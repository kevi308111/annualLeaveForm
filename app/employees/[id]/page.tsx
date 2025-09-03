"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { createClient } from "@/app/lib/supabase/client";
import {
  Box,
  Heading,
  Text,
  Spinner,
  VStack,
  useToast,
  Button,
  Card,
  CardHeader,
  CardBody,
  SimpleGrid,
  GridItem,
  HStack,
  Spacer,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Tooltip,
  FormControl,
  FormLabel,
  Input,
  Select,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { calculateSeniority, calculateAnnualLeave } from "@/app/lib/utils";
import { isAfter, isEqual, addYears, parseISO, isBefore } from "date-fns";

interface Employee {
  id: string;
  username: string;
  name: string;
  gender: string;
  jobTitle: string;
  hireDate: string;
  seniorityCorrectionDays: number;
  remainingAnnualLeaveDays: number;
  usedAnnualLeaveDays?: number;
  lastAnnualLeaveGrantDate?: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  duration: number;
  durationUnit: string;
  status: string;
  isHourly: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string;
  remarks: string | null;
  submitter: {
    name: string;
  } | null;
  deductedFromAnnualLeave?: boolean;
}

export default function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const { data: session } = useSession();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isAdjustModalOpen,
    onOpen: onOpenAdjustModal,
    onClose: onCloseAdjustModal,
  } = useDisclosure();
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null
  );
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">(
    "add"
  );
  const toast = useToast();
  const router = useRouter();
  const supabase = createClient(session?.accessToken);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch employee data
      const { data: employeeData, error: employeeError } = await supabase
        .from("Employee")
        .select("*")
        .eq("id", id.toLowerCase())
        .single();

      if (employeeError) throw employeeError;
      if (!employeeData) {
        throw new Error("未找到該員工。");
      }

      // Fetch leave requests for this employee
      const { data: leaveData, error: leaveError } = await supabase
        .from("LeaveRequest")
        .select(
          `id, employeeId, leaveType, startDate, endDate, duration, durationUnit, status, isHourly, startTime, endTime, reason, remarks, deductedFromAnnualLeave, submitter:submitted_by(name)`
        )
        .eq("employeeId", id)
        .order("startDate", { ascending: false });

      if (leaveError) throw leaveError;

      let usedAnnualLeaveDays = 0;
      if (leaveData) {
        const seniorityDetailsForUsedDays = calculateSeniority(
          employeeData.hireDate,
          employeeData.seniorityCorrectionDays
        );
        const currentCycleStartDate =
          seniorityDetailsForUsedDays.currentCycleStartDate;
        const currentCycleEndDate = addYears(currentCycleStartDate, 1);

        leaveData.forEach((request: any) => {
          const requestStartDate = parseISO(request.startDate);
          if (
            request.status === "approved" &&
            request.leaveType === "特休" &&
            (isAfter(requestStartDate, currentCycleStartDate) ||
              isEqual(requestStartDate, currentCycleStartDate)) &&
            isBefore(requestStartDate, currentCycleEndDate)
          ) {
            let durationInDays = request.duration;
            if (request.isHourly && request.durationUnit === "小時") {
              durationInDays = request.duration / 8;
            }
            usedAnnualLeaveDays += durationInDays;
          }
        });

        const processedLeaveData = leaveData.map((req: any) => ({
          ...req,
          submitter:
            req.submitter && req.submitter.length > 0 ? req.submitter[0] : null,
        }));
        setLeaveRequests(processedLeaveData);
      }

      setEmployee({ ...employeeData, usedAnnualLeaveDays });
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "獲取資料時發生錯誤",
        description: err.message,
        status: "error",
        duration: 9000,
        isClosable: true,
      });
      router.push("/employees");
    } finally {
      setLoading(false);
    }
  }, [id, router, supabase, toast, session]); // Dependencies for useCallback

  useEffect(() => {
    if (id && session) {
      fetchData();
    }
  }, [id, session, fetchData]); // Dependencies for useEffect

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "yellow";
      case "approved":
        return "green";
      case "rejected":
        return "red";
      default:
        return "gray";
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "申請中";
      case "approved":
        return "已核准";
      case "rejected":
        return "已拒絕";
      default:
        return status;
    }
  };

  const handleResetPassword = async (employeeId: string) => {
    if (!window.confirm("您確定要將此員工的密碼重置為預設密碼 (123456) 嗎？")) {
      return;
    }
    try {
      const response = await fetch(
        `/api/employees/${employeeId}/reset-password`,
        {
          method: "POST",
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to reset password via API."
        );
      }
      toast({
        title: "密碼已重置",
        description: "員工密碼已成功重置為預設密碼 (123456)。",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err: any) {
      toast({
        title: "重置密碼失敗",
        description: err.message,
        status: "error",
        duration: 9000,
        isClosable: true,
      });
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!window.confirm("您確定要刪除此員工嗎?")) {
      return;
    }
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to delete employee via API."
        );
      }
      toast({
        title: "員工已刪除",
        description: "員工資料已成功刪除。",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      router.push("/employees");
    } catch (err: any) {
      toast({
        title: "刪除員工失敗",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!window.confirm("您確定要刪除這筆請假申請嗎？") || !employee) {
      return;
    }

    try {
      const requestToDelete = leaveRequests.find((req) => req.id === requestId);
      if (!requestToDelete) throw new Error("找不到要刪除的請假申請。");

      if (
        requestToDelete.status === "approved" &&
        requestToDelete.leaveType === "特休" &&
        requestToDelete.deductedFromAnnualLeave !== false
      ) {
        let amountToRevert = requestToDelete.duration;
        if (
          requestToDelete.isHourly &&
          requestToDelete.durationUnit === "小時"
        ) {
          amountToRevert = requestToDelete.duration / 8;
        }

        const newRemaining =
          (employee.remainingAnnualLeaveDays || 0) + amountToRevert;

        const { error: updateEmployeeError } = await supabase
          .from("Employee")
          .update({ remainingAnnualLeaveDays: newRemaining })
          .eq("id", requestToDelete.employeeId);

        if (updateEmployeeError) throw updateEmployeeError;
      }

      const { error: deleteError } = await supabase
        .from("LeaveRequest")
        .delete()
        .eq("id", requestId);
      if (deleteError) throw deleteError;

      toast({
        title: "申請已刪除",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Refetch data to ensure UI is up-to-date
      if (id && session) {
        await fetchData();
      }
    } catch (err: any) {
      toast({
        title: "刪除失敗",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleAdjustAnnualLeave = async () => {
    if (!employee) return;
    let newRemaining = employee.remainingAnnualLeaveDays || 0;
    if (adjustmentType === "add") {
      newRemaining += adjustmentAmount;
    } else {
      newRemaining -= adjustmentAmount;
    }

    try {
      const { error } = await supabase
        .from("Employee")
        .update({ remainingAnnualLeaveDays: newRemaining })
        .eq("id", employee.id);

      if (error) throw error;

      toast({
        title: "特休餘額調整成功",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onCloseAdjustModal();
      await fetchData();
    } catch (err: any) {
      toast({
        title: "調整特休餘額失敗",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
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

  const seniorityDetails = calculateSeniority(
    employee.hireDate,
    employee.seniorityCorrectionDays
  );
  const annualLeaveDays = calculateAnnualLeave(
    seniorityDetails.seniorityInYears,
    seniorityDetails.seniorityInDaysAfterCorrection
  );
  const isOwnPage = session?.user?.id === employee.id;
  const isAdmin = session?.user?.role === "admin";

  return (
    <Box p={8}>
      <HStack mb={6}>
        <Heading as="h1" size="xl">
          {isOwnPage ? "我的資料" : `員工詳細資料：${employee.name}`}
        </Heading>
        <Spacer />
        <HStack spacing={4}>
          {(isOwnPage || (isAdmin && !isOwnPage)) && (
            <Link
              href={
                isOwnPage
                  ? "/leave/new"
                  : `/leave/new?employeeId=${employee.id}`
              }
              passHref
            >
              <Button colorScheme={isOwnPage ? "green" : "teal"}>
                {isOwnPage ? "請假申請" : "代為請假"}
              </Button>
            </Link>
          )}
          <Button onClick={() => router.push("/employees")}>返回</Button>
          {isAdmin && (
            <Button colorScheme="blue" mr={4} onClick={onOpenAdjustModal}>
              調整特休餘額
            </Button>
          )}
          {isAdmin && (
            <Button
              colorScheme="orange"
              onClick={() => handleResetPassword(employee.id)}
            >
              重置密碼
            </Button>
          )}
          {isOwnPage && (
            <Button onClick={() => router.push("/change-password")}>
              更改密碼
            </Button>
          )}
          <Button
            colorScheme="red"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            登出
          </Button>
        </HStack>
      </HStack>

      <VStack spacing={6} align="stretch">
        <Card>
          <CardHeader>
            <Heading size="md">基本資訊</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={2} spacing={4}>
              <GridItem>
                <Text>
                  <strong>帳號：</strong> {employee.username}
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>姓名：</strong> {employee.name}
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>性別：</strong> {employee.gender}
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>職稱：</strong> {employee.jobTitle}
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>到職日：</strong> {employee.hireDate}
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>年資校正天數：</strong>
                  {employee.seniorityCorrectionDays}
                </Text>
              </GridItem>
            </SimpleGrid>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <HStack>
              <Heading size="md">年資與特休資訊</Heading>
              <Spacer />
            </HStack>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={3} spacing={4}>
              <GridItem>
                <Tooltip
                  label={
                    "工作 6 個月以上，未滿 1 年者：3 日。\n" +
                    "工作 1 年以上，未滿 2 年者：7 日。\n" +
                    "工作 2 年以上，未滿 3 年者：10 日。\n" +
                    "工作 3 年以上，未滿 5 年者：每年有 14 日。\n" +
                    "工作 5 年以上，未滿 10 年者：每年有 15 日。\n" +
                    "工作 10 年以上者，每 1 年加給 1 日，加至 30 日為止。"
                  }
                  aria-label="特休計算規則"
                  placement="top"
                >
                  <Text>
                    <strong>目前年資持有特休：</strong> {annualLeaveDays} 日
                  </Text>
                </Tooltip>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>已使用天數：</strong>{" "}
                  {employee.usedAnnualLeaveDays || 0} 日
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>剩餘特休天數：</strong>{" "}
                  {employee.remainingAnnualLeaveDays || 0} 日
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>目前年資週期：</strong>{" "}
                  {seniorityDetails.currentSeniorityCycle}
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>目前年資 (年)：</strong>{" "}
                  {seniorityDetails.seniorityInYearsDecimal.toFixed(2)} 年
                </Text>
              </GridItem>
              <GridItem>
                <Text>
                  <strong>下次年資週期剩餘天數：</strong>{" "}
                  {seniorityDetails.daysUntilNextSeniorityCycle} 天
                </Text>
              </GridItem>
            </SimpleGrid>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading size="md">請假紀錄</Heading>
          </CardHeader>
          <CardBody>
            {leaveRequests.length === 0 ? (
              <Text>沒有請假紀錄。</Text>
            ) : (
              <TableContainer>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>假別</Th>
                      <Th>開始日期</Th>
                      <Th>結束日期</Th>
                      <Th>時長</Th>
                      <Th>狀態</Th>
                      <Th>申請人</Th>
                      {(isOwnPage || isAdmin) && <Th>操作</Th>}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {leaveRequests.map((request) => {
                      const requestStartDate = parseISO(request.startDate);
                      const isInCurrentCycle =
                        request.leaveType === "特休" &&
                        (isAfter(
                          requestStartDate,
                          seniorityDetails.currentCycleStartDate
                        ) ||
                          isEqual(
                            requestStartDate,
                            seniorityDetails.currentCycleStartDate
                          )) &&
                        isBefore(
                          requestStartDate,
                          addYears(seniorityDetails.currentCycleStartDate, 1)
                        );

                      return (
                        <Tr
                          key={request.id}
                          bg={isInCurrentCycle ? "blue.50" : "transparent"}
                        >
                          <Td>{request.leaveType}</Td>
                          <Td>
                            {request.startDate}
                            {request.isHourly && request.startTime
                              ? ` ${request.startTime}`
                              : ""}
                          </Td>
                          <Td>
                            {request.endDate}
                            {request.isHourly && request.endTime
                              ? ` ${request.endTime}`
                              : ""}
                          </Td>
                          <Td>
                            {request.duration}
                            {request.durationUnit}
                          </Td>
                          <Td>
                            <Tooltip
                              label={`狀態說明：\n- 申請中\n- 已核准\n- 已拒絕`}
                              placement="top"
                            >
                              <Badge
                                colorScheme={getStatusBadgeColor(
                                  request.status
                                )}
                              >
                                {getStatusDisplayName(request.status)}
                              </Badge>
                            </Tooltip>
                          </Td>
                          <Td>{request.submitter?.name || "N/A"}</Td>
                          {(isOwnPage || isAdmin) && (
                            <Td>
                              <HStack spacing={2}>
                                <Button
                                  size="xs"
                                  colorScheme="green"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    onOpen();
                                  }}
                                >
                                  查看
                                </Button>
                                {(isOwnPage || isAdmin) &&
                                  request.status === "pending" && (
                                    <Link
                                      href={`/leave/new?id=${request.id}`}
                                      passHref
                                    >
                                      <Button size="xs" colorScheme="blue">
                                        編輯
                                      </Button>
                                    </Link>
                                  )}
                                {((isOwnPage && request.status === "pending") ||
                                  isAdmin) && (
                                  <Button
                                    size="xs"
                                    colorScheme="red"
                                    onClick={() =>
                                      handleDeleteRequest(request.id)
                                    }
                                  >
                                    刪除
                                  </Button>
                                )}
                              </HStack>
                            </Td>
                          )}
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </CardBody>
        </Card>
      </VStack>

      <Box mt={6}>
        {isAdmin && (
          <>
            <Link href={`/employees/${employee.id}/edit`} passHref>
              <Button colorScheme="yellow" mr={4}>
                編輯員工
              </Button>
            </Link>
            <Button
              colorScheme="red"
              onClick={() => handleDeleteEmployee(employee.id)}
            >
              刪除員工
            </Button>
          </>
        )}
      </Box>

      {selectedRequest && (
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>請假詳細資訊</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text>
                <strong>假別:</strong> {selectedRequest.leaveType}
              </Text>
              <Text>
                <strong>狀態:</strong>{" "}
                <Badge
                  colorScheme={getStatusBadgeColor(selectedRequest.status)}
                >
                  {getStatusDisplayName(selectedRequest.status)}
                </Badge>
              </Text>
              <Text>
                <strong>開始時間:</strong> {selectedRequest.startDate}{" "}
                {selectedRequest.isHourly && selectedRequest.startTime
                  ? selectedRequest.startTime
                  : ""}
              </Text>
              <Text>
                <strong>結束時間:</strong> {selectedRequest.endDate}{" "}
                {selectedRequest.isHourly && selectedRequest.endTime
                  ? selectedRequest.endTime
                  : ""}
              </Text>
              <Text>
                <strong>總時長:</strong> {selectedRequest.duration}
                {selectedRequest.durationUnit}
              </Text>
              <Text>
                <strong>事由:</strong> {selectedRequest.reason}
              </Text>
              <Text>
                <strong>備註:</strong> {selectedRequest.remarks}
              </Text>
              <Text>
                <strong>申請人:</strong>{" "}
                {selectedRequest.submitter
                  ? selectedRequest.submitter.name
                  : "N/A"}
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={onClose}>
                關閉
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      <Modal isOpen={isAdjustModalOpen} onClose={onCloseAdjustModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>調整特休餘額</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text>
                當前剩餘特休：{employee.remainingAnnualLeaveDays || 0} 日
              </Text>
              <FormControl>
                <FormLabel>調整類型</FormLabel>
                <Select
                  value={adjustmentType}
                  onChange={(e) =>
                    setAdjustmentType(e.target.value as "add" | "subtract")
                  }
                >
                  <option value="add">增加</option>
                  <option value="subtract">減少</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>調整天數</FormLabel>
                <Input
                  type="number"
                  step="0.5"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCloseAdjustModal}>
              取消
            </Button>
            <Button colorScheme="blue" onClick={handleAdjustAnnualLeave}>
              確認調整
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
