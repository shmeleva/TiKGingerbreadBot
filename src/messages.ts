import {ISubmissionBase, IUser} from './models'
import {InputMedia} from 'node-telegram-bot-api'

const formatCaptionLine = (
  text: string | undefined,
  tag: '*' | '_',
  attribution: string
) => {
  return (text && `${tag}${text}${tag}${attribution}\n`) || ''
}

export const formatCaption = (submission: ISubmissionBase, user?: IUser) => {
  const author = user?.telegramUsername
    ? `@${user.telegramUsername}`
    : user?.firstName
  const attribution = author ? ` by ${author}` : ''
  const name = formatCaptionLine(submission.name, '*', attribution)
  const description = formatCaptionLine(submission.description, '_', '')
  return `${name}${description}`
}

export const formatMedia = (
  submission: ISubmissionBase,
  caption?: string
): InputMedia[] =>
  submission.media.length
    ? submission.media.map((m, i) => ({
        type: m.mediaType,
        media: m.telegramId,
        caption: i === 0 ? caption : undefined,
        parse_mode: 'Markdown',
      }))
    : undefined

export const formatErrorMessage = (submission: ISubmissionBase) => {
  const {name, media} = submission
  const errors = [
    !name && 'give your creation a name 🍪',
    !media.length && 'add some pictures 🖼️',
  ]
    .filter(e => e)
    .join(' and ')
  return errors.length ? `Please, ${errors}` : undefined
}
