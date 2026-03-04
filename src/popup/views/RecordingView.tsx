import React, { useState, useEffect, useCallback } from 'react';
import { Mic, Pause, Play, Square, Upload as UploadIcon } from 'lucide-react';
import { AudioLevelMeter } from '@/components/AudioLevelMeter';
import { ProjectSelect } from '@/components/ProjectSelect';
import { formatDuration } from '@/lib/utils';

interface RecordingViewProps {
  connected: boolean;
}

export function RecordingView({ connected }: RecordingViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingSize, setRecordingSize] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Listen for messages from service worker / offscreen document
  useEffect(() => {
    const listener = (message: any) => {
      switch (message.type) {
        case 'RECORDING_STARTED':
          setIsRecording(true);
          setIsPaused(false);
          setError('');
          break;
        case 'RECORDING_STATE':
          setIsPaused(message.isPaused);
          break;
        case 'AUDIO_LEVEL':
          setAudioLevel(message.level);
          break;
        case 'RECORDING_DURATION':
          setDuration(message.duration);
          break;
        case 'RECORDING_COMPLETE':
          setIsRecording(false);
          setIsPaused(false);
          setHasRecording(true);
          setRecordingDuration(message.duration);
          setRecordingSize(message.size);
          setName(`Recording ${new Date().toLocaleString()}`);
          break;
      }
    };

    chrome.runtime?.onMessage.addListener(listener);
    return () => chrome.runtime?.onMessage.removeListener(listener);
  }, []);

  const startRecording = useCallback(() => {
    setError('');
    chrome.runtime.sendMessage({ type: 'START_RECORDING' }, (response) => {
      if (response?.error) {
        setError(`Microphone access denied. Please allow microphone access in Chrome settings.`);
      }
    });
  }, []);

  const pauseRecording = () => chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
  const resumeRecording = () => chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
  const stopRecording = () => chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

  const handleUpload = async () => {
    if (!name.trim()) return;
    setUploading(true);
    setError('');
    chrome.runtime.sendMessage(
      { type: 'UPLOAD_RECORDING', name: name.trim(), projectId: projectId || undefined },
      (response) => {
        setUploading(false);
        if (response?.error) {
          setError('Failed to upload recording');
        } else {
          setSuccess('Recording uploaded! Transcription will begin shortly.');
          setHasRecording(false);
          setName('');
        }
      },
    );
  };

  const handleDiscard = () => {
    setHasRecording(false);
    setName('');
    setSuccess('');
    setError('');
  };

  if (!connected) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Connect to Verbatim Studio to record audio
      </div>
    );
  }

  // Post-recording: name & upload
  if (hasRecording) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Mic className="w-4 h-4 text-verbatim-500" />
          Recording Complete
        </h2>

        <div className="text-xs text-gray-500">
          Duration: {formatDuration(recordingDuration)} &middot;{' '}
          {(recordingSize / 1024).toFixed(0)} KB
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
              Name
            </label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recording name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
              Project (optional)
            </label>
            <ProjectSelect value={projectId} onChange={setProjectId} />
          </div>
        </div>

        {error && <div className="text-xs text-red-500">{error}</div>}
        {success && <div className="text-xs text-green-600">{success}</div>}

        <div className="flex gap-2">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
            onClick={handleUpload}
            disabled={uploading || !name.trim()}
          >
            <UploadIcon className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload to Verbatim'}
          </button>
          <button className="btn-secondary text-sm" onClick={handleDiscard}>
            Discard
          </button>
        </div>
      </div>
    );
  }

  // Recording state
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Mic className="w-4 h-4 text-verbatim-500" />
        Audio Recording
      </h2>

      {isRecording && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium">
                {isPaused ? 'Paused' : 'Recording'}
              </span>
            </div>
            <span className="text-lg font-mono font-semibold tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>

          <AudioLevelMeter level={isPaused ? 0 : audioLevel} />

          <div className="flex items-center justify-center gap-3">
            {isPaused ? (
              <button
                className="btn-secondary flex items-center gap-1.5 text-sm"
                onClick={resumeRecording}
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            ) : (
              <button
                className="btn-secondary flex items-center gap-1.5 text-sm"
                onClick={pauseRecording}
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            <button
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-1.5 text-sm transition-colors"
              onClick={stopRecording}
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>
      )}

      {!isRecording && (
        <div className="flex flex-col items-center py-8">
          <button
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg hover:shadow-xl"
            onClick={startRecording}
          >
            <Mic className="w-8 h-8" />
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Click to start recording
          </p>
        </div>
      )}

      {error && <div className="text-xs text-red-500 text-center">{error}</div>}
      {success && <div className="text-xs text-green-600 text-center">{success}</div>}
    </div>
  );
}
