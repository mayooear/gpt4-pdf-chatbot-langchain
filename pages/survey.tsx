import React from 'react';
import { GetServerSideProps } from 'next';
import { loadSiteConfigSync } from '@/utils/server/loadSiteConfig';
import { SiteConfig } from '@/types/siteConfig';
import NPSSurvey from '@/components/NPSSurvey';

interface SurveyPageProps {
  siteConfig: SiteConfig;
}

const SurveyPage: React.FC<SurveyPageProps> = ({ siteConfig }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <NPSSurvey siteConfig={siteConfig} forceSurvey={true} />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  const siteId = process.env.SITE_ID || 'default';
  const siteConfig = loadSiteConfigSync(siteId);

  if (!siteConfig) {
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

export default SurveyPage;
