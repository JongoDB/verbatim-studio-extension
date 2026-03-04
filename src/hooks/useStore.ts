import { create } from 'zustand';
import type { Job } from '@/types';

interface AppState {
  connected: boolean;
  setConnected: (connected: boolean) => void;

  activeJobs: Job[];
  setActiveJobs: (jobs: Job[]) => void;
  updateJob: (job: Job) => void;

  // IDs of jobs the user has dismissed from the view
  dismissedJobIds: Set<string>;
  dismissJob: (jobId: string) => void;
  dismissJobs: (jobIds: string[]) => void;

  // IDs of jobs the user has requested to cancel (optimistic UI)
  cancelingJobIds: Set<string>;
  markCanceling: (jobId: string) => void;

  // Whether persisted state has been loaded from session storage
  hydrated: boolean;

  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),

  activeJobs: [],
  setActiveJobs: (jobs) => set({ activeJobs: jobs }),
  updateJob: (job) =>
    set((state) => {
      const idx = state.activeJobs.findIndex((j) => j.id === job.id);
      let jobs;
      if (idx >= 0) {
        jobs = [...state.activeJobs];
        jobs[idx] = job;
      } else {
        jobs = [...state.activeJobs, job];
      }
      return { activeJobs: jobs };
    }),

  dismissedJobIds: new Set(),
  dismissJob: (jobId) =>
    set((state) => {
      const next = new Set(state.dismissedJobIds);
      next.add(jobId);
      persistSessionState(next, state.cancelingJobIds);
      return { dismissedJobIds: next };
    }),
  dismissJobs: (jobIds) =>
    set((state) => {
      const next = new Set(state.dismissedJobIds);
      jobIds.forEach((id) => next.add(id));
      persistSessionState(next, state.cancelingJobIds);
      return { dismissedJobIds: next };
    }),

  cancelingJobIds: new Set(),
  markCanceling: (jobId) =>
    set((state) => {
      const next = new Set(state.cancelingJobIds);
      next.add(jobId);
      persistSessionState(state.dismissedJobIds, next);
      return { cancelingJobIds: next };
    }),

  hydrated: false,

  darkMode: false,
  setDarkMode: (dark) => set({ darkMode: dark }),
}));

// Persist both dismissed and canceling IDs to session storage
function persistSessionState(dismissed: Set<string>, canceling: Set<string>) {
  try {
    chrome.storage.session.set({
      dismissedJobIds: [...dismissed],
      cancelingJobIds: [...canceling],
    });
  } catch {
    // ignore
  }
}

// Also persist when cancelingJobIds are cleaned up from useActiveJobs
export function persistCancelingJobIds(ids: Set<string>) {
  try {
    chrome.storage.session.set({ cancelingJobIds: [...ids] });
  } catch {
    // ignore
  }
}

// Hydrate persisted state from session storage on startup
try {
  chrome.storage.session.get(['dismissedJobIds', 'cancelingJobIds'], (data) => {
    const dismissed = data.dismissedJobIds?.length
      ? new Set<string>(data.dismissedJobIds)
      : new Set<string>();
    const canceling = data.cancelingJobIds?.length
      ? new Set<string>(data.cancelingJobIds)
      : new Set<string>();
    useStore.setState({
      dismissedJobIds: dismissed,
      cancelingJobIds: canceling,
      hydrated: true,
    });
  });
} catch {
  // Not in extension context — mark as hydrated immediately
  useStore.setState({ hydrated: true });
}

// Recording state
interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  setIsRecording: (recording: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setDuration: (duration: number) => void;
  setAudioLevel: (level: number) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  isPaused: false,
  duration: 0,
  audioLevel: 0,
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setDuration: (duration) => set({ duration }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  reset: () => set({ isRecording: false, isPaused: false, duration: 0, audioLevel: 0 }),
}));
