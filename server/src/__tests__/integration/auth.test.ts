/**
 * INTEGRATION TESTS — the full auth pipeline.
 *
 * These exercise route → zod middleware → controller → Mongoose → MongoDB,
 * with only the HTTP transport faked by Supertest. Nothing is mocked, so a
 * passing test means the pieces actually fit together — which is precisely the
 * class of bug unit tests with mocks cannot catch.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { User } from "../../models/User.model.js";
import { createUser, findUserByEmail } from "../helpers/factory.js";

const signupPayload = {
  name: "Kanishka",
  username: "kani_test",
  email: "kani_test@example.com",
  password: "Password123!",
};

describe("POST /api/v1/auth/signup", () => {
  it("creates a user and returns 201 with an access token", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send(signupPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(signupPayload.email);
  });

  it("never returns the password hash", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send(signupPayload);
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.refreshToken).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("$2b$"); // bcrypt prefix
  });

  it("stores the password hashed, never in plain text", async () => {
    await request(app).post("/api/v1/auth/signup").send(signupPayload);
    const user = await findUserByEmail(signupPayload.email);

    expect(user!.password).not.toBe(signupPayload.password);
    expect(user!.password).toMatch(/^\$2[aby]\$/); // bcrypt format
  });

  it("stores the refresh token hashed, so a DB dump yields no usable sessions", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send(signupPayload);
    const rawCookie = (res.headers["set-cookie"] as unknown as string[])[0];
    const rawToken = rawCookie.split("refreshToken=")[1].split(";")[0];

    const user = await findUserByEmail(signupPayload.email);
    expect(user!.refreshToken).toBeTruthy();
    expect(user!.refreshToken).not.toBe(rawToken);
  });

  it("sets an httpOnly refresh cookie", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send(signupPayload);
    const cookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/v1/auth/signup").send(signupPayload);
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...signupPayload, username: "different_name" });

    expect(res.status).toBe(409);
    expect(await User.countDocuments({ email: signupPayload.email })).toBe(1);
  });

  it("rejects a duplicate username with 409", async () => {
    await request(app).post("/api/v1/auth/signup").send(signupPayload);
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...signupPayload, email: "other@example.com" });

    expect(res.status).toBe(409);
  });

  it("treats usernames case-insensitively", async () => {
    await request(app).post("/api/v1/auth/signup").send(signupPayload);
    const res = await request(app).post("/api/v1/auth/signup").send({
      ...signupPayload,
      email: "other@example.com",
      username: signupPayload.username.toUpperCase(),
    });

    expect(res.status).toBe(409);
  });

  it("rejects an invalid payload with 400 before touching the database", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...signupPayload, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0].field).toContain("email");
    expect(await User.countDocuments()).toBe(0);
  });
});

describe("POST /api/v1/auth/signin", () => {
  it("signs in with correct credentials", async () => {
    const user = await createUser(app);
    const res = await request(app)
      .post("/api/v1/auth/signin")
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rejects a wrong password with 401", async () => {
    const user = await createUser(app);
    const res = await request(app)
      .post("/api/v1/auth/signin")
      .send({ email: user.email, password: "WrongPassword1!" });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it("gives an IDENTICAL message for unknown email and wrong password", async () => {
    const user = await createUser(app);

    const wrongPassword = await request(app)
      .post("/api/v1/auth/signin")
      .send({ email: user.email, password: "WrongPassword1!" });
    const unknownEmail = await request(app)
      .post("/api/v1/auth/signin")
      .send({ email: "nobody@example.com", password: "Password123!" });

    // Account enumeration defence: differing messages tell an attacker which
    // email addresses are registered.
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    expect(wrongPassword.status).toBe(unknownEmail.status);
  });

  it("rotates the stored refresh token on each sign-in", async () => {
    const user = await createUser(app);
    const before = (await findUserByEmail(user.email))!.refreshToken;

    await request(app).post("/api/v1/auth/signin").send({ email: user.email, password: user.password });
    const after = (await findUserByEmail(user.email))!.refreshToken;

    expect(after).not.toBe(before);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns the authenticated user", async () => {
    const user = await createUser(app);
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it("returns 401 with no token", async () => {
    expect((await request(app).get("/api/v1/auth/me")).status).toBe(401);
  });

  it("returns 401 for a malformed token", async () => {
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });

  it("signals TOKEN_EXPIRED so the client knows to refresh rather than log out", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const expired = jwt.sign({ userId: "507f1f77bcf86cd799439011" }, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: "-1s",
    });

    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${expired}`);

    expect(res.status).toBe(401);
    // The Axios interceptor keys off exactly this code. If it changes, silent
    // refresh breaks and users get logged out every 15 minutes.
    expect(res.body.code).toBe("TOKEN_EXPIRED");
  });

  it("returns 401 if the user was deleted after the token was issued", async () => {
    const user = await createUser(app);
    await User.deleteMany({});

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/refresh-token", () => {
  it("issues a new access token from a valid refresh cookie", async () => {
    const user = await createUser(app);
    const res = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rotates the refresh token on every use", async () => {
    const user = await createUser(app);
    const res = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", user.cookie);

    const newCookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(newCookie).not.toContain(user.cookie[0].split(";")[0]);
  });

  it("detects reuse of an already-rotated token and kills ALL sessions", async () => {
    const user = await createUser(app);

    // Legitimate refresh — the old cookie is now spent.
    await request(app).post("/api/v1/auth/refresh-token").set("Cookie", user.cookie);

    // An attacker replays the stolen original.
    const replay = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", user.cookie);

    expect(replay.status).toBe(403);

    // The whole family is invalidated — the real user is logged out too, which
    // is the intended trade-off: a forced re-login beats a silent compromise.
    const dbUser = await findUserByEmail(user.email);
    expect(dbUser!.refreshToken).toBeFalsy();
  });

  it("returns 401 with no cookie", async () => {
    expect((await request(app).post("/api/v1/auth/refresh-token")).status).toBe(401);
  });
});

describe("POST /api/v1/auth/signout", () => {
  it("clears the stored refresh token server-side", async () => {
    const user = await createUser(app);
    await request(app).post("/api/v1/auth/signout").set("Cookie", user.cookie);

    const dbUser = await findUserByEmail(user.email);
    expect(dbUser!.refreshToken).toBeFalsy();
  });

  it("makes the old refresh cookie unusable", async () => {
    const user = await createUser(app);
    await request(app).post("/api/v1/auth/signout").set("Cookie", user.cookie);

    const res = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", user.cookie);
    expect(res.status).toBeGreaterThanOrEqual(401);
  });
});
