import { useState, useEffect } from 'react';
import Layout from '@/components/layout';
import { SiteConfig } from '@/types/siteConfig';
import { GetServerSideProps } from 'next';
import { loadSiteConfig } from '@/utils/server/loadSiteConfig';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';
import { NextApiRequest } from 'next';

interface ModelComparison {
  id: string;
  timestamp: string;
  winner: 'A' | 'B' | 'skip';
  modelAConfig: {
    model: string;
    temperature: number;
    response: string;
  };
  modelBConfig: {
    model: string;
    temperature: number;
    response: string;
  };
  question: string;
  reasons?: {
    moreAccurate: boolean;
    betterWritten: boolean;
    moreHelpful: boolean;
    betterReasoning: boolean;
    betterSourceUse: boolean;
  };
  userComments?: string;
}

interface ModelStatsProps {
  siteConfig: SiteConfig | null;
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const siteConfig = await loadSiteConfig();
  const sudoStatus = getSudoCookie(req as NextApiRequest);

  if (!sudoStatus.sudoCookieValue) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      siteConfig,
    },
  };
};

const ModelStats = ({ siteConfig }: ModelStatsProps) => {
  const [comparisons, setComparisons] = useState<ModelComparison[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchComparisons = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/model-comparison-data?page=${currentPage}&limit=10`,
        );
        if (!response.ok) throw new Error('Failed to fetch comparisons');
        const data = await response.json();
        setComparisons(data.comparisons);
        setTotalPages(Math.ceil(data.total / 10));
      } catch (error) {
        console.error('Error fetching comparisons:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparisons();
  }, [currentPage]);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getReasonsList = (reasons?: ModelComparison['reasons']) => {
    if (!reasons) return 'None';
    return Object.entries(reasons)
      .filter(([, value]) => value)
      .map(([key]) =>
        key
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase()
          .trim(),
      )
      .join(', ');
  };

  return (
    <Layout siteConfig={siteConfig}>
      <div className="px-4 py-8 max-w-[1600px] mx-auto">
        <h1 className="text-2xl font-bold mb-6">Model Comparison Stats</h1>

        {isLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="whitespace-nowrap px-6 py-2 border">
                      Timestamp
                    </th>
                    <th className="whitespace-nowrap px-6 py-2 border w-[200px]">
                      Question
                    </th>
                    <th className="whitespace-nowrap px-6 py-2 border">
                      Winner
                    </th>
                    <th className="whitespace-nowrap px-6 py-2 border w-[150px]">
                      Model A
                    </th>
                    <th className="whitespace-nowrap px-6 py-2 border w-[80px]">
                      Answer A
                    </th>
                    <th className="whitespace-nowrap px-6 py-2 border w-[150px]">
                      Model B
                    </th>
                    <th className="whitespace-nowrap px-6 py-2 border w-[80px]">
                      Answer B
                    </th>
                    <th className="whitespace-nowrap px-6 py-2 border w-[200px]">
                      Reasons
                    </th>
                    <th className="whitespace-nowrap px-6 py-2 border w-[200px]">
                      Comments
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((comparison) => (
                    <tr key={comparison.id} className="hover:bg-gray-50">
                      <td className="px-6 py-2 border whitespace-nowrap">
                        {formatDate(comparison.timestamp)}
                      </td>
                      <td className="px-6 py-2 border truncate">
                        {comparison.question}
                      </td>
                      <td className="px-6 py-2 border text-center">
                        {comparison.winner}
                      </td>
                      <td className="px-6 py-2 border">
                        {comparison.modelAConfig.model} (
                        {comparison.modelAConfig.temperature})
                      </td>
                      <td className="px-6 py-2 border text-center relative group">
                        <span className="material-icons cursor-help">chat</span>
                        <div className="invisible group-hover:visible absolute z-50 left-0 mt-2 p-4 bg-white border rounded-lg shadow-lg w-96 max-h-96 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm">
                            {comparison.modelAConfig.response}
                          </pre>
                        </div>
                      </td>
                      <td className="px-6 py-2 border">
                        {comparison.modelBConfig.model} (
                        {comparison.modelBConfig.temperature})
                      </td>
                      <td className="px-6 py-2 border text-center relative group">
                        <span className="material-icons cursor-help">chat</span>
                        <div className="invisible group-hover:visible absolute z-50 left-0 mt-2 p-4 bg-white border rounded-lg shadow-lg w-96 max-h-96 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm">
                            {comparison.modelBConfig.response}
                          </pre>
                        </div>
                      </td>
                      <td className="px-6 py-2 border">
                        {getReasonsList(comparison.reasons)}
                      </td>
                      <td className="px-6 py-2 border">
                        {comparison.userComments || 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-center mt-6 gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ModelStats;
