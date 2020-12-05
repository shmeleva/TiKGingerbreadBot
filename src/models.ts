import mongoose, { Schema, Document } from 'mongoose';

export interface ISubmission extends Document {
  name?: string,
  description?: string,
  images: string[],
  latestCommand?: string,
  submittedAt?: Date,
}

export interface IUser extends Document {
  telegramId: string,
  telegramUsername: string,
  firstName?: string,
  lastName?: string,
  submissions: ISubmission[]
}

export const UserSchema: Schema = new Schema({
  telegramId: { type: String, required: true, unique: true },
  telegramUsername: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  submissions: [{
    name: { type: String },
    description: { type: String },
    images: [{ type: String }],
    latestCommand: { type: String },
    submittedAt: { type: Date },
  }],
});

export default mongoose.model<IUser>('User', UserSchema);
