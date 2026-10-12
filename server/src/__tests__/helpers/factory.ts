/**
 * Test factories — create the objects a test needs, with sensible defaults,
 * so each test body says only what is unique about that test.
 *
 * Interview note: this is the "Object Mother" / factory pattern. Without it,
 * every test repeats 15 lines of setup and a schema change breaks all of them
 * in 15 places instead of one.
 */
import request from "supertest";
import type { Express } from "express";
import { Post } from "../../models/Post.model.js";
import { User } from "../../models/User.model.js";

let counter = 0;
const unique = () => `${Date.now()}_${counter++}`;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  username: string;
  name: string;
  accessToken: string;
  cookie: string[];
}

/** Registers a user through the real signup endpoint and returns their credentials. */
export async function createUser(app: Express, overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const u = unique();
  const payload = {
    name: overrides.name ?? `Test User ${u}`,
    username: overrides.username ?? `user_${u}`,
    email: overrides.email ?? `user_${u}@test.dev`,
    password: overrides.password ?? "Password123!",
  };

  const res = await request(app).post("/api/v1/auth/signup").send(payload);
  if (res.status !== 201) {
    throw new Error(`createUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    ...payload,
    id: res.body.user.id ?? res.body.user.$id,
    accessToken: res.body.accessToken,
    cookie: res.headers["set-cookie"] as unknown as string[],
  };
}

/**
 * Creates a post directly in the database.
 *
 * Deliberately bypasses the HTTP endpoint: the create route requires a
 * multipart upload and a Cloudinary round trip, which is a dependency we do
 * not want in a test about likes. Tests for the upload path itself go through
 * the endpoint; tests that merely need a post to exist use this.
 */
export async function createPost(creatorId: string, overrides: Record<string, unknown> = {}) {
  return Post.create({
    caption: `Test caption ${unique()}`,
    imageUrl: "https://example.test/image.png",
    imageId: `test_${unique()}`,
    location: "Test City",
    tags: ["test"],
    creator: creatorId,
    ...overrides,
  });
}

/** Attaches a user's bearer token to a supertest request. */
export const auth = (req: request.Test, user: TestUser) =>
  req.set("Authorization", `Bearer ${user.accessToken}`);

export const findUserByEmail = (email: string) => User.findOne({ email }).select("+password +refreshToken");
