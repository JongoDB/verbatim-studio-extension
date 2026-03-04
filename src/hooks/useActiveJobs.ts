import { useEffect, useCallback } from 'react';
import { useStore } from './useStore';
import { listJobs } from '@/lib/api';
import type { Job } from '@/types';

// Job types the extension considers relevant (matches service worker)
const RELEVANT_JOB_TYPES = ['transcri', 'asr', 'ocr', 'text_extract', 'speech', 'embed', 'index'];

function isRelevantJob(job: Job): boolean {
  // Only relevant types (if type is known)
  if (job.type && job.type !== 'unknown') {
    const t = job.type.toLowerCase();
    if (!RELEVANT_JOB_TYPES.some((r) => t.includes(r))) return false;
  }

  // Only recent (within 1 hour)
  if (job.created_at) {
    const created = new Date(job.created_at).getTime();
    if (!isNaN(created) && created < Date.now() - 60 * 60 * 1000) return false;
  }

  const isActive = job.status === 'pending' || job.status === 'running';

  // Active jobs: always show
  if (isActive) return true;

  // Terminal jobs: use completed_at if available, else created_at
  const terminalTime = job.completed_at
    ? new Date(job.completed_at).getTime()
    : job.created_at
      ? new Date(job.created_at).getTime()
      : NaN;

  // Completed: brief 5-second flash then auto-hide
  if (job.status === 'completed') {
    if (!isNaN(terminalTime) && terminalTime < Date.now() - 5000) return false;
    return true;
  }

  // Failed/canceled: show for 60 seconds, then auto-hide
  // (user can also clear them manually before that)
  if (!isNaN(terminalTime) && terminalTime < Date.now() - 60 * 1000) return false;

  return true;
}

export function useActiveJobs() {
  const {
    connected, activeJobs, setActiveJobs, updateJob,
    dismissedJobIds,
  } = useStore();

  const fetchJobs = useCallback(async () => {
    try {
      const allJobs = await listJobs();
      const relevant = allJobs.filter(isRelevantJob);
      setActiveJobs(relevant);

      // Clean up cancelingJobIds for jobs that have actually reached terminal status
      const { cancelingJobIds: current } = useStore.getState();
      if (current.size > 0) {
        let changed = false;
        const next = new Set(current);
        for (const id of current) {
          const job = relevant.find((j) => j.id === id);
          if (!job || (job.status !== 'pending' && job.status !== 'running')) {
            next.delete(id);
            changed = true;
          }
        }
        if (changed) useStore.setState({ cancelingJobIds: next });
      }
    } catch {
      // ignore — backend may be down
    }
  }, [setActiveJobs]);

  useEffect(() => {
    if (!connected) return;

    let mounted = true;

    const wrappedFetch = () => {
      if (mounted) fetchJobs();
    };

    wrappedFetch();
    const pollTimer = setInterval(wrappedFetch, 5000);

    const listener = (message: { type: string; job?: Job; resource?: string }) => {
      if (!mounted) return;

      if (message.type === 'JOB_UPDATE' && message.job) {
        updateJob(message.job);
      }

      if (message.type === 'JOBS_CHANGED') {
        wrappedFetch();
      }

      if (message.type === 'INVALIDATE' && message.resource === 'jobs') {
        wrappedFetch();
      }
    };
    chrome.runtime?.onMessage.addListener(listener);

    return () => {
      mounted = false;
      clearInterval(pollTimer);
      chrome.runtime?.onMessage.removeListener(listener);
    };
  }, [connected, fetchJobs, updateJob]);

  // Filter out dismissed jobs
  const visibleJobs = activeJobs.filter((j) => !dismissedJobIds.has(j.id));

  return visibleJobs;
}
