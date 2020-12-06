import mongoose, {Schema, Document} from 'mongoose'

export interface IPhoto {
  telegramId: string
  telegramMediaGroupId?: string
  mediaType: 'photo' | 'video'
  date: Date
}

export interface ISubmissionBase {
  name?: string
  description?: string
  media: IPhoto[]
}

export interface ISubmissionDraft extends ISubmissionBase {
  mediaDate?: Date
}

export interface ISubmission extends ISubmissionBase {
  date: Date
  seq: number
}

export interface IUser extends Document {
  telegramId: number
  telegramUsername?: string
  telegramChatId: number
  firstName?: string
  previousCommand?: string
  draft?: ISubmissionDraft
  submissions: ISubmission[]
}

export interface ICompetition extends Document {
  seq: number
}

const CompetitionSchema: Schema = new Schema({
  seq: {type: Number, default: 0},
})

export const Competition = mongoose.model<ICompetition>(
  'Competition',
  CompetitionSchema
)

const UserSchema: Schema = new Schema({
  telegramId: {type: Number, required: true, unique: true},
  telegramUsername: {type: String},
  telegramChatId: {type: Number, required: true},
  firstName: {type: String},
  previousCommand: {type: String},
  draft: {
    name: {type: String},
    description: {type: String},
    mediaDate: {type: Date},
    media: [
      {
        telegramId: {type: String, required: true},
        telegramMediaGroupId: {type: String},
        mediaType: {type: String, required: true},
        date: {type: Date, required: true},
      },
    ],
  },
  submissions: [
    {
      name: {type: String, required: true},
      description: {type: String},
      media: [
        {
          telegramId: {type: String, required: true},
          telegramMediaGroupId: {type: String},
          mediaType: {type: String, required: true},
          date: {type: Date, required: true},
        },
      ],
      date: {type: Date, required: true},
      seq: {type: Number, required: true},
    },
  ],
})

export const User = mongoose.model<IUser>('User', UserSchema)
