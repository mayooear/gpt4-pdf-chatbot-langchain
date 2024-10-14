import { logEvent } from '@/utils/client/analytics';

export const handleVote = async (
  docId: string,
  isUpvote: boolean,
  votes: Record<string, number>,
  setVotes: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  setVoteError: React.Dispatch<React.SetStateAction<string | null>>,
) => {
  if (!docId) {
    console.error('Vote error: Missing document ID');
    return;
  }

  const currentVote = votes[docId] || 0;
  let vote: number;

  if ((isUpvote && currentVote === 1) || (!isUpvote && currentVote === -1)) {
    vote = 0;
  } else {
    vote = isUpvote ? 1 : -1;
  }

  setVotes((prevVotes) => {
    const updatedVotes = { ...prevVotes, [docId]: vote };
    return updatedVotes;
  });

  logEvent(
    isUpvote ? 'upvote_answer' : 'downvote_answer',
    'Engagement',
    docId,
    vote,
  );

  try {
    const response = await fetch('/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docId, vote }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update vote');
    }
    setVotes({ ...votes, [docId]: vote });
  } catch (error) {
    console.error('Vote error:', error);
    setVoteError(
      error instanceof Error ? error.message : 'An error occurred while voting',
    );
    setTimeout(() => setVoteError(null), 3000);
  }
};
