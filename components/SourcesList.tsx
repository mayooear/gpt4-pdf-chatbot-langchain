import React, { useState, useCallback } from 'react';
import { Document } from 'langchain/document';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import styles from '@/styles/Home.module.css';
import { collectionsConfig, CollectionKey } from '@/utils/client/collectionsConfig';
import { logEvent } from '@/utils/client/analytics';
import AudioPlayer from './AudioPlayer';

interface SourcesListProps {
  sources: Document<Record<string, any>>[];
  useAccordion?: boolean;
  collectionName?: string;
  renderAudioPlayer?: (source: any, index: number) => React.ReactNode;
}

const SourcesList: React.FC<SourcesListProps> = ({ sources, useAccordion, collectionName = null, renderAudioPlayer }) => {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [audioPlayerIds, setAudioPlayerIds] = useState<Record<string, string>>({});

  const handleAudioPlay = useCallback((id: string) => {
    setCurrentlyPlayingId(id);
  }, []);

  const handleAudioPause = useCallback(() => {
    setCurrentlyPlayingId(null);
  }, []);

  const renderAudioPlayerWrapper = useCallback((doc: Document<Record<string, any>>, index: number) => {
    if (renderAudioPlayer && doc.metadata.type === 'audio') {
      const fileHash = doc.metadata.file_hash;
      const uniqueKey = `${fileHash}_${index}`;

      // Generate a unique ID for this audio player instance if it doesn't exist
      if (!audioPlayerIds[uniqueKey]) {
        setAudioPlayerIds(prev => ({
          ...prev,
          [uniqueKey]: `audio_${fileHash}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));
      }

      const audioId = audioPlayerIds[uniqueKey];

      return renderAudioPlayer({
        ...doc,
        onPlay: () => handleAudioPlay(audioId),
        onPause: handleAudioPause,
        isPlaying: currentlyPlayingId === audioId,
      }, index);
    }
    return null;
  }, [renderAudioPlayer, currentlyPlayingId, handleAudioPlay, handleAudioPause, audioPlayerIds]);

  // double colon separates parent title from the (child) source title, 
  // e.g., "2009 Summer Clarity Magazine:: Letters of Encouragement". We here 
  // replace double colon with right arrow.
  const formatTitle = (title: string) => title.replace(/::/g, ' > ');

  const displayCollectionName = collectionName ? collectionsConfig[collectionName as CollectionKey] : '';

  const handleExpandAll = () => {
    logEvent('expand_all_sources', 'UI', 'accordion');
  };

  const handleAccordionExpand = (expanded: boolean) => {
    logEvent('expand_sources', 'UI', expanded ? 'expanded' : 'collapsed');
  };

  const handleSourceClick = (e: React.MouseEvent<HTMLAnchorElement>, source: string) => {
    e.preventDefault(); // Prevent default link behavior
    logEvent('click_source', 'UI', source);
    window.open(source, '_blank', 'noopener,noreferrer'); // Open link manually
  };

  const truncateText = (text: string, wordLimit: number) => {
    const words = text.split(' ');
    return words.length > wordLimit ? words.slice(0, wordLimit).join(' ') + '...' : text;
  };

  if (useAccordion) {
    return (
      <>
      {sources.length > 0 && (
        <div>
          <Accordion type="single" collapsible onValueChange={(value) => handleAccordionExpand(!!value)}>
            <AccordionItem value="sources">
              <AccordionTrigger className="text-base font-semibold text-blue-500">
                Sources
              </AccordionTrigger>
              <AccordionContent>
                <ul className="text-base">
                  {sources.map((doc, index) => (
                    <li key={index}>
                      <a 
                        href={doc.metadata.source} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="hover:underline"
                        onClick={(e) => handleSourceClick(e, doc.metadata.source)}
                      >
                        {doc.metadata.title ? formatTitle(doc.metadata.title) : 'Unknown source'}
                      </a>
                      {doc.metadata.type === 'audio' && (
                        <p>{truncateText(doc.pageContent, 30)}</p>
                      )}
                      {doc.metadata.type === 'audio' && (
                        renderAudioPlayerWrapper(doc, index)
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
      </>
    );
  }

  return (
    <>
      {sources.length > 0 && (
      <div className="flex justify-between items-start w-full"> 
        <div className="flex-grow">
          <h3 className={styles.sourceDocsHeading}>
            Sources <a href="#" onClick={(e) => {
                e.preventDefault();
                const detailsElements = document.querySelectorAll('details');
                const areAllExpanded = Array.from(detailsElements).every(detail => detail.open);
                detailsElements.forEach(detail => { detail.open = !areAllExpanded; });
                if (e.target instanceof HTMLElement) {
                  e.target.textContent = areAllExpanded ? ' (expand all)' : ' (collapse all)';
                }
                handleExpandAll();
              }}
              className={styles.expandAllLink} style={{ fontSize: 'smaller', color: 'blue' }}>
              {document.querySelectorAll('details[open]').length === 0 ? ' (expand all)' : ' (collapse all)'}
            </a>
          </h3>
        </div>
        {displayCollectionName && (
          <span className="text-right text-gray-400 text-sm" style={{ alignSelf: 'flex-start' }}>
            {displayCollectionName}
          </span>
        )}
      </div>
      )}
      {sources.map((doc, index) => {
        return (
          <details 
            key={index} 
            className={styles.sourceDocsContainer}
            onToggle={(e) => {
              if (e.currentTarget instanceof HTMLDetailsElement) {
                logEvent('expand_source', 'UI', e.currentTarget.open ? 'expanded' : 'collapsed');
              }
            }}
          >
            <summary title="Click the triangle to see details or title to go to library source">
              {doc.metadata && doc.metadata.source ? (
                <a 
                  href={doc.metadata.source} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: 'blue' }}
                  onClick={(e) => handleSourceClick(e, doc.metadata.source)}
                >
                  {doc.metadata.title ? formatTitle(doc.metadata.title) : 'Unknown source'}
                </a>
              ) : doc.metadata.title ? (
                <span style={{ color: 'blue' }}>
                  {formatTitle(doc.metadata.title)}
                </span>
              ) : (
                <span style={{ color: 'blue' }}>
                  Unknown source
                </span>
              )}
            </summary>
            <div className={styles.sourceDocContent}>
              <ReactMarkdown remarkPlugins={[gfm]} linkTarget="_blank">
                {doc.metadata.type === 'audio' ? truncateText(doc.pageContent, 30) : `*${doc.pageContent}*`}
              </ReactMarkdown>
            </div>
            {doc.metadata && doc.metadata.type === 'audio' && (
              renderAudioPlayerWrapper(doc, index)
            )}
          </details>
        );
      })}
    </>
  );
};

export default SourcesList;