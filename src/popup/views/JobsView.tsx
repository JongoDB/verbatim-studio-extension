import React, { useState, useEffect } from 'react';
import { Briefcase, CheckCircle, Clock, AlertCircle, Loader, X, RefreshCw, Trash2 } from 'lucide-react';
import { useActiveJobs } from '@/hooks/useActiveJobs';
import { cancelJob, deleteJob, retryJob } from '@/lib/api';
import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState } from '@/components/EmptyState';
import { useStore } from '@/hooks/useStore';
import type { Job } from '@/types';

export function JobsView() {
  const activeJobs = useActiveJobs();
  const connected = useStore((s) => s.connected);
  const removeJob = useStore((s) => s.removeJob);
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(new Set());

  // Clean up cancelingIds once the backend reports terminal status
  useEffect(() => {
    if (cancelingIds.size === 0) return;
    const stillCanceling = new Set<string>();
    for (const id of cancelingIds) {
      const job = activeJobs.find((j) => j.id === id);
      if (job && (job.status === 'pending' || job.status === 'running')) {
        stillCanceling.add(id);
      }
    }
    if (stillCanceling.size !== cancelingIds.size) {
      setCancelingIds(stillCanceling);
    }
  }, [activeJobs, cancelingIds]);

  const handleCancel = async (jobId: string) => {
    setCancelingIds((prev) => new Set(prev).add(jobId));
    try {
      await cancelJob(jobId);
    } catch {
      // Next poll will reconcile
    }
  };

  const handleDelete = async (jobId: string) => {
    removeJob(jobId);
    try {
      await deleteJob(jobId);
    } catch {
      // Next poll will reconcile
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob(jobId);
    } catch {
      // Backend may not support retry
    }
  };

  const getDisplayStatus = (job: Job): string => {
    if (cancelingIds.has(job.id) && (job.status === 'pending' || job.status === 'running')) {
      return 'canceling';
    }
    return job.status;
  };

  const activeCount = activeJobs.filter((j) => {
    const s = getDisplayStatus(j);
    return s === 'pending' || s === 'running';
  }).length;

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
        {activeCount > 0 && (
          <span className="text-xs font-normal text-gray-500">
            ({activeCount} active)
          </span>
        )}
      </h2>

      <div className="space-y-2">
        {activeJobs.map((job) => {
          const status = getDisplayStatus(job);
          const isActive = status === 'pending' || status === 'running';
          const isTerminal = status !== 'pending' && status !== 'running' && status !== 'canceling';
          const canRetry = status === 'failed' || status === 'canceled' || status === 'cancelled';

          return (
            <div
              key={job.id}
              className={`card p-3 space-y-2 transition-opacity ${
                isTerminal ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <JobStatusIcon status={status} />
                  <span className="text-sm font-medium capitalize truncate">
                    {getJobLabel(job)}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isActive && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Cancel job"
                    >
                      <X className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                  {canRetry && (
                    <button
                      onClick={() => handleRetry(job.id)}
                      className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      title="Retry job"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                  )}
                  {isTerminal && (
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Delete job"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                  <StatusBadge status={status} />
                </div>
              </div>

              {job.message && (
                <div className="text-xs text-gray-500">{job.message}</div>
              )}

              {job.progress !== undefined && (status === 'running' || status === 'canceling') && (
                <div className="flex items-center gap-2">
                  <ProgressBar progress={job.progress} className="flex-1" />
                  <span className="text-xs text-gray-500 tabular-nums">
                    {Math.round(job.progress)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
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
    case 'canceling':
      return <Loader className="w-4 h-4 text-orange-500 animate-spin" />;
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
    canceling: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
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
