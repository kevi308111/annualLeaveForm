import { test, expect, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';

// Supabase client for test data setup/teardown
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for tests
);

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'adminpassword'); // Replace with actual admin password
  await page.click('button[type="submit"]');
  await page.waitForURL('/employees');
  await expect(page.locator('h1')).toHaveText('員工列表');
}

// Helper function to login as employee
async function loginAsEmployee(page: Page, username: string, password = 'password123') {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  const employeeId = await getEmployeeIdByUsername(username);
  await page.waitForURL(`/employees/${employeeId}`);
}

// Helper to create a new employee via UI
async function createEmployeeViaUI(page: Page, employeeData: { username: string, name: string, hireDate: string }) {
  await page.goto('/employees/new');
  await page.fill('input[name="username"]', employeeData.username);
  await page.fill('input[name="password"]', 'password123'); // Default password for test employees
  await page.fill('input[name="name"]', employeeData.name);
  await page.selectOption('select[name="gender"]', '男');
  await page.fill('input[name="jobTitle"]', '測試職位');
  await page.fill('input[name="hireDate"]', employeeData.hireDate);
  await page.click('button[type="submit"]');
  await page.waitForURL('/employees');
  await expect(page.locator('text=員工新增成功')).toBeVisible();
}

// Helper to get employee ID from username (assuming username is unique)
async function getEmployeeIdByUsername(username: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('Employee')
    .select('id')
    .eq('username', username)
    .single();
  if (error) {
    console.error('Error fetching employee ID:', error);
    return null;
  }
  return data ? data.id : null;
}

