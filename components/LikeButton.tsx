import { useEffect, useState } from 'react';
import { getOrCreateUUID } from '@/utils/client/uuid';
import { updateLike } from '@/services/likeService';

interface LikeButtonProps {
  answerId: string;
  initialLiked: boolean;
  likeCount: number;
  onLikeCountChange: (answerId: string, newLikeCount: number) => void;
  showLikeCount?: boolean;
}

const LikeButton: React.FC<LikeButtonProps> = ({
  answerId,
  initialLiked,
  likeCount,
  onLikeCountChange,
  showLikeCount = true,
}) => {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(likeCount);
  const [animate, setAnimate] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setAnimate(true);
    setTimeout(() => setAnimate(false), 300);

    try {
      await updateLike(answerId, uuid, newLikedState);
      onLikeCountChange(answerId, newLikedState ? likes + 1 : likes - 1);
      setLikes((prevLikes) => (newLikedState ? prevLikes + 1 : prevLikes - 1));
    } catch (error) {
      console.error('LikeButton: Like error:', error);
      setIsLiked(!newLikedState);
      setError(error instanceof Error ? error.message : 'An error occurred');
      setTimeout(() => setError(null), 3000);
      // Revert the like count if there's an error
      setLikes((prevLikes) => (newLikedState ? prevLikes - 1 : prevLikes + 1));
    }
  };

  return (
    <div className="like-container flex items-center space-x-1">
      <span className="text-sm text-gray-500">Found this helpful?</span>
      <button
        className={`heart-button ${isLiked ? 'liked' : ''} ${
          animate ? 'animate-pulse' : ''
        } flex items-center`}
        onClick={handleLike}
        aria-label={isLiked ? 'Unlike this answer' : 'Like this answer'}
        title="Like this answer to show it was helpful"
      >
        <span className="material-icons text-xl leading-none">
          {isLiked ? 'favorite' : 'favorite_border'}
        </span>
      </button>
      {showLikeCount && likes > 0 && (
        <span className="like-count text-sm">{likes}</span>
      )}
      {error && <span className="text-red-500 text-sm ml-2">{error}</span>}
    </div>
  );
};

export default LikeButton;
