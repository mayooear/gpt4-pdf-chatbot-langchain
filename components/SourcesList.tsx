import React from 'react';
import { Document } from 'langchain/document';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import styles from '@/styles/Home.module.css';

interface SourcesListProps {
  sources: Document[];
  useAccordion?: boolean;
}

const SourcesList: React.FC<SourcesListProps> = ({ sources, useAccordion = false }) => {
  // double colon separates parent title from the (child) source title, 
  // e.g., "2009 Summer Clarity Magazine:: Letters of Encouragement". We here 
  // replace double colon with single colon. In the future we could want to use this to
  // differentiate in some way from a colon that shows up in the child source title. 
  const formatTitle = (title: string) => title.replace(/::/g, ':');
  if (useAccordion) {
    return (
      <>
      {sources.length > 0 && (
        <div>
          <Accordion type="single" collapsible>
            <AccordionItem value="sources">
              <AccordionTrigger className="text-base font-semibold text-blue-500">Sources</AccordionTrigger>
              <AccordionContent>
                <ul className="text-base">
                  {sources.map((doc, index) => (
                    <li key={index}>
                      <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
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
        <h3 className={styles.sourceDocsHeading}>
          Sources <a href="#" onClick={(e) => {
              e.preventDefault();
              const detailsElements = document.querySelectorAll('details');
              const areAllExpanded = Array.from(detailsElements).every(detail => detail.open);
              detailsElements.forEach(detail => { detail.open = !areAllExpanded; });
              if (e.target instanceof HTMLElement) {
                e.target.textContent = areAllExpanded ? ' (expand all)' : ' (collapse all)';
              }
            }}
            className={styles.expandAllLink} style={{ fontSize: 'smaller', color: 'blue' }}>
            {document.querySelectorAll('details[open]').length === 0 ? ' (expand all)' : ' (collapse all)'}
          </a>
        </h3>
      )}
      {sources.map((doc, index) => (
        <details key={index} className={styles.sourceDocsContainer}>
          <summary title="Click the triangle to see details or title to go to library source">
            {doc.metadata.source.startsWith('http') ? (
              <a href={doc.metadata.source} target="_blank" rel="noopener noreferrer" style={{ color: 'blue' }}>
                {doc.metadata['pdf.info.Title'] ? formatTitle(doc.metadata['pdf.info.Title']) : doc.metadata.source}
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
