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
  status: TicketStatus;
  jogId: string;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  comments: Comment[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Jog {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  order: number;
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

export const DEFAULT_JOG_NAME = 'Default Jog';
