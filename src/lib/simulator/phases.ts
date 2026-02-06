/**
 * Phase management functions
 */

import { Phase } from './types';

/**
 * Get the current phase for a given year
 * Throws error if no phase covers the year
 */
export function getCurrentPhase(phases: Phase[], year: number): Phase {
  const phase = phases.find(
    (p) => year >= p.startYear && year <= p.endYear
  );

  if (!phase) {
    throw new Error(
      `No phase defined for year ${year}. Please ensure all years are covered by phases.`
    );
  }

  return phase;
}

/**
 * Validate phases configuration
 * Returns array of validation errors (empty if valid)
 */
export function validatePhases(phases: Phase[]): string[] {
  const errors: string[] = [];

  if (phases.length === 0) {
    errors.push('At least one phase is required');
    return errors;
  }

  phases.forEach((phase, index) => {
    // Check allocation sums to 100
    const totalAllocation =
      phase.allocationInvestments + phase.allocationSavings;
    if (Math.abs(totalAllocation - 100) > 0.01) {
      errors.push(
        `Phase ${index + 1} (Years ${phase.startYear}-${
          phase.endYear
        }): Allocation must sum to 100% (currently ${totalAllocation.toFixed(
          1
        )}%)`
      );
    }

    // Check year range
    if (phase.endYear < phase.startYear) {
      errors.push(
        `Phase ${index + 1}: End year (${phase.endYear}) must be >= start year (${phase.startYear})`
      );
    }

    // Check for negative values
    if (phase.monthlyIncome < 0) {
      errors.push(`Phase ${index + 1}: Monthly income cannot be negative`);
    }
    if (phase.monthlyExpenses < 0) {
      errors.push(`Phase ${index + 1}: Monthly expenses cannot be negative`);
    }
  });

  return errors;
}
