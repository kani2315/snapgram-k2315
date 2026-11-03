<p align="center">
  <img src="public/assets/images/logo.svg" alt="Snapgram Logo" width="200"/>
</p>

<h1 align="center">Snapgram</h1>

<p align="center">
  A full-stack social media platform built with the MERN stack &mdash; React · Express · MongoDB · Node.js
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Vite-4-646CFF?logo=vite&logoColor=white" alt="Vite"/>
</p>

---

## About

Snapgram is a feature-rich social media application where users can share posts, follow others, like and save content, and explore a real-time feed. The project is built end-to-end with TypeScript — a React SPA on the frontend and a custom Express REST API backed by MongoDB on the backend.

## Features

- **JWT Authentication** — Dual-token (access + refresh) auth with HTTP-only cookies and brute-force rate limiting
- **Create & Manage Posts** — Full CRUD with image uploads (Cloudinary), captions, locations, and tags
- **Social Interactions** — Like, unlike, save, unsave, comment on posts
- **Follow System** — Follow/unfollow users with follower & following counts
- **Explore Feed** — Infinite-scrolling cursor-based feed with search
- **User Profiles** — View profiles, liked posts, saved posts, and update your own profile
- **Image Uploads** — Multer + Cloudinary pipeline for post images and avatars
- **Responsive UI** — Mobile-first design with bottom navigation and sidebar layout
- **Testing** — Unit tests (Vitest) on both client and server; integration tests with in-memory MongoDB

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Client (React SPA)                 │
│   Vite · React 18 · TanStack Query · React Router    │
│   Tailwind CSS · Shadcn/UI · React Hook Form + Zod   │
└──────────────────────┬───────────────────────────────┘
                       │  Axios (REST)
                       ▼
┌──────────────────────────────────────────────────────┐
│                 Server (Express API)                  │
│   Express 5 · Helmet · CORS · JWT · Rate Limiting    │
│   Multer · Cloudinary · Zod Validation               │
├──────────────────────────────────────────────────────┤
│                    MongoDB (Mongoose)                 │
│   Users · Posts · Comments · Follows · Saves         │
└──────────────────────────────────────────────────────┘
```

## Project Structure

```
snapgram/
├── src/                        # React frontend
│   ├── _auth/                  # Auth layout & forms (SignIn, SignUp)
│   ├── _root/                  # App layout & pages
│   │   └── pages/              # Home, Explore, Saved, Profile, etc.
│   ├── components/
│   │   ├── shared/             # PostCard, LeftSidebar, Topbar, etc.
│   │   ├── forms/              # PostForm
│   │   └── ui/                 # Shadcn/UI primitives
│   ├── context/                # Auth context provider
│   ├── hooks/                  # Custom React hooks
│   ├── lib/
│   │   ├── api/                # Axios client & REST endpoint functions
│   │   ├── react-query/        # TanStack Query hooks (queries & mutations)
│   │   └── validation/         # Zod schemas for forms
│   ├── constants/              # Sidebar links, bottom bar items
│   └── types/                  # TypeScript interfaces
│
├── server/                     # Express backend
│   └── src/
│       ├── config/             # DB connection, Cloudinary setup
│       ├── controllers/        # Auth, Post, User controllers
│       ├── middlewares/        # JWT auth, file upload, validation
│       ├── models/             # Mongoose schemas (User, Post, Comment, Follow, Save)
│       ├── routes/             # Auth, Post, User route definitions
│       ├── services/           # Business logic layer
│       ├── utils/              # Token helpers, Cloudinary utils
│       ├── validations/        # Zod request schemas
│       └── __tests__/          # Integration tests (supertest + mongodb-memory-server)
│
├── public/                     # Static assets & logo
├── package.json                # Client dependencies & scripts
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
├── vercel.json                 # Vercel SPA rewrite rules
└── tsconfig.json               # TypeScript configuration
```

## Getting Started

### Prerequisites

- **Node.js** v18.x or higher
- **npm** (comes with Node)
- A **MongoDB** instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A **Cloudinary** account ([free tier](https://cloudinary.com/))

### 1. Clone the repository

```sh
git clone https://github.com/kani2315/snapgram-k2315.git
cd snapgram-k2315
```

### 2. Set up the server

```sh
cd server
npm install
```

Create a `server/.env` file (see `server/.env.example`):

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/snapgram
JWT_ACCESS_SECRET=your_jwt_access_secret_key_here_min_32_chars
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Start the server:

```sh
npm run dev
```

The API runs on `http://localhost:5000`.

