import React from 'react';
import { copyTextToClipboard } from '../utils/clipboard';

interface CopyButtonProps {
  markdown: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ markdown }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await copyTextToClipboard(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-gray-200"
      title="Copy"
    >
      {copied ? (
        <span className="material-icons">check</span>
      ) : (
        <span className="material-icons">content_copy</span>
      )}
    </button>
  );
}

export default CopyButton;
