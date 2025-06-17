import NextAuth, { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's role. */
      id?: string | null; // Added from our database user ID
      role?: string | null; // Added custom role property
    } & DefaultSession["user"] // Extends default fields like name, email, image
    accessToken?: string; // If you added accessToken to session
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   * Also, the `user` object passed to the `jwt` callback.
   */
  interface User extends DefaultUser {
    id: string; // Ensure our database ID is always present on User object
    role?: string | null;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    /** User's role */
    id?: string | null; // Our database user ID
    role?: string | null;
    accessToken?: string; // If you added accessToken to token
  }
}
