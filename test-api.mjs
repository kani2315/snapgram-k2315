#!/usr/bin/env node
/**
 * Snapgram MERN — end-to-end API test suite
 * ------------------------------------------
 * Single file, zero dependencies. Requires Node 18+ (built-in fetch/FormData/Blob).
 *
 *   1. Start your backend (e.g. npm run dev in /server)
 *   2. Edit the CONFIG block below so the paths match YOUR routes
 *   3. node test-api.mjs
 *
 * It creates two throwaway users and exercises every cross-feature invariant:
 * like -> appears in liked, save -> appears in saved, follow -> counts update,
 * delete -> disappears everywhere, and B cannot touch A's data.
 *
 * Every failure prints WHAT was expected, WHAT came back, and the LIKELY CAUSE
 * for an Appwrite -> MERN migration.
 */

// ============================================================
// CONFIG — edit these to match your API
// ============================================================
const CONFIG = {
  BASE: process.env.API_BASE || "http://localhost:5000/api/v1",

  // Set true if POST /posts requires multipart with a real file.
  // Set false if your API accepts a JSON body with an imageUrl string.
  POST_REQUIRES_IMAGE: true,

  // How your API returns auth. "cookie" | "token" | "auto"
  AUTH_MODE: "auto",

  routes: {
    signup:        { method: "POST",   path: "/auth/signup" },
    login:         { method: "POST",   path: "/auth/signin" },
    logout:        { method: "POST",   path: "/auth/signout" },
    me:            { method: "GET",    path: "/auth/me" },
    userById:      { method: "GET",    path: (id) => `/users/${id}` },
    allUsers:      { method: "GET",    path: "/users" },
    updateUser:    { method: "PUT",    path: (id) => `/users/${id}` },

    createPost:    { method: "POST",   path: "/posts" },
    recentPosts:   { method: "GET",    path: "/posts/recent" },
    infinitePosts: { method: "GET",    path: (cursor, limit = 9) =>
                       `/posts/infinite?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}` },
    postById:      { method: "GET",    path: (id) => `/posts/${id}` },
    updatePost:    { method: "PUT",    path: (id) => `/posts/${id}` },
    deletePost:    { method: "DELETE", path: (id) => `/posts/${id}` },
    userPosts:     { method: "GET",    path: (id) => `/posts/user/${id}` },
    searchPosts:   { method: "GET",    path: (q) => `/posts/search?searchTerm=${encodeURIComponent(q)}` },

    likePost:      { method: "POST",   path: (id) => `/posts/${id}/like` },
    unlikePost:    { method: "DELETE", path: (id) => `/posts/${id}/like` },
    likedPosts:    { method: "GET",    path: (id) => `/posts/liked/${id}` },

    savePost:      { method: "POST",   path: (id) => `/posts/${id}/save` },
    unsavePost:    { method: "DELETE", path: (id) => `/posts/saved/${id}` },
    savedPosts:    { method: "GET",    path: (id) => `/posts/saved` },

    follow:        { method: "POST",   path: (id) => `/users/${id}/follow` },
    unfollow:      { method: "DELETE", path: (id) => `/users/${id}/follow` },
    followers:     { method: "GET",    path: (id) => `/users/${id}/followers` },
    following:     { method: "GET",    path: (id) => `/users/${id}/following` },

    createComment: { method: "POST",   path: (id) => `/posts/${id}/comments` },
    getComments:   { method: "GET",    path: (id) => `/posts/${id}/comments` },
  },
};

// ============================================================
// Test harness
// ============================================================
const results = [];
let section = "";
const C = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };

function group(name) { section = name; console.log(`\n${C.b}── ${name}${C.x}`); }

function check(name, passed, detail = "", cause = "") {
  results.push({ section, name, passed, detail, cause });
  if (passed) {
    console.log(`  ${C.g}PASS${C.x}  ${name}`);
  } else {
    console.log(`  ${C.r}FAIL${C.x}  ${name}`);
    if (detail) console.log(`        ${C.d}${detail}${C.x}`);
    if (cause)  console.log(`        ${C.y}likely: ${cause}${C.x}`);
  }
  return passed;
}

