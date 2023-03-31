import React from 'react';
import Chat from '@/components/chat';
import Layout from '@/components/layout';

const ChatPage = (props) => {
  console.log('props', props);

  return (
    <Layout>
      <Chat />
    </Layout>
  );
};

export default ChatPage;
