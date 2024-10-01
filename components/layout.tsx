import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { SiteConfig } from '@/types/siteConfig';
import AnandaHeader from './Header/AnandaHeader';
import JairamHeader from './Header/JairamHeader';
import CrystalHeader from './Header/CrystalHeader';
import Footer from './Footer';

interface LayoutProps {
  children?: React.ReactNode;
  siteConfig: SiteConfig | null;
}

export default function Layout({ children, siteConfig }: LayoutProps) {
  const [isDev, setIsDev] = useState(false);
  const [isSudoUser, setIsSudoUser] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setIsDev(process.env.NODE_ENV === 'development');
    setIsSudoUser(Cookies.get('sudo') === 'true');
  }, []);

  const renderHeader = () => {
    if (!siteConfig) return null;

    switch (siteConfig.siteId) {
      case 'ananda':
        return (
          <AnandaHeader
            siteConfig={siteConfig}
            isSudoUser={isSudoUser}
            isDev={isDev}
          />
        );
      case 'jairam':
        return (
          <JairamHeader
            siteConfig={siteConfig}
            isSudoUser={isSudoUser}
            isDev={isDev}
          />
        );
      case 'crystal':
        return (
          <CrystalHeader
            siteConfig={siteConfig}
            isSudoUser={isSudoUser}
            isDev={isDev}
          />
        );
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
        </div>
      </div>
      <Footer siteConfig={siteConfig} />
    </div>
  );
}
