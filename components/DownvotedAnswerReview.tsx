import React, { useState } from 'react';
import Link from 'next/link';
import { Answer, AdminAction } from '@/types/answer';
import TruncatedMarkdown from './TruncatedMarkdown';
import SourcesList from './SourcesList';
import { useMultipleCollections } from '../hooks/useMultipleCollections';
import { SiteConfig } from '../types/siteConfig';

interface DownvotedAnswerReviewProps {
  answer: Answer;
  siteConfig: SiteConfig;
}

const DownvotedAnswerReview: React.FC<DownvotedAnswerReviewProps> = ({
  answer,
  siteConfig,
}) => {
  const hasMultipleCollections = useMultipleCollections(siteConfig);

  const [adminAction, setAdminAction] = useState<AdminAction | undefined>(
    answer.adminAction,
  );

  const handleReview = async (newAction: AdminAction) => {
    try {
      const updatedAction = adminAction === newAction ? undefined : newAction;
      const response = await fetch('/api/adminAction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ docId: answer.id, action: updatedAction }),
      });

      if (response.ok) {
        setAdminAction(updatedAction);
      } else {
        console.error('Failed to update admin action');
      }
    } catch (error) {
      console.error('Error updating admin action:', error);
    }
  };

  const formatTimestamp = (timestamp: {
    _seconds: number;
    _nanoseconds: number;
  }) => {
    return new Date(timestamp._seconds * 1000).toLocaleString();
  };

  // Parse sources if they are stored as a string
  const parsedSources = answer.sources
    ? Array.isArray(answer.sources)
      ? answer.sources
      : JSON.parse(answer.sources as unknown as string)
    : [];

  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-4">
      <Link
        href={`/answers/${answer.id}`}
        className="text-black-600 hover:underline cursor-pointer"
      >
        <h2 className="text-xl font-semibold mb-2">{answer.question}</h2>
      </Link>
      <div className="mb-4">
        <TruncatedMarkdown markdown={answer.answer || ''} maxCharacters={300} />
      </div>
      {parsedSources.length > 0 && (
        <SourcesList
          sources={parsedSources}
          collectionName={hasMultipleCollections ? answer.collection : null}
        />
      )}
      <div className="mt-2 text-sm text-gray-600">
        Downvoted on: {formatTimestamp(answer.timestamp)}
      </div>
      {answer.adminAction && (
        <div className="mt-2 text-sm text-gray-600">
          Previous admin action: {answer.adminAction} on{' '}
          {formatTimestamp(answer.adminActionTimestamp!)}
        </div>
      )}
      <div className="mt-4 flex justify-end space-x-2">
        <button
          onClick={() => handleReview('affirmed')}
          className={`px-4 py-2 rounded ${
            adminAction === 'affirmed' ? 'bg-red-500 text-white' : 'bg-red-200'
          }`}
        >
          Affirm Downvote
        </button>
        <button
          onClick={() => handleReview('ignore')}
          className={`px-4 py-2 rounded ${
            adminAction === 'ignore' ? 'bg-gray-500 text-white' : 'bg-gray-200'
          }`}
        >
          Ignore
        </button>
        <button
          onClick={() => handleReview('fixed')}
          className={`px-4 py-2 rounded ${
            adminAction === 'fixed' ? 'bg-green-500 text-white' : 'bg-green-200'
          }`}
        >
          Fixed
        </button>
      </div>
    </div>
  );
};

export default DownvotedAnswerReview;
