import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import React, { ComponentType, useEffect } from 'react';
import Layout from '../layout'; // Assuming a general layout for error/loading states

interface WithAdminAuthProps {}

const withAdminAuth = <P extends object>(WrappedComponent: ComponentType<P>) => {
  const AdminAuthComponent = (props: P & WithAdminAuthProps) => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const loading = status === 'loading';

    useEffect(() => {
      if (!loading && status === 'unauthenticated') {
        // Not logged in, redirect to home or a login page
        // Alternatively, could use signIn() here:
        // signIn('google', { callbackUrl: router.pathname });
        router.push('/');
      } else if (!loading && status === 'authenticated' && session?.user?.role !== 'Admin') {
        // Logged in, but not an admin
        router.push('/unauthorized'); // Or some other page indicating lack of permission
      }
    }, [session, status, loading, router]);

    if (loading) {
      return <Layout><p>Loading session...</p></Layout>; // Or a dedicated loading component
    }

    if (status === 'unauthenticated' || (session && session.user?.role !== 'Admin')) {
      // Render null or a message while redirecting, or if redirect fails for some reason
      // Or a more specific "Access Denied" component within the Layout
      return <Layout><p>Access Denied. Redirecting...</p></Layout>;
    }

    // If authenticated and role is Admin, render the wrapped component
    return <WrappedComponent {...props} />;
  };

  // Set a display name for easier debugging
  AdminAuthComponent.displayName = `WithAdminAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return AdminAuthComponent;
};

export default withAdminAuth;

// We should also create the /unauthorized page
// For now, if a non-admin tries to access an admin page, they will be redirected to /unauthorized
// If not logged in, they will be redirected to /
// This HOC will be used to wrap admin pages.
// Example usage:
// import withAdminAuth from '../components/auth/withAdminAuth';
// const AdminDashboardPage = () => <div>Admin Dashboard</div>;
// export default withAdminAuth(AdminDashboardPage);
