import React, { useState } from 'react';
import { Camera, Scissors, Monitor } from 'lucide-react';
import { uploadDocument } from '@/lib/api';

interface ScreenCaptureViewProps {
  connected: boolean;
}

export function ScreenCaptureView({ connected }: ScreenCaptureViewProps) {
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState('');

  const handleFullCapture = async () => {
    if (!connected) return;
    setCapturing(true);
    setStatus('');

    try {
      // Capture the visible tab and upload directly
      chrome.tabs.captureVisibleTab(
        { format: 'png' },
        async (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            setStatus('Failed to capture tab');
            setCapturing(false);
            return;
          }

          try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await uploadDocument(blob, `screenshot-${Date.now()}.png`);
            setStatus('Screenshot uploaded!');
          } catch {
            setStatus('Failed to upload screenshot');
          } finally {
            setCapturing(false);
          }
        },
      );
    } catch {
      setStatus('Failed to capture');
      setCapturing(false);
    }
  };

  const handleRegionCapture = () => {
    if (!connected) return;
    // Send message to service worker to initiate screen capture + region selection
    chrome.runtime.sendMessage({ type: 'START_SCREEN_CAPTURE' });
    // Close popup so the content script overlay is visible
    window.close();
  };

  if (!connected) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Connect to Verbatim Studio to capture screenshots
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Camera className="w-4 h-4 text-verbatim-500" />
        Screen Capture
      </h2>

      <div className="space-y-3">
        <button
          className="card p-4 w-full text-left hover:shadow-md transition-shadow flex items-center gap-3"
          onClick={handleFullCapture}
          disabled={capturing}
        >
          <div className="w-10 h-10 rounded-lg bg-verbatim-50 dark:bg-verbatim-900/20 flex items-center justify-center text-verbatim-500">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium">Full Page Capture</div>
            <div className="text-xs text-gray-500">
              Capture the entire visible tab
            </div>
          </div>
        </button>

        <button
          className="card p-4 w-full text-left hover:shadow-md transition-shadow flex items-center gap-3"
          onClick={handleRegionCapture}
          disabled={capturing}
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium">Region Select</div>
            <div className="text-xs text-gray-500">
              Draw a box to capture a specific area
            </div>
          </div>
        </button>
      </div>

      {capturing && (
        <div className="text-center text-sm text-gray-500">Capturing...</div>
      )}

      {status && (
        <div
          className={`text-center text-sm ${
            status.includes('Failed') ? 'text-red-500' : 'text-green-600'
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
