import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm'; // Assuming you have this imported correctly

interface TruncatedMarkdownProps {
    markdown: string;
    maxCharacters: number;
}
  
const TruncatedMarkdown: React.FC<TruncatedMarkdownProps> = ({ markdown, maxCharacters }) => {
  const [isTruncated, setIsTruncated] = useState(true);

  const toggleTruncated = (event: React.MouseEvent) => {
    event.preventDefault(); // Prevent the default anchor link behavior of scroll to top
    setIsTruncated(!isTruncated);
  };

  const endOfTruncatedContent = markdown.slice(0, maxCharacters).lastIndexOf(" ");
  const displayedMarkdown = isTruncated ? markdown.slice(0, endOfTruncatedContent) : markdown;
  const showMoreMarkdown = isTruncated ? ` ...**[See&nbsp;more](#)**` : '';

  return (
    <div>
      <ReactMarkdown
        remarkPlugins={[gfm]}
        className="inline"
        // Add an event listener to handle clicks on the "See more" link
        components={{
          a: ({ node, ...props }) => (
            props.href === '#' ? (
              <a {...props} onClick={(event) => toggleTruncated(event)} />
            ) : (
              <a {...props} />
            )
          ),
        }}
      >
        {displayedMarkdown + showMoreMarkdown}
      </ReactMarkdown>
    </div>
  );
};

export default TruncatedMarkdown;
