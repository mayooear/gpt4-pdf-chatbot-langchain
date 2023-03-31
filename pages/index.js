import React from 'react';
import Layout from '@/components/layout';
import Chat from '@/components/chat';
import Address from '@/components/address';

export default function Home() {
  const [address, setAddress] = React.useState('');
  const [showChat, setShowChat] = React.useState(false);

  return (
    <>
      <Layout>
        {!showChat && (
          <Address
            setAddress={setAddress}
            address={address}
            setShowChat={setShowChat}
          />
        )}
        {showChat && <Chat setShowChat={setShowChat} />}
      </Layout>
    </>
  );
}
