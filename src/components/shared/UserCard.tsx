
import { IUserDocument } from "@/types";
import { Link } from "react-router-dom";
import React from "react";

import { Button } from "../ui/button";
import { useUserContext } from "@/context/AuthContext";
import { useFollowUser, useUnfollowUser, useGetUserFollowing } from "@/lib/react-query/queries";

type UserCardProps = {
  user: IUserDocument;
};

const UserCard = ({ user }: UserCardProps) => {
  const { user: currentUser, checkAuthUser } = useUserContext();
  const { mutate: followUser, isLoading: isFollowingUser } = useFollowUser();
  const { mutate: unfollowUser, isLoading: isUnfollowingUser } = useUnfollowUser();
  const { data: followingObj } = useGetUserFollowing(currentUser.id);
  
  const followRecord = followingObj?.documents.find(
    (record: any) => record.following === user.$id
  );
  const isFollowing = !!followRecord;
  const isProcessing = isFollowingUser || isUnfollowingUser;

  const handleFollow = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    if (isProcessing) return;

    if (isFollowing) {
      if (followRecord) {
        unfollowUser(followRecord.$id, {
          onSuccess: () => checkAuthUser()
        });
      }
    } else {
      followUser(
        { followerId: currentUser.id, followingId: user.$id },
        { onSuccess: () => checkAuthUser() }
      );
    }
  };

  return (
    <Link to={`/profile/${user.$id}`} className="user-card">
      <img
        src={user.imageUrl || "/assets/icons/profile-placeholder.svg"}
        alt="creator"
        className="rounded-full w-14 h-14"
      />

      <div className="flex-center flex-col gap-1">
        <p className="base-medium text-light-1 text-center line-clamp-1">
          {user.name}
        </p>
        <p className="small-regular text-light-3 text-center line-clamp-1">
          @{user.username}
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={handleFollow}
        disabled={isProcessing}
        className={`px-5 ${isFollowing ? "shad-button_dark_4" : "shad-button_primary"} ${currentUser.id === user.$id && "hidden"}`}
      >
        {isProcessing ? "Loading..." : isFollowing ? "Following" : "Follow"}
      </Button>
    </Link>
  );
};

export default UserCard;
