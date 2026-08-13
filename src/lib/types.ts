export type TicketStatus = 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done';

export type Priority = 'low' | 'medium' | 'high';

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  body: string;
  acceptanceCriteria: string;
  status: TicketStatus;
  jogId: string;
  epicId: string | null;
  priority: Priority | null;
  dueDate: string | null;
  tags: string[];
  comments: Comment[];
  order: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Jog {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  order: number;
  isArchived: boolean;
  createdAt: string;
}

export interface Epic {
  id: string;
  name: string;
  isArchived: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const BASE_TAGS = ['Life-admin', 'Travel', 'Learn', 'Fun', 'Career', 'Social', 'Dev'];

export const DEFAULT_JOG_NAME = 'backlog';

export const ORDER_GAP = 1000;

/** Sentinel jog-select value meaning "don't scope the board to a single jog". */
export const ALL_JOGS_ID = 'all';
