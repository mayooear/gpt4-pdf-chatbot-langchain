import React from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { getOtherVisitorsReference } from '@/utils/client/siteConfig';
import { SiteConfig } from '@/types/siteConfig';

interface LikePromptProps {
  show: boolean;
  siteConfig: SiteConfig | null;
}

const LikePrompt: React.FC<LikePromptProps> = ({ show, siteConfig }) => {
  const [hasSeenPrompt, setHasSeenPrompt] = useLocalStorage('hasSeenLikePrompt', false);

  if (!show || hasSeenPrompt) return null;

  const handleClose = () => {
    setHasSeenPrompt(true);
  };

  const otherVisitorsReference = getOtherVisitorsReference(siteConfig);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm mx-auto">
        <p className="mb-2">
          Don&apos;t forget to like helpful answers! This highlights them for{' '}
          {otherVisitorsReference}.
        </p>
        <button
          onClick={handleClose}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};

export default LikePrompt;
