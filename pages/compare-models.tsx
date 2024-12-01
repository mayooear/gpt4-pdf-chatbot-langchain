import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Layout from '@/components/layout';
import { SiteConfig } from '@/types/siteConfig';
import { loadSiteConfig } from '@/utils/server/loadSiteConfig';
import ModelComparisonChat from '@/components/ModelComparisonChat';
import { SavedState } from '@/components/ModelComparisonChat';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface ModelComparisonProps {
  siteConfig: SiteConfig | null;
}

const ModelComparison: React.FC<ModelComparisonProps> = ({ siteConfig }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [savedState, setSavedState] = useLocalStorage<SavedState>(
    'modelComparisonState',
    {
      modelA: 'gpt-4o',
      modelB: 'gpt-3.5-turbo',
      temperatureA: 0,
      temperatureB: 0,
      mediaTypes: {
        text: true,
        audio: true,
        youtube: true,
      },
      collection: 'master_swami',
    },
  );

  useEffect(() => {
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Layout siteConfig={siteConfig}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Compare AI Models</h1>
        <ModelComparisonChat
          siteConfig={siteConfig!}
          savedState={savedState}
          onStateChange={setSavedState}
        />
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
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

  return { props: { siteConfig } };
};

export default ModelComparison;
