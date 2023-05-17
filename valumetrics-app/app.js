const express = require('express')
const app = express()
const port = 3001

app.get('/', (req, res) => {
  res.send('Hello World!');
})

app.get('/app', )

app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`)
})
