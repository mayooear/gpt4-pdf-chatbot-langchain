import React, { useState, useEffect } from 'react';
import withAdminAuth from '../components/auth/withAdminAuth';
import Layout from '../components/layout';
import SummaryCard from '../components/ui/SummaryCard';
import { WeeklyLeadsChart, MetaAdsPerformanceChart } from '../components/Charts'; // Import charts
// import CampaignTable from '../components/CampaignTable'; // Assuming a new component for advanced table

function ReportsDashboardContent() {
  const [reportsData, setReportsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false); // State for download button
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/reports-data');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch reports data');
        }
        const data = await response.json();
        setReportsData(data);
      } catch (err) {
        console.error("Error fetching reports data:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return <div className="text-center p-8">Loading reports data...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-600">Error loading reports: {error}</div>;
  }

  if (!reportsData) {
    return <div className="text-center p-8">No reports data available.</div>;
  }

  const { summaryCards, charts, tables, metaAdsOverallSummary } = reportsData;

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    setError(null); // Clear previous errors
    try {
      const response = await fetch('/api/generate-report-pdf');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PDF generation failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF report:", err);
      setError(`Failed to download PDF: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Reports Dashboard</h1>
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloading || isLoading} // Disable if initial data is loading too
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {isDownloading ? 'Downloading...' : 'Download Report (PDF)'}
        </button>
      </div>

      {/* Summary Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard title="Total Leads" value={summaryCards.totalLeads} />
        <SummaryCard title="Total Meta Ad Spend" value={`$${parseFloat(summaryCards.totalMetaSpend || 0).toLocaleString()}`} />
        <SummaryCard title="Total Meta Ad Leads" value={summaryCards.totalMetaLeads} />
        {/* Top Questions can be a bit more complex for a simple value card */}
        <SummaryCard title="Top Questions">
          {summaryCards.topQuestions && summaryCards.topQuestions.length > 0 ? (
            <ul className="list-disc list-inside text-sm">
              {summaryCards.topQuestions.map((q, index) => (
                <li key={index} title={q.question} className="truncate">
                  {q.question} ({q.count})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">No question data.</p>
          )}
        </SummaryCard>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-4 md:p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Weekly Leads Trend</h2>
          {charts.weeklyLeadsTrend && charts.weeklyLeadsTrend.length > 0 ? (
            <WeeklyLeadsChart data={charts.weeklyLeadsTrend} />
          ) : (
            <p className="text-center text-gray-500 py-10">No weekly leads data available.</p>
          )}
        </div>
        <div className="bg-white p-4 md:p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Meta Ads Performance (Spend vs Leads per Campaign)</h2>
           {charts.metaAdsCampaignData && charts.metaAdsCampaignData.length > 0 ? (
            <MetaAdsPerformanceChart data={charts.metaAdsCampaignData} />
          ) : (
            <p className="text-center text-gray-500 py-10">No Meta Ads data available for chart.</p>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4">Meta Ads Campaign Details</h2>
        {tables.metaAdsCampaigns.length > 0 ? (
        //   <CampaignTable data={tables.metaAdsCampaigns} />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Set</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spend</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CPL</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tables.metaAdsCampaigns.map((ad, index) => (
                  <tr key={ad.id || index}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">{ad.campaign_name}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">{ad.ad_set_name}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">{ad.ad_name}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">{new Date(ad.date).toLocaleDateString()}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">${parseFloat(ad.spend || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">{ad.impressions || 0}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">{ad.clicks || 0}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">{ad.leads || 0}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">{(ad.ctr * 100).toFixed(2)}%</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">${parseFloat(ad.cpl || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No campaign data available.</p>
        )}
      </div>
    </div>
  );
}

const ProtectedReportsDashboard = () => {
  return (
    <Layout>
      <ReportsDashboardContent />
    </Layout>
  );
};

export default withAdminAuth(ProtectedReportsDashboard);
