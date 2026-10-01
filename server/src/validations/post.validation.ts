import { z } from "zod";

export const createPostSchema = z.object({
  body: z.object({
    caption: z
      .string({ required_error: "Caption is required" })
      .min(1, "Caption cannot be empty")
      .max(2200, "Caption cannot exceed 2200 characters")
      .trim(),
    location: z.string().max(100).optional().default(""),
    tags: z.string().optional().default(""), // comma-separated tags e.g. "art, coding, nature"
  }),
});

export const updatePostSchema = z.object({
  body: z.object({
    caption: z.string().min(1).max(2200).trim().optional(),
    location: z.string().max(100).optional(),
    tags: z.string().optional(),
    imageUrl: z.string().optional(),
    imageId: z.string().optional(),
  }),
  params: z.object({
    id: z.string().min(1, "Post ID is required"),
  }),
});

export type CreatePostInput = z.infer<typeof createPostSchema>["body"];
export type UpdatePostInput = z.infer<typeof updatePostSchema>["body"];
