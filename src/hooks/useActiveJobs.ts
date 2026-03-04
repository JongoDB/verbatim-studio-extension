import { useEffect, useCallback } from 'react';
import { useStore } from './useStore';
import { getJob } from '@/lib/api';
import type { Job } from '@/types';

function isTerminalStatus(status: string): boolean {
  return status !== 'pending' && status !== 'running';
}

export function useActiveJobs() {
  const { connected, activeJobs, setActiveJobs, updateJob, removeJob } = useStore();

  const fetchTrackedJobs = useCallback(async () => {
    try {
      const data = await chrome.storage.session.get('trackedJobs');
      const tracked: Record<string, { type: string; label: string; completedAt?: number }> =
        data.trackedJobs || {};
      const jobIds = Object.keys(tracked);

      if (jobIds.length === 0) {
        setActiveJobs([]);
        return;
      }

      const now = Date.now();
      const jobs: Job[] = [];
      let dirty = false;

      for (const id of jobIds) {
        const meta = tracked[id];

        // Remove jobs that reached terminal state more than 60 seconds ago
        if (meta.completedAt && now - meta.completedAt > 60000) {
          delete tracked[id];
          dirty = true;
          continue;
        }

        try {
          const job = await getJob(id);
          jobs.push(job);

          // Mark any terminal status for later cleanup
          if (isTerminalStatus(job.status) && !meta.completedAt) {
            tracked[id] = { ...meta, completedAt: now };
            dirty = true;
          }
        } catch {
          // Job not found or API error — remove from tracking
          delete tracked[id];
          dirty = true;
        }
      }

      if (dirty) {
        await chrome.storage.session.set({ trackedJobs: tracked });
      }

      setActiveJobs(jobs);
    } catch {
      // ignore
    }
  }, [setActiveJobs]);

  useEffect(() => {
    if (!connected) return;

    let mounted = true;
    const removalTimers: ReturnType<typeof setTimeout>[] = [];

    const wrappedFetch = () => {
      if (mounted) fetchTrackedJobs();
    };

    wrappedFetch();
    const pollTimer = setInterval(wrappedFetch, 5000);

    const listener = (message: { type: string; job?: Job; resource?: string }) => {
      if (!mounted) return;

      // Real-time job update from WebSocket
      if (message.type === 'JOB_UPDATE' && message.job) {
        chrome.storage.session.get('trackedJobs', (data) => {
          const tracked = data.trackedJobs || {};
          if (tracked[message.job!.id]) {
            updateJob(message.job!);

            if (isTerminalStatus(message.job!.status)) {
              const jobId = message.job!.id;
              const timer = setTimeout(() => {
                if (mounted) removeJob(jobId);
              }, 30000);
              removalTimers.push(timer);
            }
          }
        });
      }

      // Backend invalidated jobs — re-fetch immediately
      if (message.type === 'INVALIDATE' && message.resource === 'jobs') {
        wrappedFetch();
      }
    };
    chrome.runtime?.onMessage.addListener(listener);

    return () => {
      mounted = false;
      clearInterval(pollTimer);
      chrome.runtime?.onMessage.removeListener(listener);
      removalTimers.forEach(clearTimeout);
    };
  }, [connected, fetchTrackedJobs, updateJob, removeJob]);

  return activeJobs;
}