test.describe('Annual Leave Management E2E Tests', () => {
  let employeeId: string | null;
  const testEmployee = {
    username: faker.person.firstName().toLowerCase(),
    name: faker.person.fullName(),
    hireDate: '2023-01-01', // Fixed hire date for predictable seniority
  };

  test.beforeEach(async ({ page }) => {
    // Ensure admin user exists
    const { data: adminUser } = await supabase
      .from('Employee')
      .select('id')
      .eq('username', 'admin')
      .single();

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('adminpassword', 10);
      await supabase.from('Employee').insert({
        username: 'admin',
        password: hashedPassword,
        name: 'Admin',
        role: 'admin',
        hireDate: '2020-01-01',
        gender: '男',
        jobTitle: 'Administrator',
      });
    }

    // Clean up previous test employee if exists
    const existingEmployeeId = await getEmployeeIdByUsername(testEmployee.username);
    if (existingEmployeeId) {
      await supabase.from('LeaveRequest').delete().eq('employeeId', existingEmployeeId);
      await supabase.from('Employee').delete().eq('id', existingEmployeeId);
    }
    // Login as admin for most tests
    await loginAsAdmin(page);
  });

  test.afterEach(async () => {
    // Clean up test employee after each test
    if (employeeId) {
      await supabase.from('LeaveRequest').delete().eq('employeeId', employeeId);
      await supabase.from('Employee').delete().eq('id', employeeId);
      employeeId = null;
    }
  });

  test('should create a new employee with correct initial annual leave', async ({ page }) => {
    await createEmployeeViaUI(page, testEmployee);
    employeeId = await getEmployeeIdByUsername(testEmployee.username);
    expect(employeeId).not.toBeNull();

    await page.goto(`/employees/${employeeId}`);
    // Assuming 2023-01-01 hire date, and current date is > 6 months but < 1 year
    // Initial leave should be 3 days (based on calculateAnnualLeave logic)
    await expect(page.locator('text=總特休天數： 3 日')).toBeVisible();
    await expect(page.locator('text=已使用天數： 0 日')).toBeVisible();
    await expect(page.locator('text=剩餘特休天數： 3 日')).toBeVisible();
  });

  test('should approve a daily annual leave request and update balances', async ({ page }) => {
    await createEmployeeViaUI(page, testEmployee);
    employeeId = await getEmployeeIdByUsername(testEmployee.username);
    expect(employeeId).not.toBeNull();

    // Employee submits leave
    await loginAsEmployee(page, testEmployee.username);
    await page.goto('/leave/new');
    await page.selectOption('select[name="leaveType"]', '特休');
    await page.fill('input[name="startDate"]', '2024-07-10');
    await page.fill('input[name="endDate"]', '2024-07-10');
    await page.fill('input[name="duration"]', '1');
    await page.fill('textarea[name="reason"]', '測試請假');
    await page.click('button[type="submit"]');
    await page.waitForURL(`/employees/${employeeId}`);
    await expect(page.locator('text=假單已提交')).toBeVisible();

    // Admin approves leave
    await loginAsAdmin(page);
    await page.goto('/leave/approvals');
    await page.locator(`tr:has-text("${testEmployee.name}") button:has-text("核准")`).click();
    await expect(page.locator('text=申請已核准')).toBeVisible();

    // Verify balances on employee detail page
    await page.goto(`/employees/${employeeId}`);
    await expect(page.locator('text=總特休天數： 3 日')).toBeVisible(); // Still 3 days total entitlement
    await expect(page.locator('text=已使用天數： 1 日')).toBeVisible();
    await expect(page.locator('text=剩餘特休天數： 2 日')).toBeVisible();
  });

  test('should approve an hourly annual leave request and update balances correctly', async ({ page }) => {
    await createEmployeeViaUI(page, testEmployee);
    employeeId = await getEmployeeIdByUsername(testEmployee.username);
    expect(employeeId).not.toBeNull();

    // Employee submits hourly leave (4 hours = 0.5 days)
    await loginAsEmployee(page, testEmployee.username);
    await page.goto('/leave/new');
    await page.selectOption('select[name="leaveType"]', '特休');
    await page.click('input[name="isHourly"]'); // Check hourly checkbox
    await page.fill('input[name="startDate"]', '2024-07-11');
    await page.fill('input[name="endDate"]', '2024-07-11');
    await page.fill('input[name="duration"]', '4'); // 4 hours
    await page.fill('input[name="startTime"]', '09:00');
    await page.fill('input[name="endTime"]', '13:00');
    await page.fill('textarea[name="reason"]', '測試小時請假');
    await page.click('button[type="submit"]');
    await page.waitForURL(`/employees/${employeeId}`);
    await expect(page.locator('text=假單已提交')).toBeVisible();

    // Admin approves leave
    await loginAsAdmin(page);
    await page.goto('/leave/approvals');
    await page.locator(`tr:has-text("${testEmployee.name}") button:has-text("核准")`).click();
    await expect(page.locator('text=申請已核准')).toBeVisible();

    // Verify balances on employee detail page
    await page.goto(`/employees/${employeeId}`);
    await expect(page.locator('text=總特休天數： 3 日')).toBeVisible();
    await expect(page.locator('text=已使用天數： 0.5 日')).toBeVisible(); // 4 hours = 0.5 days
    await expect(page.locator('text=剩餘特休天數： 2.5 日')).toBeVisible(); // 3 - 0.5 = 2.5
  });

  test('should revert balances when an approved annual leave is deleted', async ({ page }) => {
    await createEmployeeViaUI(page, testEmployee);
    employeeId = await getEmployeeIdByUsername(testEmployee.username);
    expect(employeeId).not.toBeNull();

    // Employee submits and admin approves 1 day leave
    await loginAsEmployee(page, testEmployee.username);
    await page.goto('/leave/new');
    await page.selectOption('select[name="leaveType"]', '特休');
    await page.fill('input[name="startDate"]', '2024-07-12');
    await page.fill('input[name="endDate"]', '2024-07-12');
    await page.fill('input[name="duration"]', '1');
    await page.fill('textarea[name="reason"]', '測試刪除前請假');
    await page.click('button[type="submit"]');
    await page.waitForURL(`/employees/${employeeId}`);
    await expect(page.locator('text=假單已提交')).toBeVisible();

    await loginAsAdmin(page);
    await page.goto('/leave/approvals');
    await page.locator(`tr:has-text("${testEmployee.name}") button:has-text("核准")`).click();
    await expect(page.locator('text=申請已核准')).toBeVisible();

    // Verify initial state after approval
    await page.goto(`/employees/${employeeId}`);
    await expect(page.locator('text=已使用天數： 1 日')).toBeVisible();
    await expect(page.locator('text=剩餘特休天數： 2 日')).toBeVisible();

    // Delete the approved leave request
    await page.locator(`tr:has-text("特休") button:has-text("刪除")`).first().click();
    page.on('dialog', dialog => dialog.accept()); // Accept confirmation dialog
    await expect(page.locator('text=申請已刪除')).toBeVisible();

    // Verify balances are reverted immediately
    await expect(page.locator('text=已使用天數： 0 日')).toBeVisible();
    await expect(page.locator('text=剩餘特休天數： 3 日')).toBeVisible();
  });

  test('should manually adjust annual leave and not affect used days', async ({ page }) => {
    await createEmployeeViaUI(page, testEmployee);
    employeeId = await getEmployeeIdByUsername(testEmployee.username);
    expect(employeeId).not.toBeNull();

    await page.goto(`/employees/${employeeId}`);
    await expect(page.locator('text=已使用天數： 0 日')).toBeVisible();
    await expect(page.locator('text=剩餘特休天數： 3 日')).toBeVisible();

    // Open adjustment modal
    await page.click('button:has-text("調整特休餘額")');
    await expect(page.locator('text=調整特休餘額')).toBeVisible();
    await expect(page.locator('text=當前剩餘特休：3 日')).toBeVisible();

    // Add 2 days
    await page.selectOption('select', 'add');
    await page.fill('input[type="number"]', '2');
    await page.click('button:has-text("確認調整")');
    await expect(page.locator('text=特休餘額調整成功')).toBeVisible();

    // Verify remaining days updated, used days unchanged
    await expect(page.locator('text=已使用天數： 0 日')).toBeVisible();
    await expect(page.locator('text=剩餘特休天數： 5 日')).toBeVisible(); // 3 + 2 = 5

    // Subtract 1.5 days
    await page.click('button:has-text("調整特休餘額")');
    await expect(page.locator('text=當前剩餘特休：5 日')).toBeVisible();
    await page.selectOption('select', 'subtract');
    await page.fill('input[type="number"]', '1.5');
    await page.click('button:has-text("確認調整")');
    await expect(page.locator('text=特休餘額調整成功')).toBeVisible();

    // Verify remaining days updated, used days unchanged
    await expect(page.locator('text=已使用天數： 0 日')).toBeVisible();
    await expect(page.locator('text=剩餘特休天數： 3.5 日')).toBeVisible(); // 5 - 1.5 = 3.5
  });

  test('manual adjustment button should only be visible to admin', async ({ page }) => {
    await createEmployeeViaUI(page, testEmployee);
    employeeId = await getEmployeeIdByUsername(testEmployee.username);
    expect(employeeId).not.toBeNull();

    // As admin, button should be visible
    await page.goto(`/employees/${employeeId}`);
    await expect(page.locator('button:has-text("調整特休餘額")')).toBeVisible();

    // As employee, button should not be visible
    await loginAsEmployee(page, testEmployee.username);
    await page.goto(`/employees/${employeeId}`);
    await expect(page.locator('button:has-text("調整特休餘額")')).not.toBeVisible();
  });
});
