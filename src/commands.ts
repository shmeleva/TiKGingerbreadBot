import TelegramBot, {
  Message,
  SendMessageOptions,
  Metadata,
  InputMedia,
} from 'node-telegram-bot-api'
import {
  findOrCreateUser,
  updateDraftName,
  updateDraftDescription,
  updateDraftMediaDate,
  getCurrentSubmission,
  updatePreviousCommand,
  insertMedia,
  insertSubmission,
} from './queues'
import {formatErrorMessage, formatCaption, formatMedia} from './messages'

require('dotenv').config()
const grandmaChatId = `@${process.env.GRANDMA_CHAT_ID}`

export type Command =
  | 'editName'
  | 'editDescription'
  | 'uploadPictures'
  | 'reviewAndSubmit'
  | 'submit'
  | 'back'
  | 'listSubmissions'

type Handler = {
  after?: Command
  reply: (
    telegramId: number,
    bot: TelegramBot,
    message: Message,
    metadata: Metadata
  ) => Promise<{
    media?: InputMedia[]
    message: string
    messageOptions?: SendMessageOptions
  }>
  nextMessageType?: string[]
  nextReply?: (
    telegramId: number,
    bot: TelegramBot,
    message: Message,
    metadata: Metadata
  ) => Promise<
    | {
        message: string
        messageOptions?: SendMessageOptions
      }
    | undefined
  >
}

const buttons: Record<Command, string> = {
  editName: 'Edit name 🖋️',
  editDescription: 'Edit description 🖋️',
  uploadPictures: 'Edit pictures 🖼️',
  reviewAndSubmit: 'Review and submit ✅',
  submit: 'Submit ✅',
  listSubmissions: 'See my other submissions 📜',
  back: 'Back 🔙',
}

const toMessageOptions = (commands: Command[][]): SendMessageOptions => ({
  parse_mode: 'Markdown',
  reply_markup: {
    keyboard: commands.map(row =>
      row.map(command => ({text: buttons[command]}))
    ),
  },
})

export const defaultMessageOptions = toMessageOptions([
  ['editName', 'editDescription'],
  ['uploadPictures'],
  ['reviewAndSubmit'],
  ['listSubmissions'],
])

const handlers: Record<Command, Handler> = {
  editName: {
    reply: async () => ({
      message: 'OK. Send me the new name for your creation 🙌',
    }),
    nextMessageType: ['text'],
    nextReply: async (telegramId, _, message) => {
      await updateDraftName(telegramId, message.text)
      return {
        message: '👌 The name is now updated!',
      }
    },
  },
  editDescription: {
    reply: async () => ({
      message: 'OK. Send me the new description. Keep it short 🙌',
    }),
    nextMessageType: ['text'],
    nextReply: async (telegramId, _, message) => {
      await updateDraftDescription(telegramId, message.text)
      return {
        message: '👌 The description is now updated!',
      }
    },
  },
  uploadPictures: {
    reply: async () => ({
      message:
        'OK. Send me the new pictures. If you want to add more than one picture, send them all at once in a single message. Videos are also fine 🎬',
    }),
    nextMessageType: ['photo', 'video'],
    nextReply: async (telegramId, _, message) => {
      await updateDraftMediaDate(telegramId, new Date(message.date * 1000))
      return {
        message: '👌 Looking good! The pictures are now updated.',
      }
    },
  },
  reviewAndSubmit: {
    reply: async telegramId => {
      const submission = await getCurrentSubmission(telegramId)

      const caption = formatCaption(submission)
      const media = formatMedia(submission)
      const error = formatErrorMessage(submission)

      return error
        ? {
            media,
            message: `${caption}\n${error}`,
          }
        : {
            media,
            message: `${caption}\nIf you like how it looks, go on and press Submit ✅ We will also repost this to the Grandma Chat 🤶🎅🍪`,
            messageOptions: toMessageOptions([['back', 'submit']]),
          }
    },
  },
  submit: {
    after: 'reviewAndSubmit',
    reply: async (telegramId, bot) => {
      const submission = await getCurrentSubmission(telegramId)
      const error = formatErrorMessage(submission)
      if (error) {
        return {
          message: error,
        }
      }

      await insertSubmission(telegramId, {...submission, date: new Date()})

      await bot.sendMediaGroup(grandmaChatId, formatMedia(submission), {
        disable_notification: true,
      })
      await bot.sendMessage(
        grandmaChatId,
        `New Gingerbread Competition submission 🎊\n\n${formatCaption(
          submission
        )}`,
        {parse_mode: 'Markdown'}
      )

      return {
        message: 'Got it! 🎉 Feel free to add another submission 🙌',
      }
    },
  },
  back: {
    after: 'reviewAndSubmit',
    reply: async () => ({
      message: "Anything you didn't like? You can still make the changes!",
    }),
  },
  listSubmissions: {
    reply: async telegramId => {
      const user = await findOrCreateUser(telegramId)
      if (!user?.submissions?.length) {
        return {
          message: "You didn't send anything yet 🥺",
        }
      }
      return {
        message: `${user.submissions
          .map(s => `> ${formatCaption(s)}`)
          .join('\n')}`,
      }
    },
  },
}

