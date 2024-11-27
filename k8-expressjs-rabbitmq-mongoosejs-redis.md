Here’s a simple example of setting up a Node.js application using **Express.js**, **RabbitMQ**, **Redis**, and **Mongoose.js** (with Azure Cosmos DB) inside **Kubernetes**. The setup involves creating Docker images for each service, configuring Kubernetes deployments, and managing communication between the services.

### Step 1: Dockerize Your Node.js Application

You need a `Dockerfile` for your Node.js app to containerize it. The following Dockerfile assumes you're using **Express.js**, **Mongoose.js**, **RabbitMQ**, and **Redis**.

```dockerfile
# Use official Node.js image
FROM node:16

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
```

### Step 2: Create Kubernetes Configuration Files

Now, let’s create Kubernetes deployment and service configuration files for the Node.js app, RabbitMQ, Redis, and MongoDB (Cosmos DB connection).

#### 1. **Node.js App Deployment (express-app.yaml)**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-app
spec:
  replicas: 2  # You can scale based on your needs
  selector:
    matchLabels:
      app: nodejs-app
  template:
    metadata:
      labels:
        app: nodejs-app
    spec:
      containers:
        - name: nodejs-app
          image: <your_docker_image>  # Replace with your Docker image name
          ports:
            - containerPort: 3000
          env:
            - name: MONGO_URI
              valueFrom:
                secretKeyRef:
                  name: cosmos-db-secrets
                  key: cosmos-connection-string
            - name: RABBITMQ_URL
              value: "amqp://rabbitmq-service:5672"
            - name: REDIS_URL
              value: "redis-service:6379"
---
apiVersion: v1
kind: Service
metadata:
  name: nodejs-app
spec:
  selector:
    app: nodejs-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
```

#### 2. **RabbitMQ Deployment (rabbitmq.yaml)**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
        - name: rabbitmq
          image: "rabbitmq:management"
          ports:
            - containerPort: 5672
            - containerPort: 15672  # RabbitMQ management UI
---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq-service
spec:
  selector:
    app: rabbitmq
  ports:
    - protocol: TCP
      port: 5672
      targetPort: 5672
```

#### 3. **Redis Deployment (redis.yaml)**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: "redis:alpine"
          ports:
            - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
spec:
  selector:
    app: redis
  ports:
    - protocol: TCP
      port: 6379
      targetPort: 6379
```

### Step 3: Mongoose.js Setup for Azure Cosmos DB

In your Node.js app, use **Mongoose.js** to connect to **Azure Cosmos DB** using a connection string from an environment variable.

```js
const mongoose = require('mongoose');

// Retrieve the Cosmos DB connection string from environment variable
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to Azure Cosmos DB");
  })
  .catch(err => {
    console.error("Error connecting to Cosmos DB:", err);
  });
```

### Step 4: Use RabbitMQ for Message Queueing in Node.js App

In your Node.js app, use **RabbitMQ** to queue tasks (e.g., from different endpoints):

```js
const amqp = require('amqplib');

async function connectToRabbitMQ() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('task_queue', { durable: true });

  // Send a task to the queue
  function sendTask(task) {
    channel.sendToQueue('task_queue', Buffer.from(task), { persistent: true });
  }

  return { sendTask };
}

// Example usage
connectToRabbitMQ().then(({ sendTask }) => {
  sendTask('Hello from Node.js app!');
});
```

### Step 5: Kubernetes Secrets for Cosmos DB

To securely store your Cosmos DB connection string, create a Kubernetes secret:

```bash
kubectl create secret generic cosmos-db-secrets --from-literal=cosmos-connection-string='your_cosmos_db_connection_string'
```

### Step 6: Deploy to Kubernetes

1. **Apply all Kubernetes deployments**:

   ```bash
   kubectl apply -f rabbitmq.yaml
   kubectl apply -f redis.yaml
   kubectl apply -f express-app.yaml
   ```

2. **Verify your pods** are running:

   ```bash
   kubectl get pods
   ```

3. **Access your Node.js app**: Depending on your Kubernetes setup, you may expose your app using a LoadBalancer or port forwarding. For example, to forward the local port:

   ```bash
   kubectl port-forward svc/nodejs-app 8080:80
   ```

4. **Access RabbitMQ Management UI**: To access RabbitMQ's management UI, forward the port:

   ```bash
   kubectl port-forward svc/rabbitmq-service 15672:15672
   ```

### Conclusion

This setup creates a **Node.js app** running on **Kubernetes** using **Express.js**, **RabbitMQ**, **Redis**, and **Azure Cosmos DB**. The Node.js app sends tasks to RabbitMQ, which are processed by worker processes running in separate pods. Redis is used for in-memory caching or other key-value operations, and Mongoose.js connects to Cosmos DB using a secure connection string stored in Kubernetes secrets.

This approach allows you to scale the app horizontally (by increasing the number of replicas) and leverage RabbitMQ for decoupling task execution.