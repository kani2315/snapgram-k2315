import { Models } from "appwrite";

export interface IUserDocument extends Models.Document {
  name: string;
  username: string;
  email: string;
  imageUrl: string;
  bio: string;
  saves: any[];
  follower: any[];
  following: any[];
  posts?: IPostDocument[];
  imageId: string;
}

export interface IPostDocument extends Models.Document {
  caption: string;
  tags: string[];
  imageUrl: string;
  imageId: string;
  location: string;
  creator: IUserDocument;
  likes: IUserDocument[];
}

export type INavLink = {
  imgURL: string;
  route: string;
  label: string;
};

export type IUpdateUser = {
  userId: string;
  name: string;
  bio: string;
  imageId: string;
  imageUrl: string | string;
  file: File[];
};

export type INewPost = {
  userId: string;
  caption: string;
  file: File[];
  location?: string;
  tags?: string;
};

export type IUpdatePost = {
  postId: string;
  caption: string;
  imageId: string;
  imageUrl: string;
  file: File[];
  location?: string;
  tags?: string;
};

export type IUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  imageUrl: string;
  bio: string;
  following?: string[];
  saves?: string[];
};

export type INewUser = {
  name: string;
  email: string;
  username: string;
  password: string;
};
