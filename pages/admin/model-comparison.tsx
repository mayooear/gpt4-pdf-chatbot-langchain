import React, { useState, useEffect } from 'react';
import { GetServerSideProps, NextApiRequest, NextApiResponse } from 'next';
import Layout from '@/components/layout';
import { useSudo } from '@/contexts/SudoContext';
import { SiteConfig } from '@/types/siteConfig';
import { loadSiteConfig } from '@/utils/server/loadSiteConfig';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';
import ModelComparisonChat from '@/components/ModelComparisonChat';

interface ModelComparisonProps {
  siteConfig: SiteConfig | null;
}

const ModelComparison: React.FC<ModelComparisonProps> = ({ siteConfig }) => {
  const { isSudoUser, checkSudoStatus } = useSudo();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSudoStatus().then(() => setIsLoading(false));
  }, [checkSudoStatus]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isSudoUser) {
    return (
      <Layout siteConfig={siteConfig}>
        <div className="flex justify-center items-center h-screen">
          <p className="text-lg text-gray-600">
            Access denied. Admin privileges required.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout siteConfig={siteConfig}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Model Comparison</h1>
        <ModelComparisonChat siteConfig={siteConfig} />
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const siteId = process.env.SITE_ID || 'default';
  const siteConfig = await loadSiteConfig(siteId);

  if (!siteConfig) {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    };
  }

  const { req, res } = context;
  const sudoStatus = getSudoCookie(
    req as NextApiRequest,
    res as NextApiResponse,
  );

  if (!sudoStatus.sudoCookieValue) {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    };
  }

  return { props: { siteConfig } };
};

export default ModelComparison;
