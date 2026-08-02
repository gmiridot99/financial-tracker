/**
 * Shared derivation logic for the annual recap pages
 * (src/app/dashboard/recap/page.tsx and src/app/dashboard/[year]/recap/page.tsx).
 *
 * Both pages take a 12-entry monthly wealth array (index 0 = January,
 * index 11 = December) and derive the same start/end-of-period totals and
 * growth percentage. This was previously duplicated inline in both files
 * with identical math; extracted here to avoid drift.
 */

export interface MonthlyWealthPoint {
  investments: number;
  savings: number;
}

export interface WealthPeriodSummary {
  startWealth: MonthlyWealthPoint;
  endWealth: MonthlyWealthPoint;
  totalStart: number;
  totalEnd: number;
  delta: number;
  growthPercent: number;
}

const EMPTY_POINT: MonthlyWealthPoint = { investments: 0, savings: 0 };

/**
 * Derives start/end-of-period wealth totals and growth from a monthly
 * wealth array. Missing start (index 0) or end (index 11) entries fall
 * back to a zero point, matching the original per-page behavior.
 */
export function computeWealthPeriodSummary(
  monthlyData: MonthlyWealthPoint[] | undefined | null
): WealthPeriodSummary {
  const startWealth = monthlyData?.[0] ?? EMPTY_POINT;
  const endWealth = monthlyData?.[11] ?? EMPTY_POINT;
  const totalStart = startWealth.investments + startWealth.savings;
  const totalEnd = endWealth.investments + endWealth.savings;
  const delta = totalEnd - totalStart;
  const growthPercent = totalStart > 0 ? (delta / totalStart) * 100 : 0;

  return { startWealth, endWealth, totalStart, totalEnd, delta, growthPercent };
}
