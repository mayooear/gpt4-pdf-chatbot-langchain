import { SiteConfig } from '@/types/siteConfig';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '@/components/layout';
import AnswerItem from '@/components/AnswerItem';
import { Answer } from '@/types/answer';
import { checkUserLikes } from '@/services/likeService';
import { isSudo } from '@/utils/client/cookieUtils';
import { getOrCreateUUID } from '@/utils/client/uuid';
import { logEvent } from '@/utils/client/analytics';
import Head from 'next/head';

interface SingleAnswerProps {
  siteConfig: SiteConfig | null;
}

const SingleAnswer = ({ siteConfig }: SingleAnswerProps) => {
  const router = useRouter();
  const { answerId } = router.query;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [isSudoUser, setIsSudoUser] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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

  useEffect(() => {
    const checkSudoStatus = async () => {
      const cookies = document.cookie;
      const sudoStatus = await isSudo(cookies);
      setIsSudoUser(sudoStatus);
    };
    checkSudoStatus();
  }, []);

  useEffect(() => {
    const fetchLikeStatuses = async (answerIds: string[]) => {
      const uuid = getOrCreateUUID();
      const statuses = await checkUserLikes(answerIds, uuid);
      setLikeStatuses((prevStatuses) => ({ ...prevStatuses, ...statuses }));
    };

    if (answer) {
      fetchLikeStatuses([answer.id]);
    }
  }, [answer]);

  const handleLikeCountChange = (answerId: string, newLikeCount: number) => {
    if (answer) {
      setAnswer({
        ...answer,
        likeCount: newLikeCount,
      });
    }
    logEvent('like_answer', 'Engagement', answerId);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/answers/${answerId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      logEvent('copy_link', 'Engagement', `Answer ID: ${answerId}`);
    });
  };

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

  if (notFound) {
    return (
      <Layout siteConfig={siteConfig}>
        <div className="flex justify-center items-center h-screen">
          <p className="text-lg text-gray-600">Answer not found.</p>
        </div>
      </Layout>
    );
  }

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

  return (
    <Layout siteConfig={siteConfig}>
      <Head>
        <title>Ask Ananda Library: {answer.question.substring(0, 150)}</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <AnswerItem
          answer={answer}
          handleLikeCountChange={handleLikeCountChange}
          handleCopyLink={handleCopyLink}
          handleDelete={handleDelete}
          linkCopied={linkCopied ? answer.id : null}
          likeStatuses={likeStatuses}
          isSudoUser={isSudoUser}
          isFullPage={true}
        />
      </div>
    </Layout>
  );
};

export default SingleAnswer;
