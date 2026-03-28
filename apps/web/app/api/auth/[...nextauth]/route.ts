import NextAuth, { DefaultSession, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';

// ---------------------------------------------------------------------------
// Type augmentation — extends NextAuth session/JWT with our custom fields
// ---------------------------------------------------------------------------
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      role: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    accessToken?: string;
  }
}

// ---------------------------------------------------------------------------
// NextAuth configuration — calls the NestJS backend for authentication
// ---------------------------------------------------------------------------
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          const json = await res.json();

          if (res.ok && json.success && json.data?.accessToken) {
            return {
              id: json.data.user.id,
              email: json.data.user.email,
              name: json.data.user.email,
              role: json.data.user.role,
              accessToken: json.data.accessToken,
            };
          }

          // Surface backend error message to the sign-in page
          throw new Error(json.error?.message ?? 'Invalid credentials');
        } catch (err) {
          throw new Error(err instanceof Error ? err.message : 'Authentication failed');
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt' as const,
    maxAge: 60 * 60, // 1 hour — matches backend JWT expiry
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: { id?: string; role?: string; accessToken?: string } }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
