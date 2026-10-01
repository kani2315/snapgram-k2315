import { z } from "zod";

export const signUpSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Name is required" })
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters")
      .trim(),
    username: z
      .string({ required_error: "Username is required" })
      .min(2, "Username must be at least 2 characters")
      .max(30, "Username cannot exceed 30 characters")
      .toLowerCase()
      .trim(),
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email address")
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters"),
  }),
});

export const signInSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email address")
      .toLowerCase()
      .trim(),
    password: z.string({ required_error: "Password is required" }).min(1, "Password cannot be empty"),
  }),
});

export type SignUpInput = z.infer<typeof signUpSchema>["body"];
export type SignInInput = z.infer<typeof signInSchema>["body"];
