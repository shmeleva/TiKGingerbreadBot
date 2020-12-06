import {User, IUser, IPhoto, ISubmissionBase, Competition} from './models'

export const findUser = async (telegramId: number): Promise<IUser> =>
  User.findOne({telegramId})

export const findOrCreateUser = async (
  telegramId: number,
  telegramUsername?: string,
  telegramChatId?: number
): Promise<IUser> => {
  const user =
    (await User.findOne({telegramId})) ||
    (await User.create({
      telegramId,
      telegramUsername,
      telegramChatId,
      submissions: [],
    }))
  return user
}

export const createDraft = async (telegramId: number): Promise<IUser> => {
  const user = await User.findOneAndUpdate(
    {telegramId},
    {
      $set: {
        draft: {media: []},
      },
    },
    {new: true}
  )
  return user
}

export const updateDraftName = async (telegramId: number, name: string) => {
  await User.updateOne({telegramId}, {$set: {'draft.name': name}})
}

export const updateDraftDescription = async (
  telegramId: number,
  description: string
) => {
  await User.updateOne({telegramId}, {$set: {'draft.description': description}})
}

export const updateDraftMediaDate = async (
  telegramId: number,
  mediaDate: Date
) => {
  await User.updateOne({telegramId}, {$set: {'draft.mediaDate': mediaDate}})
}

export const updatePreviousCommand = async (
  telegramId: number,
  command: string
) => {
  await User.updateOne({telegramId}, {$set: {previousCommand: command}})
}

export const insertMedia = async (telegramId: number, media: IPhoto) => {
  await User.updateOne({telegramId}, {$push: {'draft.media': media}})
}

export const getDraft = async (
  telegramId: number
): Promise<ISubmissionBase> => {
  const user = await User.findOne({telegramId})
  if (!user) {
    return undefined
  }

  const {name, description, mediaDate, media} = user.draft
  return {
    name,
    description,
    media: media.filter(m => m.date.getTime() === mediaDate.getTime()),
  }
}

export const insertSubmission = async (
  telegramId: number,
  submissionData: ISubmissionBase
) => {
  const competition = await Competition.findOneAndUpdate(
    {},
    {$inc: {seq: 1}},
    {upsert: true, new: true, setDefaultsOnInsert: true}
  )
  const submission = {
    ...submissionData,
    date: new Date(),
    seq: competition.seq,
  }
  const user = await User.findOneAndUpdate(
    {telegramId},
    {
      $set: {
        draft: undefined,
      },
      $push: {
        submissions: submission,
      },
    },
    {new: true}
  )
  return {user, submission}
}
