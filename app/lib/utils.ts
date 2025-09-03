// app/lib/utils.ts

import { differenceInDays, differenceInYears, parseISO, startOfDay, isBefore, addYears } from 'date-fns';

interface SeniorityDetails {
  seniorityInYears: number; // 已滿年資(年)
  seniorityInYearsDecimal: number; // 新增：年資(年)小數點表示
  seniorityInDaysBeforeCorrection: number; // 年資(天)校正前
  seniorityInDaysAfterCorrection: number; // 年資(天)校正後
  daysUntilNextSeniorityCycle: number; // 下次年資週期剩餘天數
  currentSeniorityCycle: string; // 目前年資週期 (例如：1年-2年)
  currentCycleStartDate: Date; // 新增：目前年資週期的開始日期
}

/**
 * 計算員工年資詳情
 * @param hireDateString 到職日 (YYYY-MM-DD)
 * @param correctionDays 校正天數
 * @returns SeniorityDetails
 */
export function calculateSeniority(hireDateString: string, correctionDays: number = 0): SeniorityDetails {
  const hireDate = parseISO(hireDateString);
  const today = startOfDay(new Date());

  // 年資(天)校正前
  const seniorityInDaysBeforeCorrection = differenceInDays(today, hireDate);

  // 年資(天)校正後
  const seniorityInDaysAfterCorrection = seniorityInDaysBeforeCorrection + correctionDays;

  // 已滿年資(年)
  const seniorityInYears = differenceInYears(today, hireDate);

  let daysUntilNextSeniorityCycle = 0;
  let currentSeniorityCycle = '';

  // 計算下次年資週期剩餘天數和目前年資週期
  if (seniorityInYears < 1) {
    // 未滿一年，計算到滿一年的天數
    const oneYearFromHire = addYears(hireDate, 1);
    daysUntilNextSeniorityCycle = differenceInDays(oneYearFromHire, today);
    currentSeniorityCycle = '未滿1年';
  } else {
    // 已滿一年，計算到下一個整年週期的天數
    const nextAnniversary = addYears(hireDate, seniorityInYears + 1);
    daysUntilNextSeniorityCycle = differenceInDays(nextAnniversary, today);
    currentSeniorityCycle = `${seniorityInYears}年-${seniorityInYears + 1}年`;
  }

  const seniorityInYearsDecimal = seniorityInDaysAfterCorrection / 365.25; // Calculate decimal years
  const currentCycleStartDate = addYears(hireDate, seniorityInYears); // Calculate current cycle start date

  return {
    seniorityInYears,
    seniorityInYearsDecimal,
    seniorityInDaysBeforeCorrection,
    seniorityInDaysAfterCorrection,
    daysUntilNextSeniorityCycle,
    currentSeniorityCycle,
    currentCycleStartDate, // Include new field
  };
}

/**
 * 根據年資計算特休天數
 * @param seniorityInYears 已滿年資(年)
 * @param seniorityInDaysAfterCorrection 年資(天)校正後
 * @returns 特休天數
 */
export function calculateAnnualLeave(seniorityInYears: number, seniorityInDaysAfterCorrection: number): number {
  const SIX_MONTHS_IN_DAYS = 180; // Approximate days in 6 months
  const ONE_YEAR_IN_DAYS = 365; // Approximate days in 1 year

  if (seniorityInYears >= 10) {
    // 工作 10 年以上者，每 1 年加給 1 日，加至 30 日為止。
    const baseLeave = 15;
    const additionalYears = seniorityInYears - 10;
    return Math.min(baseLeave + additionalYears, 30);
  } else if (seniorityInYears >= 5) {
    return 15; // 工作 5 年以上，未滿 10 年者：每年有 15 日。
  } else if (seniorityInYears >= 3) {
    return 14; // 工作 3 年以上，未滿 5 年者：每年有 14 日。
  } else if (seniorityInYears >= 2) {
    return 10; // 工作 2 年以上，未滿 3 年者：10 日。
  } else if (seniorityInYears >= 1) {
    return 7; // 工作 1 年以上，未滿 2 年者：7 日。
  } else if (seniorityInDaysAfterCorrection >= SIX_MONTHS_IN_DAYS && seniorityInDaysAfterCorrection < ONE_YEAR_IN_DAYS) {
    return 3; // 工作 6 個月以上，未滿 1 年者：3 日。
  }
  return 0; // 未滿 6 個月無特休
}


