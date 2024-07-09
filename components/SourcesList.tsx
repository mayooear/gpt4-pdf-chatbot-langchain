import React, { useState, useCallback } from 'react';
import { Document } from 'langchain/document';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import styles from '@/styles/Home.module.css';
import { collectionsConfig, CollectionKey } from '@/utils/client/collectionsConfig';
import { logEvent } from '@/utils/client/analytics';
import { AudioPlayer } from './AudioPlayer';

interface SourcesListProps {
  sources: Document<Record<string, any>>[];
  useAccordion?: boolean;
  collectionName?: string;
}

const SourcesList: React.FC<SourcesListProps> = ({ sources, useAccordion, collectionName = null }) => {
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());

  const renderAudioPlayer = useCallback((doc: Document<Record<string, any>>, index: number) => {
    if (doc.metadata.type === 'audio') {
      const audioId = `audio_${doc.metadata.file_hash}_${index}`;
      return (
        <div className="pt-1 pb-2">
          <AudioPlayer
            key={audioId}
            src={`/api/audio/${doc.metadata.file_name}`}
            startTime={doc.metadata.start_time}
            endTime={doc.metadata.end_time}
            audioId={audioId}
            lazyLoad={true}
            isExpanded={expandedSources.has(index)}
          />
        </div>
      );
    }
    return null;
  }, [expandedSources]);

  // double colon separates parent title from the (child) source title, 
  // e.g., "2009 Summer Clarity Magazine:: Letters of Encouragement". We here 
  // replace double colon with right arrow.
  const formatTitle = (title: string) => title.replace(/::/g, ' > ');

  const displayCollectionName = collectionName ? collectionsConfig[collectionName as CollectionKey] : '';

  const handleExpandAll = () => {
    if (expandedSources.size === sources.length) {
      setExpandedSources(new Set());
    } else {
      setExpandedSources(new Set(sources.map((_, index) => index)));
    }
    logEvent('expand_all_sources', 'UI', 'accordion');
  };

  const handleSourceToggle = (index: number) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
    logEvent('expand_source', 'UI', expandedSources.has(index) ? 'collapsed' : 'expanded');
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
                        {doc.metadata.library && doc.metadata.library !== 'Ananda Library' && ` (${doc.metadata.library})`}
                      </a>
                      {doc.metadata.type === 'audio' && (
                        <p>{truncateText(doc.pageContent, 30)}</p>
                      )}
                      {doc.metadata.type === 'audio' && (
                        renderAudioPlayer(doc, index)
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
                  handleExpandAll();
                }}
                className={styles.expandAllLink} style={{ fontSize: 'smaller', color: 'blue' }}>
                {expandedSources.size === 0 ? ' (expand all)' : ' (collapse all)'}
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
            open={expandedSources.has(index)}
          >
            <summary onClick={(e) => {
              e.preventDefault();
              handleSourceToggle(index);
            }}>
              {doc.metadata && doc.metadata.source ? (
                <a 
                  href={doc.metadata.source} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: 'blue' }}
                  onClick={(e) => handleSourceClick(e, doc.metadata.source)}
                >
                  {doc.metadata.title ? formatTitle(doc.metadata.title) : doc.metadata['pdf.info.Title'] ? formatTitle(doc.metadata['pdf.info.Title']) : 'Unknown source'}
                  {doc.metadata.library && doc.metadata.library !== 'Ananda Library' && ` (${doc.metadata.library})`}
                </a>
              ) : doc.metadata.title ? (
                <span>
                  {formatTitle(doc.metadata.title)}
                  {doc.metadata.library && doc.metadata.library !== 'Ananda Library' && ` (${doc.metadata.library})`}
                </span>
              ) : doc.metadata['pdf.info.Title'] ? (
                <span style={{ color: 'blue' }}>
                  {formatTitle(doc.metadata['pdf.info.Title'])}
                  {doc.metadata.library && doc.metadata.library !== 'Ananda Library' && ` (${doc.metadata.library})`}
                </span>
              ) : (
                <span style={{ color: 'blue' }}>
                  Unknown source
                </span>
              )}
            </summary>
            <div className={`${styles.sourceDocContent}`}>
              <ReactMarkdown remarkPlugins={[gfm]} linkTarget="_blank">
                {doc.metadata.type === 'audio' ? `"${truncateText(doc.pageContent, 50)}"` : `*${doc.pageContent}*`}
              </ReactMarkdown>
            </div>
            {doc.metadata && doc.metadata.type === 'audio' && expandedSources.has(index) && (
              renderAudioPlayer(doc, index)
            )}
          </details>
        );
      })}
    </>
  );
};

export default SourcesList;