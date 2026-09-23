
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
  const { mutate: followUser } = useFollowUser();
  const { mutate: unfollowUser } = useUnfollowUser();
  const { data: followingObj } = useGetUserFollowing(currentUser.id);
  
  const followRecord = followingObj?.documents.find(
    (record: any) => record.following === user.$id
  );
  const isFollowing = !!followRecord;

  const handleFollow = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();

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
        className={`px-5 ${isFollowing ? "shad-button_dark_4" : "shad-button_primary"} ${currentUser.id === user.$id && "hidden"}`}
      >
        {isFollowing ? "Following" : "Follow"}
      </Button>
    </Link>
  );
};

export default UserCard;
