// This component renders a single answer page, fetching and displaying the answer details,
// handling likes, and providing admin functionality for deletion.

import { SiteConfig } from '@/types/siteConfig';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '@/components/layout';
import AnswerItem from '@/components/AnswerItem';
import { Answer } from '@/types/answer';
import { checkUserLikes } from '@/services/likeService';
import { getOrCreateUUID } from '@/utils/client/uuid';
import { logEvent } from '@/utils/client/analytics';
import Head from 'next/head';
import { getShortname } from '@/utils/client/siteConfig';
import { useSudo } from '@/contexts/SudoContext';

interface SingleAnswerProps {
  siteConfig: SiteConfig | null;
}

const SingleAnswer = ({ siteConfig }: SingleAnswerProps) => {
  const router = useRouter();
  const { answerId } = router.query;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [notFound, setNotFound] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { isSudoUser } = useSudo();
  const [likeError, setLikeError] = useState<string | null>(null);

  // Fetch the answer data when the component mounts or answerId changes
  useEffect(() => {
    const fetchAnswer = async () => {
      const response = await fetch(`/api/answers?answerIds=${answerId}`);
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await response.json();
      setAnswer(data[0]);
    };

    if (answerId) {
      fetchAnswer();
    }
  }, [answerId]);

  // Fetch like statuses for the answer when it's loaded
  useEffect(() => {
    const fetchLikeStatuses = async (answerIds: string[]) => {
      try {
        const uuid = getOrCreateUUID();
        const statuses = await checkUserLikes(answerIds, uuid);
        setLikeStatuses((prevStatuses) => ({ ...prevStatuses, ...statuses }));
      } catch (error) {
        console.error('Error fetching like statuses:', error);
        setLikeError(
          error instanceof Error
            ? error.message
            : 'An error occurred while checking likes.',
        );
        setTimeout(() => setLikeError(null), 5000); // Clear error after 5 seconds
      }
    };

    if (answer) {
      fetchLikeStatuses([answer.id]);
    }
  }, [answer]);

  // Handle like count changes
  const handleLikeCountChange = (answerId: string, newLikeCount: number) => {
    try {
      if (answer) {
        setAnswer({
          ...answer,
          likeCount: newLikeCount,
        });
      }
      logEvent('like_answer', 'Engagement', answerId);
    } catch (error) {
      setLikeError(
        error instanceof Error ? error.message : 'An error occurred',
      );
      setTimeout(() => setLikeError(null), 3000);
    }
  };

  // Handle copying the answer link to clipboard
  const handleCopyLink = () => {
    const url = `${window.location.origin}/answers/${answerId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      logEvent('copy_link', 'Engagement', `Answer ID: ${answerId}`);
    });
  };

  // Handle answer deletion (admin functionality)
  const handleDelete = async (answerId: string) => {
    if (confirm('Are you sure you want to delete this answer?')) {
      try {
        const response = await fetch(`/api/answers?answerId=${answerId}`, {
          method: 'DELETE',
        });
        const responseData = await response.json();
        if (!response.ok) {
          throw new Error(
            'Failed to delete answer (' + responseData.message + ')',
          );
        }
        router.push('/answers');
        logEvent('delete_answer', 'Admin', answerId);
      } catch (error) {
        console.error('Error deleting answer:', error);
        alert('Failed to delete answer. Please try again.');
      }
    }
  };

  // Render "not found" message if the answer doesn't exist
  if (notFound) {
    return (
      <Layout siteConfig={siteConfig}>
        <div className="flex justify-center items-center h-screen">
          <p className="text-lg text-gray-600">Answer not found.</p>
        </div>
      </Layout>
    );
  }

  // Render loading spinner while fetching the answer
  if (!answer) {
    return (
      <Layout siteConfig={siteConfig}>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-blue-600"></div>
          <p className="text-lg text-gray-600 ml-4">Loading...</p>
        </div>
      </Layout>
    );
  }

  // Render the answer details
  return (
    <Layout siteConfig={siteConfig}>
      <Head>
        <title>
          {getShortname(siteConfig)}: {answer.question.substring(0, 150)}
        </title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <AnswerItem
          answer={answer}
          siteConfig={siteConfig}
          handleLikeCountChange={handleLikeCountChange}
          handleCopyLink={handleCopyLink}
          handleDelete={handleDelete}
          linkCopied={linkCopied ? answer.id : null}
          likeStatuses={likeStatuses}
          isSudoUser={isSudoUser}
          isFullPage={true}
        />
        {likeError && (
          <div className="text-red-500 text-sm mt-2">{likeError}</div>
        )}
      </div>
    </Layout>
  );
};

export default SingleAnswer;
