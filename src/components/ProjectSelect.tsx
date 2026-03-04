import React, { useEffect, useState } from 'react';
import { listProjects } from '@/lib/api';
import type { Project } from '@/types';

interface ProjectSelectProps {
  value: string;
  onChange: (projectId: string) => void;
  disabled?: boolean;
}

export function ProjectSelect({ value, onChange, disabled }: ProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => {});
  }, []);

  return (
    <select
      className="input text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">No project</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
