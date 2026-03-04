import React from 'react';
import { Briefcase, CheckCircle, Clock, AlertCircle, Loader } from 'lucide-react';
import { useActiveJobs } from '@/hooks/useActiveJobs';
import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState } from '@/components/EmptyState';
import { useStore } from '@/hooks/useStore';

export function JobsView() {
  const activeJobs = useActiveJobs();
  const connected = useStore((s) => s.connected);

  const runningJobs = activeJobs.filter((j) => j.status === 'pending' || j.status === 'running');
  const recentJobs = activeJobs.filter((j) => j.status === 'completed' || j.status === 'failed');

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
          description="Jobs will appear here when you upload files or start transcriptions"
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-verbatim-500" />
        Background Jobs
        {runningJobs.length > 0 && (
          <span className="text-xs font-normal text-gray-500">
            ({runningJobs.length} active)
          </span>
        )}
      </h2>

      <div className="space-y-2">
        {activeJobs.map((job) => (
          <div
            key={job.id}
            className={`card p-3 space-y-2 transition-opacity ${
              job.status !== 'pending' && job.status !== 'running' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <JobStatusIcon status={job.status} />
                <span className="text-sm font-medium capitalize">
                  {getJobLabel(job)}
                </span>
              </div>
              <StatusBadge status={job.status} />
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

function getJobLabel(job: { type?: string }): string {
  const type = (job.type || '').toLowerCase();
  if (type.includes('transcri') || type.includes('asr')) return 'Transcription';
  if (type.includes('ocr') || type.includes('text_extract')) return 'OCR Processing';
  if (type.includes('embed') || type.includes('index')) return 'Indexing';
  return (job.type || 'Processing').replace(/_/g, ' ');
}

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader className="w-4 h-4 text-verbatim-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
    case 'canceled':
    case 'cancelled':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    canceled: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    cancelled: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}
