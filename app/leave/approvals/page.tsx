"use client";

import { useEffect, useState, useCallback } from "react"; // Added useCallback
import { useSession } from "next-auth/react";
import { createClient } from "@/app/lib/supabase/client";
import { isBefore, parseISO } from 'date-fns'; // Added for date comparison
import { calculateSeniority } from '@/app/lib/utils'; // Added for seniority calculation
import {
  Box,
  Heading,
  Text,
  Spinner,
  VStack,
  useToast,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Badge,
  HStack,
  Spacer,
  Select,
  Flex,
  FormControl,
  FormLabel,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";

interface LeaveRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  duration: number;
  durationUnit: string;
  status: string;
  employeeId: string;
  reason: string; // Added reason
  submitted_by: string; // Added submitted_by ID
  submitterName?: string; // Added submitterName for display
}

interface Employee {
  id: string;
  name: string;
}

const getNestedValue = (obj: any, path: string) => {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
};

export default function LeaveApprovalsPage() {
  const { data: session, status } = useSession();
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([]);
  const [filteredLeaveRequests, setFilteredLeaveRequests] = useState<
    LeaveRequest[]
  >([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    return employee ? employee.name : "未知員工"; // "Unknown Employee"
  };

  const getSubmitterName = (submitterId: string) => {
    const submitter = employees.find((emp) => emp.id === submitterId);
    return submitter ? submitter.name : "未知申請人"; // "Unknown Applicant"
  };
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const supabase = createClient();

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // First, fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from("Employee")
        .select("id, name");

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []); // Set employees state first

      // Then, fetch leave requests
      const { data: requests, error: requestsError } = await supabase
        .from("LeaveRequest")
        .select(
          `
          id, leaveType, startDate, endDate, duration, durationUnit, status, employeeId, reason, submitted_by
        `
        )
        .order("startDate", { ascending: false });

      if (requestsError) throw requestsError;

      // Manually map submitterName after employees are fetched
      const requestsWithSubmitterName = requests?.map(req => ({
        ...req,
        submitterName: (employeesData || []).find(emp => emp.id === req.submitted_by)?.name || '未知申請人'
      })) || [];

      setAllLeaveRequests(requestsWithSubmitterName);
      setFilteredLeaveRequests(requestsWithSubmitterName);

    } catch (err: any) {
      setError(err.message);
      toast({
        title: "獲取資料失敗",
        description: err.message,
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]); // Dependencies for useCallback

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "admin") {
      toast({
        title: "權限不足",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      router.push("/dashboard");
      return;
    }

    fetchData(); // Call fetchData here
  }, [session, status, router, fetchData]); // Updated dependencies

  useEffect(() => {
    let filtered = allLeaveRequests;

    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    if (employeeFilter !== "all") {
      filtered = filtered.filter((req) => req.employeeId === employeeFilter);
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredLeaveRequests(filtered);
  }, [statusFilter, employeeFilter, allLeaveRequests, sortConfig]);

  const handleUpdateRequestStatus = async (
    request: LeaveRequest,
    newStatus: "approved" | "rejected"
  ) => {
    try {
      let shouldDeductAnnualLeave = true; // Flag to control deduction

      // If approving an annual leave, update the employee's remaining days
      if (newStatus === "approved" && request.leaveType === "特休") {
        // Fetch employee data including hireDate and seniorityCorrectionDays
        const { data: employee, error: fetchError } = await supabase
          .from("Employee")
          .select("remainingAnnualLeaveDays, hireDate, seniorityCorrectionDays")
          .eq("id", request.employeeId)
          .single();

        if (fetchError)
          throw new Error(`無法獲取員工資料：${fetchError.message}`);
        if (!employee) throw new Error("找不到對應的員工");

        // Calculate current annual leave cycle start date
        const seniorityDetails = calculateSeniority(
          employee.hireDate,
          employee.seniorityCorrectionDays || 0
        );
        const leaveStartDate = parseISO(request.startDate);

        // Only deduct if the leave date is within or after the current annual leave cycle
        if (isBefore(leaveStartDate, seniorityDetails.currentCycleStartDate)) {
          toast({
            title: "無法扣除特休",
            description: "請假日期早於當前年資週期開始日，不從當前特休餘額扣除。",
            status: "info",
            duration: 5000,
            isClosable: true,
          });
          shouldDeductAnnualLeave = false; // Do not deduct
        } else {
          let deductionAmount = request.duration;
          // Convert hourly leave duration to days for deduction if it's an hourly annual leave
          if (request.durationUnit === '小時') {
            // Assuming 8 hours per workday for conversion
            deductionAmount = request.duration / 8;
          }

          // Fetch current remainingAnnualLeaveDays and overUsedAnnualLeaveDays from DB for accuracy
        const { data: currentEmployeeData, error: fetchCurrentEmployeeError } = await supabase
          .from("Employee")
          .select("remainingAnnualLeaveDays") // Removed overUsedAnnualLeaveDays
          .eq("id", request.employeeId)
          .single();

        if (fetchCurrentEmployeeError) throw fetchCurrentEmployeeError;
        let currentRemaining = currentEmployeeData.remainingAnnualLeaveDays || 0;

        let newRemaining = currentRemaining - deductionAmount; // Simplified logic

        const { error: updateEmployeeError } = await supabase
          .from("Employee")
          .update({
            remainingAnnualLeaveDays: newRemaining,
            // Removed overUsedAnnualLeaveDays from update
          })
          .eq("id", request.employeeId);

          if (updateEmployeeError)
            throw new Error(`更新特休餘額失敗：${updateEmployeeError.message}`);
        }
      }

      // Update leave request status regardless of annual leave deduction status
      // The deduction logic is handled separately by shouldDeductAnnualLeave flag
      const updatePayload: any = { status: newStatus };
      // If it's an approved annual leave and deduction actually happened, mark it
      if (newStatus === "approved" && request.leaveType === "特休" && shouldDeductAnnualLeave) {
        updatePayload.deductedFromAnnualLeave = true;
      }

      const { error } = await supabase
        .from("LeaveRequest")
        .update(updatePayload)
        .eq("id", request.id);

        if (error) throw error;

        toast({
          title: `申請已${newStatus === "approved" ? "核准" : "拒絕"}`,
          status: "success",
        });

        // Update the status in the local state and re-filter
        setAllLeaveRequests(prevRequests =>
          prevRequests.map(req =>
            req.id === request.id ? { ...req, status: newStatus } : req
          )
        );
        // Re-fetch all data to ensure the list is fully up-to-date and reflects any changes
        // This also implicitly handles the filtering based on current statusFilter
        fetchData(); // Call fetchData again
    } catch (err: any) {
      toast({
        title: "更新狀態失敗",
        description: err.message,
        status: "error",
      });
    }
  };

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  if (loading) {
    return (
      <Box textAlign="center" mt={20}>
        <Spinner size="xl" />
        <Text mt={4}>載入請假申請列表中...</Text>
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

  return (
    <Box p={8}>
      <HStack mb={6}>
        <Heading as="h1" size="xl">
          假單批准
        </Heading>
        <Spacer />
        <Button onClick={() => router.back()}>返回</Button>
      </HStack>

      <Flex mb={6} gap={4}>
        <FormControl>
          <FormLabel>狀態</FormLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">全部狀態</option>
            <option value="pending">待審核</option>
            <option value="approved">已核准</option>
            <option value="rejected">已拒絕</option>
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>員工</FormLabel>
          <Select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          >
            <option value="all">全部員工</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </Select>
        </FormControl>
      </Flex>

      {filteredLeaveRequests.length === 0 ? (
        <Text>沒有找到符合條件的申請。</Text>
      ) : (
        <TableContainer>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th onClick={() => requestSort("employee.name")}>員工</Th>
                <Th onClick={() => requestSort("submitterName")}>申請人</Th> {/* Added */}
                <Th onClick={() => requestSort("leaveType")}>假別</Th>
                <Th onClick={() => requestSort("startDate")}>開始日期</Th>
                <Th onClick={() => requestSort("endDate")}>結束日期</Th>
                <Th onClick={() => requestSort("duration")}>時長</Th>
                <Th>事由</Th>
                <Th onClick={() => requestSort("status")}>狀態</Th>
                <Th>操作</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredLeaveRequests.map((request) => (
                <Tr key={request.id}>
                  <Td>{getEmployeeName(request.employeeId)}</Td>
                  <Td>{request.submitterName}</Td> {/* Added */}
                  <Td>{request.leaveType}</Td>
                  <Td>{request.startDate}</Td>
                  <Td>{request.endDate}</Td>
                  <Td>
                    {request.duration}
                    {request.durationUnit}
                  </Td>
                  <Td>{request.reason}</Td>
                  <Td>
                    <Badge colorScheme={getStatusBadgeColor(request.status)}>
                      {getStatusDisplayName(request.status)}
                    </Badge>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      {request.status === "pending" && (
                        <>
                          <Button
                            colorScheme="green"
                            size="sm"
                            onClick={() =>
                              handleUpdateRequestStatus(request, "approved")
                            }
                          >
                            核准
                          </Button>
                          <Button
                            colorScheme="red"
                            size="sm"
                            onClick={() =>
                              handleUpdateRequestStatus(request, "rejected")
                            }
                          >
                            拒絕
                          </Button>
                        </>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
