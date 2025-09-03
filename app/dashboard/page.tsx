'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Box, Spinner, Text } from '@chakra-ui/react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Wait until the session is loaded
    if (status === 'loading') {
      return; // Do nothing while loading
    }

    if (status === 'unauthenticated') {
      // Redirect to login if not authenticated
      router.push('/login');
      return;
    }

    if (session?.user) {
      const { user } = session;
      if (user.role === 'admin') {
        // Redirect admins to the employee list
        router.push('/employees');
      } else {
        // Redirect regular users to their own detail page
        router.push(`/employees/${user.id}`);
      }
    }
  }, [session, status, router]);

  return (
    <Box textAlign="center" mt={20}>
      <Spinner size="xl" />
      <Text mt={4}>正在載入，請稍候...</Text>
    </Box>
  );
}
