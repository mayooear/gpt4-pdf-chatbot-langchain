import { GetServerSideProps } from 'next';
import Layout from '@/components/layout';
import { SiteConfig } from '@/types/siteConfig';
import { loadSiteConfig } from '@/utils/server/loadSiteConfig';
import ModelComparisonChat from '@/components/ModelComparisonChat';
import { SavedState } from '@/components/ModelComparisonChat';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';
import { NextApiRequest } from 'next';

interface ModelComparisonProps {
  siteConfig: SiteConfig | null;
  isSudoAdmin: boolean;
  isHidden: boolean;
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const siteConfig = await loadSiteConfig();
  const sudoStatus = getSudoCookie(req as NextApiRequest);

  if (!siteConfig?.enableModelComparison && !sudoStatus.sudoCookieValue) {
    return {
      notFound: true, // This will show the default Next.js 404 page
    };
  }

  return {
    props: {
      siteConfig,
      isSudoAdmin: !!sudoStatus.sudoCookieValue,
      isHidden: !siteConfig?.enableModelComparison,
    },
  };
};

const ModelComparison: React.FC<ModelComparisonProps> = ({
  siteConfig,
  isSudoAdmin,
  isHidden,
}) => {
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

  if (isHidden && !isSudoAdmin) {
    return null; // Let Next.js handle the 404
  }

  return (
    <Layout siteConfig={siteConfig}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">
          Compare AI Models {isHidden && '(Admin Only)'}
        </h1>
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
