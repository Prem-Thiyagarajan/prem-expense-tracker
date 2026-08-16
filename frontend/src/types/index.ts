// File: src/types/index.ts

// --- Dashboard Related Types ---
export interface BudgetVsSpend {
  spent: number;
  budget: number;
  percentUsed: number;
}
export interface TopCategory {
  id: number;
  category: string;
  amount: number;
  icon_name: string | null;
}
export interface RecentTransaction {
  id: number; // Also good to have the ID here
  description: string;
  amount: number;
  txn_date: string; // ISO date string
  category_id: number | null;
}

export interface SpendingTrendPoint {
  day: number;
  cumulative_spend: number;
}

export interface DashboardData {
  totalSpent: number;
  percentChangeFromLastMonth: number;
  dailyAverageSpend: number;
  projectedMonthlySpend: number;
  spendingTrend: SpendingTrendPoint[]; 
  topSpendingCategories: TopCategory[];
  recentTransactions: RecentTransaction[];
}
// --- Core Model Types ---

export interface Category {
  id: number;
  name: string;
  is_income: boolean;
  icon_name?: string | null;
}

export interface BudgetPlanItem {
  categoryId: number;
  categoryName: string;
  budget: number;
  spent: number;
  remaining: number;
  progress: number;
  icon_name: string | null;
  suggestedBudget?: number;
  daysLeft?: number;
}

export interface Transaction {
  id: number;
  txn_date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  source: string;
  account_id: number;
  category_id: number | null;
  merchant_id: number | null;
  tags: Tag[];
  // ✅ --- THIS IS THE FIX ---
  // Add the optional `tag_ids` property for update payloads.
  tag_ids?: number[]; 
}

// Keep in sync with backend/app/models/tag.py's EXCLUDABLE_SURFACES.
export type TagExcludedPage = 'dashboard' | 'analytics' | 'budgets';

export interface Tag {
  id: number;
  name: string;
  excluded_pages: TagExcludedPage[];
}

export interface Account {
  id: number;
  name: string;
  type: string;
  provider: string;
}

export interface Merchant {
  id: number;
  name: string;
  category_id: number | null;
  user_id: number;
}

export interface MerchantCluster {
  handle: string | null;
  sample_description: string;
  sample_descriptions: string[];
  transaction_ids: number[];
  count: number;
  total_amount: number;
  min_amount: number;
  max_amount: number;
  first_seen: string | null;
  last_seen: string | null;
}

export interface RescanResult {
  auto_applied: number;
  suggested: number;
}

// --- GOALS (per-category monthly limits) ---
// "Goal" here is a per-category monthly spend limit, not a savings-goal
// concept -- the same underlying data budget_plan_router's whole-month batch
// upsert already manages (see backend/app/services/budget_plan_service.py,
// which calls goal_crud directly). This is the granular single-item CRUD
// shape for the Budgets page's "Category limits" section. No `recurring`
// field -- the backend model doesn't have one, despite the handoff doc's
// mock implying it does.
export interface Goal {
  id: number;
  category_id: number;
  month: string; // "YYYY-MM"
  limit_amount: number;
  category: Category;
}

// --- SUBSCRIPTIONS (Bill Radar) ---
export type SubscriptionInterval = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  amount: number;
  interval: SubscriptionInterval;
  first_due_date: string; // "YYYY-MM-DD"
  last_paid_date: string | null;
  is_active: boolean;
  // Computed server-side, not stored columns.
  upcoming_due_date: string;
  overdue_due_date: string | null;
}

// --- ASSISTANT ---
export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantHealth {
  chat: boolean;
  voice: boolean;
  voice_reason?: string | null;
}

export interface AssistantNavigateAction {
  type: 'navigate';
  route: string;
  open?: string;
  label: string;
}

// One SSE event from POST /assistant/chat -- see backend/app/api/assistant_router.py's
// _run_agent for the exact shapes emitted.
export type AssistantStreamEvent =
  | { type: 'status'; state: 'thinking' | 'fallback' }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string }
  | (AssistantNavigateAction)
  | { type: 'error'; code: string; message: string }
  | { type: 'done' };

// --- ANALYTICS-SPECIFIC TYPES ---

export interface AnalyticsOverview {
  highestSpendMonth: { month: string; actual: number } | null;
  averageSpendPerMonth: number;
}

export interface MonthlyBreakdownPoint {
    month: string;
    spend: number;
}

export interface CategoryDistributionPoint {
  category: string;
  total: number;
  percentage: number;
  icon_name?: string | null;
}

export interface HabitIdentifierPoint {
  category: string;
  transaction_count: number;
  average_spend: number;
  frequency: number;
  total_spend: number;
}

export interface SpendingVelocityPoint {
    day: number;
    current: number | null;
    previous: number | null;
    average: number | null;
}

export interface SpendingCompositionPoint {
    day: number;
    cumulative_small: number | null;
    cumulative_large: number | null;
}

export interface TransactionHeatmapPoint {
  date: string; // "YYYY-MM-DD"
  spend: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  spendingVelocity?: SpendingVelocityPoint[];
  spendingComposition?: SpendingCompositionPoint[];
  habitIdentifier: HabitIdentifierPoint[]; 
  categoryDistribution: CategoryDistributionPoint[];
  transactionHeatmap?: TransactionHeatmapPoint[];
  monthlyBreakdown?: MonthlyBreakdownPoint[];
}

// --- BUDGETS PAGE TYPES ---
export interface SuggestedBudget {
  categoryId: number;
  categoryName: string;
  icon_name: string | null;
  suggestedAmount: number;
  currentSpend: number;
}
export interface HistoricalSpend {
  month: string;
  totalSpend: number;
}
export interface BudgetEmptyStateData {
  historicalSpend: HistoricalSpend[];
  averageTotalSpend: number;
  suggestedBudgets: SuggestedBudget[];
}
export interface BudgetPacingPoint {
  day: number;
  actualSpend: number;
  budgetPace?: number;
}
export interface BudgetPageData {
  plan: BudgetPlanItem[] | null;
  historicalData: BudgetEmptyStateData | null;
  pacingData?: BudgetPacingPoint[];
}

export interface User {
    id: number;
    username: string;
    email: string;
    has_security_question?: boolean;
}

// Add this interface to your existing types.ts file

export interface Alert {
  id: number;
  threshold_percentage: number | null; // Can be null for new alerts
  triggered_at: string; 
  is_acknowledged: boolean;
  
  // ✅ NEW FIELDS
  type: 'budget' | 'new_category' | 'new_merchant';
  context: {
    category_name?: string; // Will exist for 'new_category' type
    // 'new_merchant' fields -- see alert_crud.create_new_merchant_alert
    transaction_id?: number;
    description_snippet?: string;
    suggested_merchant_id?: number;
    suggested_merchant_name?: string;
    suggested_category_id?: number | null;
    match_reason?: string;
    similarity?: number | null;
  } | null;

  goal: { // Can be null for new alerts
    id: number;
    month: string;
    limit_amount: number;
    category: {
      id: number;
      name: string;
      icon_name?: string | null;
    }
  } | null;
}