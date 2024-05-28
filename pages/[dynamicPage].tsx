import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { GetServerSideProps, GetServerSidePropsContext } from 'next';

interface SudoPageProps {
  pageName: string;
}

const SudoPage: React.FC<SudoPageProps> = ({ pageName }) => {
  const [sudoStatus, setSudoStatus] = useState('');

  useEffect(() => {
    const sudoCookie = Cookies.get('SUDO');
    if (!sudoCookie) {
      Cookies.set('SUDO', '1', { expires: 365 });
      setSudoStatus('SUDO set');
    } else {
      setSudoStatus('SUDO was already set');
    }
  }, []);

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <p className="text-lg text-gray-600 mb-4">
        {sudoStatus}
      </p>
      <a href="/" className="text-blue-500 hover:underline">Go to Home</a>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context: GetServerSidePropsContext) => {
  const { params } = context;
  const dynamicPage = params?.dynamicPage;
  const pageName = process.env.SUDO_PAGE_NAME || 'defaultPageName';

  if (dynamicPage !== pageName) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      pageName,
    },
  };
};

export default SudoPage;