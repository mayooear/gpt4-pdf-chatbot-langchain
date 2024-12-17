import { useState, useEffect } from 'react';
import Layout from '@/components/layout';
import DownvotedAnswerReview from '@/components/DownvotedAnswerReview';
import { Answer } from '@/types/answer';
import { SiteConfig } from '@/types/siteConfig';

interface DownvotesReviewProps {
  siteConfig: SiteConfig | null;
}

const DownvotesReview = ({ siteConfig }: DownvotesReviewProps) => {
  const [downvotedAnswers, setDownvotedAnswers] = useState<Answer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDownvotedAnswers = async () => {
      try {
        const response = await fetch('/api/downvotedAnswers');
        if (response.ok) {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            setDownvotedAnswers(data);
            setError(null);
          } catch (parseError) {
            console.error('Failed to parse response:', text);
            console.log(parseError);
            setError('Invalid response format');
          }
        } else {
          const errorData = await response.json().catch(() => null);
          setError(errorData?.message || 'Failed to fetch downvoted answers');
        }
      } catch (error) {
        console.error('Error fetching downvoted answers:', error);
        setError('Failed to fetch downvoted answers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDownvotedAnswers();
  }, []);

  if (isLoading) {
    return <Layout siteConfig={siteConfig}>Loading...</Layout>;
  }

  if (!siteConfig) {
    return (
      <Layout siteConfig={null}>Error: Site configuration not available</Layout>
    );
  }

  if (error) {
    return (
      <Layout siteConfig={siteConfig}>
        <div className="text-red-600">Error: {error}</div>
      </Layout>
    );
  }

  return (
    <Layout siteConfig={siteConfig}>
      <h1 className="text-2xl font-bold mb-4">Review Downvoted Answers</h1>
      {downvotedAnswers.length === 0 ? (
        <p>No downvoted answers to review.</p>
      ) : (
        downvotedAnswers.map((answer) => (
          <DownvotedAnswerReview
            key={answer.id}
            answer={answer}
            siteConfig={siteConfig}
          />
        ))
      )}
    </Layout>
  );
};

export default DownvotesReview;
