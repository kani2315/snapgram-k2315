import { type Request, type Response } from "express";
import { Types } from "mongoose";
import { Post } from "../models/Post.model.js";
import { Save } from "../models/Save.model.js";
import { Comment } from "../models/Comment.model.js";
import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../services/storage.service.js";

// Helper to sanitize tags
const parseTags = (rawTags?: string): string[] => {
  if (!rawTags) return [];
  return rawTags
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter((tag) => tag.length > 0);
};

// ============================================================
// CREATE POST
// ============================================================
export const createPost = async (req: Request, res: Response): Promise<void> => {
  let uploadedImageId: string | null = null;

  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: "Post image file is required" });
      return;
    }

    const { caption, location, tags } = req.body;

    // 1. Stream file buffer to Cloudinary
    const uploadResult = await uploadImageToCloudinary(req.file.buffer, "snapgram/posts");
    uploadedImageId = uploadResult.imageId;

    // 2. Persist Post to MongoDB
    const newPost = await Post.create({
      caption,
      location: location || "",
      tags: parseTags(tags),
      imageUrl: uploadResult.imageUrl,
      imageId: uploadResult.imageId,
      creator: user._id,
    });

    // Populate creator details for client response
    const populatedPost = await newPost.populate("creator", "name username imageUrl bio id");

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: populatedPost.toJSON(),
    });
  } catch (error) {
    console.error("CreatePost Error:", error);

    // Compensating Transaction: Delete orphaned Cloudinary image if DB insert failed
    if (uploadedImageId) {
      await deleteImageFromCloudinary(uploadedImageId);
    }

    res.status(500).json({
      success: false,
      message: "Failed to create post.",
    });
  }
};

// ============================================================
// GET RECENT POSTS (Top 20 latest)
// ============================================================
export const getRecentPosts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("creator", "name username imageUrl bio id")
      .lean();

    // Map _id to id for client consistency
    const formattedPosts = posts.map((post) => ({
      ...post,
      id: post._id.toString(),
      $id: post._id.toString(), // Compatibility with Appwrite frontend contract
      $createdAt: post.createdAt,
    }));

    res.status(200).json({
      success: true,
      documents: formattedPosts,
    });
  } catch (error) {
    console.error("GetRecentPosts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recent posts." });
  }
};

// ============================================================
// GET INFINITE POSTS (Cursor-based pagination)
// ============================================================
export const getInfinitePosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 9, 50);
    const cursor = req.query.cursor as string | undefined;

    const queryFilter: Record<string, any> = {};
    if (cursor && Types.ObjectId.isValid(cursor)) {
      queryFilter._id = { $lt: new Types.ObjectId(cursor) };
    }

    const posts = await Post.find(queryFilter)
      .sort({ _id: -1 }) // Natural descending creation order
      .limit(limit + 1) // Fetch one extra to evaluate hasNextPage
      .populate("creator", "name username imageUrl bio id")
      .lean();

    const hasNextPage = posts.length > limit;
    const documents = hasNextPage ? posts.slice(0, limit) : posts;
    const nextCursor = hasNextPage ? documents[documents.length - 1]._id.toString() : null;

    const formattedDocs = documents.map((post) => ({
      ...post,
      id: post._id.toString(),
      $id: post._id.toString(),
      $createdAt: post.createdAt,
    }));

    res.status(200).json({
      success: true,
      documents: formattedDocs,
      nextCursor,
      hasNextPage,
    });
  } catch (error) {
    console.error("GetInfinitePosts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch paginated posts." });
  }
};

// ============================================================
// SEARCH POSTS
// ============================================================
export const searchPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const searchTerm = (req.query.searchTerm as string) || "";

    if (!searchTerm.trim()) {
      res.status(200).json({ success: true, documents: [] });
      return;
    }

    const regex = new RegExp(searchTerm.trim(), "i");

    const posts = await Post.find({
      $or: [{ caption: regex }, { tags: regex }, { location: regex }],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("creator", "name username imageUrl bio id")
      .lean();

    const formattedDocs = posts.map((post) => ({
      ...post,
      id: post._id.toString(),
      $id: post._id.toString(),
      $createdAt: post.createdAt,
    }));

    res.status(200).json({
      success: true,
      documents: formattedDocs,
    });
  } catch (error) {
    console.error("SearchPosts Error:", error);
    res.status(500).json({ success: false, message: "Failed to search posts." });
  }
};

// ============================================================
// GET POST BY ID
// ============================================================
export const getPostById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID format." });
      return;
    }

    const post = await Post.findById(id)
      .populate("creator", "name username imageUrl bio id")
      .lean();

    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    res.status(200).json({
      success: true,
      post: {
        ...post,
        id: post._id.toString(),
        $id: post._id.toString(),
        $createdAt: post.createdAt,
      },
    });
  } catch (error) {
    console.error("GetPostById Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve post." });
  }
};

