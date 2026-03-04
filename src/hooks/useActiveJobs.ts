import { useEffect } from 'react';
import { useStore } from './useStore';
import { listJobs } from '@/lib/api';
import type { Job } from '@/types';

// Relevant job types for the extension (upload, transcription, OCR, etc.)
const RELEVANT_TYPES = ['transcription', 'asr', 'ocr', 'llm', 'upload', 'processing', 'embedding'];

function isRelevantJob(job: Job): boolean {
  // If the type matches known processing types, include it
  const jobType = job.type.toLowerCase();
  if (RELEVANT_TYPES.some((t) => jobType.includes(t))) return true;
  // Include any job that's actively running — it's probably relevant
  if (job.status === 'running') return true;
  return false;
}

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
        // Only show active + relevant jobs
        setActiveJobs(
          jobs.filter((j) => {
            if (j.status !== 'pending' && j.status !== 'running') return false;
            return isRelevantJob(j);
          }),
        );
      } catch {
        // ignore
      }
    }

    fetchJobs();
    // Refresh periodically
    const pollTimer = setInterval(fetchJobs, 15000);

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
