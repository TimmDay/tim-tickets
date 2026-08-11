import { ORDER_GAP } from './types';

export function computeOrderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - ORDER_GAP;
  if (after === null) return before + ORDER_GAP;
  return (before + after) / 2;
}

export function needsRebalance(before: number | null, after: number | null, computed: number): boolean {
  if (before !== null && computed <= before) return true;
  if (after !== null && computed >= after) return true;
  return false;
}
