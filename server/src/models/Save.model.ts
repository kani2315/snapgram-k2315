import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ISaveSchema extends Document {
  user: Types.ObjectId;
  post: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const saveSchema = new Schema<ISaveSchema>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Post ID is required"],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        ret.$id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent duplicate saves by the same user on the same post
saveSchema.index({ user: 1, post: 1 }, { unique: true });

export const Save: Model<ISaveSchema> = mongoose.model<ISaveSchema>("Save", saveSchema);
