import React from 'react';
import Layout from '@/components/layout';

import dynamic from 'next/dynamic'

const DynamicChat = dynamic(() => import('@/components/chat'), {
  loading: () => <p>Loading...</p>,
})

const ChatPage = (props) => {
  console.log('props', props);

  return (
    <Layout>
      <DynamicChat />
    </Layout>
  );
};

export default ChatPage;
