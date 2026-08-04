import { PrismaAdapter } from '@next-auth/prisma-adapter';
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import argon2 from 'argon2';

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;

        const storedHash = user.passwordHash;
        let valid = false;

        try {
          if (storedHash?.startsWith?.('$argon2')) {
            valid = await argon2.verify(storedHash, credentials.password);
          } else {
            // fallback to bcrypt for legacy users
            valid = await bcrypt.compare(credentials.password, storedHash);
            if (valid) {
              // rehash with argon2 and persist
              const newHash = await argon2.hash(credentials.password, {
                type: argon2.argon2id,
                memoryCost: 2 ** 16,
                timeCost: 3,
                parallelism: 1,
              });
              await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
            }
          }
        } catch (err) {
          console.error('Password verify error', err);
          return null;
        }

        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl
        };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || ''
    })
  ],
  session: {
    strategy: 'database'
  },
  pages: {
    signIn: '/auth/login',
    newUser: '/auth/register'
  },
  callbacks: {
    async session({ session, user }) {
      if (session?.user && user) {
        // @ts-ignore
        session.user.id = user.id;
      }
      return session;
    }
  }
};

export default authOptions;
