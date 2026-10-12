import { Router } from "express";
import {
  createPost,
  getRecentPosts,
  getInfinitePosts,
  searchPosts,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  savePost,
  deleteSavedPost,
  getUserSavedPosts,
  createComment,
  getPostComments,
  getLikedPosts,
} from "../controllers/post.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";

const router = Router();

// Public Read Endpoints
router.get("/recent", getRecentPosts);
router.get("/infinite", getInfinitePosts);
router.get("/search", searchPosts);
router.get("/user/:userId", getUserPosts);
router.get("/liked/:userId", getLikedPosts);

// Protected Social Interactions (Bookmarks & Likes & Comments)
router.get("/saved", requireAuth, getUserSavedPosts);
router.post("/save", requireAuth, savePost);
router.post("/:id/save", requireAuth, savePost);
router.delete("/saved/:id", requireAuth, deleteSavedPost);
router.delete("/:id/save", requireAuth, deleteSavedPost);
router.put("/:id/like", requireAuth, likePost);
router.post("/:id/like", requireAuth, likePost);
router.delete("/:id/like", requireAuth, unlikePost);

// Comments
router.get("/:id/comments", getPostComments);
router.post("/:id/comments", requireAuth, createComment);

// Single Post Read
router.get("/:id", getPostById);

// Protected CRUD Mutations
router.post("/", requireAuth, uploadSingleImage, createPost);
router.put("/:id", requireAuth, uploadSingleImage, updatePost);
router.patch("/:id", requireAuth, uploadSingleImage, updatePost);
router.delete("/:id", requireAuth, deletePost);

export default router;
