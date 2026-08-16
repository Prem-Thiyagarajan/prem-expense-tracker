// File: src/Wrapped/wrappedStories.ts
//
// Pure, framework-free builder for the Wrapped story sequence. Reshapes data
// the Analytics/Dashboard pages already fetch -- no network calls of its own.
//
// Ported from PFT-Mobile/src/app/(tabs)/trends.tsx's buildWrappedStories().
// The mobile version takes { totalSpent, percentChangeFromLastMonth } off its
// dashboard hook, a sorted category distribution, and habitIdentifier, and
// turns them into three story cards (total + delta, top category, most
// frequent buy). Field names differ here (this app's DashboardData /
// CategoryDistributionPoint / HabitIdentifierPoint, from src/types/index.ts)
// but the shape and copy style are carried over 1:1. Kept local to Wrapped/
// rather than added to src/types/index.ts per the task's constraint on that
// shared file.
import { formatCurrency } from '../utils/formatter';
import type { CategoryDistributionPoint, HabitIdentifierPoint } from '../types';

export interface WrappedStory {
  /** Medallion emoji. */
  emoji: string;
  /** Medallion fill -- always paired with candyLine ink per the candy-accent convention. */
  circleColor: string;
  /** Headline above the medallion. */
  title: string;
  /** The giant Archivo Black stat. */
  big: string;
  /** Muted caption line under the stat. */
  sub: string;
  /** Suggested caption for manual sharing -- copied to the clipboard alongside the downloaded card image. */
  shareText: string;
}

/**
 * Category -> {emoji, color} for the medallion. Mirrors the CATEGORY_COLORS
 * map duplicated in Dashboard/components/TopSpendCategoriesChart.tsx and
 * Analytics/components/CategoryDistribution.tsx (handoff/README.md §Category
 * colours + icons), plus that section's emoji. Kept local to Wrapped -- it's
 * a presentational cast, not a data type other screens need.
 */
const CATEGORY_VISUALS: Record<string, { emoji: string; color: string }> = {
  Food: { emoji: '🍕', color: '#FF8787' },
  Bills: { emoji: '💡', color: '#5C7CFA' },
  Travel: { emoji: '🚌', color: '#FFD43B' },
  Transportation: { emoji: '🚌', color: '#FFD43B' },
  Shopping: { emoji: '🛍️', color: '#C7F0DB' },
  Transfers: { emoji: '🏦', color: '#C7F0DB' },
  'Health & Wellness': { emoji: '🩺', color: '#C7F0DB' },
  Healthcare: { emoji: '🩺', color: '#C7F0DB' },
  'Personal Care': { emoji: '💇', color: '#FFD6E8' },
  Education: { emoji: '🎓', color: '#D0BFFF' },
  Entertainment: { emoji: '🎟️', color: '#D0BFFF' },
  Services: { emoji: '🎟️', color: '#D0BFFF' },
  'House Work': { emoji: '🧹', color: '#E8E2D4' },
  Miscellaneous: { emoji: '📦', color: '#E8E2D4' },
  Rent: { emoji: '🏠', color: '#5C7CFA' },
};
const DEFAULT_VISUAL = { emoji: '📦', color: '#E8E2D4' };
const categoryVisual = (category: string) => CATEGORY_VISUALS[category] ?? DEFAULT_VISUAL;

/** The subset of DashboardData a story needs -- avoids importing the whole shape just for two fields. */
export interface WrappedDashboardTotals {
  totalSpent: number;
  percentChangeFromLastMonth: number;
}

/**
 * Builds the Wrapped story sequence for a single month.
 *
 * `dashboardTotals` comes from a `getDashboardData(month)` call -- Analytics'
 * own AnalyticsOverview only carries `highestSpendMonth` / `averageSpendPerMonth`
 * (all-time figures), not this month's total or its delta from last month, so
 * that one figure has to come from Dashboard's data, not Analytics'.
 * `categoryDistribution` and `habitIdentifier` come straight off the
 * already-fetched AnalyticsData for the month -- no extra fetch needed there.
 *
 * Pure and React-free so it's directly testable.
 */
export function buildWrappedStories(
  dashboardTotals: WrappedDashboardTotals | null,
  categoryDistribution: CategoryDistributionPoint[],
  habitIdentifier: HabitIdentifierPoint[],
  monthLabel: string,
): WrappedStory[] {
  const stories: WrappedStory[] = [];

  // Story 1: total spent + delta vs last month.
  if (dashboardTotals && dashboardTotals.totalSpent > 0) {
    const pct = Math.round(Math.abs(dashboardTotals.percentChangeFromLastMonth));
    const up = dashboardTotals.percentChangeFromLastMonth >= 0;
    stories.push({
      emoji: '💸',
      circleColor: '#C7F0DB',
      title: `You spent this much in ${monthLabel}`,
      big: formatCurrency(dashboardTotals.totalSpent),
      sub: `${up ? '▲' : '▼'} ${pct}% vs last month`,
      shareText: `I spent ${formatCurrency(dashboardTotals.totalSpent)} in ${monthLabel} — ${up ? 'up' : 'down'} ${pct}% vs last month. #MyMoneyWrapped`,
    });
  }

  // Story 2: top category by spend.
  const topCategory = [...categoryDistribution].sort((a, b) => b.total - a.total)[0];
  if (topCategory) {
    const visual = categoryVisual(topCategory.category);
    stories.push({
      emoji: visual.emoji,
      circleColor: visual.color,
      title: `Your top category was ${topCategory.category}`,
      big: formatCurrency(topCategory.total),
      sub: `${Math.round(topCategory.percentage)}% of everything you spent`,
      shareText: `My top spending category in ${monthLabel} was ${topCategory.category} at ${formatCurrency(topCategory.total)}. #MyMoneyWrapped`,
    });
  }

  // Story 3: most frequent buy -- needs more than one purchase to be a "habit".
  const topHabit = [...habitIdentifier].sort((a, b) => b.transaction_count - a.transaction_count)[0];
  if (topHabit && topHabit.transaction_count > 1) {
    const visual = categoryVisual(topHabit.category);
    stories.push({
      emoji: visual.emoji,
      circleColor: visual.color,
      title: 'Your most frequent buy',
      big: `${topHabit.transaction_count}× ${topHabit.category}`,
      sub: `avg ${formatCurrency(topHabit.average_spend)} each time`,
      shareText: `I bought ${topHabit.category} ${topHabit.transaction_count} times in ${monthLabel}, averaging ${formatCurrency(topHabit.average_spend)} a pop. #MyMoneyWrapped`,
    });
  }

  return stories;
}
