import { NextPageContext } from 'next';
import { loadSiteConfig } from '../server/loadSiteConfig';

export const getCommonClientSideProps = async (context: NextPageContext) => {
  const siteId = process.env.SITE_ID || 'default';

  try {
    const siteConfig = await loadSiteConfig(siteId);

    if (!siteConfig) {
      throw new Error(`Configuration not found for site ID: ${siteId}`);
    }

    return {
      props: {
        siteConfig,
      },
    };
  } catch (error) {
    console.error('Error loading site config:', error);
    return {
      props: {
        siteConfig: null,
        error:
          'Failed to load site configuration. Please notify an administrator.',
      },
    };
  }
};
