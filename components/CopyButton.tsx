import React from 'react';
import { copyTextToClipboard } from '../utils/client/clipboard';
import { logEvent } from '@/utils/client/analytics';
import { Converter } from 'showdown';
import { Document } from 'langchain/document';
import { DocMetadata } from '@/types/DocMetadata';
import { getSiteName } from '@/utils/client/siteConfig';
import { SiteConfig } from '@/types/siteConfig';

interface CopyButtonProps {
  markdown: string;
  answerId?: string;
  sources?: Document<DocMetadata>[];
  question: string;
  siteConfig: SiteConfig | null;
}

const CopyButton: React.FC<CopyButtonProps> = ({
  markdown,
  answerId,
  sources,
  question,
  siteConfig,
}) => {
  const [copied, setCopied] = React.useState(false);

  const convertMarkdownToHtml = (markdown: string): string => {
    const converter = new Converter();
    return converter.makeHtml(markdown);
  };

  const formatSources = (sources: Document<DocMetadata>[]): string => {
    return sources
      .map((doc) => {
        const title = doc.metadata.title || 'Unknown source';
        const collection = doc.metadata.library || '';
        const sourceUrl = doc.metadata.source;

        if (sourceUrl) {
          return `- [${title}](${sourceUrl}) (${collection})`;
        } else {
          return `- ${title} (${collection})`;
        }
      })
      .join('\n');
  };

  const handleCopy = async () => {
    let contentToCopy = `## Question:\n\n${question}\n\n## Answer:\n\n${markdown}`;

    if (sources && sources.length > 0) {
      contentToCopy += '\n\n### Sources\n' + formatSources(sources);
    }

    contentToCopy +=
      `\n\n### From:\n\n[${getSiteName(siteConfig)}](` +
      `${process.env.NEXT_PUBLIC_BASE_URL}/answers/${answerId}` +
      ')';
    const htmlContent = convertMarkdownToHtml(contentToCopy);
    await copyTextToClipboard(htmlContent, true);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);

    // Log the event to Google Analytics
    logEvent('copy_answer', 'UI', answerId || 'unknown');
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-gray-200"
      title="Copy answer to clipboard"
    >
      {copied ? (
        <span className="material-icons">check</span>
      ) : (
        <span className="material-icons">content_copy</span>
      )}
    </button>
  );
};

export default CopyButton;
