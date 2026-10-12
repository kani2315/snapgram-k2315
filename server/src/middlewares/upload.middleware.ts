import multer, { type FileFilterCallback } from "multer";
import { type Request } from "express";

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format. Only JPEG, PNG, WebP, and GIF images are allowed."));
  }
};

const multerInstance = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum file size
  },
  fileFilter,
});

export const uploadSingleImage = (req: Request, res: any, next: any) => {
  multerInstance.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ])(req, res, (err: any) => {
    if (err) return next(err);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (files["file"]?.[0]) {
        req.file = files["file"][0];
      } else if (files["image"]?.[0]) {
        req.file = files["image"][0];
      }
    }
    next();
  });
};
