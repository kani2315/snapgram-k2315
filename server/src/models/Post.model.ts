import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPostSchema extends Document {
  caption: string;
  tags: string[];
  imageUrl: string;
  imageId: string;
  location: string;
  creator: Types.ObjectId;
  likes: Types.ObjectId[];
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPostSchema>(
  {
    caption: {
      type: String,
      required: [true, "Caption is required"],
      trim: true,
      maxlength: [2200, "Caption cannot exceed 2200 characters"],
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    imageUrl: {
      type: String,
      required: [true, "Image URL is required"],
    },
    imageId: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Post must belong to a creator"],
      index: true,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Compound indexes for optimal feed and profile query performance
postSchema.index({ createdAt: -1 });
postSchema.index({ creator: 1, createdAt: -1 });

export const Post: Model<IPostSchema> = mongoose.model<IPostSchema>("Post", postSchema);
