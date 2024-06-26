import React from 'react';
import { Document } from 'langchain/document';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import styles from '@/styles/Home.module.css';
import { collectionsConfig, CollectionKey } from '@/utils/client/collectionsConfig';
import { logEvent } from '@/utils/client/analytics';

interface SourcesListProps {
  sources: Document<Record<string, any>>[];
  useAccordion?: boolean;
  collectionName?: string; 
}

const SourcesList: React.FC<SourcesListProps> = ({ sources, useAccordion, collectionName = null }) => {
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
                        {doc.metadata['pdf.info.Title'] ? formatTitle(doc.metadata['pdf.info.Title']) : doc.metadata.source}
                      </a>
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
      {sources.map((doc, index) => (
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
            {doc.metadata.source.startsWith('http') ? (
              <a 
                href={doc.metadata.source} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ color: 'blue' }}
                onClick={(e) => handleSourceClick(e, doc.metadata.source)}
              >
                {doc.metadata['pdf.info.Title'] ? formatTitle(doc.metadata['pdf.info.Title'].replace(/&amp;/g, '&')) : doc.metadata.source}
              </a>
            ) : (
              doc.metadata.source
            )}
          </summary>
          <div className={styles.sourceDocContent}>
            <ReactMarkdown remarkPlugins={[gfm]} linkTarget="_blank">
              {`*${doc.pageContent}*`}
            </ReactMarkdown>
          </div>
        </details>
      ))}
    </>
  );
};

export default SourcesList;
