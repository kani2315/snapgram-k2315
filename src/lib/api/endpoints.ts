import { apiClient } from "./client";
import {
  INewPost,
  INewUser,
  IUpdatePost,
  IUpdateUser,
  IPostDocument,
  IUserDocument,
} from "@/types";

// ============================================================
// AUTHENTICATION ENDPOINTS
// ============================================================

export async function createUserAccount(user: INewUser) {
  try {
    const { data } = await apiClient.post("/auth/signup", {
      name: user.name,
      username: user.username,
      email: user.email,
      password: user.password,
    });

    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
    }

    return {
      ...data.user,
      $id: data.user.id || data.user._id,
    };
  } catch (error: any) {
    console.error("createUserAccount error:", error.response?.data || error.message);
    throw error;
  }
}

export async function signInAccount(user: { email: string; password: string }) {
  try {
    const { data } = await apiClient.post("/auth/signin", user);

    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
    }

    return {
      ...data.user,
      $id: data.user.id || data.user._id,
    };
  } catch (error: any) {
    console.error("signInAccount error:", error.response?.data || error.message);
    throw error;
  }
}

export async function signOutAccount() {
  try {
    await apiClient.post("/auth/signout");
    localStorage.removeItem("accessToken");
    return { status: "success" };
  } catch (error: any) {
    console.error("signOutAccount error:", error);
    localStorage.removeItem("accessToken");
    return { status: "success" };
  }
}

export async function getCurrentUser(): Promise<IUserDocument | null> {
  try {
    const { data } = await apiClient.get("/auth/me");
    if (!data.user) return null;

    return {
      ...data.user,
      $id: data.user.id || data.user._id,
    } as IUserDocument;
  } catch (error: any) {
    return null;
  }
}

// ============================================================
// POST ENDPOINTS
// ============================================================

