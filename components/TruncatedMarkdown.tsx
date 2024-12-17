import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';

interface TruncatedMarkdownProps {
  markdown: string;
  maxCharacters: number;
}

const TruncatedMarkdown: React.FC<TruncatedMarkdownProps> = ({
  markdown = '',
  maxCharacters,
}) => {
  const [isTruncated, setIsTruncated] = useState(true);

  if (!markdown) {
    return <div>(No content)</div>;
  }

  const toggleTruncated = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsTruncated(!isTruncated);
  };

  const shouldTruncate = markdown.length >= maxCharacters * 1.1;

  const displayedMarkdown = useMemo(() => {
    const endOfTruncatedContent = markdown
      .slice(0, maxCharacters)
      .lastIndexOf(' ');
    return isTruncated && shouldTruncate
      ? markdown.slice(0, endOfTruncatedContent)
      : markdown;
  }, [markdown, maxCharacters, isTruncated, shouldTruncate]);

  return (
    <div>
      <ReactMarkdown remarkPlugins={[gfm]} className="inline">
        {displayedMarkdown}
      </ReactMarkdown>
      {isTruncated && shouldTruncate && (
        <a href="#" onClick={toggleTruncated} className="inline">
          ...See&nbsp;more
        </a>
      )}
    </div>
  );
};

export default React.memo(TruncatedMarkdown);
