import { useEffect, useCallback } from 'react';
import { useStore } from './useStore';
import { listJobs } from '@/lib/api';
import type { Job } from '@/types';

// Job types the extension considers relevant (matches service worker)
const RELEVANT_JOB_TYPES = ['transcri', 'asr', 'ocr', 'text_extract', 'speech', 'embed', 'index'];

function isRelevantJob(job: Job): boolean {
  const isActive = job.status === 'pending' || job.status === 'running';

  // Only relevant types (if type is known)
  if (job.type && job.type !== 'unknown') {
    const t = job.type.toLowerCase();
    if (!RELEVANT_JOB_TYPES.some((r) => t.includes(r))) return false;
  }

  if (isActive) {
    // Active jobs: show if created within last hour
    if (job.created_at) {
      const created = new Date(job.created_at).getTime();
      if (!isNaN(created) && created < Date.now() - 60 * 60 * 1000) return false;
    }
    return true;
  }

  // Terminal jobs: auto-hide after 60 seconds
  if (job.completed_at) {
    const completed = new Date(job.completed_at).getTime();
    if (!isNaN(completed) && completed < Date.now() - 60 * 1000) return false;
  } else if (job.created_at) {
    // No completed_at — fallback to created_at, hide after 2 minutes
    const created = new Date(job.created_at).getTime();
    if (!isNaN(created) && created < Date.now() - 2 * 60 * 1000) return false;
  }

  return true;
}

export function useActiveJobs() {
  const { connected, activeJobs, setActiveJobs, updateJob } = useStore();

  const fetchJobs = useCallback(async () => {
    try {
      const allJobs = await listJobs();
      const relevant = allJobs.filter(isRelevantJob);
      setActiveJobs(relevant);
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

      // Real-time job update from WebSocket via service worker
      if (message.type === 'JOB_UPDATE' && message.job) {
        updateJob(message.job);
      }

      // Service worker tells us jobs changed — re-fetch from backend
      if (message.type === 'JOBS_CHANGED') {
        wrappedFetch();
      }

      // Backend invalidated jobs — re-fetch
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

  return activeJobs;
}
