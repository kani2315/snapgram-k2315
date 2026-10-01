import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  signUp,
  signIn,
  refreshSession,
  signOut,
  getCurrentUser,
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { signUpSchema, signInSchema } from "../validations/auth.validation.js";

const router = Router();

// Strict Rate Limiting exclusively for brute-force sensitive routes (login & signup)
const authBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 15 : 1000, // Relaxed in development
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts from this IP. Please try again after 15 minutes.",
  },
});

// Public Authentication Endpoints (Brute-Force Protected)
router.post("/signup", authBruteForceLimiter, validate(signUpSchema), signUp);
router.post("/signin", authBruteForceLimiter, validate(signInSchema), signIn);
router.post("/refresh-token", refreshSession);
router.post("/signout", signOut);

// Protected Authentication Endpoints (Never throttled by brute-force limiter)
router.get("/me", requireAuth, getCurrentUser);

export default router;
