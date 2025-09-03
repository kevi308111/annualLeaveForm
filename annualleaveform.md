# 公司內部請假管理系統 - 開發計畫

## 專案總覽 (Project Overview)

這是一個公司內部的請假管理系統，旨在簡化請假流程，並自動化特休天數的計算。系統將提供員工資料管理、請假申請、以及假單紀錄等功能。

## 功能需求 (Features)

### 1. 使用者驗證 (Authentication)

- 提供一個簡單的使用者登入系統。
- 系統將包含兩種使用者角色：管理員 (Admin) 和一般員工 (Employee)。
- 管理員可以為員工設定帳號和密碼。
- 員工登入後可以修改自己的密碼，但不能修改帳號。

### 2. 權限管理 (Access Control)

- **管理員 (Admin):**
  - 可以查看所有員工的資料列表。
  - 可以新增、編輯、刪除任何員工的資料。
  - 可以查看所有人的請假紀錄。
- **一般員工 (Employee):**
  - 在員工列表頁面，只能點擊自己的名字查看自己的詳細資料。
  - 不能查看或編輯其他員工的資料。
  - 只能申請自己的假單，以及查看自己的請假紀錄。

### 3. 員工資料管理 (Employee Data Management)

- 一個集中的員工資料表，方便管理。
- 員工資料應包含以下欄位：
  - 帳號 (Username) - 用於登入
  - 密碼 (Password) - 儲存為雜湊值
  - 姓名 (Name)
  - 性別 (Gender)
  - 職稱 (Job Title)
  - 到職日 (Hire Date)
  - 年資校正天數 (Seniority Correction Days) - 用於調整員工的總年資天數。
  - 角色 (Role) - `admin` 或 `employee`，用於權限管理。
  - 持有特休天數 (Remaining Annual Leave Days) - 員工當前可用的特休天數，由系統根據年資計算並在請假後更新。
  - 上次特休發放日期 (Last Annual Leave Grant Date) - 記錄上次特休天數發放的日期，通常為到職日或年資週期開始日。
  - **以下為系統根據到職日和年資校正天數計算的衍生欄位，不直接儲存於資料庫，但可在前端顯示或用於計算：**
    - 已滿年資(年) (Seniority in years)
    - 年資(天)校正前 (Seniority in days - before correction)
    - 年資(天)校正後 (Seniority in days - after correction)
    - 年資(年/天) (Seniority in years/days)
    - 下次年資週期剩餘天數 (Days until next seniority cycle)
    - 目前年資週期 (Current seniority cycle)
    - 至新年資週期前請假天數 (Leave days taken before next cycle) - 指在下一個年資週期開始前已使用的特休天數，可從請假紀錄中累計計算。
    - 至新年資週期前剩餘特休天數 (Remaining leave days before next cycle) - 指在下一個年資週期開始前，扣除已請假天數後剩餘的特休天數。

### 4. 特休計算規則 (Annual Leave Calculation)

- 系統需要根據年資自動計算特休天數，規則如下：
  - 工作 6 個月以上，未滿 1 年者：3 日。
  - 工作 1 年以上，未滿 2 年者：7 日。
  - 工作 2 年以上，未滿 3 年者：10 日。
  - 工作 3 年以上，未滿 5 年者：每年有 14 日。
  - 工作 5 年以上，未滿 10 年者：每年有 15 日。
  - 工作 10 年以上者，每 1 年加給 1 日，加至 30 日為止。

### 5. 特休計算邏輯詳情 (Annual Leave Calculation Details)

特休天數的計算主要依賴於 `app/lib/utils.ts` 中的兩個核心函數：`calculateSeniority` 和 `calculateAnnualLeave`。

#### `calculateSeniority` 函數

- **目的：** 計算員工的年資詳情，包括已滿年資、校正後的年資天數等。
- **輸入參數：**
  - `hireDateString`: 員工的到職日期 (格式為 YYYY-MM-DD)。
  - `correctionDays`: 年資校正天數 (數字，預設為 0)。
