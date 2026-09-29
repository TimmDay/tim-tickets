'use client';

import { useRef, useState } from 'react';
import { AGENT_MODELS, AgentModel, DEFAULT_AGENT_MODEL } from '@/lib/types';
import { ConfirmModal } from './ConfirmModal';

interface AgentModelSelectProps {
  value: AgentModel | null;
  onChange: (model: AgentModel | null) => void;
}

// Rough max height of the open option list — same open-upward rationale as EpicSelect, since
// this field sits at the very bottom of the ticket modal.
const DROPDOWN_HEIGHT_ESTIMATE = 150;

/** Custom dropdown styled like EpicSelect rather than a native <select>: on mobile, globals.css
 * floors native form controls at 16px (to stop iOS zoom-on-focus), which made a native select
 * here render noticeably bigger than the Epic field beside it. */
export function AgentModelSelect({ value, onChange }: AgentModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  // A pricier model waiting on the user's confirmation before it's applied.
  const [pendingModel, setPendingModel] = useState<AgentModel | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const options: { value: AgentModel | null; label: string }[] = [{ value: null, label: 'Default' }, ...AGENT_MODELS];
  const selectedLabel = options.find((option) => option.value === value)?.label ?? 'Default';

  function toggleOpen() {
    if (!open) {
      const spaceBelow = triggerRef.current
        ? window.innerHeight - triggerRef.current.getBoundingClientRect().bottom
        : Infinity;
      setOpenUpward(spaceBelow < DROPDOWN_HEIGHT_ESTIMATE);
    }
    setOpen((prev) => !prev);
  }

  function select(model: AgentModel | null) {
    setOpen(false);
    // Haiku is the cheap default; Default resolves to it in the workflow. Anything else
    // costs noticeably more, so make the user say so twice.
    if (model !== null && model !== DEFAULT_AGENT_MODEL && model !== value) {
      setPendingModel(model);
      return;
    }
    onChange(model);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="w-full truncate rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {selectedLabel}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul
            className={`absolute right-0 z-20 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg lg:right-auto lg:left-0 dark:border-gray-700 dark:bg-gray-800 ${
              openUpward ? 'bottom-full mb-1' : 'mt-1'
            }`}
          >
            {options.map((option) => (
              <li key={option.value ?? 'default'}>
                <button
                  type="button"
                  onClick={() => select(option.value)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    option.value === value
                      ? 'font-medium text-gray-900 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {pendingModel && (
        <div onClick={(event) => event.stopPropagation()}>
          <ConfirmModal
            title={`Use ${AGENT_MODELS.find((m) => m.value === pendingModel)?.label ?? 'this model'}?`}
            message="Agent runs start from scratch: the model re-reads the repo and its docs before writing any code, and a run is many turns of that. Bigger models cost several times more per run than Haiku, which handles most well-scoped tickets. Only pick this for work that needs it."
            confirmLabel="Use it anyway"
            onConfirm={() => {
              onChange(pendingModel);
              setPendingModel(null);
            }}
            onCancel={() => setPendingModel(null)}
          />
        </div>
      )}
    </div>
  );
}
