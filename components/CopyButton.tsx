import React from 'react';
import { copyTextToClipboard } from '../utils/client/clipboard';
import { logEvent } from '@/utils/client/analytics';
import { Converter } from 'showdown';

interface CopyButtonProps {
  markdown: string;
  answerId?: string; // Add this to identify the answer being copied
}

const CopyButton: React.FC<CopyButtonProps> = ({ markdown, answerId }) => {
  const [copied, setCopied] = React.useState(false);

  const convertMarkdownToHtml = (markdown: string): string => {
    const converter = new Converter();
    return converter.makeHtml(markdown);
  };

  const handleCopy = async () => {
    const htmlContent = convertMarkdownToHtml(markdown);
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