- **輸出：** 一個包含以下年資詳情的物件：
  - `seniorityInYears`: 已滿年資(年) (例如：工作滿 1 年則為 1)。
  - `seniorityInYearsDecimal`: 年資(年)小數點表示 (例如：1.5 年)。
  - `seniorityInDaysBeforeCorrection`: 年資(天)校正前 (從到職日到今天的天數)。
  - `seniorityInDaysAfterCorrection`: 年資(天)校正後 (校正前的天數加上校正天數)。
  - `daysUntilNextSeniorityCycle`: 下次年資週期剩餘天數 (距離下一個年資週年紀念日的天數)。
  - `currentSeniorityCycle`: 目前年資週期 (例如：「未滿1年」、「1年-2年」)。
  - `currentCycleStartDate`: 目前年資週期的開始日期。
- **計算邏輯：**
  1.  根據 `hireDateString` 和當前日期計算出未校正的年資天數 (`seniorityInDaysBeforeCorrection`) 和已滿年資年數 (`seniorityInYears`)。
  2.  將 `correctionDays` 加入 `seniorityInDaysBeforeCorrection` 得到 `seniorityInDaysAfterCorrection`。
  3.  根據 `seniorityInYears` 判斷當前年資週期，並計算距離下一個年資週年紀念日的天數。
  4.  計算 `seniorityInYearsDecimal` (年資天數校正後 / 365.25)。

#### `calculateAnnualLeave` 函數

- **目的：** 根據員工的年資計算其應得的特休天數。
- **輸入參數：**
  - `seniorityInYears`: 已滿年資(年) (來自 `calculateSeniority` 的輸出)。
  - `seniorityInDaysAfterCorrection`: 年資(天)校正後 (來自 `calculateSeniority` 的輸出)。
- **輸出：** 員工應得的特休天數 (數字)。
- **計算邏輯 (對應特休計算規則)：**
  - **工作 10 年以上：**
    - 基礎特休天數為 15 天。
    - 每超過 10 年的部分，每年額外增加 1 天特休。
    - 特休天數上限為 30 天。
  - **工作 5 年以上，未滿 10 年：** 15 天。
  - **工作 3 年以上，未滿 5 年：** 14 天。
  - **工作 2 年以上，未滿 3 年：** 10 天。
  - **工作 1 年以上，未滿 2 年：** 7 天。
  - **工作 6 個月以上，未滿 1 年：** 3 天 (判斷條件為 `seniorityInDaysAfterCorrection` 大於等於 180 天且小於 365 天)。
  - **未滿 6 個月：** 0 天。

### 6. 請假申請表單 (Leave Request Form)

- 一個線上的請假申請表單。
- 表單欄位應包含：
  - 申請人 (Applicant) - 從員工姓名列表中選擇
  - 請假類型 (Leave Type) - 特休、事假、病假、其他 (可自訂，若選「其他」需填寫具體假別名稱)
  - 請假事由 (Reason)
  - 請假日數 (Duration) - 數字，可填寫小數點 (例如：0.5, 1, 1.5)
  - 請假開始日期 (Start Date) - YYYY/MM/DD
  - 請假結束日期 (End Date) - YYYY/MM/DD
  - 備註 (Remarks) - 可選
- 表單右上角應有「返回」按鈕，可回到上一頁。

## 資料模型 (Data Models)

### `Employee` (員工)

```json
{
  "id": "string",
  "username": "string",
  "password": "string", // 儲存為雜湊值
  "name": "string",
  "gender": "string",
  "jobTitle": "string",
  "hireDate": "date",
  "seniorityCorrectionDays": "number",
  "role": "string", // 'admin' 或 'employee'
  "remainingAnnualLeaveDays": "number", // 員工當前可用的特休天數
  "lastAnnualLeaveGrantDate": "date" // 上次特休天數發放的日期
}
```

### `LeaveRequest` (假單)

```json
{
  "id": "string",
  "employeeId": "string",
  "leaveType": "string",
  "reason": "string",
  "duration": "number",
  "startDate": "date",
  "endDate": "date",
  "remarks": "string",
  "status": "string" // e.g., 'pending', 'approved', 'rejected'
}
```

## 技術棧建議 (Technology Stack)