function skip(name, why) {
  results.push({ section, name, passed: null, detail: why });
  console.log(`  ${C.y}SKIP${C.x}  ${name} ${C.d}(${why})${C.x}`);
}

// ============================================================
// HTTP client with a cookie jar + bearer token per "session"
// ============================================================
function makeSession(label) {
  return { label, cookies: new Map(), token: null, user: null };
}

function cookieHeader(s) {
  if (!s.cookies.size) return null;
  return [...s.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(s, res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) s.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

async function call(s, method, path, body, isForm = false) {
  const url = CONFIG.BASE + path;
  const headers = {};
  const ck = cookieHeader(s);
  if (ck) headers["Cookie"] = ck;
  if (s.token && CONFIG.AUTH_MODE !== "cookie") headers["Authorization"] = `Bearer ${s.token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  let res, text;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      redirect: "manual",
    });
    text = await res.text();
  } catch (e) {
    return { ok: false, status: 0, data: null, raw: "", error: e.message, url, method };
  }

  storeCookies(s, res);
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  // auto-capture a token from common shapes
  if (data && typeof data === "object") {
    const t = data.token || data.accessToken || data.jwt || data?.data?.token;
    if (t && typeof t === "string") s.token = t;
  }

  return { ok: res.ok, status: res.status, data, raw: text, url, method };
}

// ============================================================
// Shape normalizers — these also REPORT shape problems
// ============================================================
const shapeNotes = new Set();

function idOf(o) {
  if (!o) return null;
  if (typeof o === "string") return o;
  if (o._id) return String(o._id);
  if (o.id) return String(o.id);
  if (o.$id) { shapeNotes.add("Objects still use Appwrite's `$id` — Mongo uses `_id`."); return String(o.$id); }
  return null;
}

function asList(payload, label = "") {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["documents", "data", "posts", "users", "items", "results", "comments"]) {
    if (Array.isArray(payload[key])) {
      if (key === "documents") shapeNotes.add(`"${label}" returns { documents: [...] } — Appwrite's shape. Your React code may expect a plain array (or vice versa).`);
      return payload[key];
    }
  }
  if (Array.isArray(payload.data?.posts)) return payload.data.posts;
  if (Array.isArray(payload.data?.documents)) return payload.data.documents;
  return [];
}

function hasPopulatedAuthor(doc) {
  const a = doc?.creator ?? doc?.author ?? doc?.user ?? doc?.userId;
  if (!a) return { ok: false, why: "no creator/author field at all" };
  if (typeof a === "string") return { ok: false, why: `creator is a bare id string ("${a.slice(0, 10)}…")` };
  if (!a.name && !a.username) return { ok: false, why: "creator is an object but has no name/username" };
  return { ok: true };
}

function createdAtOf(o) {
  if (o?.createdAt) return o.createdAt;
  if (o?.$createdAt) { shapeNotes.add("Documents still expose `$createdAt` — Mongoose timestamps give `createdAt`."); return o.$createdAt; }
  return null;
}

// ============================================================
// Fixtures
// ============================================================
const stamp = Date.now();
const USER_A = { name: "Test Alpha", username: `alpha_${stamp}`, email: `alpha_${stamp}@test.dev`, password: "Password123!" };
const USER_B = { name: "Test Bravo", username: `bravo_${stamp}`, email: `bravo_${stamp}@test.dev`, password: "Password123!" };

// a 1x1 transparent PNG
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
function tinyPng() { return new Blob([Buffer.from(PNG_B64, "base64")], { type: "image/png" }); }

