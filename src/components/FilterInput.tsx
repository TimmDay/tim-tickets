'use client';

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Desktop width; the board uses a narrower one to fit its toolbar on one line. */
  desktopWidthClassName?: string;
}

export function FilterInput({ value, onChange, placeholder, desktopWidthClassName = 'lg:w-64' }: FilterInputProps) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`order-last w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 lg:order-none ${desktopWidthClassName} dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100`}
    />
  );
}
