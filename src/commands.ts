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
  getDraft,
  updatePreviousCommand,
  insertMedia,
  insertSubmission,
  createDraft,
  findUser,
} from './queues'
import {formatErrorMessage, formatCaption, formatMedia} from './messages'

require('dotenv').config()
const chatIds = [process.env.GRANDMA_CHAT_ID, process.env.COMPETITION_CHAT_ID]

export type Command =
  | 'newSubmission'
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
    message?: string
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
  newSubmission: 'New submission ➕',
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

const startingMessageOptions = toMessageOptions([
  ['newSubmission'],
  ['listSubmissions'],
])

const editingMessageOptions = toMessageOptions([
  ['editName', 'editDescription'],
  ['uploadPictures'],
  ['reviewAndSubmit'],
  ['listSubmissions'],
])

const submittingMessageOptions = toMessageOptions([['back', 'submit']])

const defaultMessageOptions = async telegramId => {
  const user = await findUser(telegramId)
  return user?.draft?.media ? editingMessageOptions : startingMessageOptions
}

const handlers: Record<Command, Handler> = {
  newSubmission: {
    reply: async telegramId => {
      await createDraft(telegramId)
      return {
        message:
          'Give your creation a name, tell us a bit more about it, add pictures and share it with the Grandma Club! 🤶🎅🍪',
      }
    },
  },
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
      const submission = await getDraft(telegramId)
      const caption = formatCaption(submission)
      const error = formatErrorMessage(submission)

      return error
        ? submission.media.length
          ? {
              media: formatMedia(submission, `${caption}\n${error}`),
            }
          : {
              message: `${caption}\n${error}`,
            }
        : {
            media: formatMedia(submission, `${caption}`),
            message:
              'If you like how it looks, go on and press Submit ✅ We will also repost this to the Grandma Chat 🤶🎅🍪',
            messageOptions: submittingMessageOptions,
          }
    },
  },
  submit: {
    after: 'reviewAndSubmit',
    reply: async (telegramId, bot) => {
      const submissionData = await getDraft(telegramId)
      const error = formatErrorMessage(submissionData)
      if (error) {
        return {
          message: error,
        }
      }

      const {user, submission} = await insertSubmission(
        telegramId,
        submissionData
      )

      const caption = `🎊 #GingerbreadCompetition2020 Submission #${
        submission.seq
      }\n\n${formatCaption(submissionData, user)}`
      const media = formatMedia(submissionData, caption)

      chatIds.forEach(async chatId => {
        try {
          chatId && (await bot.sendMediaGroup(chatId, media))
        } catch (e) {
          console.error(e)
        }
      })

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

  const {previousCommand} = user

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
      await bot.sendMediaGroup(message.chat.id, reply.media)
    }
    if (reply.message) {
      await bot.sendMessage(
        message.chat.id,
        reply.message,
        reply.messageOptions || (await defaultMessageOptions(telegramUserId))
      )
    }
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
  if (user.draft?.media && recognisedLatestCommand) {
    const [command, handler] = recognisedLatestCommand

    if (
      handler.nextMessageType &&
      !handler.nextMessageType.includes(metadata.type)
    ) {
      await updatePreviousCommand(telegramUserId, command)
      return
    }

    const reply = await handler.nextReply(
      telegramUserId,
      bot,
      message,
      metadata
    )
    await bot.sendMessage(
      message.chat.id,
      reply.message,
      reply.messageOptions || (await defaultMessageOptions(telegramUserId))
    )

    return
  }

  if (metadata.type === 'text') {
    if (user.draft?.media) {
      await bot.sendMessage(
        message.chat.id,
        'Give your creation a name, tell us a bit more about it, add pictures and share it with the Grandma Club! 🤶🎅🍪',
        editingMessageOptions
      )
    } else {
      await bot.sendMessage(
        message.chat.id,
        'Hi, cookie! 👋 Start by creating a new submission.',
        startingMessageOptions
      )
    }
  }
}
