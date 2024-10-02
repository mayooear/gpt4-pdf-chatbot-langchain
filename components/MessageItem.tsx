import React, { Fragment } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import styles from '@/styles/Home.module.css';
import markdownStyles from '@/styles/MarkdownStyles.module.css';
import SourcesList from '@/components/SourcesList';
import CopyButton from '@/components/CopyButton';
import LikeButton from '@/components/LikeButton';
import { SiteConfig } from '@/types/siteConfig';
import { ExtendedAIMessage } from '@/types/ExtendedAIMessage';

interface MessageItemProps {
  message: ExtendedAIMessage;
  previousMessage?: ExtendedAIMessage;
  index: number;
  isLastMessage: boolean;
  loading: boolean;
  privateSession: boolean;
  collectionChanged: boolean;
  hasMultipleCollections: boolean;
  likeStatuses: Record<string, boolean>;
  linkCopied: string | null;
  votes: Record<string, number>;
  siteConfig: SiteConfig | null;
  handleLikeCountChange: (answerId: string, liked: boolean) => void;
  handleCopyLink: (answerId: string) => void;
  handleVote: (docId: string, isUpvote: boolean) => void;
  lastMessageRef: React.RefObject<HTMLDivElement> | null;
  messageKey: string;
}

function MessageItem({
  message,
  previousMessage,
  index,
  isLastMessage,
  loading,
  privateSession,
  collectionChanged,
  hasMultipleCollections,
  likeStatuses,
  linkCopied,
  votes,
  siteConfig,
  handleLikeCountChange,
  handleCopyLink,
  handleVote,
  lastMessageRef,
  messageKey,
}: MessageItemProps) {
  let icon;
  let className;

  if (message.type === 'apiMessage') {
    icon = (
      <Image
        src="/bot-image.png"
        alt="AI"
        width={40}
        height={40}
        className="rounded-sm"
        priority
      />
    );
    className = 'bg-gray-50';
  } else {
    icon = (
      <Image
        src="/usericon.png"
        alt="Me"
        width={30}
        height={30}
        className="rounded-sm"
        priority
      />
    );
    className =
      loading && isLastMessage ? styles.usermessagewaiting : styles.usermessage;
  }

  return (
    <Fragment key={messageKey}>
      {message.type === 'apiMessage' && index > 0 && (
        <hr className="border-t border-gray-200 mb-0" />
      )}
      <div
        className={`${className} p-2 px-3`}
        ref={isLastMessage ? lastMessageRef : null}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-2">{icon}</div>
          <div className="flex-grow">
            <div className="max-w-none">
              {message.sourceDocs && (
                <div className="mb-2">
                  <SourcesList
                    sources={message.sourceDocs}
                    collectionName={
                      collectionChanged && hasMultipleCollections
                        ? message.collection
                        : null
                    }
                  />
                </div>
              )}
              <ReactMarkdown
                remarkPlugins={[gfm]}
                components={{
                  a: ({ ...props }) => (
                    <a target="_blank" rel="noopener noreferrer" {...props} />
                  ),
                }}
                className={`mt-1 ${markdownStyles.markdownanswer}`}
              >
                {message.message
                  .replace(/\n/g, '  \n')
                  .replace(/\n\n/g, '\n\n')}
              </ReactMarkdown>
            </div>
            {/* Action icons container */}
            <div className="mt-2 flex items-center space-x-2">
              {message.type === 'apiMessage' && index !== 0 && (
                <>
                  <CopyButton
                    markdown={message.message}
                    answerId={message.docId ?? ''}
                    sources={message.sourceDocs}
                    question={previousMessage?.message ?? ''}
                    siteConfig={siteConfig}
                  />
                </>
              )}
              {!privateSession &&
                message.type === 'apiMessage' &&
                message.docId && (
                  <>
                    <button
                      onClick={() => handleCopyLink(message.docId ?? '')}
                      className="text-black-600 hover:underline flex items-center"
                      title="Copy link to clipboard"
                    >
                      <span className="material-icons">
                        {linkCopied === message.docId ? 'check' : 'link'}
                      </span>
                    </button>
                    <LikeButton
                      answerId={message.docId ?? ''}
                      initialLiked={likeStatuses[message.docId ?? ''] || false}
                      likeCount={0}
                      onLikeCountChange={(answerId, newLikeCount) =>
                        handleLikeCountChange(answerId, newLikeCount > 0)
                      }
                      showLikeCount={false}
                    />
                    <button
                      onClick={() => handleVote(message.docId ?? '', false)}
                      className={`${styles.voteButton} ${
                        votes[message.docId ?? ''] === -1
                          ? styles.voteButtonDownActive
                          : ''
                      } hover:bg-gray-200 flex items-center`}
                      title="Downvote (private) for system training"
                    >
                      <span className="material-icons text-black">
                        {votes[message.docId ?? ''] === -1
                          ? 'thumb_down'
                          : 'thumb_down_off_alt'}
                      </span>
                    </button>
                  </>
                )}
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}

export default MessageItem;
