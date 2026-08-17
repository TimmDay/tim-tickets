import { ORDER_GAP } from './types';

function computeOrderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - ORDER_GAP;
  if (after === null) return before + ORDER_GAP;
  return (before + after) / 2;
}

function needsRebalance(before: number | null, after: number | null, computed: number): boolean {
  if (before !== null && computed <= before) return true;
  if (after !== null && computed >= after) return true;
  return false;
}

export type ReorderPersist = { kind: 'single'; id: string; order: number } | { kind: 'bulk'; orderedIds: string[] };

export interface ReorderResult {
  /** id -> new order value. Just the moved item's on a direct update, or everyone's in
   * `orderedList` when a rebalance fired. */
  orderUpdates: Map<string, number>;
  persist: ReorderPersist;
}

/**
 * Computes new `order` values for a manually-reordered list. `orderedList` is the target
 * list with the moved item already spliced into its new position — a same-list drag typically
 * gets this from dnd-kit's `arrayMove`; a cross-container drag (e.g. into a different kanban
 * column) splices the moved item into the target container's own list directly. Only ever
 * touches `order` — a moved item's other changed fields (e.g. a kanban card's `status`) are
 * the caller's own concern, both to compute and to persist.
 *
 * `direction` matches how `orderedList` is sorted for display: 'asc' (lowest order first, the
 * default) or 'desc' (highest order first, e.g. a "newest first" manual sort) — it only
 * changes which neighbor plays which role, and which end of a rebalance gets the highest value.
 */
export function computeReorder<T extends { id: string; order: number }>(
  orderedList: T[],
  movedItemId: string,
  direction: 'asc' | 'desc' = 'asc',
): ReorderResult {
  const movedIndex = orderedList.findIndex((item) => item.id === movedItemId);
  const prevNeighbor = orderedList[movedIndex - 1] ?? null;
  const nextNeighbor = orderedList[movedIndex + 1] ?? null;
  const [before, after] =
    direction === 'asc'
      ? [prevNeighbor?.order ?? null, nextNeighbor?.order ?? null]
      : [nextNeighbor?.order ?? null, prevNeighbor?.order ?? null];

  const newOrder = computeOrderBetween(before, after);

  if (needsRebalance(before, after, newOrder)) {
    const lastIndex = orderedList.length - 1;
    const orderUpdates = new Map(
      orderedList.map((item, index) => [item.id, (direction === 'asc' ? index : lastIndex - index) * ORDER_GAP]),
    );
    const orderedIds =
      direction === 'asc' ? orderedList.map((item) => item.id) : [...orderedList].reverse().map((item) => item.id);
    return { orderUpdates, persist: { kind: 'bulk', orderedIds } };
  }

  return {
    orderUpdates: new Map([[movedItemId, newOrder]]),
    persist: { kind: 'single', id: movedItemId, order: newOrder },
  };
}
