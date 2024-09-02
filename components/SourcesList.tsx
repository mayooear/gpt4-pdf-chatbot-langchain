import React, { useState, useCallback } from 'react';
import { Document } from 'langchain/document';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import styles from '@/styles/Home.module.css';
import {
  collectionsConfig,
  CollectionKey,
} from '@/utils/client/collectionsConfig';
import { logEvent } from '@/utils/client/analytics';
import { AudioPlayer } from './AudioPlayer';
import {
  getMappedLibraryName,
  getLibraryUrl,
} from '@/utils/client/libraryMappings';

// Add this helper function at the top of the file, outside the component
const extractTitle = (metadata: Record<string, any>): string => {
  return metadata.title || metadata['pdf.info.Title'] || 'Unknown source';
};

interface SourcesListProps {
  sources: Document<Record<string, any>>[];
  collectionName?: string | null;
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
    (
      doc: Document<Record<string, any>>,
      index: number,
      isExpanded: boolean,
    ) => {
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
              isExpanded={isExpanded}
            />
          </div>
        );
      }
      return null;
    },
    [],
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
  const formatTitle = (title: string | undefined) =>
    (title || '').replace(/::/g, ' > ');

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

  const handleSourceClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    source: string,
  ) => {
    e.preventDefault(); // Prevent default link behavior
    logEvent('click_source', 'UI', source);
    window.open(source, '_blank', 'noopener,noreferrer'); // Open link manually
  };

  const handleLibraryClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    library: string,
  ) => {
    e.preventDefault();
    const libraryUrl = getLibraryUrl(library);
    if (libraryUrl) {
      logEvent('click_library', 'UI', library);
      window.open(libraryUrl, '_blank', 'noopener,noreferrer');
    }
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
    // Extract the title using the helper function
    let sourceTitle = formatTitle(extractTitle(doc.metadata));

    // For audio sources with album metadata, format as "Album > Title"
    if (doc.metadata.type === 'audio' && doc.metadata.album) {
      sourceTitle = `${doc.metadata.album} > ${sourceTitle}`;
    }

    return (
      <span
        className={
          doc.metadata.source
            ? 'text-blue-600 font-medium'
            : 'text-black font-medium'
        }
      >
        {doc.metadata.source ? (
          <a
            href={doc.metadata.source}
            onClick={(e) => handleSourceClick(e, doc.metadata.source)}
            className="hover:underline"
          >
            {sourceTitle}
          </a>
        ) : (
          sourceTitle
        )}
      </span>
    );
  };

  const renderLibraryName = (doc: Document<Record<string, any>>) => {
    const libraryName = getMappedLibraryName(doc.metadata.library);
    const libraryUrl = getLibraryUrl(doc.metadata.library);

    return libraryUrl ? (
      <a
        href={libraryUrl}
        onClick={(e) => handleLibraryClick(e, doc.metadata.library)}
        className={`${styles.libraryNameLink} text-gray-400 hover:text-gray-600 text-sm hover:underline`}
      >
        {libraryName}
      </a>
    ) : (
      <span className={`${styles.libraryNameText} text-gray-400 text-sm`}>
        {libraryName}
      </span>
    );
  };

  const handleSummaryClick = (
    e: React.MouseEvent,
    index: number,
    doc: Document<Record<string, any>>,
  ) => {
    const target = e.target as HTMLElement;
    const isClickOnLink = target.tagName === 'A' || target.closest('a');
    const isClickOnArrow =
      target.classList.contains('arrow-icon') || target.closest('.arrow-icon');

    if (!isClickOnLink && (isClickOnArrow || !doc.metadata.source)) {
      e.preventDefault();
      handleSourceToggle(index);
    }
  };

  return (
    <div className="bg-white sourcesContainer pb-4">
      {sources.length > 0 && (
        <div className="flex justify-between items-center w-full border-b border-gray-200 px-3 py-1">
          <div className="flex items-baseline">
            <h3 className="text-base font-bold mr-2">Sources</h3>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleExpandAll();
              }}
              className="text-sm text-blue-600 hover:underline"
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
      <div className="px-3">
        {sources.map((doc, index) => {
          const isExpanded = expandedSources.has(index);
          const isLastSource = index === sources.length - 1;
          return (
            <details
              key={index}
              className={`${styles.sourceDocsContainer} ${
                isLastSource ? '' : 'border-b border-gray-200'
              } group`}
              open={isExpanded}
            >
              <summary
                onClick={(e) => handleSummaryClick(e, index, doc)}
                className="flex items-center cursor-pointer list-none py-1 px-2 hover:bg-gray-50"
              >
                <div className="grid grid-cols-[auto_1fr_auto] items-center w-full gap-2">
                  <div className="flex items-center">
                    <span className="inline-block w-4 h-4 transition-transform duration-200 transform group-open:rotate-90 arrow-icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span className="material-icons text-sm ml-1">
                      {getSourceIcon(doc)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {renderSourceTitle(doc)}
                  </div>
                  <div className="text-right">
                    {doc.metadata.library &&
                      doc.metadata.library !== 'Default Library' &&
                      renderLibraryName(doc)}
                  </div>
                </div>
              </summary>
              <div className="pl-5 pb-1">
                {isExpanded && (
                  <>
                    {doc.metadata &&
                      doc.metadata.type === 'audio' &&
                      renderAudioPlayer(doc, index, isExpanded)}
                    {doc.metadata &&
                      doc.metadata.type === 'youtube' &&
                      renderYouTubePlayer(doc, index)}
                  </>
                )}
                <ReactMarkdown remarkPlugins={[gfm]} linkTarget="_blank">
                  {doc.pageContent}
                </ReactMarkdown>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
};

export default SourcesList;
