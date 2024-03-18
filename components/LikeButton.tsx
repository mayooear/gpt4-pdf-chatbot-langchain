import { useEffect, useState } from 'react';
import { getOrCreateUUID } from '@/utils/uuid';
import { checkUserLikes } from '@/services/likeService';

interface LikeButtonProps {
    answerId: string;
    initialLiked: boolean;
    likeCount: number; 
}

const LikeButton: React.FC<LikeButtonProps> = ({ answerId, initialLiked, likeCount }) => {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(likeCount); 
  
  useEffect(() => {
    setIsLiked(initialLiked);
  }, [initialLiked]);
  
  useEffect(() => {
    setLikes(likeCount);
  }, [likeCount]);
  
  const handleLike = async () => {
    const uuid = getOrCreateUUID();
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);

    try {
      const response = await fetch('/api/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answerId, uuid, like: newLikedState }),
      });

      if (!response.ok) {
        // If the response is not ok, revert the liked state
        setIsLiked(!newLikedState);
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred while updating the like status.');
      }
    } catch (error) {
      console.error('Like error:', error);
      setIsLiked(!newLikedState); // Revert the liked state on error
      // TODO: Optionally handle the error state in the UI, e.g., with a toast notification
    }

    // Update the like count based on the new liked state
    setLikes(prevLikes => newLikedState ? prevLikes + 1 : prevLikes - 1);
  };

  return (
    <div className="like-container flex items-center">
      <button
        className={`heart-button ${isLiked ? 'liked' : ''}`}
        onClick={handleLike}
        aria-label={isLiked ? 'Unlike this answer' : 'Like this answer'}
        title={isLiked ? 'Unlike this answer' : 'Like this answer'}
      >
        {isLiked ? (
          <span className="material-icons">favorite</span>
        ) : (
          <span className="material-icons">favorite_border</span>
        )}
      </button>
      {likes > 0 && <span className="like-count ml-2">{likes}</span>}
    </div>
  );
};

export default LikeButton;
