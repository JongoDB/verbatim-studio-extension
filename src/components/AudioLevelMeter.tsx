import React from 'react';

interface AudioLevelMeterProps {
  level: number; // 0-1
  className?: string;
}

export function AudioLevelMeter({ level, className }: AudioLevelMeterProps) {
  const bars = 20;

  return (
    <div className={`flex items-end gap-0.5 h-8 ${className || ''}`}>
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = i / bars;
        const active = level > threshold;
        const isHigh = i / bars > 0.75;
        const isMid = i / bars > 0.5;

        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              active
                ? isHigh
                  ? 'bg-red-500'
                  : isMid
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
            style={{ height: `${((i + 1) / bars) * 100}%` }}
          />
        );
      })}
    </div>
  );
}
