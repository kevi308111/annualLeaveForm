"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Box, Button, Heading, Text, VStack, Spinner } from "@chakra-ui/react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Box textAlign="center" mt={20}>
        <Spinner size="xl" />
      </Box>
    );
  }

  if (session) {
    return (
      <Box textAlign="center" mt={20}>
        <VStack spacing={4}>
          <Heading>歡迎 {session.user?.name}</Heading>
          <Text>你已登入</Text>
          <Button colorScheme="red" onClick={() => signOut()}>
            登出
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Box textAlign="center" mt={20}>
      <VStack spacing={4}>
        <Heading>特休管理系統</Heading>
        <Text>你還沒登入！</Text>
        <Link href="/login" passHref>
          <Button colorScheme="teal">登入</Button>
        </Link>
      </VStack>
    </Box>
  );
}
