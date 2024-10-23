// This component displays user engagement statistics, including questions with likes
// and most popular questions over various time periods.

import { SiteConfig } from '@/types/siteConfig';
import { useState, useEffect } from 'react';
import Layout from '@/components/layout';

// Structure for the statistics data
interface StatsData {
  questionsWithLikes: Record<string, number>;
  mostPopularQuestion: Record<string, { question: string; likes: number }>;
}

// Formats a date string to a more readable format (Today, Yesterday, or MM/DD)
const formatDate = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date.getTime() === today.getTime()) {
    return 'Today';
  } else if (date.getTime() === today.getTime() - 86400000) {
    return 'Yesterday';
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

interface StatsProps {
  siteConfig: SiteConfig | null;
}

const Stats = ({ siteConfig }: StatsProps) => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch statistics data from the API when the component mounts
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

  // Display loading, error, or no data messages if applicable
  if (isLoading)
    return (
      <Layout siteConfig={siteConfig}>
        <div>Loading...</div>
      </Layout>
    );
  if (error)
    return (
      <Layout siteConfig={siteConfig}>
        <div>Error: {error}</div>
      </Layout>
    );
  if (!stats)
    return (
      <Layout siteConfig={siteConfig}>
        <div>No data available</div>
      </Layout>
    );

  // Sort dates in descending order
  const dates = Object.keys(stats.questionsWithLikes);
  const sortedDates = dates.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  // Calculate aggregate statistics for a given number of days
  const calculateAggregateStats = (days: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const relevantDates = sortedDates.filter(
      (date) => new Date(date) >= cutoffDate,
    );

    const totalLikes = relevantDates.reduce(
      (sum, date) => sum + (stats.questionsWithLikes[date] || 0),
      0,
    );
    const averageLikes =
      relevantDates.length > 0
        ? (totalLikes / relevantDates.length).toFixed(1)
        : 'N/A';

    const mostPopular = relevantDates.reduce(
      (max, date) => {
        const current = stats.mostPopularQuestion[date];
        return current && current.likes > (max?.likes || 0) ? current : max;
      },
      { question: 'N/A', likes: 0 },
    );

    return { averageLikes, mostPopular };
  };

  // Calculate statistics for different time periods
  const sevenDayStats = calculateAggregateStats(7);
  const thirtyDayStats = calculateAggregateStats(30);
  const ninetyDayStats = calculateAggregateStats(90);

  return (
    <Layout siteConfig={siteConfig}>
      <h1 className="text-2xl font-bold mb-4">User Engagement Statistics</h1>
      {sortedDates.length === 0 ? (
        <p>No data available for the last three days.</p>
      ) : (
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Date</th>
              <th className="py-2 px-4 border-b">Questions with Likes (%)</th>
              <th className="py-2 px-4 border-b">Most Popular Question</th>
            </tr>
          </thead>
          <tbody>
            {/* Render rows for individual dates */}
            {sortedDates.map((date) => (
              <tr key={date}>
                <td className="py-2 px-4 border-b">{formatDate(date)}</td>
                <td className="py-2 px-4 border-b text-center">
                  {stats.questionsWithLikes[date] || 0}%
                </td>
                <td className="py-2 px-4 border-b text-center">
                  {stats.mostPopularQuestion[date]?.question || 'N/A'} (
                  {stats.mostPopularQuestion[date]?.likes || 0} likes)
                </td>
              </tr>
            ))}
            {/* Render aggregate statistics rows */}
            <tr>
              <td className="py-2 px-4 border-b font-bold">Last 7 Days</td>
              <td className="py-2 px-4 border-b text-center">
                {sevenDayStats.averageLikes}%
              </td>
              <td className="py-2 px-4 border-b text-center">
                {sevenDayStats.mostPopular.question} (
                {sevenDayStats.mostPopular.likes} likes)
              </td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b font-bold">Last 30 Days</td>
              <td className="py-2 px-4 border-b text-center">
                {thirtyDayStats.averageLikes}%
              </td>
              <td className="py-2 px-4 border-b text-center">
                {thirtyDayStats.mostPopular.question} (
                {thirtyDayStats.mostPopular.likes} likes)
              </td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b font-bold">Last 90 Days</td>
              <td className="py-2 px-4 border-b text-center">
                {ninetyDayStats.averageLikes}%
              </td>
              <td className="py-2 px-4 border-b text-center">
                {ninetyDayStats.mostPopular.question} (
                {ninetyDayStats.mostPopular.likes} likes)
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Layout>
  );
};

export default Stats;
