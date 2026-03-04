import { useEffect } from 'react';
import { useStore } from './useStore';
import { listJobs } from '@/lib/api';
import type { Job } from '@/types';

export function useActiveJobs() {
  const { connected, activeJobs, setActiveJobs, updateJob } = useStore();

  useEffect(() => {
    if (!connected) return;

    let mounted = true;

    async function fetchJobs() {
      try {
        const jobs = await listJobs();
        if (mounted) {
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          setActiveJobs(
            jobs.filter((j) => {
              if (j.status !== 'pending' && j.status !== 'running') return false;
              // Filter out stale jobs older than 1 hour
              if (j.created_at && new Date(j.created_at).getTime() < oneHourAgo) return false;
              return true;
            }),
          );
        }
      } catch {
        // ignore
      }
    }

    fetchJobs();

    const listener = (message: { type: string; job?: Job }) => {
      if (message.type === 'JOB_UPDATE' && message.job && mounted) {
        updateJob(message.job);
      }
    };
    chrome.runtime?.onMessage.addListener(listener);

    return () => {
      mounted = false;
      chrome.runtime?.onMessage.removeListener(listener);
    };
  }, [connected, setActiveJobs, updateJob]);

  return activeJobs;
}
