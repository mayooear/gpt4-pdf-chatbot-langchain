import { GetServerSideProps } from 'next';
import Layout from '@/components/layout';
import { SiteConfig } from '@/types/siteConfig';
import { loadSiteConfig } from '@/utils/server/loadSiteConfig';
import ModelComparisonChat from '@/components/ModelComparisonChat';
import { SavedState } from '@/components/ModelComparisonChat';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';
import { NextApiRequest } from 'next';
import { useState } from 'react';

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

const InfoModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-4">Understanding AI Models</h2>
        <div className="text-gray-600 space-y-4">
          <p>
            Help us compare different AI models by choosing which response is
            more helpful.
          </p>
          <p>
            If neither response is helpful, you can skip and try a different
            question - this helps avoid biasing our data when neither response
            meets expectations.
          </p>
          <p>
            AI models are like different chefs in a kitchen - each has their own
            style and specialty. Some are better at certain tasks than others.
          </p>
          <p>
            When we adjust the &quot;temperature&quot; setting, we&apos;re
            telling the AI how creative to be. A low temperature (like 0) means
            the AI will be very focused and consistent - great for factual
            answers. A higher temperature (like 0.7) allows for more creativity
            and variety - better for brainstorming and casual conversation.
          </p>
          <p>
            Your feedback helps us understand which AI &quot;chef&quot; and
            which &quot;cooking style&quot; works best for different situations.
            This helps us provide better service to everyone!
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isHidden && !isSudoAdmin) {
    return null; // Let Next.js handle the 404
  }

  return (
    <Layout siteConfig={siteConfig}>
      <div className="flex flex-col h-full">
        <div className="flex-grow overflow-hidden answers-container">
          <div className="h-full overflow-y-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">
              Compare AI Models {isHidden && '(Admin Only)'}
            </h1>
            {!isHidden && (
              <div className="text-gray-600 mb-6">
                <p className="inline-block">
                  Help us improve our service by rating the answers you receive.{' '}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Learn more
                  </button>
                </p>
              </div>
            )}
            <InfoModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
            />
            <ModelComparisonChat
              siteConfig={siteConfig}
              savedState={savedState}
              onStateChange={setSavedState}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ModelComparison;
