import { useState, useEffect } from 'react';
import Layout from '@/components/layout';

interface StatsData {
  questions: Record<string, number>;
  likes: Record<string, number>;
  downvotes: Record<string, number>;
  uniqueUsers: Record<string, number>;
  questionsWithLikes: Record<string, number>;
  mostPopularQuestion: Record<string, { question: string; likes: number }>;
  userRetention: Record<string, number>;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const Stats = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) return <Layout><div>Loading...</div></Layout>;
  if (error) return <Layout><div>Error: {error}</div></Layout>;
  if (!stats) return <Layout><div>No data available</div></Layout>;

  const dates = Object.keys(stats.questions);
  const sortedDates = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">User Engagement Statistics</h1>
      {sortedDates.length === 0 ? (
        <p>No data available for the last three days.</p>
      ) : (
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Date</th>
              <th className="py-2 px-4 border-b">Questions Asked</th>
              <th className="py-2 px-4 border-b">Likes</th>
              <th className="py-2 px-4 border-b">Downvotes</th>
              <th className="py-2 px-4 border-b">Unique Users</th>
              <th className="py-2 px-4 border-b">Questions with Likes</th>
              <th className="py-2 px-4 border-b">Most Popular Question</th>
              <th className="py-2 px-4 border-b">User Retention</th>
            </tr>
          </thead>
          <tbody>
            {sortedDates.map((date) => (
              <tr key={date}>
                <td className="py-2 px-4 border-b">{formatDate(date)}</td>
                <td className="py-2 px-4 border-b text-center">{stats.questions[date] || 0}</td>
                <td className="py-2 px-4 border-b text-center">{stats.likes[date] || 0}</td>
                <td className="py-2 px-4 border-b text-center">{stats.downvotes[date] || 0}</td>
                <td className="py-2 px-4 border-b text-center">{stats.uniqueUsers[date] || 0}</td>
                <td className="py-2 px-4 border-b text-center">{stats.questionsWithLikes[date] || 0}%</td>
                <td className="py-2 px-4 border-b text-center">{stats.mostPopularQuestion[date]?.question || ''} ({stats.mostPopularQuestion[date]?.likes || 0} likes)</td>
                <td className="py-2 px-4 border-b text-center">{stats.userRetention[date] || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
};

export default Stats;
