"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import * as bcrypt from "bcryptjs";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  HStack,
  Spacer,
  InputGroup, // Added
  InputRightElement, // Added
  IconButton, // Added
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons"; // Added icons

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // State for password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    if (!session?.user?.id) {
      toast({
        title: "錯誤",
        description: "無法取得使用者ID，請重新登入。",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        title: "錯誤",
        description: "新密碼與確認密碼不符。",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "錯誤",
        description: "新密碼長度至少為6個字元。",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch user's current hashed password from DB
      const { data: employee, error: fetchError } = await supabase
        .from("Employee")
        .select("password")
        .eq("id", session.user.id)
        .single();

      if (fetchError || !employee) {
        throw new Error("無法獲取使用者密碼，請稍後再試。");
      }

      // 2. Compare provided current password with stored hash
      const passwordMatch = await bcrypt.compare(
        currentPassword,
        employee.password
      );

      if (!passwordMatch) {
        throw new Error("目前密碼不正確。");
      }

      // 3. Hash the new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // 4. Update user's password in DB
      const { error: updateError } = await supabase
        .from("Employee")
        .update({ password: hashedNewPassword })
        .eq("id", session.user.id);

      if (updateError) {
        throw new Error("更新密碼失敗，請稍後再試。");
      }

      toast({
        title: "密碼已成功更改！",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      router.push("/dashboard"); // Redirect to dashboard or profile page
    } catch (err: any) {
      toast({
        title: "更改密碼失敗",
        description: err.message,
        status: "error",
        duration: 9000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={8}>
      <HStack mb={6}>
        <Heading as="h1" size="xl">
          更改密碼
        </Heading>
        <Spacer />
        <Button onClick={() => router.back()}>返回</Button>
      </HStack>
      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel htmlFor="current-password">目前密碼</FormLabel>
            <InputGroup>
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <InputRightElement>
                <IconButton
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  icon={showCurrentPassword ? <ViewOffIcon /> : <ViewIcon />}
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  variant="ghost"
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>

          <FormControl isRequired>
            <FormLabel htmlFor="new-password">新密碼</FormLabel>
            <InputGroup>
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <InputRightElement>
                <IconButton
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  icon={showNewPassword ? <ViewOffIcon /> : <ViewIcon />}
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  variant="ghost"
                />
              </InputRightElement>
            </InputGroup>
            <Text fontSize="sm" color="gray.500" mt={1}>
              密碼長度至少為6個字元。
            </Text>
          </FormControl>

          <FormControl isRequired>
            <FormLabel htmlFor="confirm-new-password">確認新密碼</FormLabel>
            <InputGroup>
              <Input
                id="confirm-new-password"
                type={showConfirmNewPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
              <InputRightElement>
                <IconButton
                  aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                  icon={showConfirmNewPassword ? <ViewOffIcon /> : <ViewIcon />}
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  variant="ghost"
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>

          <Button type="submit" colorScheme="blue" isLoading={isLoading}>
            更改密碼
          </Button>
        </VStack>
      </form>
    </Box>
  );
}
