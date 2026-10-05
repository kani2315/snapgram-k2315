import { Router } from "express";
import {
  getUsers,
  getUserById,
  updateUser,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
  toggleFollowUser,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";

const router = Router();

// Public User Endpoints
router.get("/", getUsers);
router.get("/:id", getUserById);
router.get("/:id/followers", getUserFollowers);
router.get("/:id/following", getUserFollowing);

// Protected User Endpoints
router.put("/:id", requireAuth, uploadSingleImage, updateUser);
router.patch("/:id", requireAuth, uploadSingleImage, updateUser);
router.post("/:id/follow", requireAuth, followUser);
router.delete("/:id/follow", requireAuth, unfollowUser);

export default router;
