import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  return (
    <div className={`h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className || ''}`}>
      <div
        className="h-full bg-verbatim-500 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
