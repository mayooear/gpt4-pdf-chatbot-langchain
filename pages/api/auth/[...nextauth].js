import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { upsertUser, getUserByEmail } from '../../../lib/db';

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    // Add other providers here if needed
  ],
  session: {
    strategy: 'jwt', // Using JWT for session management
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // console.log("signIn callback", { user, account, profile });
      if (!user || !user.email) {
        console.error('SignIn callback: User or user email is missing.');
        return false; // Prevent sign-in if email is not present
      }

      // Upsert user in the database
      const { data: dbUser, error } = await upsertUser({
        email: user.email,
        name: user.name,
        image: user.image,
      });

      if (error) {
        console.error('Error upserting user in signIn callback:', error);
        return false; // Prevent sign-in on database error
      }

      // You can add logic here to check if user is allowed to sign in based on role or other criteria
      // For example, if dbUser.role === 'Disabled' return false

      // Store the database user ID and role onto the user object to pass to JWT callback
      // Note: NextAuth `user` object in signIn can be augmented and these properties will pass to JWT `user` param.
      if (dbUser) {
        user.id = dbUser.id; // Add database ID
        user.role = dbUser.role; // Add database role
      }

      return true; // Continue sign-in
    },
    async jwt({ token, user, account, profile }) {
      // console.log("jwt callback", { token, user, account, profile });
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }

      // If user object exists (it does upon signIn), transfer user.id and user.role to the token.
      // These were added in the signIn callback from our database user.
      if (user) {
        token.id = user.id; // This is our database user ID
        token.role = user.role;
      } else if (token.email) {
        // This case handles when the JWT is re-evaluated (e.g. tab focus, session revalidation)
        // and the `user` object is not passed. We need to re-fetch the user role from DB.
        // However, `token.sub` usually holds the provider's user ID.
        // We need to fetch user by email, as that's our primary unique identifier in the users table.
        const { data: dbUser, error } = await getUserByEmail(token.email);
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        } else if (error) {
          console.error('JWT callback: Error fetching user by email:', error);
          // Potentially revoke token or set a default/error role
          token.role = 'ErrorFetchingRole';
        }
      }
      return token;
    },
    async session({ session, token }) {
      // console.log("session callback", { session, token });
      // Send properties to the client, like an access_token, user ID, and user role.
      session.accessToken = token.accessToken; // From provider
      session.user.id = token.id;         // From our database, added in JWT callback
      session.user.role = token.role;     // From our database, added in JWT callback
      // Ensure session.user.email is correctly populated (NextAuth usually does this)
      if (token.email && !session.user.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    // signIn: '/auth/signin', // Optionally, define custom sign-in pages
    // signOut: '/auth/signout',
    // error: '/auth/error', // Error code passed in query string as ?error=
    // verifyRequest: '/auth/verify-request', // (used for email/passwordless sign in)
    // newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out to disable)
  },
  // Add database adapter here if you want to use a database for session management
  // adapter: SupabaseAdapter({ client: supabase, table: 'nextauth_sessions' }), // Example
  secret: process.env.NEXTAUTH_SECRET,
  // debug: process.env.NODE_ENV === 'development', // Enable debug messages in development
});
