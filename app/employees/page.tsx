"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { createClient } from "@/app/lib/supabase/client";
import {
  Box,
  Heading,
  Text,
  Spinner,
  VStack,
  SimpleGrid,
  Button,
  HStack,
  Spacer,
  useToast, // Added useToast
} from "@chakra-ui/react";
import Link from "next/link";

interface Employee {
  id: string;
  username: string;
  name: string;
  gender: string;
  jobTitle: string;
  hireDate: string;
  seniorityCorrectionDays: number;
}

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingLeave, setIsUpdatingLeave] = useState(false); // New state for loading
  const supabase = createClient();
  const toast = useToast(); // Initialize useToast

  const fetchEmployees = async () => { // Made fetchEmployees a const to be callable from handleGrantAnnualLeave
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from("Employee").select("*");
      if (error) {
        throw error;
      }
      setEmployees(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [supabase]); // Dependency array includes supabase

  const handleGrantAnnualLeave = async () => {
    setIsUpdatingLeave(true);
    try {
      const response = await fetch('/api/grant-annual-leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to grant annual leave via API.');
      }

      const result = await response.json();
      
      let descriptionMessage = result.message;
      if (result.updatedEmployees && result.updatedEmployees.length > 0) {
        const updatedNames = result.updatedEmployees.map((emp: any) => {
          const oldRem = emp.oldRemainingAnnualLeaveDays.toFixed(2);
          const newRem = emp.newRemainingAnnualLeaveDays.toFixed(2);
          const oldOver = emp.oldOverUsedAnnualLeaveDays.toFixed(2);
          const newOver = emp.newOverUsedAnnualLeaveDays.toFixed(2);

          let changes = [];
          if (oldRem !== newRem) changes.push(`剩余: ${oldRem} -> ${newRem}`);
          if (oldOver !== newOver) changes.push(`超用: ${oldOver} -> ${newOver}`);
          
          return `${emp.name} (${changes.join(', ')})`;
        }).join('; ');
        descriptionMessage = `更新了 ${result.updatedEmployees.length} 位员工: ${updatedNames}`;
      }

      toast({
        title: '年资特休更新成功',
        description: descriptionMessage,
        status: 'success',
        duration: 9000, // Increased duration for longer message
        isClosable: true,
      });
      fetchEmployees(); // Refresh employee list after successful update
    } catch (err: any) {
      toast({
        title: '更新年資特休失敗',
        description: err.message,
        status: 'error',
        duration: 9000,
        isClosable: true,
      });
    } finally {
      setIsUpdatingLeave(false);
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

  if (error) {
    return (
      <Box textAlign="center" mt={20} color="red.500">
        <Text>錯誤：{error}</Text>
      </Box>
    );
  }

  const userIsAdmin = session?.user?.role === "admin";
  const currentUserId = session?.user?.id;

  return (
    <Box p={8}>
      <HStack mb={6}>
        <Heading as="h1" size="xl">
          員工列表
        </Heading>
        <Spacer />
        {userIsAdmin && (
          <Link href="/employees/new" passHref>
            <Button colorScheme="blue" mr={4}>
              新增員工
            </Button>
          </Link>
        )}
        {userIsAdmin && (
          <Link href="/leave/approvals" passHref>
            <Button colorScheme="teal" mr={4}>審核假單</Button>
          </Link>
        )}
        {userIsAdmin && (
          <Button
            colorScheme="purple"
            onClick={handleGrantAnnualLeave}
            isLoading={isUpdatingLeave}
            loadingText="更新中..."
            mr={4}
          >
            更新年資持有特休
          </Button>
        )}
        <Button
          colorScheme="red"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          登出
        </Button>
      </HStack>
      {employees.length === 0 ? (
        <Text>沒有找到員工。請新增員工以開始！</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {employees.map((employee) => {
            const isCurrentUser = employee.id === currentUserId;
            const canView = userIsAdmin || isCurrentUser;
            const canEdit = userIsAdmin;

            return (
              <Box
                key={employee.id}
                p={5}
                shadow="md"
                borderWidth="1px"
                borderRadius="md"
              >
                <Heading as="h3" size="md" mb={2}>
                  {employee.name} ({employee.username})
                </Heading>
                {/* <Text>職稱：{employee.jobTitle}</Text> */}

                <HStack mt={4} spacing={4}>
                  <Link href={`/employees/${employee.id}`}>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      isDisabled={!canView}
                      _disabled={{
                        opacity: 0.7,
                        cursor: "not-allowed",
                      }}
                    >
                      查看
                    </Button>
                  </Link>
                </HStack>
              </Box>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
}
