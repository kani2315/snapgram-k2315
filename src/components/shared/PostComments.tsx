import { useState } from "react";
import { Link } from "react-router-dom";
import { Models } from "appwrite";

import { useCreateComment, useGetPostComments } from "@/lib/react-query/queries";
import { Button } from "../ui/button";
import { Loader } from "../shared";

type PostCommentsProps = {
  post: Models.Document;
  currentUser: any;
};

const PostComments = ({ post, currentUser }: PostCommentsProps) => {
  const { data: comments, isLoading } = useGetPostComments(post.$id);
  const { mutate: createComment, isLoading: isCreatingComment } = useCreateComment();
  const [content, setContent] = useState("");

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createComment({
      postId: post.$id,
      userId: currentUser.id,
      content,
    });
    setContent("");
  };

  return (
    <div className="w-full flex flex-col gap-4 mt-4">
      <hr className="border w-full border-dark-4/80" />
      <h3 className="body-bold md:h3-bold">Comments</h3>

      <div className="flex flex-col gap-5 mt-4">
        {isLoading ? (
          <Loader />
        ) : comments?.documents.length === 0 ? (
          <p className="text-light-3 small-regular">No comments yet. Be the first to comment!</p>
        ) : (
          comments?.documents.map((comment) => (
            <div key={comment.$id} className="flex gap-3 items-start">
              <Link to={`/profile/${comment.creator.$id}`}>
                <img
                  src={comment.creator?.imageUrl || "/assets/icons/profile-placeholder.svg"}
                  alt="creator"
                  className="w-8 h-8 rounded-full"
                />
              </Link>
              <div className="flex flex-col gap-1 bg-dark-4 p-3 rounded-lg w-full">
                <Link to={`/profile/${comment.creator.$id}`}>
                  <p className="base-medium text-light-1">{comment.creator.name}</p>
                </Link>
                <p className="small-regular text-light-2">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleComment} className="flex gap-3 mt-4 items-center">
        <img
          src={currentUser.imageUrl || "/assets/icons/profile-placeholder.svg"}
          alt="currentUser"
          className="w-10 h-10 rounded-full"
        />
        <input
          type="text"
          placeholder="Write a comment..."
          className="flex-1 bg-dark-4 border-none placeholder:text-light-4 focus-visible:ring-1 focus-visible:ring-offset-1 ring-offset-light-3 p-3 rounded-xl outline-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button
          type="submit"
          className="shad-button_primary"
          disabled={!content.trim() || isCreatingComment}
        >
          {isCreatingComment ? <Loader /> : "Post"}
        </Button>
      </form>
    </div>
  );
};

export default PostComments;
