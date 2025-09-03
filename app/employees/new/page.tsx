"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import * as bcrypt from "bcryptjs";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Heading,
  Text,
  useToast,
  HStack,
  Spacer,
} from "@chakra-ui/react";
import { calculateSeniority, calculateAnnualLeave } from "@/app/lib/utils"; // Import these functions

export default function NewEmployeePage() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [seniorityCorrectionDays, setSeniorityCorrectionDays] = useState(0);
  const [role, setRole] = useState("employee"); // New state for role
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      // Calculate initial annual leave days
      const seniorityDetails = calculateSeniority(
        hireDate,
        seniorityCorrectionDays
      );
      const initialAnnualLeaveDays = calculateAnnualLeave(
        seniorityDetails.seniorityInYears,
        seniorityDetails.seniorityInDaysAfterCorrection
      );

      const { error } = await supabase.from("Employee").insert([
        {
          username,
          password: hashedPassword,
          name,
          gender,
          jobTitle,
          hireDate,
          seniorityCorrectionDays,
          role: role, // Use selected role
          remainingAnnualLeaveDays: initialAnnualLeaveDays, // Initialize remaining annual leave
          lastAnnualLeaveGrantDate: hireDate, // Initialize last grant date to hire date
        },
      ]);

      if (error) throw error;

      toast({
        title: "員工新增成功",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      router.push("/employees"); // Redirect to employee list
    } catch (err: any) {
      toast({
        title: "新增員工失敗",
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
          新增員工
        </Heading>
        <Spacer />
        <Button onClick={() => router.back()}>返回</Button>
      </HStack>
      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>姓名</FormLabel>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>性別</FormLabel>
            <Select
              placeholder="選擇性別"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="男">男</option>
              <option value="女">女</option>
              <option value="其他">其他</option>
            </Select>
          </FormControl>
          <FormControl isRequired>
            <FormLabel>職稱</FormLabel>
            <Input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>到職日</FormLabel>
            <Input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel>年資校正天數</FormLabel>
            <Input
              type="number"
              value={seniorityCorrectionDays}
              onChange={(e) =>
                setSeniorityCorrectionDays(Number(e.target.value))
              }
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>角色</FormLabel>
            <Select
              value={role}
              name="role"
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="employee">員工</option>
              <option value="admin">管理員</option>
            </Select>
          </FormControl>
          <Button type="submit" colorScheme="blue" isLoading={isLoading}>
            新增員工
          </Button>
        </VStack>
      </form>
    </Box>
  );
}