// ============================================================
// GET USER'S POSTS
// ============================================================
export const getUserPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user ID format." });
      return;
    }

    const posts = await Post.find({ creator: userId })
      .sort({ createdAt: -1 })
      .populate("creator", "name username imageUrl bio id")
      .lean();

    const formattedDocs = posts.map((post) => ({
      ...post,
      id: post._id.toString(),
      $id: post._id.toString(),
      $createdAt: post.createdAt,
    }));

    res.status(200).json({
      success: true,
      documents: formattedDocs,
    });
  } catch (error) {
    console.error("GetUserPosts Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve user posts." });
  }
};

// ============================================================
// UPDATE POST
// ============================================================
export const updatePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID format." });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    // Authorization check
    if (post.creator.toString() !== user?._id.toString()) {
      res.status(403).json({ success: false, message: "Forbidden: You are not the author of this post." });
      return;
    }

    const { caption, location, tags } = req.body;

    if (caption) post.caption = caption;
    if (location !== undefined) post.location = location;
    if (tags !== undefined) post.tags = parseTags(tags);

    // If new image was uploaded
    if (req.file) {
      const oldImageId = post.imageId;
      const uploadResult = await uploadImageToCloudinary(req.file.buffer, "snapgram/posts");

      post.imageUrl = uploadResult.imageUrl;
      post.imageId = uploadResult.imageId;

      // Clean up previous image from Cloudinary
      if (oldImageId) {
        await deleteImageFromCloudinary(oldImageId);
      }
    }

    await post.save();
    const populated = await post.populate("creator", "name username imageUrl bio id");

    res.status(200).json({
      success: true,
      message: "Post updated successfully",
      post: populated.toJSON(),
    });
  } catch (error) {
    console.error("UpdatePost Error:", error);
    res.status(500).json({ success: false, message: "Failed to update post." });
  }
};

// ============================================================
// DELETE POST
// ============================================================
export const deletePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID format." });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    // Authorization check
    if (post.creator.toString() !== user?._id.toString()) {
      res.status(403).json({ success: false, message: "Forbidden: You are not authorized to delete this post." });
      return;
    }

    // 1. Delete image asset from Cloudinary
    if (post.imageId) {
      await deleteImageFromCloudinary(post.imageId);
    }

    // 2. Cascading cleanup: delete bookmark/save references and comments
    await Promise.all([
      Save.deleteMany({ post: post._id }),
      Comment.deleteMany({ post: post._id }),
    ]);

    // 3. Delete Post document
    await Post.findByIdAndDelete(post._id);

    res.status(200).json({
      success: true,
      message: "Post and associated assets deleted successfully.",
    });
  } catch (error) {
    console.error("DeletePost Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete post." });
  }
};

// ============================================================
// LIKE POST
// ============================================================
export const likePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user;
    const likesArray = req.body?.likesArray;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID format." });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    if (Array.isArray(likesArray)) {
      // Direct array update (Appwrite optimistic sync pattern)
      post.likes = likesArray
        .filter((uid: string) => Types.ObjectId.isValid(uid))
        .map((uid: string) => new Types.ObjectId(uid));
      post.likesCount = post.likes.length;
    } else if (user) {
      // Idempotent like: add user._id if not already present
      const userIdStr = user._id.toString();
      const alreadyLiked = post.likes.some((uid) => uid.toString() === userIdStr);

      if (!alreadyLiked) {
        post.likes.push(user._id);
        post.likesCount += 1;
      }
    }

    await post.save();

    res.status(200).json({
      success: true,
      message: "Post liked successfully",
      post: {
        ...post.toJSON(),
        id: post._id.toString(),
        $id: post._id.toString(),
        likes: post.likes.map((uid) => uid.toString()),
      },
    });
  } catch (error: any) {
    console.error("LikePost Error stack:", error?.stack || error);
    res.status(500).json({ success: false, message: error?.message || "Failed to update like status." });
  }
};

// ============================================================
// UNLIKE POST
// ============================================================
export const unlikePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid post ID format." });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }

    if (user) {
      const userIdStr = user._id.toString();
      const alreadyLiked = post.likes.some((uid) => uid.toString() === userIdStr);

      if (alreadyLiked) {
        post.likes = post.likes.filter((uid) => uid.toString() !== userIdStr);
        post.likesCount = Math.max(0, post.likesCount - 1);
        await post.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Post unliked successfully",
      post: {
        ...post.toJSON(),
        id: post._id.toString(),
        $id: post._id.toString(),
        likes: post.likes.map((uid) => uid.toString()),
      },
    });
  } catch (error: any) {
    console.error("UnlikePost Error:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to unlike post." });
  }
};

