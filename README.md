<p align="center">
  <img src="public/assets/images/logo.svg" alt="Snapgram Logo" width="200"/>
</p>

<h1 align="center">Snapgram</h1>

## About The Project

Snapgram is a feature-rich social media platform designed to provide a seamless and engaging user experience. It allows users to share their moments, connect with others, and explore a world of content. This project is built with a modern tech stack, ensuring high performance, scalability, and a beautiful, responsive user interface.

It leverages the power of **Appwrite** for its backend services, making it a robust and secure application.

### Key Features

- **Authentication**: Secure user sign-up and sign-in functionality.
- **Create & Manage Posts**: Users can create, edit, and delete their posts with captions, locations, and tags.
- **Explore Feed**: Discover new content and users on the explore page.
- **Liking and Saving**: Engage with content by liking posts and saving them for later.
- **User Profiles**: View detailed user profiles with their posts, liked posts, and personal information.
- **Home Feed**: An infinite-scrolling feed to view posts from other users.
- **File Uploads**: Seamlessly upload images for posts and profile pictures.
- **Responsive UI**: A beautiful and responsive design that works on all devices.

## Tech Stack

This project is built with the following technologies:

*   **Frontend**:
    *   [React.js](https://reactjs.org/)
    *   [Vite](https://vitejs.dev/)
    *   [TypeScript](https://www.typescriptlang.org/)
    *   [Tailwind CSS](https://tailwindcss.com/) for styling
    *   [Shadcn/UI](https://ui.shadcn.com/) for UI components
*   **Backend & Database**:
    *   [Appwrite](https://appwrite.io/) (Backend-as-a-Service)
*   **State Management & Data Fetching**:
    *   [Tanstack React Query](https://tanstack.com/query/v4/)
*   **Form Management**:
    *   [React Hook Form](https://react-hook-form.com/)
    *   [Zod](https://zod.dev/) for validation

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js (v18.x or higher)
*   npm
*   An [Appwrite](https://appwrite.io/) account

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your_username/snapgram.git
    cd snapgram
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Set up Appwrite:**
    *   Go to your [Appwrite Console](https://cloud.appwrite.io/) and create a new project.
    *   Under the **Database** section, create a new database.
    *   Create the following collections and their corresponding attributes as needed by the application: `users`, `posts`, `saves`.
    *   Under the **Storage** section, create a new bucket for file uploads.
    *   You will need the following IDs from your Appwrite project.

4.  **Set up environment variables:**
    Create a `.env.local` file in the root of your project and add the following variables. Replace the placeholder values with your Appwrite project's credentials.

    ```env
    VITE_APPWRITE_URL=https://cloud.appwrite.io/v1
    VITE_APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
    VITE_APPWRITE_DATABASE_ID=YOUR_DATABASE_ID
    VITE_APPWRITE_STORAGE_ID=YOUR_STORAGE_BUCKET_ID
    VITE_APPWRITE_USER_COLLECTION_ID=YOUR_USER_COLLECTION_ID
    VITE_APPWRITE_POST_COLLECTION_ID=YOUR_POST_COLLECTION_ID
    VITE_APPWRITE_SAVES_COLLECTION_ID=YOUR_SAVES_COLLECTION_ID
    ```

5.  **Run the application:**
    ```sh
    npm run dev
    ```

The application should now be running on `http://localhost:5173/`.

## Deployment

This project is configured for easy deployment on [Vercel](https://vercel.com/), leveraging the `vercel.json` file for configuration.
