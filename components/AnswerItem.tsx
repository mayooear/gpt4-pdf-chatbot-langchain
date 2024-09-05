import React, { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import TruncatedMarkdown from '@/components/TruncatedMarkdown';
import SourcesList from '@/components/SourcesList';
import CopyButton from '@/components/CopyButton';
import LikeButton from '@/components/LikeButton';
import { Answer } from '@/types/answer';
import { collectionsConfig } from '@/utils/client/collectionsConfig';
import { useMultipleCollections } from '@/hooks/useMultipleCollections';
import { SiteConfig } from '@/types/siteConfig';
import markdownStyles from '@/styles/MarkdownStyles.module.css';
import { DocMetadata } from '@/types/DocMetadata';
import { Document } from 'langchain/document';

interface AnswerItemProps {
  answer: Answer;
  handleLikeCountChange: (answerId: string, newLikeCount: number) => void;
  handleCopyLink: (answerId: string) => void;
  handleDelete?: (answerId: string) => void;
  linkCopied: string | null;
  likeStatuses: Record<string, boolean>;
  isSudoUser: boolean;
  isFullPage?: boolean;
  siteConfig: SiteConfig | null;
}

const SIMILARITY_THRESHOLD = 0.15;

const AnswerItem: React.FC<AnswerItemProps> = ({
  answer,
  handleLikeCountChange,
  handleCopyLink,
  handleDelete,
  linkCopied,
  likeStatuses,
  isSudoUser,
  isFullPage = false,
  siteConfig,
}) => {
  const hasMultipleCollections = useMultipleCollections(
    siteConfig || undefined,
  );
  const [expanded, setExpanded] = useState(isFullPage);

  const renderTruncatedQuestion = (question: string, maxLength: number) => {
    if (!question) {
      console.error('renderTruncatedQuestion called with undefined question');
      return null;
    }
    const truncated = question.slice(0, maxLength);
    return truncated
      .split('\n')
      .map((line: string, i: number, arr: string[]) => (
        <React.Fragment key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ));
  };

  const truncateTitle = (title: string, maxLength: number) => {
    return title.length > maxLength ? `${title.slice(0, maxLength)}...` : title;
  };

  return (
    <div
      className={`bg-white p-2 sm:p-2.5 ${
        isFullPage ? '' : 'mb-4'
      } rounded-lg shadow`}
    >
      <div className="flex items-start">
        <span className="material-icons mt-1 mr-2 flex-shrink-0">
          question_answer
        </span>
        <div className="flex-grow min-w-0">
          <div className="mb-2">
            {isFullPage ? (
              <b className="block break-words">
                {expanded ? (
                  answer.question.split('\n').map((line: string, i: number) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < answer.question.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))
                ) : (
                  <>
                    {renderTruncatedQuestion(answer.question, 600)}
                    {answer.question.length > 600 && '...'}
                  </>
                )}
              </b>
            ) : (
              <Link href={`/answers/${answer.id}`} legacyBehavior>
                <a className="text-black-600 hover:underline cursor-pointer">
                  <b className="block break-words">
                    {expanded ? (
                      answer.question
                        .split('\n')
                        .map((line: string, i: number) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < answer.question.split('\n').length - 1 && (
                              <br />
                            )}
                          </React.Fragment>
                        ))
                    ) : (
                      <>
                        {renderTruncatedQuestion(answer.question, 200)}
                        {answer.question.length > 200 && '...'}
                      </>
                    )}
                  </b>
                </a>
              </Link>
            )}
            {((isFullPage && answer.question.length > 600) ||
              (!isFullPage && answer.question.length > 200)) &&
              !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-black hover:underline ml-2"
                >
                  <b>See More</b>
                </button>
              )}
          </div>
          <div className="text-sm text-gray-500 flex flex-wrap">
            <span className="mr-4">
              {formatDistanceToNow(new Date(answer.timestamp._seconds * 1000), {
                addSuffix: true,
              })}
            </span>
            {hasMultipleCollections && (
              <span>
                {answer.collection
                  ? collectionsConfig[
                      answer.collection as keyof typeof collectionsConfig
                    ]?.replace(/ /g, '\u00a0') || 'Unknown\u00a0Collection'
                  : 'Unknown\u00a0Collection'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="bg-gray-100 p-2 sm:p-2.5 rounded mt-2">
        <div className={`${markdownStyles.markdownanswer} overflow-x-auto`}>
          <TruncatedMarkdown
            markdown={answer.answer}
            maxCharacters={isFullPage ? 4000 : 600}
          />
          {answer.sources && (
            <SourcesList
              sources={answer.sources as Document<DocMetadata>[]}
              collectionName={hasMultipleCollections ? answer.collection : null}
            />
          )}
          {answer.relatedQuestionsV2 &&
            answer.relatedQuestionsV2.filter(
              (q: { similarity: number }) =>
                q.similarity >= SIMILARITY_THRESHOLD,
            ).length > 0 && (
              <div className="bg-gray-200 pt-0.5 pb-3 px-3 rounded-lg mt-2 mb-2">
                <h3 className="text-lg !font-bold mb-2">Related Questions</h3>
                <ul className="list-disc pl-2">
                  {answer.relatedQuestionsV2
                    .filter(
                      (q: { similarity: number }) =>
                        q.similarity >= SIMILARITY_THRESHOLD,
                    )
                    .map((relatedQuestion: { id: string; title: string }) => (
                      <li key={relatedQuestion.id} className="ml-0">
                        <a
                          href={`/answers/${relatedQuestion.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {truncateTitle(relatedQuestion.title, 150)}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          <div className="flex flex-wrap items-center mt-2">
            <CopyButton
              markdown={answer.answer}
              answerId={answer.id}
              sources={answer.sources as Document<DocMetadata>[] | undefined}
              question={answer.question}
            />
            <button
              onClick={() => handleCopyLink(answer.id)}
              className="ml-2 sm:ml-4 text-black-600 hover:underline flex items-center"
              title="Copy link to clipboard"
            >
              <span className="material-icons">
                {linkCopied === answer.id ? 'check' : 'link'}
              </span>
            </button>
            <div className="ml-2 sm:ml-4">
              <LikeButton
                answerId={answer.id}
                initialLiked={likeStatuses[answer.id] || false}
                likeCount={answer.likeCount}
                onLikeCountChange={handleLikeCountChange}
              />
            </div>
            {isSudoUser && (
              <>
                <button
                  onClick={() => handleDelete && handleDelete(answer.id)}
                  className="ml-4 text-red-600"
                >
                  <span className="material-icons">delete</span>
                </button>
                <span className="ml-6">IP: ({answer.ip})</span>
                {answer.vote === -1 && (
                  <button className="ml-4 text-red-600" title="Downvote">
                    <span className="material-icons">thumb_down</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnswerItem;
