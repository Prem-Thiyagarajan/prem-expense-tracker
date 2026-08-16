// File: src/Settings/components/IconPicker.tsx

import React from 'react';
import { getCategoryIcon } from '../../utils/iconHelper';
import { Ban } from 'lucide-react';

interface IconPickerProps {
  selectedValue: string | null;
  onIconSelect: (iconName: string | null) => void;
  availableIcons: string[]; 
}

const IconPicker: React.FC<IconPickerProps> = ({ selectedValue, onIconSelect, availableIcons = [] }) => {
  return (
    <div>
      <label className="block font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted mb-2">
        Choose an Icon
      </label>

      {/*
        - `h-32`: Sets a fixed height for the container (tailwind's h-32 is 8rem or 128px), which is perfect for two rows of icons.
        - `overflow-y-auto`: Adds a vertical scrollbar ONLY if the content overflows.
        - `pr-2`: Adds a little padding on the right so the scrollbar doesn't overlap the icons.
      */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 p-3 border-1.5 border-line rounded-card h-32 overflow-y-auto pr-2 bg-bg">

        {/* "No Icon" Button */}
        <button
            onClick={() => onIconSelect(null)}
            type="button"
            className={`
              flex items-center justify-center w-11 h-11 rounded-chip border-1.5 border-line
              transition-all transform hover:scale-105
              ${selectedValue === null ? 'bg-candy-mint shadow-chip' : 'bg-card'}
            `}
            aria-label="No Icon"
            title="No Icon"
          >
            <Ban size={20} className="text-muted" />
        </button>

        {/* The available icons */}
        {availableIcons.map(iconName => (
          <button
            key={iconName}
            onClick={() => onIconSelect(iconName)}
            type="button"
            className={`
              flex items-center justify-center w-11 h-11 rounded-chip border-1.5 border-line
              transition-all transform hover:scale-105
              ${selectedValue === iconName ? 'bg-candy-mint shadow-chip' : 'bg-card'}
            `}
            aria-label={iconName}
            title={iconName}
          >
            {getCategoryIcon(null, iconName)}
          </button>
        ))}
      </div>

      {availableIcons.length === 0 && (
        <p className="font-body text-xs text-muted mt-2">All available icons are currently in use.</p>
      )}
    </div>
  );
};

export default IconPicker;