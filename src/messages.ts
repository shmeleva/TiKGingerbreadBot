import {ISubmission} from './models'

const formatCaptionLine = (text: string | undefined, tag: '*' | '_') => {
  return (text && `${tag}${text}${tag}\n`) || ''
}

export const formatCaption = (submission: Omit<ISubmission, 'date'>) => {
  const name = formatCaptionLine(submission.name, '*')
  const description = formatCaptionLine(submission.description, '_')
  return `${name}${description}`
}

export const formatMedia = (submission: Omit<ISubmission, 'date'>) =>
  submission.media.length
    ? submission.media.map(m => ({
        type: m.mediaType,
        media: m.telegramId,
      }))
    : undefined

export const formatErrorMessage = (submission: Omit<ISubmission, 'date'>) => {
  const {name, media} = submission
  const errors = [
    !name && 'give your creation a name 🍪',
    !media.length && 'add some pictures 🖼️',
  ]
    .filter(e => e)
    .join(' and ')
  return errors.length ? `Please, ${errors}` : undefined
}
