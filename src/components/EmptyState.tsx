import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-gray-400 dark:text-gray-500 mb-3">{icon}</div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}
