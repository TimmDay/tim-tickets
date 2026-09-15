'use client';

import { DragEvent, useRef, useState } from 'react';
import { XIcon } from './XIcon';

interface ScreenshotFieldProps {
  /** Image to show: a local preview of a pending screenshot, or the saved one's URL. */
  previewUrl: string | null;
  processing: boolean;
  onAdd: (file: File) => void;
  onRemove: () => void;
}

/**
 * The ticket form's single optional screenshot. Mobile gets a button (opening the photo
 * library via the file input's `accept="image/*"`); desktop gets a drop zone that's also
 * clickable for a file picker. Pasting (⌘V) is handled by the modal as a whole, so it works
 * wherever focus is — see TicketModal's onPaste.
 */
export function ScreenshotField({ previewUrl, processing, onAdd, onRemove }: ScreenshotFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = Array.from(event.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (file) onAdd(file);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Screenshot</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so picking the same file again still fires onChange.
          event.target.value = '';
          if (file) onAdd(file);
        }}
      />

      {previewUrl ? (
        <div className="flex items-start gap-3">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="block shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: preview URLs and an authenticated API route; next/image adds nothing here */}
            <img
              src={previewUrl}
              alt="Ticket screenshot"
              className="max-h-40 max-w-[12rem] rounded-md border border-gray-200 object-contain dark:border-gray-700"
            />
          </a>
          <div className="flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={openPicker}
              disabled={processing}
              className="text-sm text-gray-600 hover:underline disabled:opacity-50 dark:text-gray-400"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={processing}
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline disabled:opacity-50 dark:text-gray-400"
            >
              <XIcon className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={openPicker}
            disabled={processing}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 lg:hidden dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {processing ? 'Processing…' : 'Add screenshot'}
          </button>
          <button
            type="button"
            onClick={openPicker}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            disabled={processing}
            className={`hidden w-full rounded-md border-2 border-dashed px-3 py-4 text-sm lg:block ${
              dragOver
                ? 'border-gray-500 bg-gray-50 text-gray-700 dark:border-gray-400 dark:bg-gray-800 dark:text-gray-200'
                : 'border-gray-300 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            {processing ? 'Processing…' : 'Drop a screenshot, paste with ⌘V, or click to choose a file'}
          </button>
        </>
      )}
    </div>
  );
}
