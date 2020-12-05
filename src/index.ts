import express from 'express'
import mongoose from 'mongoose'
import TelegramBot from 'node-telegram-bot-api'

import {processMessage} from './commands'

require('dotenv').config()

const port = process.env.PORT || 3000
const botApiToken = process.env.BOT_API_TOKEN

mongoose.connect(
  'mongodb://username:password@localhost/test?authSource=admin',
  {
    useNewUrlParser: true,
    auth: {
      user: 'username',
      password: 'password',
    },
  },
  e =>
    e
      ? console.error(`Failed to connect to MongoDB: ${e}`)
      : console.log('Connected to MongoDB')
)

const bot = new TelegramBot(botApiToken)
bot.on('message', (message, metadata) => processMessage(bot, message, metadata))

const app = express()

app.use(express.json())

app.post('/bot', (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

// eslint-disable-next-line no-console
app.listen(port, () => console.log(`Server is listening on ${port}`))
