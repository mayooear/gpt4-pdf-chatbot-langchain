import Layout from '@/components/layout';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { formatDistanceToNow } from 'date-fns';
import { Document } from 'langchain/document';
import CopyButton from '@/components/CopyButton';
import LikeButton from '@/components/LikeButton';
import SourcesList from '@/components/SourcesList';
import TruncatedMarkdown from '@/components/TruncatedMarkdown';

interface Answer {
  id: string;
  question: string;
  answer: string;
  sources: Document[];
  ip: string;
  history: any[]; // more specific here would be better
  timestamp: Timestamp; 
}

interface Timestamp {
  _seconds: number;
  _nanoseconds: number;
}

const AllAnswers = () => {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [page, setPage] = useState(0);
  const { ref, inView } = useInView();
  const [isLoading, setIsLoading] = useState(false);
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // State to track if there are more items to load
  const [hasMore, setHasMore] = useState(true);

  // State to track if the data has been loaded at least once
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // State to control the delayed spinner visibility
  const [showDelayedSpinner, setShowDelayedSpinner] = useState(false);

  useEffect(() => {
    const fetchAnswers = async () => {
      if (isLoading) return;
      setIsLoading(true);
  
      let newAnswers: Answer[] = [];
      try {
        const answersResponse = await fetch(`/api/logs?page=${page}&limit=10`, {
          method: 'GET',
        });
        if (!answersResponse.ok) {
          throw new Error(`HTTP error! status: ${answersResponse.status}`);
        }
        newAnswers = await answersResponse.json();
      } catch (error) {
        console.error("Failed to fetch answers:", error);
      }
      if (newAnswers.length === 0) {
        setHasMore(false);
      } else {
        setAnswers(prevAnswers => {
          const updatedAnswers = { ...prevAnswers };
          newAnswers.forEach((answer: Answer) => {
            updatedAnswers[answer.id] = answer;
          });
          return updatedAnswers;
        });
      }
  
      setIsLoading(false);
    };
  
    if (hasMore && !isLoading) {
      fetchAnswers();
    }
  }, [page, hasMore, isLoading]);

  useEffect(() => {
    // Set a timeout to show the spinner after 1.5 seconds
    const timer = setTimeout(() => {
      if (isLoading) {
        setShowDelayedSpinner(true);
      }
    }, 1500);

    // Clear the timeout if the component unmounts or isLoading changes to false
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Intersection observer effect
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      setPage(prevPage => prevPage + 1);
    }
  }, [inView, hasMore, isLoading]);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {isLoading && !initialLoadComplete && showDelayedSpinner ? (
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-blue-600"></div>
            <p className="text-lg text-gray-600 ml-4">Loading...</p>
          </div>
        ) : (
          <div>
            <div>
            {Object.values(answers).map((answer, index) => (
                <div key={answer.id} className="bg-white p-2.5 m-2.5">
                <div className="flex items-center">
                    <span className="material-icons">question_answer</span>
                    <p className="ml-4">
                    Question: {answer.question}
                    <span className="ml-4">
                        {formatDistanceToNow(new Date(answer.timestamp._seconds * 1000), { addSuffix: true })}
                    </span>
                    </p>
                </div>
                <div className="bg-gray-100 p-2.5 rounded">
                    <div className="markdownanswer">
                    {/* Use the TruncatedMarkdown component for the answer content */}
                    <TruncatedMarkdown markdown={answer.answer} maxCharacters={600} />
                    {/* Render the sources list if available */}
                    {answer.sources && (
                        <SourcesList sources={answer.sources} useAccordion={true} />
                    )}
                    {/* Render the interaction buttons */}
                    <div className="flex items-center">
                        <CopyButton markdown={answer.answer} />
                        <div className="ml-4">
                        <LikeButton
                            answerId={answer.id}
                            initialLiked={likeStatuses[answer.id] || false}
                            likeCount={likeCounts[answer.id] || 0} // Pass the like count to LikeButton
                        />
                        </div>
                    </div>
                    </div>
                </div>
            </div>
            ))}
            {/* Intersection Observer Element */}
            {hasMore && <div ref={ref} style={{ height: 1 }} />}
          </div>       
        </div>
        )}
      </div>
    </Layout>
  );
};

export default AllAnswers;
