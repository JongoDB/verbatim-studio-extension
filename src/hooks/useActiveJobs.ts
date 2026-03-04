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
        // Show all active jobs (pending or running)
        setActiveJobs(
          jobs.filter((j) => j.status === 'pending' || j.status === 'running'),
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
