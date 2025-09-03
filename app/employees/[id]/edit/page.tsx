"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
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
  Spinner,
} from "@chakra-ui/react";

interface Employee {
  id: string;
  username: string;
  name: string;
  gender: string;
  jobTitle: string;
  hireDate: string;
  seniorityCorrectionDays: number;
}

export default function EditEmployeePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [seniorityCorrectionDays, setSeniorityCorrectionDays] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchEmployee() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("Employee")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (data) {
          setEmployee(data);
          setUsername(data.username);
          setName(data.name);
          setGender(data.gender);
          setJobTitle(data.jobTitle);
          setHireDate(data.hireDate);
          setSeniorityCorrectionDays(data.seniorityCorrectionDays || 0);
        }
      } catch (err: any) {
        setError(err.message);
        toast({
          title: "獲取員工資料失敗",
          description: err.message,
          status: "error",
        });
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchEmployee();
    }
  }, [id, supabase, toast]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("Employee")
        .update({
          username,
          name,
          gender,
          jobTitle,
          hireDate,
          seniorityCorrectionDays,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "員工資料更新成功",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      router.push(`/employees/${id}`); // Redirect back to employee detail page
    } catch (err: any) {
      toast({
        title: "更新員工資料失敗",
        description: err.message,
        status: "error",
        duration: 9000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" mt={20}>
        <Spinner size="xl" />
        <Text mt={4}>載入員工資料中...</Text>
      </Box>
    );
  }

  if (error || !employee) {
    return (
      <Box textAlign="center" mt={20} color="red.500">
        <Text>錯誤：{error || "未找到員工。"}</Text>
        <Button mt={4} onClick={() => router.push("/employees")}>
          返回列表
        </Button>
      </Box>
    );
  }

  return (
    <Box p={8}>
      <HStack mb={6}>
        <Heading as="h1" size="xl">
          編輯員工：{employee.name}
        </Heading>
        <Spacer />
        <Button onClick={() => router.back()}>返回</Button>
      </HStack>
      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel>帳號</FormLabel>
            <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>姓名</FormLabel>
            <Input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>性別</FormLabel>
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="男">男</option>
              <option value="女">女</option>
              <option value="其他">其他</option>
            </Select>
          </FormControl>
          <FormControl isRequired>
            <FormLabel>職稱</FormLabel>
            <Input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>到職日</FormLabel>
            <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          </FormControl>
          <FormControl>
            <FormLabel>年資校正天數</FormLabel>
            <Input type="number" value={seniorityCorrectionDays} onChange={(e) => setSeniorityCorrectionDays(Number(e.target.value))} />
          </FormControl>
          <Button type="submit" colorScheme="blue" isLoading={isSubmitting}>
            更新員工資料
          </Button>
        </VStack>
      </form>
    </Box>
  );
}