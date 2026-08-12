'use client';

import { KeyboardEvent, useState } from 'react';
import { XIcon } from './XIcon';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  options: string[];
  placeholder?: string;
  showChips?: boolean;
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pr-1.5 pl-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {tag}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${tag}`}
        className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

export function TagInput({ value, onChange, options, placeholder, showChips = true }: TagInputProps) {
  const [inputText, setInputText] = useState('');
  const [open, setOpen] = useState(false);

  const query = inputText.trim().toLowerCase();
  const filteredOptions = options.filter(
    (option) => !value.includes(option) && (query === '' || option.toLowerCase().includes(query)),
  );

  function addTag(tag: string) {
    const trimmed = tag.trim();
    setInputText('');
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (inputText.trim()) addTag(inputText);
    } else if (event.key === 'Backspace' && inputText === '' && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div>
      <div className="relative">
        <input
          value={inputText}
          onChange={(event) => {
            setInputText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            addTag(inputText);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        {open && filteredOptions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <ul className="max-h-40 overflow-auto">
              {filteredOptions.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addTag(option)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showChips && value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />
          ))}
        </div>
      )}
    </div>
  );
}
