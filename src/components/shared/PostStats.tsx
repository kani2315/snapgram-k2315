
import { Models } from "appwrite";
import { IPostDocument } from "@/types";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

import { checkIsLiked } from "@/lib/utils";
import {
  useLikePost,
  useSavePost,
  useDeleteSavedPost,
  useGetCurrentUser,
} from "@/lib/react-query/queries";

type PostStatsProps = {
  post: IPostDocument;
  userId: string;
};

const PostStats = ({ post, userId }: PostStatsProps) => {
  const location = useLocation();
  const likesList = (post.likes || []).map((user: Models.Document | string) => 
    typeof user === 'string' ? user : user.$id
  );

  const [likes, setLikes] = useState<string[]>(likesList);
  const [isSaved, setIsSaved] = useState(false);

  const { mutate: likePost, isLoading: isLiking } = useLikePost();
  const { mutate: savePost, isLoading: isSaving } = useSavePost();
  const { mutate: deleteSavePost, isLoading: isDeletingSave } = useDeleteSavedPost();

  const { data: currentUser } = useGetCurrentUser();

  const targetPostId = post?.$id || (post as any)?.id || (post as any)?._id;

  const savedPostRecord = (currentUser?.saves || (currentUser as any)?.save || []).find(
    (record: any) => {
      if (!record) return false;
      const recPostId =
        record.post?.$id ||
        record.post?.id ||
        record.post?._id ||
        (typeof record.post === "string" ? record.post : null) ||
        record.$id ||
        record.id;
      return recPostId === targetPostId;
    }
  );

  useEffect(() => {
    setIsSaved(!!savedPostRecord);
  }, [savedPostRecord, currentUser]);

  const handleLikePost = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>
  ) => {
    e.stopPropagation();
    if (isLiking || !targetPostId) return;

    let likesArray = [...likes];

    if (likesArray.includes(userId)) {
      likesArray = likesArray.filter((Id) => Id !== userId);
    } else {
      likesArray.push(userId);
    }

    setLikes(likesArray);
    likePost({ postId: targetPostId, likesArray });
  };

  const handleSavePost = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>
  ) => {
    e.stopPropagation();
    if (isSaving || isDeletingSave || !targetPostId) return;

    if (savedPostRecord) {
      setIsSaved(false);
      const recordId =
        savedPostRecord.$id ||
        savedPostRecord.id ||
        savedPostRecord._id ||
        targetPostId;
      return deleteSavePost(recordId);
    }

    savePost({
      userId: userId || currentUser?.$id || (currentUser as any)?.id,
      postId: targetPostId,
    });
    setIsSaved(true);
  };

  const containerStyles = location.pathname.startsWith("/profile")
    ? "w-full"
    : "";

  return (
    <div
      className={`flex justify-between items-center z-20 ${containerStyles}`}>
      <div className="flex gap-2 mr-5">
        <img
          src={`${
            checkIsLiked(likes, userId)
              ? "/assets/icons/liked.svg"
              : "/assets/icons/like.svg"
          }`}
          alt="like"
          width={20}
          height={20}
          onClick={(e) => handleLikePost(e)}
          className="cursor-pointer"
        />
        <p className="small-medium lg:base-medium">{likes.length}</p>
      </div>

      <div className="flex gap-2">
        <img
          src={isSaved ? "/assets/icons/saved.svg" : "/assets/icons/save.svg"}
          alt="share"
          width={20}
          height={20}
          className="cursor-pointer"
          onClick={(e) => handleSavePost(e)}
        />
      </div>
    </div>
  );
};

export default PostStats;
