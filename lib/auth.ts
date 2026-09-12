import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { cache } from 'react'
import { UserRole } from '@prisma/client'
import { clientIp, isRateLimited, rateLimit, resetRateLimit } from '@/lib/rate-limit'
import { dummyPasswordHash, hashPassword, needsRehash, passwordFingerprint } from '@/lib/password'

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
})

// Brute-force protection (15-minute window, in memory — single instance):
// - per account + IP: stops guessing one account from one address without letting a stranger
//   lock the real user out from their own address;
// - per IP: stops one address spraying many accounts;
// - per account (any IP): a high ceiling against distributed guessing of one account.
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES_PER_ACCOUNT_IP = 10
const MAX_FAILURES_PER_IP = 50
const MAX_FAILURES_PER_ACCOUNT = 100

// How often an active session re-reads role/active status from the database, so role
// changes and deactivations take effect within a minute instead of at token expiry.
const SESSION_REFRESH_MS = 60 * 1000

const { handlers, signIn, signOut, auth: uncachedAuth } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60, // 12 hours
  },
  pages: {
    signIn: '/',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const email = parsed.data.email.toLowerCase()
        const ip = clientIp(request?.headers)
        const limits = [
          { key: `login:account-ip:${email}:${ip}`, max: MAX_FAILURES_PER_ACCOUNT_IP },
          { key: `login:ip:${ip}`, max: MAX_FAILURES_PER_IP },
          { key: `login:account:${email}`, max: MAX_FAILURES_PER_ACCOUNT },
        ]

        if (limits.some(({ key, max }) => isRateLimited(key, max))) {
          return null
        }

        try {
          const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            orderBy: { createdAt: 'asc' },
          })

          // Always run bcrypt (same cost as stored hashes) so timing doesn't reveal whether the account exists
          const hash = user?.password ?? (await dummyPasswordHash())
          const isPasswordValid = await bcrypt.compare(parsed.data.password, hash)

          // Deactivated accounts must not be able to sign in
          if (!user || !user.active || !isPasswordValid) {
            for (const { key, max } of limits) rateLimit(key, max, LOGIN_WINDOW_MS)
            return null
          }

          resetRateLimit(limits[0].key)

          // Upgrade hashes created with an older, cheaper cost
          if (needsRehash(user.password)) {
            try {
              await prisma.user.update({
                where: { id: user.id },
                data: { password: await hashPassword(parsed.data.password) },
              })
            } catch (error) {
              console.error('Password rehash failed:', error)
            }
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.refreshedAt = Date.now()
        const row = await prisma.user.findUnique({ where: { id: user.id as string }, select: { password: true } })
        if (row) token.pwf = passwordFingerprint(row.password)
        return token
      }

      // Periodically re-validate the account so demotions, deactivations and password resets
      // apply within a minute
      const refreshedAt = typeof token.refreshedAt === 'number' ? token.refreshedAt : 0
      if (token.id && Date.now() - refreshedAt > SESSION_REFRESH_MS) {
        try {
          const current = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, active: true, name: true, email: true, password: true },
          })
          if (!current || !current.active) return null // ends the session
          const fingerprint = passwordFingerprint(current.password)
          if (typeof token.pwf === 'string' && token.pwf !== fingerprint) return null // password changed
          token.pwf = fingerprint
          token.role = current.role
          token.name = current.name
          token.email = current.email
          token.refreshedAt = Date.now()
        } catch (error) {
          // Keep the existing token on transient DB errors rather than logging everyone out
          console.error('Session refresh failed:', error)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
})

// Wrap auth with React.cache for per-request deduplication
// Multiple calls to auth() in the same request will only execute once
export const auth = cache(uncachedAuth)

export { handlers, signIn, signOut }
