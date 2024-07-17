import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '@/components/layout';
import CopyButton from '@/components/CopyButton';
import LikeButton from '@/components/LikeButton';
import SourcesList from '@/components/SourcesList';
import TruncatedMarkdown from '@/components/TruncatedMarkdown';
import { Answer } from '@/types/answer';
import { checkUserLikes } from '@/services/likeService';
import { isSudo } from '@/utils/client/cookieUtils';
import { collectionsConfig } from '@/utils/client/collectionsConfig';
import { formatDistanceToNow } from 'date-fns';
import { getOrCreateUUID } from '@/utils/client/uuid';
import { logEvent } from '@/utils/client/analytics';
import React from 'react';
import Head from 'next/head';

const SingleAnswer = () => {
  const router = useRouter();
  const { answerId } = router.query;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [isSudoUser, setIsSudoUser] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const renderTruncatedQuestion = (question: string, maxLength: number) => {
    const truncated = question.slice(0, maxLength);
    return truncated.split('\n').map((line, i, arr) => (
      <React.Fragment key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/answers/${answerId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      logEvent('copy_link', 'Engagement', `Answer ID: ${answerId}`);
    });
  };

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
      setLikeStatuses(prevStatuses => ({ ...prevStatuses, ...statuses }));
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

  const handleDelete = async (answerId: string) => {
    if (confirm('Are you sure you want to delete this answer?')) {
      try {
        const response = await fetch(`/api/answers?answerId=${answerId}`, {
          method: 'DELETE',
        });
        const responseData = await response.json();
        if (!response.ok) {
          throw new Error('Failed to delete answer (' + responseData.message + ')');
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
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-lg text-gray-600">Answer not found.</p>
        </div>
      </Layout>
    );
  }

  if (!answer) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-blue-600"></div>
          <p className="text-lg text-gray-600 ml-4">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Ask Ananda Library: {answer.question.substring(0, 150)}</title>
      </Head>
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => router.push('/answers')} className="text-blue-600 hover:underline">
          &larr; Back to All Answers
        </button>
      </div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-2.5 m-2.5">
          <div className="flex items-center">
            <span className="material-icons">question_answer</span>
            <div className="ml-4 flex-grow">
              <div className="mb-2">
                <b className="text-black-600 block">
                  {expanded ? (
                    answer.question.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < answer.question.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))
                  ) : (
                    <>
                      {renderTruncatedQuestion(answer.question, 200)}
                      {answer.question.length > 200 && '...'}
                    </>
                  )}
                  {answer.question.length > 200 && !expanded && (
                    <button 
                      onClick={() => setExpanded(true)}
                      className="text-black hover:underline ml-2"
                    >
                      Show More
                    </button>
                  )}
                </b>
              </div>
              <div className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(answer.timestamp._seconds * 1000), { addSuffix: true })}
                <span className="ml-4">
                  {answer.collection ? collectionsConfig[answer.collection as keyof typeof collectionsConfig].replace(/ /g, "\u00a0") : 'Unknown\u00a0Collection'}
                </span>            
              </div>
            </div>
          </div>
          <div className="bg-gray-100 p-2.5 rounded">
            <div className="markdownanswer">
              <TruncatedMarkdown markdown={answer.answer} maxCharacters={600} />
              {answer.sources && (
                <SourcesList sources={answer.sources} />
              )}
              <div className="flex items-center">
                <CopyButton
                  markdown={answer.answer}
                  answerId={answer.id}
                />
                <button
                    onClick={handleCopyLink}
                    className="ml-4 text-black-600 hover:underline flex items-center"
                    title="Copy link to clipboard"
                >
                    <span className="material-icons">
                      {linkCopied ? 'check' : 'link'}
                    </span>
                </button>
                <div className="ml-4">
                  <LikeButton
                    key={`${answer.id}-${likeStatuses[answer.id]}`}
                    answerId={answer.id}
                    initialLiked={likeStatuses[answer.id] || false}
                    likeCount={answer.likeCount}
                    onLikeCountChange={handleLikeCountChange}
                  />
                </div>
                {isSudoUser && (
                  <>
                    <button onClick={() => handleDelete(answer.id)} className="ml-4 text-red-600">
                      <span className="material-icons">delete</span>
                    </button>
                    <span className="ml-6">IP: ({answer.ip})</span>
                    {answer.vote === -1 && (
                      <button
                        className="ml-4 text-red-600"
                        title="Downvote"
                      >
                        <span className="material-icons">thumb_down</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SingleAnswer;