export type TicketStatus = 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done';

export type Priority = 'low' | 'medium' | 'high';

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  /** Short, human-readable, immutable identifier (e.g. "T-42") used for shareable URLs
   * (`/tickets/T-42`) — separate from `id` (the Firestore doc id) so links stay stable
   * even if the underlying storage ever changes. Assigned once at creation and never
   * reused or reassigned. */
  key: string;
  title: string;
  body: string;
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

export const EPIC_COLOR_THEME_VALUES = ['indigo', 'blue', 'emerald', 'rose', 'amber'] as const;

export type EpicColorTheme = (typeof EPIC_COLOR_THEME_VALUES)[number];

export interface Epic {
  id: string;
  name: string;
  description: string;
  colorTheme: EpicColorTheme;
  isArchived: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface EpicColorThemeOption {
  value: EpicColorTheme;
  label: string;
  chipClassName: string;
  /** Solid fill for small indicators (e.g. the dot next to an epic's name) — the chip
   * colors above are pale tints that would barely register at that size. */
  dotClassName: string;
}

export const EPIC_COLOR_THEMES: EpicColorThemeOption[] = [
  {
    value: 'indigo',
    label: 'Violet',
    chipClassName: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    dotClassName: 'bg-violet-500 dark:bg-violet-400',
  },
  {
    value: 'blue',
    label: 'Blue',
    chipClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    dotClassName: 'bg-blue-500 dark:bg-blue-400',
  },
  {
    value: 'emerald',
    label: 'Emerald',
    chipClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    dotClassName: 'bg-emerald-500 dark:bg-emerald-400',
  },
  {
    value: 'rose',
    label: 'Rose',
    chipClassName: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    dotClassName: 'bg-rose-500 dark:bg-rose-400',
  },
  {
    value: 'amber',
    label: 'Amber',
    chipClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    dotClassName: 'bg-amber-500 dark:bg-amber-400',
  },
];

export const DEFAULT_EPIC_COLOR_THEME: EpicColorTheme = 'indigo';

export function getEpicColorTheme(colorTheme: EpicColorTheme): EpicColorThemeOption {
  return EPIC_COLOR_THEMES.find((option) => option.value === colorTheme) ?? EPIC_COLOR_THEMES[0];
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

export const BASE_TAGS = ['Life-admin', 'Travel', 'Learn', 'Fun', 'Career', 'Social', 'Dev', 'Fitness', 'EH OI'];

export const DEFAULT_JOG_NAME = 'backlog';

export const ORDER_GAP = 1000;

/** Sentinel jog-select value meaning "don't scope the board to a single jog". */
export const ALL_JOGS_ID = 'all';
