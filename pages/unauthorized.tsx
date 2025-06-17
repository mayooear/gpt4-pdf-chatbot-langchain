import Layout from '../components/layout';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h1>Access Denied</h1>
        <p>You do not have the necessary permissions to view this page.</p>
        <Link href="/" legacyBehavior>
          <a>Go to Homepage</a>
        </Link>
      </div>
    </Layout>
  );
}
