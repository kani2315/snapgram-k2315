import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { type CookieOptions } from "express";

export interface ITokenPayload {
  userId: string;
}

const getAccessSecret = (): Secret =>
  process.env.JWT_ACCESS_SECRET || "fallback_access_secret_32_characters_minimum";
const getRefreshSecret = (): Secret =>
  process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret_32_characters_minimum";
const getAccessExpiresIn = (): SignOptions["expiresIn"] =>
  (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as SignOptions["expiresIn"];
const getRefreshExpiresIn = (): SignOptions["expiresIn"] =>
  (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, getAccessSecret(), { expiresIn: getAccessExpiresIn() });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, getRefreshSecret(), { expiresIn: getRefreshExpiresIn() });
};

export const verifyAccessToken = (token: string): ITokenPayload => {
  return jwt.verify(token, getAccessSecret()) as ITokenPayload;
};

export const verifyRefreshToken = (token: string): ITokenPayload => {
  return jwt.verify(token, getRefreshSecret()) as ITokenPayload;
};

export const getRefreshTokenCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true, // Prevents client-side JS (XSS) from reading the cookie
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? "strict" : "lax", // Protects against CSRF attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: "/api/v1/auth", // Limits cookie transmission scope strictly to auth endpoints
  };
};
