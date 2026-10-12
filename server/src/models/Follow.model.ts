import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IFollowSchema extends Document {
  follower: Types.ObjectId;
  following: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const followSchema = new Schema<IFollowSchema>(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Follower ID is required"],
      index: true,
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Following ID is required"],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent duplicate follows
followSchema.index({ follower: 1, following: 1 }, { unique: true });

export const Follow: Model<IFollowSchema> = mongoose.model<IFollowSchema>("Follow", followSchema);
