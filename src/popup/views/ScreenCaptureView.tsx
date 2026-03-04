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
    setCapturing(true);

    // Capture the tab while popup is still open, then send to content script
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

          // Try sending to content script; inject it first if not present
          const sendToContentScript = () => {
            chrome.tabs.sendMessage(
              tab.id!,
              { type: 'SCREEN_CAPTURE_RESULT', dataUrl },
              (response) => {
                if (chrome.runtime.lastError) {
                  // Content script not injected yet - inject programmatically
                  chrome.scripting.executeScript(
                    {
                      target: { tabId: tab.id! },
                      files: ['content-script.js'],
                    },
                    () => {
                      if (chrome.runtime.lastError) {
                        setStatus('Cannot capture on this page (browser or protected page)');
                        setCapturing(false);
                        return;
                      }
                      // Retry after injection
                      setTimeout(() => {
                        chrome.tabs.sendMessage(
                          tab.id!,
                          { type: 'SCREEN_CAPTURE_RESULT', dataUrl },
                          (retryResponse) => {
                            if (chrome.runtime.lastError) {
                              setStatus('Failed to start region selector');
                              setCapturing(false);
                              return;
                            }
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
