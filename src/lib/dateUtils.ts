/**
 * Date utility functions for handling month-specific date calculations
 */

import { endOfMonth } from 'date-fns';

/**
 * Returns a valid YYYY-MM-DD string for the given year/month,
 * using today's day clamped to the last day of the target month.
 *
 * This prevents invalid dates like "2026-02-31" when viewing February on the 31st.
 *
 * @param year - The target year
 * @param month - The target month (1-12)
 * @returns A valid YYYY-MM-DD date string
 *
 * @example
 * // When today is Jan 31
 * getValidDateForMonth(2026, 2) // Returns "2026-02-28"
 * getValidDateForMonth(2026, 4) // Returns "2026-04-30"
 * getValidDateForMonth(2026, 5) // Returns "2026-05-31"
 */
export function getValidDateForMonth(year: number, month: number): string {
  const today = new Date().getDate();
  const targetDate = new Date(year, month - 1, 1);
  const lastDay = endOfMonth(targetDate).getDate();
  const clampedDay = Math.min(today, lastDay);

  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Convert internal simulation year (1-50) to display string.
 * If startYear is set, returns the absolute year (e.g., "2031").
 * Otherwise returns "Anno {year}".
 */
export function displayYear(internalYear: number, startYear?: number): string {
  if (startYear) return String(startYear + internalYear - 1);
  return `Anno ${internalYear}`;
}
