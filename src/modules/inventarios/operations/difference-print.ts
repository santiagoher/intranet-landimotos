import type { ComparisonProduct } from './types'
import { displayQuantity } from './quantity'

export interface DifferencePrintRow extends ComparisonProduct { unit: string | null }
export interface DifferencePrintData {
  ticket: string; version: number; warehouse: string; category: string;
  operator: string; leader: string; countedAt: string | null; generatedAt: string;
  demo: boolean; rows: DifferencePrintRow[]; shortages: number; surpluses: number;
  missingReference: number; pendingCount: number; totalProducts: number;
}

// Use the existing RPC's exact decimal difference; never recalculate or cast to Number.
export function differenceSign(value: string | null): -1 | 0 | 1 {
  if (value == null || !/^[+-]?\d+(?:\.\d+)?$/.test(value) || /^[+-]?0+(?:\.0+)?$/.test(value)) return 0
  return value.startsWith('-') ? -1 : 1
}
export function signedDifference(value: string): string {
  const formatted = displayQuantity(value)
  return differenceSign(value) > 0 && !formatted.startsWith('+') ? `+${formatted}` : formatted
}
export function summarizeDifferences(products: DifferencePrintRow[]) {
  const rows = products.filter(p => p.expected != null && p.counted != null && differenceSign(p.difference) !== 0)
  return {
    rows,
    shortages: rows.filter(p => differenceSign(p.difference) < 0).length,
    surpluses: rows.filter(p => differenceSign(p.difference) > 0).length,
    missingReference: products.filter(p => p.expected == null).length,
    pendingCount: products.filter(p => p.counted == null).length,
  }
}
