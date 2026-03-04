import React, { useState } from 'react';
import { Mic, Pause, Play, Square, Upload as UploadIcon } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { AudioLevelMeter } from '@/components/AudioLevelMeter';
import { ProjectSelect } from '@/components/ProjectSelect';
import { uploadRecording } from '@/lib/api';
import { formatDuration } from '@/lib/utils';

interface RecordingViewProps {
  connected: boolean;
}

export function RecordingView({ connected }: RecordingViewProps) {
  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useAudioRecorder();

  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleStop = async () => {
    const blob = await stopRecording();
    setRecordingBlob(blob);
    setName(`Recording ${new Date().toLocaleString()}`);
  };

  const handleUpload = async () => {
    if (!recordingBlob || !name.trim()) return;
    setUploading(true);
    setError('');
    try {
      await uploadRecording(recordingBlob, name.trim(), projectId || undefined);
      setSuccess('Recording uploaded! Transcription will begin shortly.');
      setRecordingBlob(null);
      setName('');
    } catch (err) {
      setError('Failed to upload recording');
    } finally {
      setUploading(false);
    }
  };

  const handleDiscard = () => {
    setRecordingBlob(null);
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
  if (recordingBlob) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Mic className="w-4 h-4 text-verbatim-500" />
          Recording Complete
        </h2>

        <div className="text-xs text-gray-500">
          Duration: {formatDuration(duration)} &middot;{' '}
          {(recordingBlob.size / 1024).toFixed(0)} KB
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
              onClick={handleStop}
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

      {success && <div className="text-xs text-green-600 text-center">{success}</div>}
    </div>
  );
}
