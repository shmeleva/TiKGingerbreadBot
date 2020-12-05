import User, {IUser, IPhoto, ISubmission} from './models'

export const findOrCreateUser = async (
  telegramId: number,
  telegramUsername?: string
): Promise<IUser> => {
  const user =
    (await User.findOne({telegramId})) ||
    (await User.create({
      telegramId,
      telegramUsername,
      draft: {media: []},
      submissions: [],
    }))
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
  await User.updateOne({telegramId}, {$set: {'draft.previousCommand': command}})
}

export const insertMedia = async (telegramId: number, media: IPhoto) => {
  await User.updateOne({telegramId}, {$push: {'draft.media': media}})
}

export const getCurrentSubmission = async (
  telegramId: number
): Promise<Omit<ISubmission, 'date'>> => {
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
  submission: ISubmission
) => {
  await User.updateOne(
    {telegramId},
    {
      $set: {
        draft: {media: []},
      },
      $push: {
        submissions: submission,
      },
    }
  )
}
