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

export const getServerSideProps: GetServerSideProps = async () => {
  const siteConfig = await loadSiteConfig();

  if (!siteConfig?.enableModelComparison) {
    return {
      notFound: true, // This will show the default Next.js 404 page
    };
  }

  return {
    props: {
      siteConfig,
    },
  };
};

const ModelComparison: React.FC<ModelComparisonProps> = ({ siteConfig }) => {
  const [savedState, setSavedState] = useLocalStorage<SavedState>(
    'modelComparisonState',
    {
      modelA: 'gpt-4',
      modelB: 'gpt-3.5-turbo',
      temperatureA: 0,
      temperatureB: 0.7,
      mediaTypes: {
        text: true,
        audio: true,
        youtube: true,
      },
      collection: 'master_swami',
    },
  );

  return (
    <Layout siteConfig={siteConfig}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Compare AI Models</h1>
        <ModelComparisonChat
          siteConfig={siteConfig}
          savedState={savedState}
          onStateChange={setSavedState}
        />
      </div>
    </Layout>
  );
};

export default ModelComparison;
