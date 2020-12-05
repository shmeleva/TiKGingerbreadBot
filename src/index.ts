import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { handleMessage } from './commands';

require('dotenv').config();

const port = process.env.PORT || 3000;
const botApiToken = process.env.BOT_API_TOKEN;

const bot = new TelegramBot(botApiToken);

bot.on('message', (message) => {
  handleMessage(bot, message);
});

const app = express();

app.use(express.json());

app.post('/bot', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// eslint-disable-next-line no-console
app.listen(port, () => console.log(`Server is listening on ${port}`));
