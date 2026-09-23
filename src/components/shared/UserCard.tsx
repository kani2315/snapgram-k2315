// @ts-nocheck
import { Models } from "appwrite";
import { Link } from "react-router-dom";
import React, { useState, useEffect } from "react";

import { Button } from "../ui/button";
import { useUserContext } from "@/context/AuthContext";
import { useFollowUser } from "@/lib/react-query/queries";

type UserCardProps = {
  user: Models.Document;
};

const UserCard = ({ user }: UserCardProps) => {
  const { user: currentUser, checkAuthUser } = useUserContext();
  const { mutate: followUser } = useFollowUser();

  const followingList = currentUser.following?.map((u: Models.Document | string) => typeof u === 'string' ? u : u.$id) || [];
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    setIsFollowing(followingList.includes(user.$id));
  }, [currentUser]);

  const handleFollow = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();

    let newFollowing = [...followingList];
    
    const followerList = user.follower?.map((u: Models.Document | string) => typeof u === 'string' ? u : u.$id) || [];
    let newFollower = [...followerList];

    if (isFollowing) {
      newFollowing = newFollowing.filter((id) => id !== user.$id);
      newFollower = newFollower.filter((id) => id !== currentUser.id);
    } else {
      newFollowing.push(user.$id);
      newFollower.push(currentUser.id);
    }

    setIsFollowing(!isFollowing);
    followUser(
      { 
        currentUserId: currentUser.id, 
        followingArray: newFollowing,
        targetUserId: user.$id,
        followerArray: newFollower
      },
      {
        onSuccess: () => {
          checkAuthUser();
        }
      }
    );
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
