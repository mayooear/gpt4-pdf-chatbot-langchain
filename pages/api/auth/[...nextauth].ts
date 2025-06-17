import NextAuth, { type NextAuthOptions } from 'next-auth'; // Standard type import
import GoogleProvider from 'next-auth/providers/google';

// Define authOptions with minimal configuration
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  // Minimal session strategy
  session: {
    strategy: 'jwt',
  },
  // Minimal callbacks, or none if not strictly needed for type check
  callbacks: {
    async session({ session, token }) {
      // Example: Augment session if needed, ensuring types align with next-auth.d.ts
      if (session.user && token.sub) { // token.sub is typically the user id from provider
        (session.user as any).id = token.sub;
      }
      if (session.user && (token as any).role) { // If role is added to token in jwt callback
         (session.user as any).role = (token as any).role;
      }
      return session;
    },
    async jwt({ token, user }) {
      // Example: Augment token if needed
      if (user && (user as any).role) { // If role is available on user object during sign-in
        (token as any).role = (user as any).role;
      }
       if (user && user.id) { // user.id from provider or db
        token.sub = user.id; // Ensure subject in token matches user id
      }
      return token;
    },
  },
};

// Export the NextAuth handler with the options
export default NextAuth(authOptions);
