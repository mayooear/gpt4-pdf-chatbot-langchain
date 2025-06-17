import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]'; // Adjust path as needed
import {
  getTotalLeadsCount,
  getTopQuestions,
  getWeeklyLeadsTrend,
  getMetaAdsSummary,
  getAllMetaAdsCampaignData,
} from '../../lib/db'; // Adjust path as needed

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden: Access denied.' });
  }

  try {
    // Parallel fetching of all data points
    const [
      totalLeadsResult,
      topQuestionsResult,
      weeklyLeadsTrendResult,
      metaAdsSummaryResult,
      metaAdsCampaignDataResult,
    ] = await Promise.all([
      getTotalLeadsCount(),
      getTopQuestions(5), // Get top 5 questions
      getWeeklyLeadsTrend(12), // Get trend for last 12 weeks
      getMetaAdsSummary(),
      getAllMetaAdsCampaignData(),
    ]);

    // Check for errors in each result and handle them appropriately
    // For simplicity, just logging errors here and sending what we have or an error status
    if (totalLeadsResult.error) console.error("Error fetching total leads:", totalLeadsResult.error);
    if (topQuestionsResult.error) console.error("Error fetching top questions:", topQuestionsResult.error);
    if (weeklyLeadsTrendResult.error) console.error("Error fetching weekly leads trend:", weeklyLeadsTrendResult.error);
    if (metaAdsSummaryResult.error) console.error("Error fetching meta ads summary:", metaAdsSummaryResult.error);
    if (metaAdsCampaignDataResult.error) console.error("Error fetching meta ads campaign data:", metaAdsCampaignDataResult.error);

    // Consolidate data into a single response object
    const reportsData = {
      summaryCards: {
        totalLeads: totalLeadsResult.count || 0,
        topQuestions: topQuestionsResult.data || [],
        // You could add more summary data from metaAdsSummaryResult here if needed
        totalMetaSpend: metaAdsSummaryResult.data?.totalSpend || 0,
        totalMetaLeads: metaAdsSummaryResult.data?.totalLeads || 0,
      },
      charts: {
        weeklyLeadsTrend: weeklyLeadsTrendResult.data || [],
        // Potentially transform metaAdsSummaryResult or parts of metaAdsCampaignDataResult for charts
        // e.g., spend vs leads from metaAdsSummaryResult (though it's a single summary now)
        // or aggregate metaAdsCampaignDataResult by campaign for a bar chart.
        // For now, we'll pass the raw campaign data and let client decide on chart representation
        metaAdsCampaignData: metaAdsCampaignDataResult.data || [],
      },
      tables: {
        metaAdsCampaigns: metaAdsCampaignDataResult.data || [],
      },
      // Include the full summary for Meta Ads if needed separately
      metaAdsOverallSummary: metaAdsSummaryResult.data || {},
    };

    res.status(200).json(reportsData);

  } catch (error) {
    console.error('Failed to fetch reports data:', error);
    res.status(500).json({ error: 'Failed to fetch reports data', details: error.message });
  }
}
