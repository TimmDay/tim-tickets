import { describe, expect, it } from 'vitest';
import { computePrioritySort } from '../ordering';
import { Priority } from '../types';

const t = (id: string, order: number, priority: Priority | null) => ({ id, order, priority });

describe('computePrioritySort', () => {
  it('orders high, medium, none, low — stable within a group — reusing the existing order slots', () => {
    const tickets = [t('low', 0, 'low'), t('none1', 10, null), t('high', 20, 'high'), t('med', 30, 'medium'), t('none2', 40, null)];

    const updates = computePrioritySort(tickets);
    const result = tickets.map((ticket) => ({ ...ticket, order: updates.get(ticket.id) ?? ticket.order }));

    expect(result.sort((a, b) => a.order - b.order).map((ticket) => ticket.id)).toEqual([
      'high',
      'med',
      'none1',
      'none2',
      'low',
    ]);
    expect(new Set(result.map((ticket) => ticket.order))).toEqual(new Set([0, 10, 20, 30, 40]));
  });

  it('returns no updates when already sorted', () => {
    expect(computePrioritySort([t('a', 1, 'high'), t('b', 2, null), t('c', 3, 'low')]).size).toBe(0);
  });
});
