import { create } from 'zustand';
import type { Job } from '@/types';

interface AppState {
  connected: boolean;
  setConnected: (connected: boolean) => void;

  activeJobs: Job[];
  setActiveJobs: (jobs: Job[]) => void;
  updateJob: (job: Job) => void;

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
      // Remove completed/failed jobs from the active list
      return { activeJobs: jobs.filter((j) => j.status === 'pending' || j.status === 'running') };
    }),

  darkMode: false,
  setDarkMode: (dark) => set({ darkMode: dark }),
}));

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