export async function createPost(post: INewPost): Promise<IPostDocument> {
  try {
    const formData = new FormData();
    formData.append("caption", post.caption);
    if (post.location) formData.append("location", post.location);
    if (post.tags) formData.append("tags", post.tags);

    if (post.file && post.file.length > 0) {
      formData.append("file", post.file[0]);
    }

    const { data } = await apiClient.post("/posts", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return {
      ...data.post,
      $id: data.post.id || data.post._id,
    } as IPostDocument;
  } catch (error: any) {
    console.error("createPost error:", error.response?.data || error.message);
    throw error;
  }
}

export async function getRecentPosts(): Promise<{ documents: IPostDocument[] }> {
  try {
    const { data } = await apiClient.get("/posts/recent");
    return { documents: data.documents };
  } catch (error: any) {
    console.error("getRecentPosts error:", error);
    return { documents: [] };
  }
}

export async function getInfinitePosts({ pageParam }: { pageParam?: string }): Promise<{ documents: IPostDocument[] }> {
  try {
    const query = pageParam ? `?cursor=${pageParam}&limit=9` : "?limit=9";
    const { data } = await apiClient.get(`/posts/infinite${query}`);
    return { documents: data.documents };
  } catch (error: any) {
    console.error("getInfinitePosts error:", error);
    return { documents: [] };
  }
}

export async function searchPosts(searchTerm: string): Promise<{ documents: IPostDocument[] }> {
  try {
    const { data } = await apiClient.get(`/posts/search?searchTerm=${encodeURIComponent(searchTerm)}`);
    return { documents: data.documents };
  } catch (error: any) {
    console.error("searchPosts error:", error);
    return { documents: [] };
  }
}

export async function getPostById(postId?: string): Promise<IPostDocument | undefined> {
  if (!postId) return undefined;
  try {
    const { data } = await apiClient.get(`/posts/${postId}`);
    if (!data.post) return undefined;
    return data.post as IPostDocument;
  } catch (error: any) {
    console.error("getPostById error:", error);
    return undefined;
  }
}

export async function getUserPosts(userId?: string): Promise<{ documents: IPostDocument[] }> {
  if (!userId) return { documents: [] };
  try {
    const { data } = await apiClient.get(`/posts/user/${userId}`);
    return { documents: data.documents };
  } catch (error: any) {
    console.error("getUserPosts error:", error);
    return { documents: [] };
  }
}

export async function updatePost(post: IUpdatePost): Promise<IPostDocument> {
  try {
    const formData = new FormData();
    if (post.caption) formData.append("caption", post.caption);
    if (post.location) formData.append("location", post.location);
    if (post.tags) formData.append("tags", post.tags);

    if (post.file && post.file.length > 0) {
      formData.append("file", post.file[0]);
    }

    const { data } = await apiClient.put(`/posts/${post.postId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return data.post as IPostDocument;
  } catch (error: any) {
    console.error("updatePost error:", error);
    throw error;
  }
}

export async function deletePost(postId?: string, _imageId?: string) {
  if (!postId) return;
  try {
    const { data } = await apiClient.delete(`/posts/${postId}`);
    return data;
  } catch (error: any) {
    console.error("deletePost error:", error);
    throw error;
  }
}

// ============================================================
// SOCIAL INTERACTION ENDPOINTS (Likes & Saves)
// ============================================================

export async function likePost(postId: string, likesArray: string[]) {
  try {
    const { data } = await apiClient.post(`/posts/${postId}/like`, {
      likesArray,
    });
    return data.post;
  } catch (error: any) {
    console.error("likePost error:", error);
    throw error;
  }
}

export async function savePost(_userId: string, postId: string) {
  try {
    const { data } = await apiClient.post(`/posts/${postId}/save`);
    return data;
  } catch (error: any) {
    console.error("savePost error:", error);
    throw error;
  }
}

export async function deleteSavedPost(savedRecordId: string) {
  try {
    const { data } = await apiClient.delete(`/posts/saved/${savedRecordId}`);
    return data;
  } catch (error: any) {
    console.error("deleteSavedPost error:", error);
    throw error;
  }
}

// ============================================================
// USER ENDPOINTS
// ============================================================

export async function getUsers(limit?: number): Promise<{ documents: IUserDocument[] }> {
  try {
    const query = limit ? `?limit=${limit}` : "";
    const { data } = await apiClient.get(`/users${query}`);
    return { documents: data.documents };
  } catch (error: any) {
    console.error("getUsers error:", error);
    return { documents: [] };
  }
}

export async function getUserById(userId: string): Promise<IUserDocument | null> {
  try {
    const { data } = await apiClient.get(`/users/${userId}`);
    return data as IUserDocument;
  } catch (error: any) {
    console.error("getUserById error:", error);
    return null;
  }
}

export async function updateUser(user: IUpdateUser): Promise<IUserDocument> {
  try {
    const formData = new FormData();
    if (user.name) formData.append("name", user.name);
    if (user.bio) formData.append("bio", user.bio);

    if (user.file && user.file.length > 0) {
      formData.append("file", user.file[0]);
    }

    const { data } = await apiClient.put(`/users/${user.userId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return data.user as IUserDocument;
  } catch (error: any) {
    console.error("updateUser error:", error);
    throw error;
  }
}

export async function followUser(_followerId: string, followingId: string) {
  try {
    const { data } = await apiClient.post(`/users/${followingId}/follow`);
    return {
      ...data,
      $id: followingId,
    };
  } catch (error: any) {
    console.error("followUser error:", error);
    throw error;
  }
}

export async function unfollowUser(targetUserId: string) {
  try {
    const { data } = await apiClient.delete(`/users/${targetUserId}/follow`);
    return {
      ...data,
      $id: targetUserId,
      status: "Ok",
    };
  } catch (error: any) {
    console.error("unfollowUser error:", error);
    throw error;
  }
}

export async function getUserFollowers(userId: string): Promise<{ documents: any[] }> {
  try {
    const { data } = await apiClient.get(`/users/${userId}/followers`);
    return { documents: data.documents || [] };
  } catch {
    return { documents: [] };
  }
}

export async function getUserFollowing(userId: string): Promise<{ documents: any[] }> {
  try {
    const { data } = await apiClient.get(`/users/${userId}/following`);
    return { documents: data.documents || [] };
  } catch {
    return { documents: [] };
  }
}

export async function getLikedPosts(userId?: string): Promise<{ documents: any[] }> {
  if (!userId) return { documents: [] as any[] };
  try {
    const { data } = await apiClient.get(`/posts/liked/${userId}`);
    return { documents: data.documents || [] };
  } catch (error: any) {
    console.error("getLikedPosts error:", error);
    return { documents: [] as any[] };
  }
}

export async function createComment(postId: string, _userId: string, content: string) {
  try {
    const { data } = await apiClient.post(`/posts/${postId}/comments`, { content });
    return data;
  } catch (error: any) {
    console.error("createComment error:", error);
    throw error;
  }
}

export async function getPostComments(postId: string): Promise<{ documents: any[] }> {
  try {
    const { data } = await apiClient.get(`/posts/${postId}/comments`);
    return { documents: data.documents || [] };
  } catch (error: any) {
    console.error("getPostComments error:", error);
    return { documents: [] as any[] };
  }
}
