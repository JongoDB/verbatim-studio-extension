import React from 'react';
import { Briefcase, CheckCircle, Clock, AlertCircle, Loader } from 'lucide-react';
import { useActiveJobs } from '@/hooks/useActiveJobs';
import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState } from '@/components/EmptyState';
import { formatRelativeTime } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';

export function JobsView() {
  const activeJobs = useActiveJobs();
  const connected = useStore((s) => s.connected);

  if (!connected) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Connect to Verbatim Studio to view jobs
      </div>
    );
  }

  if (activeJobs.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-verbatim-500" />
          Background Jobs
        </h2>
        <EmptyState
          icon={<CheckCircle className="w-8 h-8" />}
          title="No active jobs"
          description="All tasks are complete"
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-verbatim-500" />
        Background Jobs
        <span className="text-xs font-normal text-gray-500">({activeJobs.length} active)</span>
      </h2>

      <div className="space-y-2">
        {activeJobs.map((job) => (
          <div key={job.id} className="card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <JobStatusIcon status={job.status} />
                <span className="text-sm font-medium capitalize">{job.type}</span>
              </div>
              <span className="text-xs text-gray-400">
                {formatRelativeTime(job.created_at)}
              </span>
            </div>

            {job.message && (
              <div className="text-xs text-gray-500">{job.message}</div>
            )}

            {job.progress !== undefined && job.status === 'running' && (
              <div className="flex items-center gap-2">
                <ProgressBar progress={job.progress} className="flex-1" />
                <span className="text-xs text-gray-500 tabular-nums">
                  {Math.round(job.progress)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader className="w-4 h-4 text-verbatim-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}
