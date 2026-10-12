import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.model.js";
import { Save } from "../models/Save.model.js";
import { Follow } from "../models/Follow.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenCookieOptions,
  hashRefreshToken,
  compareRefreshToken,
} from "../utils/jwt.util.js";
import { type SignUpInput, type SignInInput } from "../validations/auth.validation.js";

// ============================================================
// SIGN UP
// ============================================================
export const signUp = async (req: Request<{}, {}, SignUpInput>, res: Response): Promise<void> => {
  try {
    const { name, username, email, password } = req.body;

    // Check if email already registered
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        message: "Email is already registered. Please log in.",
      });
      return;
    }

    // Check if username is taken
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      res.status(409).json({
        success: false,
        message: "Username is already taken. Please choose another.",
      });
      return;
    }

    // Generate fallback initial avatar (matching Appwrite avatar behavior)
    const initialAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=877EFF&color=fff`;

    // Create user in database
    const newUser = await User.create({
      name,
      username,
      email,
      password,
      imageUrl: initialAvatar,
    });

    // Generate Tokens
    const accessToken = generateAccessToken(newUser._id.toString());
    const refreshToken = generateRefreshToken(newUser._id.toString());

    // Hash and persist refresh token for revocation and rotation
    newUser.refreshToken = await hashRefreshToken(refreshToken);
    await newUser.save();

    // Set HttpOnly refresh cookie
    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      accessToken,
      user: newUser.toJSON(),
    });
  } catch (error) {
    console.error("SignUp Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user account.",
    });
  }
};

// ============================================================
// SIGN IN
// ============================================================
export const signIn = async (req: Request<{}, {}, SignInInput>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Explicitly select password field
    const user = await User.findOne({ email }).select("+password +refreshToken");
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    // Generate new token pair
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Hash and store new refresh token (token rotation)
    user.refreshToken = await hashRefreshToken(refreshToken);
    await user.save();

    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      message: "Signed in successfully",
      accessToken,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("SignIn Error:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred during login.",
    });
  }
};

// ============================================================
// REFRESH TOKEN (Rotation & Reuse Detection)
// ============================================================
export const refreshSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
      res.status(401).json({
        success: false,
        message: "No refresh token cookie found. Please log in again.",
      });
      return;
    }

    // Verify token cryptographic signature
    let decoded: { userId: string };
    try {
      decoded = verifyRefreshToken(incomingRefreshToken);
    } catch {
      res.clearCookie("refreshToken", getRefreshTokenCookieOptions());
      res.status(401).json({
        success: false,
        message: "Refresh token is expired or invalid.",
      });
      return;
    }

    const user = await User.findById(decoded.userId).select("+refreshToken");
    if (!user || !user.refreshToken) {
      res.clearCookie("refreshToken", getRefreshTokenCookieOptions());
      res.status(401).json({
        success: false,
        message: "Session revoked or account does not exist.",
      });
      return;
    }

    // Compare incoming refresh token against hashed token in DB
    const isTokenValid = await compareRefreshToken(incomingRefreshToken, user.refreshToken);
    if (!isTokenValid) {
      // Possible Token Theft Detected! Invalidate user session
      user.refreshToken = undefined;
      await user.save();
      res.clearCookie("refreshToken", getRefreshTokenCookieOptions());
      res.status(403).json({
        success: false,
        message: "Security alert: Token reuse detected. All sessions invalidated.",
      });
      return;
    }

    // Rotate tokens
    const newAccessToken = generateAccessToken(user._id.toString());
    const newRefreshToken = generateRefreshToken(user._id.toString());

    user.refreshToken = await hashRefreshToken(newRefreshToken);
    await user.save();

    res.cookie("refreshToken", newRefreshToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("RefreshSession Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh authentication session.",
    });
  }
};

// ============================================================
// SIGN OUT
// ============================================================
export const signOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (incomingRefreshToken) {
      try {
        const decoded = verifyRefreshToken(incomingRefreshToken);
        await User.findByIdAndUpdate(decoded.userId, { $unset: { refreshToken: 1 } });
      } catch {
        // Token was invalid or already expired, proceed to clear cookie
      }
    }

    res.clearCookie("refreshToken", getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      message: "Signed out successfully",
    });
  } catch (error) {
    console.error("SignOut Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sign out.",
    });
  }
};

// ============================================================
// GET CURRENT USER
// ============================================================
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
      return;
    }

    // Populate user's saved posts for instant bookmark detection and following for follow state
    const [saves, followingDocs] = await Promise.all([
      Save.find({ user: req.user._id })
        .populate({
          path: "post",
          populate: { path: "creator", select: "name username imageUrl bio id" },
        })
        .lean(),
      Follow.find({ follower: req.user._id }).lean(),
    ]);

    const followingIds = followingDocs.map((f) => f.following.toString());

    const formattedSaves = saves
      .filter((s) => s.post)
      .map((s) => {
        const postObj = s.post as any;
        return {
          ...s,
          id: s._id.toString(),
          $id: s._id.toString(),
          post: {
            ...postObj,
            id: postObj._id?.toString(),
            $id: postObj._id?.toString(),
            imageUrl: postObj.imageUrl,
            creator: postObj.creator
              ? {
                  ...postObj.creator,
                  id: postObj.creator._id?.toString(),
                  $id: postObj.creator._id?.toString(),
                }
              : null,
          },
        };
      });

    res.status(200).json({
      success: true,
      user: {
        ...req.user.toJSON(),
        id: req.user._id.toString(),
        $id: req.user._id.toString(),
        saves: formattedSaves,
        save: formattedSaves,
        following: followingIds,
      },
    });
  } catch (error) {
    console.error("GetCurrentUser Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve authenticated user profile.",
    });
  }
};
