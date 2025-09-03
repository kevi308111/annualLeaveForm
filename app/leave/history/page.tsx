'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { createClient } from '@/app/lib/supabase/client';
import {
  Box,
  Heading,
  Text,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Badge,
} from '@chakra-ui/react';

interface LeaveRequest {
  id: string;
  created_at: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  Employee: {
    name: string;
  } | null;
}

export default function LeaveHistoryPage() {
  const { data: session } = useSession();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLeaveRequests() {
      if (!session) return;

      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('LeaveRequest')
          .select(`
            id, created_at, leaveType, startDate, endDate, reason, status,
            Employee ( name )
          `)
          .order('created_at', { ascending: false });

        // If user is not an admin, only fetch their own requests
        if (session.user.role !== 'admin') {
          query = query.eq('employeeId', session.user.id);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }
        setLeaveRequests(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaveRequests();
  }, [session, supabase]);

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'yellow';
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" mt={20}>
        <Spinner size="xl" />
        <Text mt={4}>載入請假紀錄...</Text>
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
      <Heading as="h1" size="xl" mb={6}>
        請假紀錄
      </Heading>
      {leaveRequests.length === 0 ? (
        <Text>沒有找到請假紀錄。</Text>
      ) : (
        <TableContainer>
          <Table variant="simple">
            <Thead>
              <Tr>
                {session?.user?.role === 'admin' && <Th>申請人</Th>}
                <Th>假別</Th>
                <Th>開始日期</Th>
                <Th>結束日期</Th>
                <Th>事由</Th>
                <Th>狀態</Th>
                {session?.user?.role === 'admin' && <Th>操作</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {leaveRequests.map((request) => (
                <Tr key={request.id}>
                  {session?.user?.role === 'admin' && <Td>{request.Employee?.name || 'N/A'}</Td>}
                  <Td>{request.leaveType}</Td>
                  <Td>{request.startDate}</Td>
                  <Td>{request.endDate}</Td>
                  <Td>{request.reason}</Td>
                  <Td>
                    <Badge colorScheme={getStatusBadgeColor(request.status)}>
                      {request.status}
                    </Badge>
                  </Td>
                  {session?.user?.role === 'admin' && (
                    <Td>
                      {request.status === 'pending' && (
                        <HStack spacing={2}>
                          <Button size="xs" colorScheme="green" onClick={() => handleUpdateRequestStatus(request.id, 'approved')}>
                            核准
                          </Button>
                          <Button size="xs" colorScheme="red" onClick={() => handleUpdateRequestStatus(request.id, 'rejected')}>
                            駁回
                          </Button>
                        </HStack>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
