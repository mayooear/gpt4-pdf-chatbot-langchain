import { useEffect, useState } from 'react';
import { SiteConfig } from '@/types/siteConfig';
import AnandaHeader from './Header/AnandaHeader';
import JairamHeader from './Header/JairamHeader';
import CrystalHeader from './Header/CrystalHeader';
import Footer from './Footer';
import NPSSurvey from './NPSSurvey';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface LayoutProps {
  children?: React.ReactNode;
  siteConfig: SiteConfig | null;
}

export default function Layout({ children, siteConfig }: LayoutProps) {
  const [isClient, setIsClient] = useState(false);
  const [, setVisitCount] = useLocalStorage('visitCount', 0);

  useEffect(() => {
    setIsClient(true);
    setVisitCount((prevCount: number) => prevCount + 1);
  }, [setVisitCount]);

  const renderHeader = () => {
    if (!siteConfig) return null;

    switch (siteConfig.siteId) {
      case 'ananda':
        return <AnandaHeader siteConfig={siteConfig} />;
      case 'jairam':
        return <JairamHeader siteConfig={siteConfig} />;
      case 'crystal':
        return <CrystalHeader siteConfig={siteConfig} />;
      default:
        return null;
    }
  };

  if (!isClient) return null; // Prevent rendering until client-side

  return (
    <div className="h-screen app-container-wrap">
      <div className="mx-auto flex flex-col max-w-[800px] app-container">
        {renderHeader()}
        <div className="flex-grow overflow-auto">
          <main className="flex flex-col h-full">{children}</main>
          {siteConfig && <NPSSurvey siteConfig={siteConfig} />}
        </div>
      </div>
      <Footer siteConfig={siteConfig} />
    </div>
  );
}
