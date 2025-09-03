import { type NextAuthOptions } from 'next-auth';
import { SupabaseAdapter } from '@next-auth/supabase-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@/app/lib/supabase/server';
import * as bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: {  label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) {
          return null;
        }

        const supabase = createClient();

        const { data: employee, error } = await supabase
          .from('Employee')
          .select('*, role, password')
          .eq('username', credentials.username)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('查無使用者，請聯絡管理員。');
          } else {
            console.error('Supabase error during login:', error);
            throw new Error('登入時發生資料庫錯誤，請稍後再試。');
          }
        }

        if (!employee) {
          throw new Error('查無使用者，請聯絡管理員。');
        }

        const passwordMatch = await bcrypt.compare(credentials.password, employee.password);

        if (!passwordMatch) {
          throw new Error('密碼不正確。');
        }

        return {
          id: employee.id,
          name: employee.name,
          email: `${employee.username}@example.com`,
          role: employee.role || 'employee',
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};