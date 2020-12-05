import TelegramBot, {
  Message,
  SendMessageOptions,
  Metadata,
} from 'node-telegram-bot-api'
import {
  findOrCreateUser,
  updateDraftName,
  updateDraftDescription,
  updateDraftMediaDate,
  getCurrentSubmission,
  updatePreviousCommand,
  insertMedia,
} from './queues'

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
    message: Message,
    metadata: Metadata
  ) => Promise<{
    message: string
    messageOptions?: SendMessageOptions
  }>
  nextMessageType?: string[]
  nextReply?: (
    telegramId: number,
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
    nextReply: async (telegramId, message) => {
      await updateDraftName(telegramId, message.text)
      return {
        message: '👌 The name is now updated!',
      }
    },
  },
  editDescription: {
    reply: async () => ({
      message: 'OK. Send me the new description. Keep it brief 🙌',
    }),
    nextMessageType: ['text'],
    nextReply: async (telegramId, message) => {
      await updateDraftDescription(telegramId, message.text)
      return {
        message: '👌 The description is now updated!',
      }
    },
  },
  uploadPictures: {
    reply: async () => ({
      message: 'OK. Send me the new pictures. It can be one or more pictures.',
    }),
    nextMessageType: ['photo', 'video'],
    nextReply: async (telegramId, message) => {
      await updateDraftMediaDate(telegramId, new Date(message.date * 1000))
      return {
        message: '👌 Looking good! The pictures are now updated.',
      }
    },
  },
  reviewAndSubmit: {
    reply: async telegramId => {
      // TODO: Send the review also and validate the fields.
      const submission = await getCurrentSubmission(telegramId)
      return {
        message: `Name: ${submission.name}
        Description: ${submission.description}
        Media: ${submission.media.length}
          
        If you like how it looks, go on and press Submit ✅ We will also repost this to the Grandma Chat 🤶🎅🍪`,
        messageOptions: toMessageOptions([['back', 'submit']]),
      }
    },
  },
  submit: {
    after: 'reviewAndSubmit',
    reply: async () => ({
      // TODO: Validate the fields, mark the submission date, and repost.
      message: 'Got it! 🎉 Feel free to add another submission 🙌',
    }),
  },
  back: {
    after: 'reviewAndSubmit',
    reply: async () => ({
      message: "Anything you didn't like? You can still make the changes!",
    }),
  },
  listSubmissions: {
    reply: async () => ({
      // TODO: Fetch all the submissions.
      message: "You didn't send anything yet 🥺",
    }),
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

  const user = await findOrCreateUser(telegramUserId, username)
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
    const reply = await handler.reply(telegramUserId, message, metadata)

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
      mediaType: 'video',
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

    const reply = await handler.nextReply(telegramUserId, message, metadata)
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

  /*await bot.sendMediaGroup(message.chat.id, [{type: 'photo', media: photoId}], {
    disable_notification: true,
  })*/
}
