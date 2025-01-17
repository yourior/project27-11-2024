const path = require('path')
const express = require('express')

const app = express()
const port = process.env.PORT || 3000

async function start() {
  app.set('view engine', 'pug')
  app.set('views', path.join(__dirname, 'views'))
  app.use(express.static(path.join(__dirname, 'public')))

  app.listen(port, () => {
    console.log(`App listening on http://localhost:${port}`)
  })

  app.get('/', (req, res) => res.render('index'));
}

start()
