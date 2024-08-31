import { useState, useEffect } from 'react';
import Layout from '@/components/layout';
import { useRouter } from 'next/router';
import DownvotedAnswerReview from '@/components/DownvotedAnswerReview';
import { Answer } from '@/types/answer';
import { SiteConfig } from '@/types/siteConfig';

interface DownvotesReviewProps {
  siteConfig: SiteConfig | null;
}

const DownvotesReview = ({ siteConfig }: DownvotesReviewProps) => {
  const [downvotedAnswers, setDownvotedAnswers] = useState<Answer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchDownvotedAnswers = async () => {
      try {
        const response = await fetch('/api/downvotedAnswers');
        if (response.ok) {
          const data = await response.json();
          setDownvotedAnswers(data);
        } else {
          console.error('Failed to fetch downvoted answers');
        }
      } catch (error) {
        console.error('Error fetching downvoted answers:', error);
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
