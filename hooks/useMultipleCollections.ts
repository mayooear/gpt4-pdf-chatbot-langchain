import { useMemo } from 'react';
import { getCollectionsConfig } from '@/utils/client/siteConfig';
import { SiteConfig } from '@/types/siteConfig';

export const useMultipleCollections = (siteConfig: SiteConfig | undefined) => {
  return useMemo(() => {
    if (!siteConfig) {
      console.log('useMultipleCollections: siteConfig is undefined');
      return false;
    }
    const collectionsConfig = getCollectionsConfig(siteConfig);
    const collectionCount = Object.keys(collectionsConfig).length;
    return collectionCount > 1;
  }, [siteConfig]);
};
