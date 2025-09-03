import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { createClient } from '@supabase/supabase-js';
import {
  differenceInYears,
  differenceInDays,
  parseISO,
  startOfDay,
  addYears,
  isBefore,
  isEqual,
} from 'date-fns';

// Helper functions (copied from app/lib/utils.ts, adapted for API route)
interface SeniorityDetails {
  seniorityInYears: number;
  seniorityInYearsDecimal: number;
  seniorityInDaysBeforeCorrection: number;
  seniorityInDaysAfterCorrection: number;
  daysUntilNextSeniorityCycle: number;
  currentSeniorityCycle: string;
  currentCycleStartDate: Date;
}

function calculateSeniority(hireDateString: string, correctionDays: number = 0): SeniorityDetails {
  const hireDate = parseISO(hireDateString);
  const today = startOfDay(new Date());

  const seniorityInDaysBeforeCorrection = differenceInDays(today, hireDate);
  const seniorityInDaysAfterCorrection = seniorityInDaysBeforeCorrection + correctionDays;
  const seniorityInYears = differenceInYears(today, hireDate);

  let daysUntilNextSeniorityCycle = 0;
  let currentSeniorityCycle = '';

  if (seniorityInYears < 1) {
    const oneYearFromHire = addYears(hireDate, 1);
    daysUntilNextSeniorityCycle = differenceInDays(oneYearFromHire, today);
    currentSeniorityCycle = '未滿1年';
  } else {
    const nextAnniversary = addYears(hireDate, seniorityInYears + 1);
    daysUntilNextSeniorityCycle = differenceInDays(nextAnniversary, today);
    currentSeniorityCycle = `${seniorityInYears}年-${seniorityInYears + 1}年`;
  }

  const seniorityInYearsDecimal = seniorityInDaysAfterCorrection / 365.25;
  const currentCycleStartDate = addYears(hireDate, seniorityInYears);

  return {
    seniorityInYears,
    seniorityInYearsDecimal,
    seniorityInDaysBeforeCorrection,
    seniorityInDaysAfterCorrection,
    daysUntilNextSeniorityCycle,
    currentSeniorityCycle,
    currentCycleStartDate,
  };
}

function calculateAnnualLeave(seniorityInYears: number, seniorityInDaysAfterCorrection: number): number {
  const SIX_MONTHS_IN_DAYS = 180;
  const ONE_YEAR_IN_DAYS = 365;

  if (seniorityInYears >= 10) {
    const baseLeave = 15;
    const additionalYears = seniorityInYears - 10;
    return Math.min(baseLeave + additionalYears, 30);
  } else if (seniorityInYears >= 5) {
    return 15;
  } else if (seniorityInYears >= 3) {
    return 14;
  } else if (seniorityInYears >= 2) {
    return 10;
  } else if (seniorityInYears >= 1) {
    return 7;
  } else if (seniorityInDaysAfterCorrection >= SIX_MONTHS_IN_DAYS && seniorityInDaysAfterCorrection < ONE_YEAR_IN_DAYS) {
    return 3;
  }
  return 0;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  // 1. Verify user session and admin role
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Fetch all employees
    const { data: employees, error: fetchError } = await supabaseAdmin
      .from('Employee')
      .select('id, hireDate, seniorityCorrectionDays, remainingAnnualLeaveDays, lastAnnualLeaveGrantDate'); // Removed overUsedAnnualLeaveDays

    if (fetchError) {
      console.error('Error fetching employees:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({ message: 'No employees found.' }, { status: 200 });
    }

    const updates = [];
    const today = startOfDay(new Date());

    for (const employee of employees) {
      const seniorityDetails = calculateSeniority(
        employee.hireDate,
        employee.seniorityCorrectionDays || 0
      );

      const currentCycleStartDate = startOfDay(seniorityDetails.currentCycleStartDate);
      const lastGrantDate = employee.lastAnnualLeaveGrantDate ? startOfDay(parseISO(employee.lastAnnualLeaveGrantDate)) : null;

      // Check if a new cycle has started and leave hasn't been granted for it yet
      // Condition: currentCycleStartDate is today or in the past AND
      //            (lastGrantDate is null OR lastGrantDate is before currentCycleStartDate)
      if (
        (isBefore(currentCycleStartDate, today) || isEqual(currentCycleStartDate, today)) &&
        (!lastGrantDate || isBefore(lastGrantDate, currentCycleStartDate))
      ) {
        const newEntitlement = calculateAnnualLeave(
          seniorityDetails.seniorityInYears,
          seniorityDetails.seniorityInDaysAfterCorrection
        );

        let updatedRemaining = employee.remainingAnnualLeaveDays || 0;

        updatedRemaining += newEntitlement; // Simplified logic (no overUsedAnnualLeaveDays)

        updates.push({
          id: employee.id,
          remainingAnnualLeaveDays: updatedRemaining,
          lastAnnualLeaveGrantDate: today.toISOString().split('T')[0],
        });
      }
    }

    if (updates.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('Employee')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        console.error('Error updating employee leave balances:', updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      message: `Processed ${employees.length} employees, updated ${updates.length} records.`,
      updatedEmployees: updates,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Unhandled error in API route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
