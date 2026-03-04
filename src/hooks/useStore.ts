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
      persistDismissedJobIds(next);
      return { dismissedJobIds: next };
    }),
  dismissJobs: (jobIds) =>
    set((state) => {
      const next = new Set(state.dismissedJobIds);
      jobIds.forEach((id) => next.add(id));
      persistDismissedJobIds(next);
      return { dismissedJobIds: next };
    }),

  cancelingJobIds: new Set(),
  markCanceling: (jobId) =>
    set((state) => {
      const next = new Set(state.cancelingJobIds);
      next.add(jobId);
      persistCancelingJobIds(next);
      return { cancelingJobIds: next };
    }),

  hydrated: false,

  darkMode: false,
  setDarkMode: (dark) => set({ darkMode: dark }),
}));

// Persist dismissed IDs to local storage (survives extension reload / browser restart)
function persistDismissedJobIds(dismissed: Set<string>) {
  try {
    chrome.storage.local.set({ dismissedJobIds: [...dismissed] });
  } catch {
    // ignore
  }
}

// Persist canceling IDs to session storage (ephemeral, clears on browser restart)
export function persistCancelingJobIds(ids: Set<string>) {
  try {
    chrome.storage.session.set({ cancelingJobIds: [...ids] });
  } catch {
    // ignore
  }
}

// Hydrate persisted state from both storage areas on startup
try {
  let localDone = false;
  let sessionDone = false;
  let dismissed = new Set<string>();
  let canceling = new Set<string>();

  const maybeFinish = () => {
    if (localDone && sessionDone) {
      useStore.setState({ dismissedJobIds: dismissed, cancelingJobIds: canceling, hydrated: true });
    }
  };

  chrome.storage.local.get(['dismissedJobIds'], (data) => {
    if (data.dismissedJobIds?.length) {
      dismissed = new Set<string>(data.dismissedJobIds);
    }
    localDone = true;
    maybeFinish();
  });

  chrome.storage.session.get(['cancelingJobIds'], (data) => {
    if (data.cancelingJobIds?.length) {
      canceling = new Set<string>(data.cancelingJobIds);
    }
    sessionDone = true;
    maybeFinish();
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