function postBody(caption, tags = "test,automated") {
  if (CONFIG.POST_REQUIRES_IMAGE) {
    const fd = new FormData();
    fd.append("caption", caption);
    fd.append("location", "Test City");
    fd.append("tags", tags);
    fd.append("file", tinyPng(), "test.png");
    fd.append("image", tinyPng(), "test.png"); // some APIs name it "image"
    return [fd, true];
  }
  return [{ caption, location: "Test City", tags: tags.split(","), imageUrl: "https://example.com/t.png" }, false];
}

// ============================================================
// THE TESTS
// ============================================================
const A = makeSession("A");
const B = makeSession("B");
let postA = null, postB = null;

async function run() {
  console.log(`${C.b}Snapgram MERN API tests${C.x}  →  ${CONFIG.BASE}\n`);

  // ---------- 0. reachability ----------
  group("0. Server reachable");
  {
    const r = await call(A, "GET", CONFIG.routes.recentPosts.path);
    if (r.status === 0) {
      check("backend responds", false, r.error, "Server not running, or BASE url/port is wrong.");
      summary(); process.exit(1);
    }
    check("backend responds", true, `status ${r.status}`);
  }

  // ---------- 1. auth ----------
  group("1. Authentication");
  {
    const r1 = await call(A, "POST", CONFIG.routes.signup.path, USER_A);
    check("signup user A", r1.status === 200 || r1.status === 201,
      `status ${r1.status} · ${preview(r1.data)}`,
      "Check required fields, unique index conflicts, and that the route path matches CONFIG.");

    const r2 = await call(B, "POST", CONFIG.routes.signup.path, USER_B);
    check("signup user B", r2.status === 200 || r2.status === 201, `status ${r2.status}`);

    // if signup didn't log us in, log in explicitly
    let meA = await call(A, "GET", CONFIG.routes.me.path);
    if (!meA.ok) {
      const l = await call(A, "POST", CONFIG.routes.login.path, { email: USER_A.email, password: USER_A.password });
      check("login user A", l.ok, `status ${l.status} · ${preview(l.data)}`,
        "Password hashing mismatch (bcrypt compare), or login route shape differs.");
      meA = await call(A, "GET", CONFIG.routes.me.path);
    }
    const lB = await call(B, "POST", CONFIG.routes.login.path, { email: USER_B.email, password: USER_B.password });
    if (!lB.ok) await call(B, "GET", CONFIG.routes.me.path);

    const okMe = check("GET /me returns the logged-in user", meA.ok, `status ${meA.status} · ${preview(meA.data)}`,
      "Auth middleware not reading the cookie/Bearer token, or /me route missing.");
    if (okMe) {
      A.user = meA.data?.user ?? meA.data?.data ?? meA.data;
      check("  /me has a usable id", !!idOf(A.user), `got keys: ${keysOf(A.user)}`,
        "Frontend probably reads `$id`; Mongo gives `_id`.");
      check("  /me does NOT leak the password hash",
        !(A.user?.password || A.user?.passwordHash),
        "password field present in response",
        "Add `select: false` on the password field, or strip it in the controller.");
    }

    const meB = await call(B, "GET", CONFIG.routes.me.path);
    B.user = meB.data?.user ?? meB.data?.data ?? meB.data;

    const anon = makeSession("anon");
    const r401 = await call(anon, "GET", CONFIG.routes.me.path);
    check("unauthenticated /me is rejected", r401.status === 401 || r401.status === 403,
      `got ${r401.status}, expected 401/403`,
      "Protected routes are missing the auth middleware.");
  }

  if (!A.user || !idOf(A.user)) {
    console.log(`\n${C.r}Cannot continue without a logged-in user A.${C.x}`);
    summary(); process.exit(1);
  }
  const aId = idOf(A.user), bId = idOf(B.user);

  // ---------- 2. create + read posts ----------
  group("2. Posts — create and appear in feed");
  {
    const cap = `Alpha automated post ${stamp}`;
    const [body, isForm] = postBody(cap);
    const r = await call(A, "POST", CONFIG.routes.createPost.path, body, isForm);
    const ok = check("create post as A", r.status === 200 || r.status === 201,
      `status ${r.status} · ${preview(r.data)}`,
      CONFIG.POST_REQUIRES_IMAGE
        ? "Multer not configured, wrong field name (file vs image), or Cloudinary/S3 upload failing."
        : "Set POST_REQUIRES_IMAGE=true if your API needs a real file.");
    if (ok) postA = r.data?.post ?? r.data?.data ?? r.data;

    const [bodyB, isFormB] = postBody(`Bravo automated post ${stamp}`);
    const rb = await call(B, "POST", CONFIG.routes.createPost.path, bodyB, isFormB);
    postB = rb.data?.post ?? rb.data?.data ?? rb.data;

    const feed = await call(A, "GET", CONFIG.routes.recentPosts.path);
    const list = asList(feed.data, "recentPosts");
    check("GET feed returns a list", feed.ok && Array.isArray(list),
      `status ${feed.status} · got ${typeof feed.data} · ${preview(feed.data)}`,
      "Controller returning the raw Mongoose doc instead of an array, or a wrapper key your UI doesn't unwrap.");

    const mine = list.find((p) => idOf(p) === idOf(postA));
    check("the new post appears in the feed", !!mine,
      `feed has ${list.length} posts; new id ${idOf(postA)} not among them`,
      "Feed sorted the wrong way, a limit excluding it, or the create didn't persist.");

    // THE BIG ONE for MERN migrations
    if (list.length) {
      const pop = hasPopulatedAuthor(list[0]);
      check("feed posts have a POPULATED creator (not a bare id)", pop.ok, pop.why,
        "Missing .populate('creator', 'name username imageUrl') in the feed controller. " +
        "Appwrite expanded relationships automatically; Mongoose does not. " +
        "This is why post.creator.name renders blank.");
      check("feed posts have createdAt", !!createdAtOf(list[0]),
        `keys: ${keysOf(list[0])}`,
        "Add { timestamps: true } to the schema, or the UI is reading $createdAt.");
      check("feed posts carry an image url", !!(list[0].imageUrl || list[0].image || list[0].imageURL),
        `keys: ${keysOf(list[0])}`,
        "Upload succeeded but the url wasn't saved to the document.");
    }
  }

  if (!postA || !idOf(postA)) {
    console.log(`\n${C.r}Cannot continue without a created post.${C.x}`);
    summary(); process.exit(1);
  }
  const pA = idOf(postA), pB = postB ? idOf(postB) : null;

  // ---------- 3. explore / pagination ----------
  group("3. Explore — pagination");
  {
    const p1 = await call(A, "GET", CONFIG.routes.infinitePosts.path(null, 2));
    const l1 = asList(p1.data, "infinitePosts");
    check("explore page 1 returns posts", p1.ok && l1.length > 0,
      `status ${p1.status} · ${l1.length} items · ${preview(p1.data)}`,
      "Route missing, or cursor/limit params named differently.");

    if (l1.length) {
      const cursor = p1.data?.nextCursor ?? p1.data?.cursor ?? idOf(l1[l1.length - 1]);
      const p2 = await call(A, "GET", CONFIG.routes.infinitePosts.path(cursor, 2));
      const l2 = asList(p2.data, "infinitePosts");
      if (l2.length === 0) {
        skip("explore page 2 differs from page 1", "only one page of data exists — create more posts to test");
      } else {
        const overlap = l2.filter((p) => l1.some((q) => idOf(q) === idOf(p)));
        check("page 2 does not repeat page 1", overlap.length === 0,
          `${overlap.length} duplicate(s) across pages`,
          "Cursor ignored, or sorting on a MUTABLE field (updatedAt changes when a post is liked — sort on createdAt + _id).");
      }
      check("explore posts have a populated creator", hasPopulatedAuthor(l1[0]).ok,
        hasPopulatedAuthor(l1[0]).why,
        "Same missing .populate() as the feed — explore usually has its own controller.");
    }
  }

  // ---------- 4. likes ----------
  group("4. Likes — and the Liked tab");
  {
    const r = await call(A, "POST", CONFIG.routes.likePost.path(pA));
    check("like a post", r.ok, `status ${r.status} · ${preview(r.data)}`,
      "Route/method mismatch, or the controller expects the whole likes array in the body.");

    const after = await call(A, "GET", CONFIG.routes.postById.path(pA));
    const post = after.data?.post ?? after.data?.data ?? after.data;
    const likes = post?.likes ?? [];
    const count = post?.likeCount ?? post?.likesCount ?? (Array.isArray(likes) ? likes.length : null);
    check("like count is 1", count === 1, `got ${count} · likes field: ${JSON.stringify(likes).slice(0, 80)}`,
      "If you kept likes as an array, use $addToSet not $push. If it's a separate collection, the count needs a countDocuments or a denormalized field.");

    const liked = await call(A, "GET", CONFIG.routes.likedPosts.path(aId));
    const ll = asList(liked.data, "likedPosts");
    check("post appears in A's LIKED list", liked.ok && ll.some((p) => idOf(p) === pA),
      `status ${liked.status} · ${ll.length} items · ${preview(liked.data)}`,
      "THE CLASSIC: querying Post.find({ likes: userId }) where userId is a STRING but likes holds ObjectIds. " +
      "Cast with new mongoose.Types.ObjectId(userId), or query the Like collection by user.");

    if (ll.length) {
      check("  liked posts are populated", hasPopulatedAuthor(ll[0]).ok, hasPopulatedAuthor(ll[0]).why,
        "Missing .populate() on the liked-posts query.");
    }

    // idempotency
    await call(A, "POST", CONFIG.routes.likePost.path(pA));
    const dup = await call(A, "GET", CONFIG.routes.postById.path(pA));
    const dpost = dup.data?.post ?? dup.data?.data ?? dup.data;
    const dcount = dpost?.likeCount ?? dpost?.likesCount ?? (dpost?.likes?.length ?? null);
    check("liking twice does NOT double-count", dcount === 1, `count is now ${dcount}`,
      "Use $addToSet on the array, or a unique compound index { user: 1, post: 1 } on the Like collection.");

    const un = await call(A, "DELETE", CONFIG.routes.unlikePost.path(pA));
    check("unlike works", un.ok, `status ${un.status}`, "Check the DELETE route exists (some APIs toggle with POST).");

    const liked2 = await call(A, "GET", CONFIG.routes.likedPosts.path(aId));
    check("post leaves the LIKED list after unlike",
      !asList(liked2.data).some((p) => idOf(p) === pA),
      "post still present after unlike",
      "$pull not matching because of ObjectId vs string.");

    await call(A, "POST", CONFIG.routes.likePost.path(pA)); // re-like for later tests
  }

  // ---------- 5. saves ----------
  group("5. Saves — and the Saved page");
  {
    const r = await call(A, "POST", CONFIG.routes.savePost.path(pA));
    check("save a post", r.ok, `status ${r.status} · ${preview(r.data)}`, "Route/method mismatch.");

    const saved = await call(A, "GET", CONFIG.routes.savedPosts.path(aId));
    const sl = asList(saved.data, "savedPosts");
    check("post appears in SAVED", saved.ok && sl.some((p) => idOf(p) === pA || idOf(p?.post) === pA),
      `status ${saved.status} · ${sl.length} items · ${preview(saved.data)}`,
      "If saves are their own collection you must .populate('post') AND unwrap it — " +
      "the UI expects post objects, not save records wrapping a post.");

    if (sl.length) {
      const item = sl[0].post ?? sl[0];
      check("  saved items carry the real post data", !!(item.caption || item.imageUrl),
        `item keys: ${keysOf(sl[0])}`,
        "Returning save records without .populate('post').");
      const pop = hasPopulatedAuthor(item);
      check("  saved posts show the ORIGINAL author", pop.ok, pop.why,
        "Old Appwrite bug carried over: the Saved page overwrote each post's creator with the current user.");
    }

    await call(A, "POST", CONFIG.routes.savePost.path(pA));
    const s2 = asList((await call(A, "GET", CONFIG.routes.savedPosts.path(aId))).data);
    const dupes = s2.filter((p) => idOf(p) === pA || idOf(p?.post) === pA).length;
    check("saving twice does NOT duplicate", dupes <= 1, `${dupes} copies in saved`,
      "Add a unique compound index { user: 1, post: 1 } — the only race-proof fix.");

    await call(A, "DELETE", CONFIG.routes.unsavePost.path(pA));
    const s3 = asList((await call(A, "GET", CONFIG.routes.savedPosts.path(aId))).data);
    check("unsave removes it", !s3.some((p) => idOf(p) === pA || idOf(p?.post) === pA),
      "still in saved after unsave", "$pull / deleteOne not matching on ObjectId.");

    await call(A, "POST", CONFIG.routes.savePost.path(pA)); // restore
  }

  // ---------- 6. follows ----------
  group("6. Follows — counts on BOTH sides");
  {
    if (!bId) { skip("follow tests", "user B was not created"); }
    else {
      const r = await call(A, "POST", CONFIG.routes.follow.path(bId));
      check("A follows B", r.ok, `status ${r.status} · ${preview(r.data)}`, "Route/method mismatch.");

      const fo = await call(A, "GET", CONFIG.routes.followers.path(bId));
      const fol = asList(fo.data, "followers");
      check("A appears in B's FOLLOWERS", fo.ok && fol.some((u) => idOf(u) === aId || idOf(u?.follower) === aId),
        `status ${fo.status} · ${fol.length} items · ${preview(fo.data)}`,
        "Querying the wrong side of the edge (follower vs following swapped), or ObjectId vs string again.");

      const fi = await call(A, "GET", CONFIG.routes.following.path(aId));
      const fil = asList(fi.data, "following");
      check("B appears in A's FOLLOWING", fi.ok && fil.some((u) => idOf(u) === bId || idOf(u?.following) === bId),
        `status ${fi.status} · ${fil.length} items`,
        "Only one side of the relationship is being written. With an edge collection ONE document serves both queries — " +
        "if you kept two arrays, the second write may be failing silently.");

      const prof = await call(A, "GET", CONFIG.routes.userById.path(bId));
      const bu = prof.data?.user ?? prof.data?.data ?? prof.data;
      const fc = bu?.followerCount ?? bu?.followersCount ?? (Array.isArray(bu?.followers) ? bu.followers.length : null);
      if (fc === null) skip("B's profile shows followerCount", "no follower count field on the user document");
      else check("B's profile shows follower count = 1", fc === 1, `got ${fc}`,
        "Denormalized counter not incremented, or counting a page instead of using countDocuments().");

      await call(A, "POST", CONFIG.routes.follow.path(bId));
      const fol2 = asList((await call(A, "GET", CONFIG.routes.followers.path(bId))).data);
      const n = fol2.filter((u) => idOf(u) === aId || idOf(u?.follower) === aId).length;
      check("following twice does NOT duplicate", n <= 1, `${n} follow records`,
        "Unique compound index { follower: 1, following: 1 }.");

      const self = await call(A, "POST", CONFIG.routes.follow.path(aId));
      check("cannot follow yourself", !self.ok, `got ${self.status}, expected 4xx`,
        "Add a guard in the controller and a schema-level check.");

      const unf = await call(A, "DELETE", CONFIG.routes.unfollow.path(bId));
      check("unfollow works", unf.ok, `status ${unf.status}`);
      const fol3 = asList((await call(A, "GET", CONFIG.routes.followers.path(bId))).data);
      check("A leaves B's followers", !fol3.some((u) => idOf(u) === aId || idOf(u?.follower) === aId),
        "still a follower after unfollow");

      await call(A, "POST", CONFIG.routes.follow.path(bId)); // restore
    }
  }

  // ---------- 7. comments ----------
  group("7. Comments");
  {
    const r = await call(B, "POST", CONFIG.routes.createComment.path(pA), { content: `nice post ${stamp}`, text: `nice post ${stamp}` });
    check("B comments on A's post", r.status === 200 || r.status === 201,
      `status ${r.status} · ${preview(r.data)}`,
      "Body field name mismatch (content vs text vs comment).");

    const cs = await call(A, "GET", CONFIG.routes.getComments.path(pA));
    const cl = asList(cs.data, "comments");
    check("comment appears on the post", cs.ok && cl.length > 0,
      `status ${cs.status} · ${cl.length} items · ${preview(cs.data)}`,
      "Query filtering by post id as a string against an ObjectId field.");
    if (cl.length) {
      const pop = hasPopulatedAuthor(cl[0]);
      check("  comment author is populated", pop.ok, pop.why,
        "Missing .populate('creator','name imageUrl') — the comment renders with a blank name.");
    }

    const empty = await call(B, "POST", CONFIG.routes.createComment.path(pA), { content: "", text: "" });
    check("empty comment is rejected", !empty.ok, `got ${empty.status}, expected 4xx`,
      "No validation — add a required + minlength/maxlength on the schema and validate in the controller.");
  }

  // ---------- 8. profile / user posts / search ----------
  group("8. Profile and search");
  {
    const up = await call(A, "GET", CONFIG.routes.userPosts.path(aId));
    const upl = asList(up.data, "userPosts");
    check("A's post shows on A's profile", up.ok && upl.some((p) => idOf(p) === pA),
      `status ${up.status} · ${upl.length} items`,
      "Query by creator with a string id against an ObjectId field.");

    const s = await call(A, "GET", CONFIG.routes.searchPosts.path(`Alpha automated post ${stamp}`));
    const sl = asList(s.data, "searchPosts");
    check("search finds the post by caption", s.ok && sl.some((p) => idOf(p) === pA),
      `status ${s.status} · ${sl.length} results · ${preview(s.data)}`,
      "Needs a text index: PostSchema.index({ caption: 'text' }) then .find({ $text: { $search: q } }), " +
      "or a $regex fallback. Without the index, $text errors and you silently get nothing.");

    const all = await call(A, "GET", CONFIG.routes.allUsers.path);
    const al = asList(all.data, "allUsers");
    check("all-users list works", all.ok && al.length >= 2, `status ${all.status} · ${al.length} users`);
    if (al.length) {
      check("  user list does NOT leak emails/passwords",
        !al.some((u) => u.password || u.passwordHash || u.email),
        "email or password present in the public user list",
        "Project only safe fields: .select('name username imageUrl').");
    }
  }

  // ---------- 9. authorization ----------
  group("9. Authorization — B must not touch A's data");
  {
    const e = await call(B, "PATCH", CONFIG.routes.updatePost.path(pA), { caption: "hacked by B" });
    check("B CANNOT edit A's post", e.status === 403 || e.status === 401,
      `got ${e.status} — if 200, this is a real vulnerability`,
      "Controller must compare post.creator with req.user._id using .equals() or String() — " +
      "ObjectId === string is ALWAYS false, which silently passes a naive check written the other way.");

    const d = await call(B, "DELETE", CONFIG.routes.deletePost.path(pA));
    check("B CANNOT delete A's post", d.status === 403 || d.status === 401,
      `got ${d.status} — if 2xx, your post is gone and this is critical`);

    const u = await call(B, "PATCH", CONFIG.routes.updateUser.path(aId), { name: "hacked" });
    check("B CANNOT edit A's profile", u.status === 403 || u.status === 401,
      `got ${u.status}`,
      "Prefer a /me route for self-updates so no id comes from the client at all.");

    const forged = await call(B, "POST", CONFIG.routes.createPost.path,
      ...(() => { const [b, f] = postBody("forged"); if (!f) b.creator = aId; return [b, f]; })());
    if (forged.ok) {
      const fp = forged.data?.post ?? forged.data?.data ?? forged.data;
      const who = idOf(fp?.creator) ?? idOf(fp?.author);
      check("creator is taken from the SESSION, not the body", who !== aId,
        `post was attributed to ${who === aId ? "A (forged!)" : who}`,
        "Never read creator from req.body — set it from req.user._id.");
    } else skip("creator cannot be forged", "forged create was rejected outright (fine)");
  }

  // ---------- 10. delete cascade ----------
  group("10. Delete — does it disappear everywhere?");
  {
    const d = await call(A, "DELETE", CONFIG.routes.deletePost.path(pA));
    check("A can delete their own post", d.ok, `status ${d.status}`);

    const g = await call(A, "GET", CONFIG.routes.postById.path(pA));
    check("deleted post returns 404", g.status === 404, `got ${g.status}`,
      "Returning 200 with null makes the UI spin forever instead of showing 'not found'.");

    const feed = asList((await call(A, "GET", CONFIG.routes.recentPosts.path)).data);
    check("gone from the feed", !feed.some((p) => idOf(p) === pA), "still in feed");

    const saved = asList((await call(A, "GET", CONFIG.routes.savedPosts.path(aId))).data);
    const orphanSave = saved.some((p) => idOf(p) === pA || idOf(p?.post) === pA || (p?.post === null));
    check("no orphan record left in SAVED", !orphanSave,
      "a save record still points at the deleted post",
      "Cascade the delete (Save.deleteMany({ post: id })), or use a post-remove hook. " +
      "An orphan with post:null crashes the Saved page.");

    const liked = asList((await call(A, "GET", CONFIG.routes.likedPosts.path(aId))).data);
    check("gone from LIKED", !liked.some((p) => idOf(p) === pA || p === null), "still in liked list");

    const cs = await call(A, "GET", CONFIG.routes.getComments.path(pA));
    const cl = asList(cs.data);
    check("comments cleaned up", cl.length === 0 || cs.status === 404,
      `${cl.length} comments still exist for a deleted post`,
      "Comment.deleteMany({ post: id }) on delete.");
  }

  summary();
}

