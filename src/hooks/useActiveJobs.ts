import { useEffect } from 'react';
import { useStore } from './useStore';
import { getJob } from '@/lib/api';
import type { Job } from '@/types';

export function useActiveJobs() {
  const { connected, activeJobs, setActiveJobs, updateJob, removeJob } = useStore();

  useEffect(() => {
    if (!connected) return;

    let mounted = true;
    const removalTimers: ReturnType<typeof setTimeout>[] = [];

    async function fetchTrackedJobs() {
      try {
        const data = await chrome.storage.session.get('trackedJobs');
        const tracked: Record<string, { type: string; label: string; completedAt?: number }> =
          data.trackedJobs || {};
        const jobIds = Object.keys(tracked);

        if (jobIds.length === 0) {
          if (mounted) setActiveJobs([]);
          return;
        }

        const now = Date.now();
        const jobs: Job[] = [];
        let dirty = false;

        for (const id of jobIds) {
          const meta = tracked[id];

          // Remove jobs that completed more than 60 seconds ago
          if (meta.completedAt && now - meta.completedAt > 60000) {
            delete tracked[id];
            dirty = true;
            continue;
          }

          try {
            const job = await getJob(id);
            jobs.push(job);

            // Mark completed/failed jobs with a timestamp for later cleanup
            if (
              (job.status === 'completed' || job.status === 'failed') &&
              !meta.completedAt
            ) {
              tracked[id] = { ...meta, completedAt: now };
              dirty = true;
            }
          } catch {
            // Job not found or API error — remove from tracking
            delete tracked[id];
            dirty = true;
          }
        }

        if (!mounted) return;

        if (dirty) {
          await chrome.storage.session.set({ trackedJobs: tracked });
        }

        setActiveJobs(jobs);
      } catch {
        // ignore
      }
    }

    fetchTrackedJobs();
    const pollTimer = setInterval(fetchTrackedJobs, 5000);

    const listener = (message: { type: string; job?: Job }) => {
      if (message.type === 'JOB_UPDATE' && message.job && mounted) {
        // Only show updates for tracked jobs
        chrome.storage.session.get('trackedJobs', (data) => {
          const tracked = data.trackedJobs || {};
          if (tracked[message.job!.id]) {
            updateJob(message.job!);

            if (message.job!.status === 'completed' || message.job!.status === 'failed') {
              const jobId = message.job!.id;
              const timer = setTimeout(() => {
                if (mounted) removeJob(jobId);
              }, 30000);
              removalTimers.push(timer);
            }
          }
        });
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
