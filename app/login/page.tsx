"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Heading,
  useToast,
} from "@chakra-ui/react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });

    setIsLoading(false);

    if (result?.error) {
      console.log('NextAuth result.error:', result.error); // Add this line for debugging
      toast({
        title: "登入失敗", // Changed title to Chinese
        description: result.error,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } else {
      // Redirect to dashboard page to handle role-based redirection
      router.push("/dashboard");
    }
  };

  return (
    <Box maxW="md" mx="auto" mt={10}>
      <Heading as="h1" mb={6} textAlign="center">
        登入
      </Heading>
      <form onSubmit={handleSubmit}>
        <Stack spacing={4}>
          <FormControl isRequired>
            <FormLabel>帳號</FormLabel>
            <Input
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>密碼</FormLabel>
            <Input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormControl>
          <Button type="submit" colorScheme="teal" isLoading={isLoading}>
            Login
          </Button>
        </Stack>
      </form>
    </Box>
  );
}
