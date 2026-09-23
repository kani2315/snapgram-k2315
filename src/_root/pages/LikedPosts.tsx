import { GridPostList, Loader } from "@/components/shared";
import { useGetCurrentUser, useGetLikedPosts } from "@/lib/react-query/queries";

const LikedPosts = () => {
  const { data: currentUser } = useGetCurrentUser();
  const { data: likedPostsData } = useGetLikedPosts(currentUser?.$id || "");

  if (!currentUser)
    return (
      <div className="flex-center w-full h-full">
        <Loader />
      </div>
    );

  const likedPosts = likedPostsData?.documents || [];

  return (
    <>
      {likedPosts.length === 0 && (
        <p className="text-light-4">No liked posts</p>
      )}

      <GridPostList posts={likedPosts} showStats={false} />
    </>
  );
};

export default LikedPosts;