### 3. Set up the client

```sh
# From the project root
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

## API Reference

All API routes are prefixed with `/api/v1`.

### Auth (`/api/v1/auth`)

| Method | Endpoint         | Auth | Description                |
| ------ | ---------------- | ---- | -------------------------- |
| POST   | `/signup`        | No   | Register a new user        |
| POST   | `/signin`        | No   | Log in (returns JWT)       |
| POST   | `/refresh-token` | No   | Refresh access token       |
| POST   | `/signout`       | No   | Clear auth cookies         |
| GET    | `/me`            | Yes  | Get current user profile   |

### Posts (`/api/v1/posts`)

| Method | Endpoint             | Auth | Description                     |
| ------ | -------------------- | ---- | ------------------------------- |
| GET    | `/recent`            | No   | Get recent posts                |
| GET    | `/infinite`          | No   | Cursor-based infinite feed      |
| GET    | `/search`            | No   | Search posts by caption         |
| GET    | `/user/:userId`      | No   | Get posts by a specific user    |
| GET    | `/liked/:userId`     | No   | Get liked posts for a user      |
| GET    | `/:id`               | No   | Get single post by ID           |
| POST   | `/`                  | Yes  | Create a new post (with image)  |
| PUT    | `/:id`               | Yes  | Update a post                   |
| DELETE | `/:id`               | Yes  | Delete a post                   |
| PUT    | `/:id/like`          | Yes  | Like a post                     |
| DELETE | `/:id/like`          | Yes  | Unlike a post                   |
| POST   | `/:id/save`          | Yes  | Save a post                     |
| DELETE | `/:id/save`          | Yes  | Unsave a post                   |
| GET    | `/saved`             | Yes  | Get current user's saved posts  |
| GET    | `/:id/comments`      | No   | Get comments for a post         |
| POST   | `/:id/comments`      | Yes  | Add a comment to a post         |

### Users (`/api/v1/users`)

| Method | Endpoint           | Auth | Description                |
| ------ | ------------------ | ---- | -------------------------- |
| GET    | `/`                | No   | List all users             |
| GET    | `/:id`             | No   | Get user by ID             |
| GET    | `/:id/followers`   | No   | Get user's followers       |
| GET    | `/:id/following`   | No   | Get user's following       |
| PUT    | `/:id`             | Yes  | Update user profile        |
| POST   | `/:id/follow`      | Yes  | Follow a user              |
| DELETE | `/:id/follow`      | Yes  | Unfollow a user            |

### Health

| Method | Endpoint       | Description            |
| ------ | -------------- | ---------------------- |
| GET    | `/api/v1/health` | API health check     |

## Testing

```sh
# Client-side unit tests
npm test

# Server-side integration tests
cd server
npm test
```

Server tests use `mongodb-memory-server` for an isolated in-memory database — no external MongoDB required.

## Tech Stack

| Layer            | Technology                                          |
| ---------------- | --------------------------------------------------- |
| **Frontend**     | React 18, TypeScript, Vite                          |
| **Styling**      | Tailwind CSS, Shadcn/UI, Radix UI                   |
| **State/Data**   | TanStack React Query, React Context                 |
| **Forms**        | React Hook Form, Zod                                |
| **HTTP Client**  | Axios                                               |
| **Routing**      | React Router v6                                     |
| **Backend**      | Express 5, TypeScript, Node.js                      |
| **Database**     | MongoDB with Mongoose ODM                           |
| **Auth**         | JWT (access + refresh tokens), bcryptjs              |
| **File Storage** | Cloudinary (production), Multer (local fallback)    |
| **Validation**   | Zod (both client & server)                          |
| **Testing**      | Vitest, Supertest, mongodb-memory-server            |
| **Deployment**   | Vercel (frontend), any Node host (backend)          |

## Deployment

- **Frontend**: Configured for [Vercel](https://vercel.com/) via `vercel.json` (SPA rewrites).
- **Backend**: Deploy to any Node.js host (Render, Railway, Fly.io, etc.). Ensure environment variables are set.

## License

This project is for educational and portfolio purposes.
