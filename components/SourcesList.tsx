import React, { useState, useCallback } from 'react';
import { Document } from 'langchain/document';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './ui/accordion';
import styles from '@/styles/Home.module.css';
import {
  collectionsConfig,
  CollectionKey,
} from '@/utils/client/collectionsConfig';
import { logEvent } from '@/utils/client/analytics';
import { AudioPlayer } from './AudioPlayer';

interface SourcesListProps {
  sources: Document<Record<string, any>>[];
  collectionName?: string;
}

const SourcesList: React.FC<SourcesListProps> = ({
  sources,
  collectionName = null,
}) => {
  const [expandedSources, setExpandedSources] = useState<Set<number>>(
    new Set(),
  );
  const [expandedAccordionSource, setExpandedAccordionSource] = useState<
    number | null
  >(null);

  const renderAudioPlayer = useCallback(
    (doc: Document<Record<string, any>>, index: number) => {
      if (doc.metadata.type === 'audio') {
        const audioId = `audio_${doc.metadata.file_hash}_${index}`;
        return (
          <div className="pt-1 pb-2">
            <AudioPlayer
              key={audioId}
              src={`/api/audio/${doc.metadata.filename}`}
              startTime={doc.metadata.start_time}
              audioId={audioId}
              lazyLoad={true}
              isExpanded={expandedSources.has(index)}
            />
          </div>
        );
      }
      return null;
    },
    [expandedSources],
  );

  const transformYouTubeUrl = (url: string, startTime: number) => {
    const urlObj = new URL(url);
    let videoId = '';
    if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    } else if (
      urlObj.hostname === 'www.youtube.com' &&
      urlObj.pathname.includes('watch')
    ) {
      videoId = urlObj.searchParams.get('v') || '';
    }
    const baseUrl = `https://www.youtube.com/embed/${videoId}`;
    const params = new URLSearchParams(urlObj.search);
    params.set('start', Math.floor(startTime).toString());
    params.set('rel', '0');
    return `${baseUrl}?${params.toString()}`;
  };

  const renderYouTubePlayer = useCallback(
    (doc: Document<Record<string, any>>, index: number) => {
      if (doc.metadata.type === 'youtube') {
        const embedUrl = transformYouTubeUrl(
          doc.metadata.url,
          doc.metadata.start_time,
        );
        return (
          <div className="aspect-video mb-7">
            <iframe
              className="h-full w-full rounded-lg"
              src={embedUrl}
              title={doc.metadata.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        );
      }
      return null;
    },
    [],
  );

  // double colon separates parent title from the (child) source title,
  // e.g., "2009 Summer Clarity Magazine:: Letters of Encouragement". We here
  // replace double colon with right arrow.
  const formatTitle = (title: string) => title.replace(/::/g, ' > ');

  const displayCollectionName = collectionName
    ? collectionsConfig[collectionName as CollectionKey]
    : '';

  const handleExpandAll = () => {
    if (expandedSources.size === sources.length) {
      setExpandedSources(new Set());
    } else {
      setExpandedSources(new Set(sources.map((_, index) => index)));
    }
    logEvent('expand_all_sources', 'UI', 'accordion');
  };

  const handleSourceToggle = (index: number) => {
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
    logEvent(
      'expand_source',
      'UI',
      expandedSources.has(index) ? 'collapsed' : 'expanded',
    );
  };

  const handleAccordionExpand = (index: number | null) => {
    setExpandedAccordionSource(index);
    logEvent('expand_sources', 'UI', index !== null ? 'expanded' : 'collapsed');
  };

  const handleSourceClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    source: string,
  ) => {
    e.preventDefault(); // Prevent default link behavior
    logEvent('click_source', 'UI', source);
    window.open(source, '_blank', 'noopener,noreferrer'); // Open link manually
  };

  const truncateText = (text: string, wordLimit: number) => {
    const words = text.split(' ');
    return words.length > wordLimit
      ? words.slice(0, wordLimit).join(' ') + '...'
      : text;
  };

  const getSourceIcon = (doc: Document<Record<string, any>>) => {
    switch (doc.metadata.type) {
      case 'audio':
        return 'mic';
      case 'youtube':
        return 'videocam';
      default:
        return 'description';
    }
  };

  const renderSourceTitle = (doc: Document<Record<string, any>>) => {
    return (
      <span className="text-black-600 font-medium">
        {formatTitle(
          doc.metadata.title ||
            doc.metadata['pdf.info.Title'] ||
            'Unknown source',
        )}
        <span className="ml-4 text-gray-500 font-normal">
          {doc.metadata.library}
        </span>
      </span>
    );
  };

  return (
    <div className="bg-gray-200 pt-2 pb-3 px-3 rounded-lg mt-0 sourcesContainer">
      {sources.length > 0 && (
        <div className="flex justify-between items-end w-full mb-2">
          <div className="flex items-baseline">
            <h3 className="text-lg !font-bold mr-2">Sources</h3>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleExpandAll();
              }}
              className="text-sm text-blue-500 hover:underline"
            >
              {expandedSources.size === 0 ? '(expand all)' : '(collapse all)'}
            </a>
          </div>
          {displayCollectionName && (
            <span className="text-sm text-gray-400">
              {displayCollectionName}
            </span>
          )}
        </div>
      )}
      {sources.map((doc, index) => {
        const isExpanded = expandedSources.has(index);
        return (
          <details
            key={index}
            className={`${styles.sourceDocsContainer} ${
              isExpanded && index !== 0 ? 'mt-4' : ''
            }`}
            open={isExpanded}
          >
            <summary
              onClick={(e) => {
                e.preventDefault();
                handleSourceToggle(index);
              }}
              className="flex items-center cursor-pointer list-none"
            >
              <div className="flex items-center mr-2 w-8">
                <span className="inline-block w-4 h-4 transition-transform duration-200 transform group-open:rotate-90">
                  ▶
                </span>
                <span className="material-icons text-sm ml-1">
                  {getSourceIcon(doc)}
                </span>
              </div>
              {doc.metadata && doc.metadata.source ? (
                <div className="flex items-center flex-grow">
                  <a
                    href={doc.metadata.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline mr-4"
                    onClick={(e) => handleSourceClick(e, doc.metadata.source)}
                  >
                    <span className="font-medium">
                      {renderSourceTitle(doc)}
                    </span>
                  </a>
                </div>
              ) : doc.metadata.title ? (
                <span className="flex items-center flex-grow">
                  <span className="font-medium mr-4">
                    {renderSourceTitle(doc)}
                  </span>
                </span>
              ) : doc.metadata['pdf.info.Title'] ? (
                <span className="text-blue-600 flex items-center flex-grow">
                  <span className="font-medium mr-4">
                    {renderSourceTitle(doc)}
                  </span>
                </span>
              ) : (
                <span className="text-blue-600 flex items-center flex-grow">
                  <span className="font-medium mr-4">
                    {renderSourceTitle(doc)}
                  </span>
                </span>
              )}
            </summary>
            <div className="pl-5 mt-2">
              <ReactMarkdown remarkPlugins={[gfm]} linkTarget="_blank">
                {doc.pageContent}
              </ReactMarkdown>
              {doc.metadata &&
                doc.metadata.type === 'audio' &&
                expandedSources.has(index) &&
                renderAudioPlayer(doc, index)}
              {doc.metadata &&
                doc.metadata.type === 'youtube' &&
                expandedSources.has(index) &&
                renderYouTubePlayer(doc, index)}
            </div>
          </details>
        );
      })}
    </div>
  );
};

export default SourcesList;
