import { useEffect, useState } from 'react';
import { getOrCreateUUID } from '@/utils/client/uuid';

interface LikeButtonProps {
  answerId: string;
  initialLiked: boolean;
  likeCount: number;
  onLikeCountChange: (answerId: string, newLikeCount: number) => void;
  showLikeCount?: boolean; // Add this prop
}

const LikeButton: React.FC<LikeButtonProps> = ({ answerId, initialLiked, likeCount, onLikeCountChange, showLikeCount = true }) => {
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
  
      // Update the like count in the chat logs
      await fetch('/api/updateLikeCount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answerId, likeCount: newLikedState ? likes + 1 : likes - 1 }),
      });

      // Call the onLikeCountChange callback with the updated like count
      onLikeCountChange(answerId, newLikedState ? likes + 1 : likes - 1);

    } catch (error) {
      console.error('Like error:', error);
      setIsLiked(!newLikedState);
      // TODO: Optionally handle the error state in the UI, e.g., with a toast notification
    }
  
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
        <span className="material-icons">{isLiked ? 'favorite' : 'favorite_border'}</span>
      </button>
      {showLikeCount && likes > 0 && <span className="like-count flex items-center justify-center">{likes}</span>}
    </div>
  );
};

export default LikeButton;
