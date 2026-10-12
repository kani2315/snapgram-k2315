
import { GridPostList, Loader } from "@/components/shared";
import { useGetCurrentUser } from "@/lib/react-query/queries";


const Saved = () => {
  const { data: currentUser } = useGetCurrentUser();

  const rawSaves = currentUser?.saves || (currentUser as any)?.save || [];
  const savePosts = rawSaves
    .filter((savePost: any) => savePost && savePost.post)
    .map((savePost: any) => {
      const p = typeof savePost.post === "object" ? savePost.post : null;
      if (!p) return null;
      return {
        ...p,
        $id: p.$id || p.id || p._id,
        id: p.id || p.$id || p._id,
        imageUrl: p.imageUrl,
        creator: p.creator || {
          name: currentUser?.name || "Creator",
          imageUrl: currentUser?.imageUrl || "/assets/icons/profile-placeholder.svg",
        },
      };
    })
    .filter(Boolean)
    .reverse();

  return (
    <div className="saved-container">
      <div className="flex gap-2 w-full max-w-5xl">
        <img
          src="/assets/icons/save.svg"
          width={36}
          height={36}
          alt="edit"
          className="invert-white"
        />
        <h2 className="h3-bold md:h2-bold text-left w-full">Saved Posts</h2>
      </div>

      {!currentUser ? (
        <Loader />
      ) : (
        <div className="w-full flex justify-center max-w-5xl gap-9">
          {savePosts?.length === 0 ? (
            <p className="text-light-4">No available posts</p>
          ) : (
            <GridPostList posts={savePosts as any} showStats={false} showUser={false} />
          )}
        </div>
      )}
    </div>
  );
};

export default Saved;
