"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "@/app/lib/supabase/client";
import { useSession } from "next-auth/react";
import { isBefore, parseISO, differenceInDays, differenceInMinutes, eachDayOfInterval, isWeekend, isAfter } from 'date-fns';
import { formatDuration } from "@/app/lib/utils";
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
  Textarea,
  HStack,
  Spacer,
  Checkbox,
} from "@chakra-ui/react";
import { useRouter, useSearchParams } from "next/navigation";

// Define the schema for the leave request form
const leaveRequestSchema = z
  .object({
    leaveType: z.enum(["特休", "事假", "病假", "生理假", "其他"], {
      message: "假別為必填",
    }),
    otherLeaveType: z.string().optional(), // Conditionally required
    isHourly: z.boolean().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "開始日期必須是 YYYY-MM-DD 格式",
    }),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "結束日期必須是 YYYY-MM-DD 格式",
    }),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    duration: z.number().min(0.1, { message: "請假時長必須大於 0" }),
    reason: z
      .string()
      .min(1, { message: "事由為必填" })
      .max(100, { message: "事由不能超過 100 字" }),
    remarks: z.string().max(200, { message: "備註不能超過 200 字" }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.leaveType === "其他" && !data.otherLeaveType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "請填寫其他假別名稱",
        path: ["otherLeaveType"],
      });
    }

    // Validate that endDate is not earlier than startDate
    if (data.startDate && data.endDate) {
      const parsedStartDate = parseISO(data.startDate);
      const parsedEndDate = parseISO(data.endDate);
      if (isBefore(parsedEndDate, parsedStartDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "結束日期不能早於開始日期",
          path: ["endDate"], // Attach error to endDate field
        });
      }
    }

    // Conditional validation for hourly leave
    if (data.isHourly) {
      if (!data.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "請填寫開始時間",
          path: ["startTime"],
        });
      }
      if (!data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "請填寫結束時間",
          path: ["endTime"],
        });
      }
      
      // Validate end time is after start time if on the same day
      if (data.startTime && data.endTime && data.startDate === data.endDate) {
        const startDateTime = parseISO(`${data.startDate}T${data.startTime}`);
        const endDateTime = parseISO(`${data.endDate}T${data.endTime}`);
        if (isBefore(endDateTime, startDateTime)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "結束時間不能早於開始時間",
            path: ["endTime"],
          });
        }
      }
    } else { // If not hourly, duration is required, and times are optional (default to 00:00)
      if (data.duration === undefined || data.duration === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "請填寫請假時長",
          path: ["duration"],
        });
      } else if (data.duration <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "請假時長必須大於 0",
          path: ["duration"],
        });
      }
      // No validation for startTime/endTime if not hourly, as they default to 00:00
    }
  });

type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

