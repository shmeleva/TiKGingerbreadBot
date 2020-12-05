import express from 'express'
import mongoose from 'mongoose'
import TelegramBot from 'node-telegram-bot-api'

import {processMessage} from './commands'

require('dotenv').config()

const port = process.env.PORT || 3000
const mongoUsername = process.env.MONGO_INITDB_ROOT_USERNAME
const mongoPassword = process.env.MONGO_INITDB_ROOT_PASSWORD
const mongoUrl = process.env.MONGO_URL
const botPublicUrl = process.env.BOT_PUBLIC_URL
const botApiToken = process.env.BOT_API_TOKEN

mongoose.connect(
  `mongodb://${mongoUsername}:${mongoPassword}@${mongoUrl}/gingerbread_bot?authSource=admin`,
  {
    useNewUrlParser: true,
  },
  e =>
    e
      ? console.error(`Failed to connect to MongoDB: ${e}`)
      : console.log('Connected to MongoDB')
)

const bot = new TelegramBot(botApiToken)
bot.setWebHook(`${botPublicUrl}/bot`)
bot.on('message', (message, metadata) => processMessage(bot, message, metadata))

const app = express()

app.use(express.json())

app.post('/bot', (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

app.listen(port, () => console.log(`Server is listening on ${port}`))