- **前端框架 (Frontend Framework):** Next.js, React, TypeScript, Tailwind CSS (已建立)
- **UI 元件庫 (UI Components):** [**Chakra UI**](https://chakra-ui.com/) - 一個功能強大且易於使用的 React 元件庫。
- **表單管理 (Forms):** [**React Hook Form**](https://react-hook-form.com/) 搭配 [**Zod**](https://zod.dev/) - 用於表單的建立、驗證和管理。
- **使用者驗證 (Authentication):** [**NextAuth.js**](https://next-auth.js.org/) - 一個完整的 Next.js 驗證解決方案，支援多種登入方式。
- **資料庫 (Database):** [**Supabase**](https://supabase.com/) - 一個開源的 Firebase 替代品，提供資料庫、驗證、儲存等後端服務，有免費方案，非常適合快速開發。
- **日期/時間處理 (Date/Time):** [**date-fns**](https://date-fns.org/) 或 [**Day.js**](https://day.js.org/) - 用於處理各種日期相關的計算。
- **狀態管理 (State Management):** [**Zustand**](https://github.com/pmndrs/zustand) (已安裝) - 一個輕量、簡單的狀態管理工具。

## 資料儲存與處理 (Data Storage and Handling)

我們將使用 **Supabase** 作為主要的後端服務。

- **資料庫:** 您的所有資料（員工資料、請假紀錄等）都會被安全地儲存在 Supabase 的雲端 PostgreSQL 資料庫上。我們會建立 `Employee` 和 `LeaveRequest` 兩個主要的資料表來儲存相關資訊。
- **資料處理:** 我們的 Next.js 應用程式會透過 `supabase-js` 這個官方套件來和您的 Supabase 資料庫溝通，進行資料的新增、讀取、修改和刪除。
- **安全性:** Supabase 提供了多層次的資料安全機制，包含傳輸加密、精細的權限控管 (Row-Level Security)，以及安全的密碼加密儲存。

## 部署方案 (Deployment Strategy)

我們建議使用 **Vercel** 來部署這個應用程式。

- **無縫整合:** Vercel 是 Next.js 的開發公司，兩者整合完美，部署過程非常簡單。
- **持續部署 (CI/CD):** 我們可以將專案連結到一個 Git 倉庫（如 GitHub），當有新的程式碼提交時，Vercel 會自動進行建置和部署。
- **高效能與免費方案:** Vercel 提供全球 CDN 加速，並有免費方案可供使用。
- **與 Supabase 協作:** Vercel 專案可以安全地透過環境變數設定來連接 Supabase 資料庫，確保金鑰不外洩。

## 開發步驟 (Implementation Steps)

1.  **環境設定 (Setup):**

    - 安裝建議的套件 (`@chakra-ui/react @emotion/react @emotion/styled framer-motion`, `react-hook-form`, `zod`, `next-auth`, `supabase`, `date-fns`)。
    - 設定 Chakra UI Provider。
    - 在 Supabase 建立專案，並根據資料模型建立 `Employee` 和 `LeaveRequest` 資料表。

2.  **使用者驗證 (Authentication):**

    - 使用 NextAuth.js 和 Supabase Auth 設定登入、登出和密碼修改功能。
    - 建立管理員角色，用以管理員工帳號。

3.  **員工資料模組 (Employee Module):**

    - 建立一個頁面來顯示所有員工的列表。
    - 建立一個頁面來顯示單一員工的詳細資料，包含自動計算的年資和特休資訊。
    - 建立新增和編輯員工資料的表單。

4.  **請假系統模組 (Leave System Module):**

    - 使用 React Hook Form 和 Zod 建立請假申請表單。
    - 實作特休計算的邏輯。
    - 建立一個頁面來顯示個人的請假紀錄。
    - (可選) 建立一個給管理員看的頁面，用以審核假單。

5.  **部署 (Deployment):**
    - 將專案連接到 GitHub，並在 Vercel 上進行部署設定。

## 環境變數設定 (.env)

為了保護敏感資訊並方便不同環境的配置，我們使用環境變數來儲存 API 金鑰、資料庫連接字串等。在專案根目錄下，您需要建立一個名為 `.env.local` 的檔案。

**請注意：** `.env.local` 檔案不應被提交到版本控制系統 (例如 Git)，因為它包含敏感資訊。`.gitignore` 檔案中通常會包含 `*.env*` 來自動忽略這些檔案。

以下是 `annual-leave-form-frontend` 專案中可能需要的環境變數範例：

```
# Supabase 相關
NEXT_PUBLIC_SUPABASE_URL=您的Supabase專案URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=您的Supabase匿名公開金鑰

# NextAuth.js 相關
NEXTAUTH_SECRET=一個長且複雜的隨機字串，用於簽署session token
NEXTAUTH_URL=您的應用程式部署URL (例如：http://localhost:3000 或 https://your-app.vercel.app)
```

- **`NEXT_PUBLIC_SUPABASE_URL`**: 您的 Supabase 專案的 URL，可以在 Supabase 專案設定中找到。
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: 您的 Supabase 匿名公開金鑰，用於前端與 Supabase 互動。
- **`NEXTAUTH_SECRET`**: 一個用於 NextAuth.js 簽署 session token 的秘密金鑰。您可以使用工具（如 `openssl rand -base64 32`）生成一個隨機字串。
- **`NEXTAUTH_URL`**: 您的應用程式的基礎 URL。在開發環境中通常是 `http://localhost:3000`。

## Supabase 建立與設定流程

Supabase 是一個開源的 Firebase 替代品，提供資料庫、驗證、儲存等後端服務。

### 1. 建立 Supabase 專案

1.  **註冊/登入**: 前往 [Supabase 官網](https://supabase.com/) 並使用您的 GitHub 帳號或其他方式註冊或登入。
2.  **建立新專案**: 登入後，點擊 "New project" 按鈕。
3.  **填寫專案資訊**:
    - **Name**: 為您的專案命名 (例如：`annual-leave-form`)。
    - **Database Password**: 設定一個強密碼，這是您的 PostgreSQL 資料庫密碼。請務必記住它。
    - **Region**: 選擇一個離您或您的使用者最近的資料中心區域，以獲得最佳效能。
    - **Pricing Plan**: 選擇 "Free" 方案進行開發和測試。
4.  **等待專案建立**: Supabase 會自動為您配置資料庫和其他服務，這可能需要幾分鐘。

### 2. 取得 API 金鑰

專案建立完成後，您需要取得 Supabase 的 URL 和匿名公開金鑰，這些將用於您的 Next.js 應用程式連接 Supabase。

1.  **進入專案設定**: 在 Supabase 控制台，點擊左側導航欄底部的 "Project Settings" (齒輪圖示)。
2.  **API 設定**: 選擇 "API" 選項卡。
3.  **複製金鑰**:
    - **Project URL**: 複製 `URL` 欄位的值，這就是 `NEXT_PUBLIC_SUPABASE_URL`。
    - **Project API keys**: 複製 `anon (public)` 欄位下的 `Key` 值，這就是 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。

### 3. 設定資料庫表格 (根據資料模型)

根據專案的資料模型 (`Employee` 和 `LeaveRequest`)，您需要在 Supabase 中建立對應的表格。

1.  **進入資料庫**: 在 Supabase 控制台，點擊左側導航欄的 "Table Editor" (表格圖示)。
2.  **建立新表格**: 點擊 "+ New table" 按鈕。
3.  **定義表格結構**:
    - **Name**: 輸入表格名稱 (例如：`employees` 或 `leave_requests`)。
    - **Columns**: 根據您的資料模型定義欄位 (例如：`name` (text), `hire_date` (date) 等)。確保為每個表格設定一個主鍵 (通常是 `id`)。
    - **Row Level Security (RLS)**: 預設情況下，RLS 是啟用的。這是一個重要的安全功能，您需要為每個表格定義策略，以控制誰可以讀取、寫入、更新或刪除資料。在開發初期，您可以暫時禁用它或設定簡單的策略，但在生產環境中務必啟用並配置正確。

### 4. 設定驗證 (Authentication)

Supabase 提供了強大的驗證服務。

1.  **進入驗證**: 在 Supabase 控制台，點擊左側導航欄的 "Authentication" (鎖頭圖示)。
2.  **設定提供者**: 您可以啟用不同的登入方式，例如：
    - **Email**: 啟用電子郵件登入，並配置是否需要電子郵件確認。
    - **Social Providers**: 啟用 Google, GitHub 等第三方登入。
3.  **使用者管理**: 在 "Users" 選項卡中，您可以手動添加使用者或查看已註冊的使用者。

完成以上步驟後，您的 Supabase 後端就基本設定完成了，可以開始與 Next.js 前端應用程式進行整合。
