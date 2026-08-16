// File: src/components/ui/Dropdown.tsx
//
// A single-select popover styled to match the app's own cream/candy chrome,
// for places a native <select> matters visually -- a native element's own
// dropdown LIST is always rendered by the OS/browser and can't be themed
// past its trigger's chevron, which looks jarring against everything else
// on the page. Not a replacement for every <select> in the app -- only
// swapped in where that visual mismatch was flagged (Expenses page).
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional swatch dot, e.g. a category's candy color. */
  color?: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  /** Classes for the trigger button -- caller controls shape/colour/size. */
  className?: string;
  /** Inline style for the trigger, e.g. a dynamic category background. */
  style?: React.CSSProperties;
  menuClassName?: string;
  chevronClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  value, onChange, options, placeholder = "Select…",
  className = "", style, menuClassName = "", chevronClassName = "text-muted",
  disabled, "aria-label": ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        style={style}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          {selected?.color && (
            <span className="w-2 h-2 rounded-full shrink-0 border border-candyLine" style={{ background: selected.color }} />
          )}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform duration-chip ${open ? "rotate-180" : ""} ${chevronClassName}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute left-0 mt-1.5 min-w-full w-max max-w-[280px] max-h-64 overflow-y-auto bg-card border-2 border-line rounded-card shadow-overlay z-30 py-1 ${menuClassName}`}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-body transition-colors ${
                opt.value === value ? "bg-candy-lilac font-semibold text-[#1E1B16]" : "hover:bg-hair text-ink"
              }`}
            >
              {opt.color && <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-candyLine" style={{ background: opt.color }} />}
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
