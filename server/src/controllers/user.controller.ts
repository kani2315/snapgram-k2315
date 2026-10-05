import { type Request, type Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/User.model.js";
import { Post } from "../models/Post.model.js";
import { Follow } from "../models/Follow.model.js";
import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../services/storage.service.js";

// ============================================================
// GET USERS (Top Creators)
// ============================================================
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("name username imageUrl bio createdAt updatedAt")
      .lean();

    const formattedUsers = users.map((u) => ({
      ...u,
      id: u._id.toString(),
      $id: u._id.toString(),
      $createdAt: u.createdAt,
    }));

    res.status(200).json({
      success: true,
      documents: formattedUsers,
    });
  } catch (error) {
    console.error("GetUsers Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users." });
  }
};

// ============================================================
// GET USER BY ID (With Posts & Follow stats)
// ============================================================
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user ID format." });
      return;
    }

    const user = await User.findById(userId).select("-refreshToken").lean();
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    // Parallel fetch: user's posts, follower count, following count
    const [posts, followersCount, followingCount] = await Promise.all([
      Post.find({ creator: user._id }).sort({ createdAt: -1 }).lean(),
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
    ]);

    const formattedPosts = posts.map((p) => ({
      ...p,
      id: p._id.toString(),
      $id: p._id.toString(),
      $createdAt: p.createdAt,
    }));

    res.status(200).json({
      success: true,
      ...user,
      id: user._id.toString(),
      $id: user._id.toString(),
      $createdAt: user.createdAt,
      posts: formattedPosts,
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("GetUserById Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user profile." });
  }
};

// ============================================================
// UPDATE USER PROFILE (With Avatar Media Upload)
// ============================================================
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;
    const currentUser = req.user;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user ID format." });
      return;
    }

    // Authorization check
    if (currentUser?._id.toString() !== userId) {
      res.status(403).json({ success: false, message: "Forbidden: You cannot modify other user profiles." });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const { name, bio } = req.body;

    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();

    // If new profile picture was uploaded
    if (req.file) {
      const oldImageId = user.imageId;
      const uploadResult = await uploadImageToCloudinary(req.file.buffer, "snapgram/avatars");

      user.imageUrl = uploadResult.imageUrl;
      user.imageId = uploadResult.imageId;

      if (oldImageId) {
        await deleteImageFromCloudinary(oldImageId);
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        ...user.toJSON(),
        $id: user._id.toString(),
      },
    });
  } catch (error) {
    console.error("UpdateUser Error:", error);
    res.status(500).json({ success: false, message: "Failed to update profile." });
  }
};

// ============================================================
// FOLLOW USER (Explicit POST)
// ============================================================
export const followUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const currentUserId = req.user?._id;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ success: false, message: "Invalid target user ID." });
      return;
    }

    if (currentUserId?.toString() === targetUserId) {
      res.status(400).json({ success: false, message: "You cannot follow yourself." });
      return;
    }

    // Upsert or findOneAndUpdate to guarantee idempotency
    await Follow.findOneAndUpdate(
      { follower: currentUserId, following: new Types.ObjectId(targetUserId) },
      { follower: currentUserId, following: new Types.ObjectId(targetUserId) },
      { upsert: true, new: true }
    );

    const followersCount = await Follow.countDocuments({ following: new Types.ObjectId(targetUserId) });

    res.status(200).json({
      success: true,
      message: "Followed successfully",
      isFollowing: true,
      followersCount,
    });
  } catch (error) {
    console.error("FollowUser Error:", error);
    res.status(500).json({ success: false, message: "Failed to follow user." });
  }
};

// ============================================================
// UNFOLLOW USER (Explicit DELETE)
// ============================================================
export const unfollowUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const currentUserId = req.user?._id;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ success: false, message: "Invalid target user ID." });
      return;
    }

    await Follow.findOneAndDelete({
      follower: currentUserId,
      following: new Types.ObjectId(targetUserId),
    });

    const followersCount = await Follow.countDocuments({ following: new Types.ObjectId(targetUserId) });

    res.status(200).json({
      success: true,
      message: "Unfollowed successfully",
      isFollowing: false,
      followersCount,
    });
  } catch (error) {
    console.error("UnfollowUser Error:", error);
    res.status(500).json({ success: false, message: "Failed to unfollow user." });
  }
};

// ============================================================
// GET USER FOLLOWERS
// ============================================================
export const getUserFollowers = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user ID format." });
      return;
    }

    const followers = await Follow.find({ following: new Types.ObjectId(userId) })
      .populate("follower", "name username imageUrl bio id")
      .lean();

    const formatted = followers.map((f) => {
      const u = f.follower as any;
      return {
        ...u,
        id: u?._id?.toString() || u?.id,
        $id: u?._id?.toString() || u?.id,
        followRecordId: f._id.toString(),
      };
    });

    res.status(200).json({
      success: true,
      documents: formatted,
    });
  } catch (error) {
    console.error("GetUserFollowers Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch followers." });
  }
};

// ============================================================
// GET USER FOLLOWING
// ============================================================
export const getUserFollowing = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user ID format." });
      return;
    }

    const following = await Follow.find({ follower: new Types.ObjectId(userId) })
      .populate("following", "name username imageUrl bio id")
      .lean();

    const formatted = following.map((f) => {
      const u = f.following as any;
      return {
        ...u,
        id: u?._id?.toString() || u?.id,
        $id: u?._id?.toString() || u?.id,
        followRecordId: f._id.toString(),
      };
    });

    res.status(200).json({
      success: true,
      documents: formatted,
    });
  } catch (error) {
    console.error("GetUserFollowing Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch following." });
  }
};

// ============================================================
// TOGGLE FOLLOW / UNFOLLOW USER (Legacy compat)
// ============================================================
export const toggleFollowUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const currentUserId = req.user?._id;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ success: false, message: "Invalid target user ID." });
      return;
    }

    if (currentUserId?.toString() === targetUserId) {
      res.status(400).json({ success: false, message: "You cannot follow yourself." });
      return;
    }

    const existingFollow = await Follow.findOne({
      follower: currentUserId,
      following: targetUserId,
    });

    let isFollowing: boolean;

    if (existingFollow) {
      await Follow.findByIdAndDelete(existingFollow._id);
      isFollowing = false;
    } else {
      await Follow.create({
        follower: currentUserId,
        following: targetUserId,
      });
      isFollowing = true;
    }

    const followersCount = await Follow.countDocuments({ following: targetUserId });

    res.status(200).json({
      success: true,
      isFollowing,
      followersCount,
    });
  } catch (error) {
    console.error("ToggleFollowUser Error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle follow status." });
  }
};
