import { Epic, getEpicColorTheme } from '@/lib/types';

interface EpicChipProps {
  epic: Epic;
  className?: string;
}

export function EpicChip({ epic, className }: EpicChipProps) {
  const theme = getEpicColorTheme(epic.colorTheme);

  return (
    <span className={`group relative inline-flex ${className ?? ''}`}>
      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${theme.chipClassName}`}>{epic.name}</span>
      {epic.description && (
        <span className="pointer-events-none absolute right-0 bottom-full z-20 mb-1.5 w-48 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity delay-300 group-hover:opacity-100 group-focus:opacity-100 dark:bg-gray-700">
          {epic.description}
        </span>
      )}
    </span>
  );
}
