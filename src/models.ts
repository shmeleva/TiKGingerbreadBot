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
  previousCommand?: string
}

export interface ISubmission extends ISubmissionBase {
  date: Date
}

export interface IUser extends Document {
  telegramId: number
  telegramUsername?: string
  firstName?: string
  draft: ISubmissionDraft
  submissions: ISubmission[]
}

const UserSchema: Schema = new Schema({
  telegramId: {type: Number, required: true, unique: true},
  telegramUsername: {type: String},
  firstName: {type: String},
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
    previousCommand: {type: String},
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
          date: {type: Date},
        },
      ],
      date: {type: Date, required: true},
    },
  ],
})

export default mongoose.model<IUser>('User', UserSchema)
