import cloudinary from "../config/cloudinary.js";
import { type UploadApiResponse } from "cloudinary";
import streamifier from "streamifier";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { fileURLToPath } from "url";

export interface IUploadResult {
  imageUrl: string;
  imageId: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Streams an in-memory image buffer to Cloudinary (or local disk in development)
 */
export const uploadImageToCloudinary = async (
  buffer: Buffer,
  folder: string = "snapgram/posts"
): Promise<IUploadResult> => {
  // If running in development without Cloudinary credentials, store locally on disk
  const hasCloudinary =
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY !== "your_api_key" &&
    process.env.CLOUDINARY_API_KEY !== "demo";

  if (!hasCloudinary) {
    const subFolder = folder.includes("avatars") ? "avatars" : "posts";
    const targetDir = path.join(UPLOADS_DIR, subFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const uniqueId = `local_${crypto.randomUUID()}.jpg`;
    const localFilePath = path.join(targetDir, uniqueId);
    await fs.promises.writeFile(localFilePath, buffer);

    const port = process.env.PORT || 5000;
    const localUrl = `http://localhost:${port}/uploads/${subFolder}/${uniqueId}`;

    return {
      imageUrl: localUrl,
      imageId: `local_${subFolder}_${uniqueId}`,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(error || new Error("Failed to stream image to Cloudinary"));
        }
        resolve({
          imageUrl: result.secure_url,
          imageId: result.public_id,
        });
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Deletes an image from Cloudinary or local disk
 */
export const deleteImageFromCloudinary = async (publicId: string): Promise<boolean> => {
  if (!publicId) return true;

  if (publicId.startsWith("local_")) {
    try {
      const parts = publicId.split("_");
      if (parts.length >= 3) {
        const subFolder = parts[1];
        const filename = parts.slice(2).join("_");
        const filePath = path.join(UPLOADS_DIR, subFolder, filename);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  try {
    const res = await cloudinary.uploader.destroy(publicId);
    return res.result === "ok";
  } catch (error) {
    console.error("Cloudinary Deletion Error:", error);
    return false;
  }
};
