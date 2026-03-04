import { useEffect } from 'react';
import { useStore } from './useStore';
import { listJobs } from '@/lib/api';
import type { Job } from '@/types';

export function useActiveJobs() {
  const { connected, activeJobs, setActiveJobs, updateJob, removeJob } = useStore();

  useEffect(() => {
    if (!connected) return;

    let mounted = true;
    const removalTimers: ReturnType<typeof setTimeout>[] = [];

    async function fetchJobs() {
      try {
        const jobs = await listJobs();
        if (!mounted) return;
        // Only show active jobs created within the last 30 minutes
        // to avoid displaying stale stuck jobs from the backend
        const cutoff = Date.now() - 30 * 60 * 1000;
        setActiveJobs(
          jobs.filter((j) => {
            if (j.status !== 'pending' && j.status !== 'running') return false;
            if (j.created_at) {
              const created = new Date(j.created_at).getTime();
              if (created < cutoff) return false;
            }
            return true;
          }),
        );
      } catch {
        // ignore
      }
    }

    fetchJobs();
    // Refresh periodically
    const pollTimer = setInterval(fetchJobs, 10000);

    const listener = (message: { type: string; job?: Job }) => {
      if (message.type === 'JOB_UPDATE' && message.job && mounted) {
        updateJob(message.job);

        // Auto-remove completed/failed jobs after 15s
        if (message.job.status === 'completed' || message.job.status === 'failed') {
          const jobId = message.job.id;
          const timer = setTimeout(() => {
            if (mounted) removeJob(jobId);
          }, 15000);
          removalTimers.push(timer);
        }
      }
    };
    chrome.runtime?.onMessage.addListener(listener);

    return () => {
      mounted = false;
      clearInterval(pollTimer);
      chrome.runtime?.onMessage.removeListener(listener);
      removalTimers.forEach(clearTimeout);
    };
  }, [connected, setActiveJobs, updateJob, removeJob]);

  return activeJobs;
}