// ============================================================
// SAVE POST (Bookmark)
// ============================================================
export const savePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const postId = (req.params.id || req.body?.postId) as string;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!postId || !Types.ObjectId.isValid(postId)) {
      res.status(400).json({ success: false, message: "Invalid post ID format." });
      return;
    }

    // Upsert to ensure idempotent save operation
    const saveRecord = await Save.findOneAndUpdate(
      { user: user._id, post: new Types.ObjectId(postId) },
      { user: user._id, post: new Types.ObjectId(postId) },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: "Post saved successfully",
      ...(saveRecord?.toJSON() || {}),
      id: saveRecord?._id?.toString(),
      $id: saveRecord?._id?.toString(),
      post: {
        id: postId,
        $id: postId,
      },
    });
  } catch (error: any) {
    console.error("SavePost Error stack:", error?.stack || error);
    res.status(500).json({ success: false, message: error?.message || "Failed to save post." });
  }
};

// ============================================================
// DELETE SAVED POST (Remove Bookmark)
// ============================================================
export const deleteSavedPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid identifier." });
      return;
    }

    // Delete by Save Record ID or Post ID
    await Save.findOneAndDelete({
      $or: [
        { _id: new Types.ObjectId(id), user: user._id },
        { post: new Types.ObjectId(id), user: user._id },
      ],
    });

    res.status(200).json({
      status: "Ok",
      success: true,
      message: "Bookmark removed successfully.",
    });
  } catch (error) {
    console.error("DeleteSavedPost Error:", error);
    res.status(500).json({ success: false, message: "Failed to remove saved post." });
  }
};

// ============================================================
// GET USER'S SAVED POSTS
// ============================================================
export const getUserSavedPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const savedRecords = await Save.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "post",
        populate: { path: "creator", select: "name username imageUrl bio id" },
      })
      .lean();

    const formattedPosts = savedRecords
      .filter((record) => record.post)
      .map((record) => {
        const p = record.post as any;
        return {
          ...p,
          id: p._id.toString(),
          $id: p._id.toString(),
          $createdAt: p.createdAt,
          saveRecordId: record._id.toString(),
        };
      });

    res.status(200).json({
      success: true,
      documents: formattedPosts,
    });
  } catch (error) {
    console.error("GetUserSavedPosts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch saved posts." });
  }
};

// ============================================================
// CREATE COMMENT
// ============================================================
export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const user = req.user;
    const { content } = req.body;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!content || !content.trim()) {
      res.status(400).json({ success: false, message: "Comment content cannot be empty." });
      return;
    }

    const comment = await Comment.create({
      post: new Types.ObjectId(postId),
      creator: user._id,
      content: content.trim(),
    });

    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
    const populated = await comment.populate("creator", "name username imageUrl bio id");

    const creatorObj = populated.creator as any;
    res.status(201).json({
      success: true,
      ...populated.toJSON(),
      $id: populated._id.toString(),
      creator: {
        ...creatorObj.toJSON?.() || creatorObj,
        $id: creatorObj._id?.toString() || creatorObj.id,
      },
    });
  } catch (error) {
    console.error("CreateComment Error:", error);
    res.status(500).json({ success: false, message: "Failed to create comment." });
  }
};

// ============================================================
// GET POST COMMENTS
// ============================================================
export const getPostComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const comments = await Comment.find({ post: new Types.ObjectId(postId) })
      .sort({ createdAt: 1 })
      .populate("creator", "name username imageUrl bio id")
      .lean();

    const formatted = comments.map((c) => ({
      ...c,
      id: c._id.toString(),
      $id: c._id.toString(),
      creator: c.creator
        ? {
            ...(c.creator as any),
            id: (c.creator as any)._id?.toString(),
            $id: (c.creator as any)._id?.toString(),
          }
        : null,
    }));

    res.status(200).json({ success: true, documents: formatted });
  } catch (error) {
    console.error("GetPostComments Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch comments." });
  }
};

// ============================================================
// GET LIKED POSTS
// ============================================================
export const getLikedPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user ID format." });
      return;
    }

    const posts = await Post.find({ likes: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .populate("creator", "name username imageUrl bio id")
      .lean();

    const formatted = posts.map((p) => ({
      ...p,
      id: p._id.toString(),
      $id: p._id.toString(),
      $createdAt: p.createdAt,
    }));

    res.status(200).json({ success: true, documents: formatted });
  } catch (error) {
    console.error("GetLikedPosts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch liked posts." });
  }
};
