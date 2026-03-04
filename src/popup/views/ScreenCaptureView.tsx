import React, { useState, useEffect } from 'react';
import { Camera, Scissors, Monitor, Upload, X } from 'lucide-react';
import { uploadDocument, triggerOcr } from '@/lib/api';

interface ScreenCaptureViewProps {
  connected: boolean;
}

export function ScreenCaptureView({ connected }: ScreenCaptureViewProps) {
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [runOcr, setRunOcr] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Check for pending capture from a region select (popup was closed during selection)
  useEffect(() => {
    chrome.storage.session.get('pendingCapture', (data) => {
      if (data.pendingCapture) {
        setPreviewDataUrl(data.pendingCapture);
      }
    });
  }, []);

  const handleFullCapture = () => {
    if (!connected) return;
    setCapturing(true);
    setStatus('');

    chrome.tabs.captureVisibleTab(
      { format: 'png' },
      (dataUrl) => {
        setCapturing(false);
        if (chrome.runtime.lastError || !dataUrl) {
          setStatus('Failed to capture tab');
          return;
        }
        setPreviewDataUrl(dataUrl);
      },
    );
  };

  const handleRegionCapture = () => {
    if (!connected) return;
    setCapturing(true);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setStatus('No active tab found');
        setCapturing(false);
        return;
      }

      chrome.tabs.captureVisibleTab(
        { format: 'png' },
        (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            setStatus('Failed to capture tab');
            setCapturing(false);
            return;
          }

          const sendToContentScript = () => {
            chrome.tabs.sendMessage(
              tab.id!,
              { type: 'SCREEN_CAPTURE_RESULT', dataUrl },
              (response) => {
                if (chrome.runtime.lastError) {
                  chrome.scripting.executeScript(
                    {
                      target: { tabId: tab.id! },
                      files: ['content-script.js'],
                    },
                    () => {
                      if (chrome.runtime.lastError) {
                        // Protected page — capture full page as preview instead
                        setPreviewDataUrl(dataUrl);
                        setCapturing(false);
                        setStatus('Region select not available on this page — full page captured');
                        return;
                      }
                      setTimeout(() => {
                        chrome.tabs.sendMessage(
                          tab.id!,
                          { type: 'SCREEN_CAPTURE_RESULT', dataUrl },
                          (retryResponse) => {
                            if (chrome.runtime.lastError) {
                              setPreviewDataUrl(dataUrl);
                              setCapturing(false);
                              setStatus('Region select not available — full page captured');
                              return;
                            }
                            // Popup will close; preview shows on next open
                            window.close();
                          },
                        );
                      }, 100);
                    },
                  );
                  return;
                }
                window.close();
              },
            );
          };
          sendToContentScript();
        },
      );
    });
  };

  const handleUpload = async () => {
    if (!previewDataUrl) return;
    setUploading(true);
    setStatus('');

    try {
      chrome.runtime.sendMessage(
        { type: 'UPLOAD_CAPTURE', dataUrl: previewDataUrl, runOcr },
        (response) => {
          setUploading(false);
          if (response?.error) {
            setStatus('Failed to upload screenshot');
          } else {
            setStatus('Screenshot uploaded!');
            setPreviewDataUrl(null);
          }
        },
      );
    } catch {
      setStatus('Failed to upload screenshot');
      setUploading(false);
    }
  };

  const handleDiscard = () => {
    setPreviewDataUrl(null);
    setStatus('');
    chrome.runtime.sendMessage({ type: 'DISCARD_CAPTURE' });
  };

  if (!connected) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Connect to Verbatim Studio to capture screenshots
      </div>
    );
  }

  // Preview mode
  if (previewDataUrl) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Camera className="w-4 h-4 text-verbatim-500" />
          Screenshot Preview
        </h2>

        <div className="card overflow-hidden">
          <img
            src={previewDataUrl}
            alt="Screenshot"
            className="w-full max-h-[240px] object-contain bg-gray-100 dark:bg-gray-800"
          />
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Run OCR on image
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={runOcr}
            onClick={() => setRunOcr(!runOcr)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              runOcr ? 'bg-verbatim-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                runOcr ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </label>

        {status && (
          <div
            className={`text-sm text-center ${
              status.includes('Failed') ? 'text-red-500' : 'text-green-600'
            }`}
          >
            {status}
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
            onClick={handleUpload}
            disabled={uploading}
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            className="btn-secondary flex items-center justify-center gap-2 text-sm"
            onClick={handleDiscard}
            disabled={uploading}
          >
            <X className="w-4 h-4" />
            Discard
          </button>
        </div>
      </div>
    );
  }

  // Capture options
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
            status.includes('Failed')
              ? 'text-red-500'
              : status.includes('not available')
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-green-600'
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