export const processMessage = async (
  bot: TelegramBot,
  message: Message,
  metadata: Metadata
) => {
  const {text} = message

  const {id: telegramUserId, username} = message.from
  if (!telegramUserId) {
    return
  }

  const user = await findOrCreateUser(telegramUserId, username, message.chat.id)
  if (!user) {
    return
  }

  const {previousCommand} = user.draft

  const recognisedCommand =
    metadata.type === 'text' &&
    Object.entries(handlers).find(
      ([c, h]) =>
        text === buttons[c] && !(h.after && h.after !== previousCommand)
    )
  if (recognisedCommand) {
    const [command, handler] = recognisedCommand
    const reply = await handler.reply(telegramUserId, bot, message, metadata)

    if (reply.media) {
      await bot.sendMediaGroup(message.chat.id, reply.media, {
        disable_notification: true,
      })
    }
    await bot.sendMessage(message.chat.id, reply.message, {
      ...defaultMessageOptions,
      ...(reply.messageOptions ?? {}),
    })
    await updatePreviousCommand(telegramUserId, command)

    return
  }

  await updatePreviousCommand(telegramUserId, undefined)

  if (metadata.type === 'photo' && message.photo.length) {
    const [photo] = message.photo.slice(-1)
    await insertMedia(telegramUserId, {
      telegramId: photo.file_id,
      telegramMediaGroupId: message.media_group_id,
      mediaType: 'photo',
      date: new Date(message.date * 1000),
    })
  }

  if (metadata.type === 'video' && message.video) {
    await insertMedia(telegramUserId, {
      telegramId: message.video.file_id,
      telegramMediaGroupId: message.media_group_id,
      mediaType: 'video',
      date: new Date(message.date * 1000),
    })
  }

  const recognisedLatestCommand = Object.entries(handlers).find(
    ([c, h]) => c === previousCommand && h.nextReply
  )
  if (recognisedLatestCommand) {
    const [, handler] = recognisedLatestCommand

    if (
      handler.nextMessageType &&
      !handler.nextMessageType.includes(metadata.type)
    ) {
      return
    }

    const reply = await handler.nextReply(
      telegramUserId,
      bot,
      message,
      metadata
    )
    await bot.sendMessage(message.chat.id, reply.message, {
      ...defaultMessageOptions,
      ...(reply.messageOptions ?? {}),
    })

    return
  }

  if (metadata.type === 'text') {
    await bot.sendMessage(
      message.chat.id,
      'Hi, cookie! 👋 Give your creation a name, tell us a bit more about it, add pictures and share it with the Grandma Club! 🤶🎅🍪',
      defaultMessageOptions
    )
  }
}