export default function NewLeaveRequestPage() {
  const { data: session } = useSession();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset, // Added reset
    setValue, // Added setValue
  } = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      startTime: "00:00",
      endTime: "00:00",
    },
  });
  const toast = useToast();
  const router = useRouter();
  const supabase = createClient();
  const [estimatedDuration, setEstimatedDuration] = useState<string>('');
  const searchParams = useSearchParams();
  const leaveRequestId = searchParams.get('id');
  const employeeIdForLeave = searchParams.get('employeeId');
  const [isEditing, setIsEditing] = useState(false); // New state to track editing mode
  const [editedEmployeeId, setEditedEmployeeId] = useState<string | null>(null); // State to store employeeId of edited leave

  useEffect(() => {
    if (leaveRequestId) {
      setIsEditing(true);
      const fetchLeaveRequest = async () => {
        const { data, error } = await supabase
          .from('LeaveRequest')
          .select('*')
          .eq('id', leaveRequestId)
          .single();

        if (error) {
          toast({
            title: '錯誤',
            description: '無法載入請假申請資料。',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
          router.push('/leave/new'); // Redirect to new form if data not found
          return;
        }

        if (data) {
          // Store the employeeId for redirection
          setEditedEmployeeId(data.employeeId); // Store employeeId from fetched data

          // Pre-fill the form with fetched data
          reset({
            leaveType: data.leaveType.startsWith('其他:') ? '其他' : data.leaveType,
            otherLeaveType: data.leaveType.startsWith('其他:') ? data.leaveType.substring(3).trim() : '',
            isHourly: data.isHourly,
            startDate: data.startDate,
            endDate: data.endDate,
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            reason: data.reason,
            remarks: data.remarks || '',
            duration: data.duration,
          });
        }
      };
      fetchLeaveRequest();
    }
  }, [leaveRequestId, reset, supabase, toast, router]);

  const selectedIsHourly = watch("isHourly"); // Added back

  

  const selectedLeaveType = watch("leaveType"); // Added back

  const onSubmit = async (data: LeaveRequestFormData) => {
    const isAdmin = session?.user?.role === 'admin';
    const loggedInUserId = session?.user?.id;
    console.log('Logged In User ID:', loggedInUserId); // Added for debugging

    if (!loggedInUserId) {
      toast({
        title: "錯誤",
        description: "無法取得使用者ID，請重新登入。",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const targetEmployeeId = isEditing && editedEmployeeId ? editedEmployeeId : (isAdmin && employeeIdForLeave ? employeeIdForLeave : loggedInUserId);

    if (!targetEmployeeId) {
      toast({
        title: "錯誤",
        description: "無法確定目標員工，請重新登入。",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      let durationUnit = data.isHourly ? '小時' : '天';

      const leaveDataToSave = {
        employeeId: targetEmployeeId,
        submitted_by: loggedInUserId,
        leaveType: data.leaveType === '其他' ? `其他: ${data.otherLeaveType}` : data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        isHourly: data.isHourly || false,
        startTime: data.isHourly ? data.startTime : null,
        endTime: data.isHourly ? data.endTime : null,
        duration: data.duration,
        durationUnit: durationUnit,
        reason: data.reason,
        remarks: data.remarks,
        status: 'pending',
      };

      let dbOperation;
      if (isEditing && leaveRequestId) {
        dbOperation = supabase.from('LeaveRequest').update(leaveDataToSave).eq('id', leaveRequestId);
      } else {
        dbOperation = supabase.from('LeaveRequest').insert([leaveDataToSave]);
      }

      const { error } = await dbOperation;

      if (error) {
        throw error;
      }

      toast({
        title: isEditing ? '假單已更新' : '假單已提交',
        description: isEditing ? '您的請假申請已成功更新。' : '您的請假申請已成功提交。',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      router.push(`/employees/${targetEmployeeId}`);
    } catch (err: any) {
      toast({
        title: '提交假單時發生錯誤',
        description: err.message,
        status: 'error',
        duration: 9000,
        isClosable: true,
      });
    }
  };

  return (
    <Box p={8}>
      <HStack mb={6}>
        <Heading as="h1" size="xl">
          請假申請
        </Heading>
        <Spacer />
        <Button onClick={() => router.back()}>返回</Button>
      </HStack>
      <form onSubmit={handleSubmit(onSubmit)}>
        <VStack spacing={4} align="stretch">
          <FormControl isInvalid={!!errors.leaveType}>
            <FormLabel htmlFor="leaveType">假別</FormLabel>
            <Select
              id="leaveType"
              placeholder="選擇假別"
              {...register("leaveType")}
            >
              <option value="特休">特休</option>
              <option value="事假">事假</option>
              <option value="病假">病假</option>
              <option value="生理假">生理假</option>
              <option value="其他">其他</option>
            </Select>
            <Text color="red.500">{errors.leaveType?.message}</Text>
          </FormControl>

          {selectedLeaveType === "其他" && (
            <FormControl isInvalid={!!errors.otherLeaveType}>
              <FormLabel htmlFor="otherLeaveType">其他假別名稱</FormLabel>
              <Input id="otherLeaveType" {...register("otherLeaveType")} />
              <Text color="red.500">{errors.otherLeaveType?.message}</Text>
            </FormControl>
          )}

          <FormControl isInvalid={!!errors.startDate}>
            <FormLabel htmlFor="startDate">開始日期</FormLabel>
            <Input id="startDate" type="date" {...register("startDate")} />
            <Text color="red.500">{errors.startDate?.message}</Text>
          </FormControl>

          <FormControl isInvalid={!!errors.endDate}>
            <HStack> {/* Added HStack */}
              <FormLabel htmlFor="endDate">結束日期</FormLabel>
              <Spacer /> {/* Added Spacer to push button to right */}
              <Button
                size="sm"
                onClick={() => {
                  const startDateValue = watch("startDate");
                  if (!startDateValue) {
                    toast({
                      title: "錯誤",
                      description: "請先選擇開始日期。",
                      status: "error",
                      duration: 3000,
                      isClosable: true,
                    });
                    return;
                  }
                  setValue("endDate", startDateValue);
                }}
              >
                同開始日期
              </Button>
            </HStack>
            <Input id="endDate" type="date" {...register("endDate")} />
            <Text color="red.500">{errors.endDate?.message}</Text>
          </FormControl>

          {!selectedIsHourly && ( // Only show if not hourly
            <FormControl isInvalid={!!errors.duration}>
              <FormLabel htmlFor="duration">請假時長 (天)</FormLabel>
              <Input id="duration" type="number" step="0.5" {...register("duration", { valueAsNumber: true })} />
              <Text color="red.500">{errors.duration?.message}</Text>
            </FormControl>
          )}

          {selectedIsHourly && ( // Only show if hourly
            <FormControl isInvalid={!!errors.duration}>
              <FormLabel htmlFor="duration">請假時長 (小時)</FormLabel>
              <Input id="duration" type="number" step="0.5" {...register("duration", { valueAsNumber: true })} />
              <Text color="red.500">{errors.duration?.message}</Text>
            </FormControl>
          )}

          <FormControl>
            <Checkbox {...register('isHourly')}>時數假</Checkbox>
          </FormControl>

          {selectedIsHourly && (
            <HStack spacing={4}>
              <FormControl isInvalid={!!errors.startTime}>
                <FormLabel htmlFor="startTime">開始時間</FormLabel>
                <Input id="startTime" type="time" {...register('startTime')} />
                <Text color="red.500">{errors.startTime?.message}</Text>
              </FormControl>
              <FormControl isInvalid={!!errors.endTime}>
                <FormLabel htmlFor="endTime">結束時間</FormLabel>
                <Input id="endTime" type="time" {...register('endTime')} />
                <Text color="red.500">{errors.endTime?.message}</Text>
              </FormControl>
            </HStack>
          )}

          

          

          

          <FormControl isInvalid={!!errors.reason}>
            <FormLabel htmlFor="reason">事由</FormLabel>
            <Textarea id="reason" {...register("reason")} />
            <Text color="red.500">{errors.reason?.message}</Text>
          </FormControl>

          <FormControl isInvalid={!!errors.remarks}>
            <FormLabel htmlFor="remarks">備註</FormLabel>
            <Textarea id="remarks" {...register("remarks")} />
            <Text color="red.500">{errors.remarks?.message}</Text>
          </FormControl>

          <Button type="submit" colorScheme="blue" isLoading={isSubmitting}>
            {isEditing ? '更新申請' : '提交申請'}
          </Button>
        </VStack>
      </form>
    </Box>
  );
}
