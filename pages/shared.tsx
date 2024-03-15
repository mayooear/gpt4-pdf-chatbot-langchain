import Layout from '@/components/layout';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';

interface Share {
  firstName: string;
  lastName: string;
  comments?: string;
  answerId: string;
  createdAt: number; // Unix timestamp format
}

interface Answer {
  answer: string;
}

const SharedAnswers = () => {
  const [shares, setShares] = useState<Share[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  useEffect(() => {
    const fetchSharesAndAnswers = async () => {
      // Fetch shares from Firestore
      const sharesResponse = await fetch('/api/share', {
        method: 'GET',
      });
      const sharesData = await sharesResponse.json();

      // Sort shares in reverse chronological order
      const sortedShares = sharesData.sort((a: Share, b: Share) => {
        console.log(`Sorting: a.createdAt = ${JSON.stringify(a.createdAt)}, b.createdAt = ${JSON.stringify(b.createdAt)}`);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      // Fetch related answers
      const answersData: Record<string, Answer> = {};
      for (const share of sortedShares) {
        const answerResponse = await fetch(`/api/chat?answerId=${share.answerId}`);
        const answerData = await answerResponse.json();
        answersData[share.answerId] = answerData;
      }

      setShares(sortedShares);
      setAnswers(answersData);
    };

    fetchSharesAndAnswers();
  }, []);

  console.log('shares:', shares);
  console.log('answers:', answers);

  return (
    <Layout>
        <div>
        {shares.map((share, index) => (
            <div key={index} style={{ backgroundColor: 'white', padding: '10px', margin: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center'}}>
                    <span className="material-icons">person</span>
                    <p>
                        {`${share.firstName} ${share.lastName}`}
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        {formatDistanceToNow(new Date((share.createdAt as any)._seconds * 1000), { addSuffix: true })} 
                    </p>
                </div>
                {share.comments && <p style={{marginTop: '5px', marginBottom: '10px' }}>{share.comments}</p>}
                <div style={{ backgroundColor: '#f4f4f4', padding: '10px' }}>
                    <ReactMarkdown remarkPlugins={[gfm]}>
                        {answers[share.answerId]?.answer || ''}
                    </ReactMarkdown>
                </div>
            </div>
        ))}
        </div>
    </Layout>
  );
};

export default SharedAnswers;
