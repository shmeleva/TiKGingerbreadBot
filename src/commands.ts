import TelegramBot, { Message, SendMessageOptions } from 'node-telegram-bot-api';

type Command =
  | 'editName'
  | 'editDescription'
  | 'uploadPictures'
  | 'reviewAndSubmit'
  | 'submit'
  | 'back'
  | 'listSubmissions'

type Handler = {
  after?: Command
  reply: (message: Message) => {
    message: string,
    messageOptions?: SendMessageOptions,
  },
  nextReply?: (message: Message) => {
    message: string,
    messageOptions?: SendMessageOptions,
  },
}

const buttons: Record<Command, string> = {
  editName: 'Edit name 🖋️',
  editDescription: 'Edit description 🖋️',
  uploadPictures: 'Edit pictures 🖼️',
  reviewAndSubmit: 'Review and submit ✅',
  submit: 'Submit ✅',
  listSubmissions: 'See my other submissions 📜',
  back: 'Back 🔙',
};

const toMessageOptions = (commands: Command[][]): SendMessageOptions => ({
  reply_markup: {
    keyboard: commands.map((row) => row.map((command) => ({ text: buttons[command] }))),
  },
});

export const defaultMessageOptions = toMessageOptions([
  ['editName', 'editDescription'],
  ['uploadPictures'],
  ['reviewAndSubmit'],
  ['listSubmissions'],
]);

const mockState: {latestCommand: Command | undefined} = {
  latestCommand: undefined,
};

const handlers: Record<Command, Handler> = {
  editName: {
    reply: () => ({
      message: 'OK. Send me the new name for your creation 🙌',
    }),
    // TODO: Set name in the DB.
    nextReply: () => ({
      message: '👌 The name is now updated!',
    }),
  },
  editDescription: {
    reply: () => ({
      message: 'OK. Send me the new description. Keep it brief 🙌',
    }),
    // TODO: Set description in the DB.
    nextReply: () => ({
      message: '👌 The description is now updated!',
    }),
  },
  uploadPictures: {
    reply: () => ({
      message: 'OK. Send me the new pictures. It can be one or more pictures.',
    }),
    // TODO: Set pictures in the DB.
    nextReply: () => ({
      message: '👌 Looking good! The pictures are now updated.',
    }),
  },
  reviewAndSubmit: {
    reply: () => ({
      // TODO: Send the review also and validate the fields.
      message: 'If you like how it looks, go on and press Submit ✅ We will also repost this to the Grandma Chat 🤶🎅🍪',
      messageOptions: toMessageOptions([['back', 'submit']]),
    }),
  },
  submit: {
    after: 'reviewAndSubmit',
    reply: () => ({
      // TODO: Validate the fields, mark the submission date, and repost.
      message: 'Got it! 🎉 Feel free to add another submission 🙌',
    }),
  },
  back: {
    after: 'reviewAndSubmit',
    reply: () => ({
      message: 'Anything you didn\'t like? You can still make the changes!',
    }),
  },
  listSubmissions: {
    reply: () => ({
      // TODO: Fetch all the submissions.
      message: 'You didn\'t send anything yet 🥺',
    }),
  },
};

export const handleMessage = (bot: TelegramBot, message: Message) => {
  const { text } = message;
  const { latestCommand } = mockState;

  // 1. Check if the message is a recognised command:
  const recognisedCommand = Object.entries(handlers)
    .find(([c, h]) => text === buttons[c] && !(h.after && h.after !== latestCommand));
  if (recognisedCommand) {
    const [command, handler] = recognisedCommand;
    const reply = handler.reply(message);
    bot.sendMessage(message.chat.id, reply.message, {
      ...defaultMessageOptions,
      ...reply.messageOptions ?? {},
    });
    mockState.latestCommand = command as Command;
    return;
  }

  // 2. Check if the bot expects the new name, description or pictures.
  const recognisedLatestCommand = Object.entries(handlers)
    .find(([c, h]) => c === latestCommand && h.nextReply);
  if (recognisedLatestCommand) {
    const [, handler] = recognisedLatestCommand;
    const reply = handler.nextReply(message);
    bot.sendMessage(message.chat.id, reply.message, {
      ...defaultMessageOptions,
      ...reply.messageOptions ?? {},
    });
    mockState.latestCommand = undefined;
    return;
  }

  // 3. Reply with a default message if everything else fails.
  mockState.latestCommand = undefined;
  bot.sendMessage(message.chat.id,
    `Hi, cookie ${message.from?.id}! 👋 Give your creation a name, tell us a bit more about it, add pictures and share it with the Grandma Club! 🤶🎅🍪`, defaultMessageOptions);
};
