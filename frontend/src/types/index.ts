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

export interface Tag {
  id: number;
  name: string;
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
  transaction_ids: number[];
  count: number;
}

export interface RescanResult {
  auto_applied: number;
  suggested: number;
}

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
    }
  } | null;
}