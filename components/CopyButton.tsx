import React from 'react';
import { copyTextToClipboard } from '../utils/client/clipboard';
import { logEvent } from '@/utils/client/analytics';
import { Converter } from 'showdown';
import { Document } from 'langchain/document';

interface CopyButtonProps {
  markdown: string;
  answerId?: string;
  sources?: Document<Record<string, any>>[];
  question: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({
  markdown,
  answerId,
  sources,
  question,
}) => {
  const [copied, setCopied] = React.useState(false);

  const convertMarkdownToHtml = (markdown: string): string => {
    const converter = new Converter();
    return converter.makeHtml(markdown);
  };

  const formatSources = (sources: Document<Record<string, any>>[]): string => {
    return sources
      .map((doc) => {
        const title =
          doc.metadata.title ||
          doc.metadata['pdf.info.Title'] ||
          'Unknown source';
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
      '\n\n### From:\n\n[Ask Ananda Library](' +
      process.env.NEXT_PUBLIC_BASE_URL +
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