// ============================================================
// helpers + summary
// ============================================================
function keysOf(o) { return o && typeof o === "object" ? Object.keys(o).slice(0, 12).join(", ") : String(o); }
function preview(d) {
  if (d == null) return "null";
  const s = typeof d === "string" ? d : JSON.stringify(d);
  return s.length > 160 ? s.slice(0, 160) + "…" : s;
}

function summary() {
  const pass = results.filter((r) => r.passed === true).length;
  const fail = results.filter((r) => r.passed === false);
  const skipped = results.filter((r) => r.passed === null).length;

  console.log(`\n${C.b}${"=".repeat(62)}${C.x}`);
  console.log(`${C.g}${pass} passed${C.x}   ${fail.length ? C.r : C.d}${fail.length} failed${C.x}   ${C.y}${skipped} skipped${C.x}`);

  if (shapeNotes.size) {
    console.log(`\n${C.y}${C.b}Response-shape notes${C.x}`);
    for (const n of shapeNotes) console.log(`  • ${n}`);
  }

  if (fail.length) {
    console.log(`\n${C.r}${C.b}Failures, in the order to fix them${C.x}`);
    let last = "";
    fail.forEach((f, i) => {
      if (f.section !== last) { console.log(`\n  ${C.b}${f.section}${C.x}`); last = f.section; }
      console.log(`  ${i + 1}. ${f.name}`);
      if (f.detail) console.log(`     ${C.d}${f.detail}${C.x}`);
      if (f.cause)  console.log(`     ${C.y}→ ${f.cause}${C.x}`);
    });
    console.log(`\n${C.d}Tip: fix top-down. An auth or populate failure cascades into many others.${C.x}`);
  } else {
    console.log(`\n${C.g}Everything passed.${C.x}`);
  }
  console.log("");
}

run().catch((e) => { console.error(`\n${C.r}Test runner crashed:${C.x}`, e); summary(); process.exit(1); });
