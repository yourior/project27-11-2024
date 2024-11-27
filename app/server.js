const express = require('express');
const mongoose = require('mongoose');
const amqplib = require('amqplib');
const Redis = require('ioredis');

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

// MongoDB setup
const mongoUrl = 'mongodb://mongodb-service:27017/mydb';
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

// Mongoose schema and model
const dataSchema = new mongoose.Schema({
  name: String,
  value: String,
});
const DataModel = mongoose.model('Data', dataSchema);

// Redis setup
const redis = new Redis({ host: 'redis-service', port: 6379 });
redis.on('connect', () => console.log('Connected to Redis'));

// RabbitMQ setup
let channel;
const rabbitmqUrl = 'amqp://rabbitmq-service:5672';
amqplib.connect(rabbitmqUrl)
  .then(conn => conn.createChannel())
  .then(ch => {
    channel = ch;
    console.log('Connected to RabbitMQ');
    channel.assertQueue('data-queue');
  })
  .catch(err => console.error('Failed to connect to RabbitMQ', err));

// Helper: Publish to RabbitMQ
function publishToQueue(queue, message) {
  if (channel) {
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  }
}

// Endpoint 1: Register data
app.post('/register', async (req, res) => {
  const { name, value } = req.body;
  if (!name || !value) return res.status(400).send({ error: 'Name and value are required' });

  try {
    // Save to MongoDB
    const data = new DataModel({ name, value });
    const savedData = await data.save();

    // Cache in Redis
    await redis.set(`data:${savedData._id}`, JSON.stringify(savedData));

    // Publish to RabbitMQ
    publishToQueue('data-queue', { action: 'register', data: savedData });

    res.status(201).send(savedData);
  } catch (err) {
    console.error('Error saving data:', err);
    res.status(500).send({ error: 'Failed to register data' });
  }
});

// Endpoint 2: Retrieve all data
app.get('/data', async (req, res) => {
  try {
    // Check cache first
    const cachedData = await redis.get('all-data');
    if (cachedData) return res.status(200).send(JSON.parse(cachedData));

    // Fetch from MongoDB
    const data = await DataModel.find();
    await redis.set('all-data', JSON.stringify(data), 'EX', 60); // Cache for 60 seconds

    // Publish to RabbitMQ
    publishToQueue('data-queue', { action: 'retrieve', data });

    res.status(200).send(data);
  } catch (err) {
    console.error('Error retrieving data:', err);
    res.status(500).send({ error: 'Failed to retrieve data' });
  }
});

// Endpoint 3: Remove data by ID
app.delete('/data/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Remove from MongoDB
    const removedData = await DataModel.findByIdAndDelete(id);
    if (!removedData) return res.status(404).send({ error: 'Data not found' });

    // Remove from Redis
    await redis.del(`data:${id}`);
    await redis.del('all-data'); // Invalidate all-data cache

    // Publish to RabbitMQ
    publishToQueue('data-queue', { action: 'remove', data: id });

    res.status(200).send({ message: 'Data removed', id });
  } catch (err) {
    console.error('Error removing data:', err);
    res.status(500).send({ error: 'Failed to remove data' });
  }
});

app.listen(port, () => console.log(`Express server running on port ${port}`));
