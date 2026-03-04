import { useEffect } from 'react';
import { useStore } from './useStore';
import type { Job } from '@/types';

// Only track jobs received via WebSocket during this session.
// Completed/failed jobs are auto-removed after 10 seconds.
export function useActiveJobs() {
  const { connected, activeJobs, updateJob, setActiveJobs, removeJob } = useStore();

  useEffect(() => {
    if (!connected) return;

    let mounted = true;
    const removalTimers: ReturnType<typeof setTimeout>[] = [];

    // Clear any stale jobs when reconnecting
    setActiveJobs([]);

    const listener = (message: { type: string; job?: Job }) => {
      if (message.type === 'JOB_UPDATE' && message.job && mounted) {
        updateJob(message.job);

        // Auto-remove completed/failed jobs after 10s
        if (message.job.status === 'completed' || message.job.status === 'failed') {
          const jobId = message.job.id;
          const timer = setTimeout(() => {
            if (mounted) removeJob(jobId);
          }, 10000);
          removalTimers.push(timer);
        }
      }
    };
    chrome.runtime?.onMessage.addListener(listener);

    return () => {
      mounted = false;
      chrome.runtime?.onMessage.removeListener(listener);
      removalTimers.forEach(clearTimeout);
    };
  }, [connected, setActiveJobs, updateJob, removeJob]);

  return activeJobs;
}
