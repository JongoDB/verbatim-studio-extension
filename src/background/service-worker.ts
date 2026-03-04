/// <reference lib="webworker" />

import { getSettings } from '@/lib/storage';
import type { Job, WSMessage } from '@/types';

let ws: WebSocket | null = null;
let connected = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let backendPort = 52780;

// Pending recording data URL (from offscreen document, awaiting user upload)
let pendingRecordingDataUrl: string | null = null;

const MAX_RECONNECT_DELAY = 30000;

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  init();
});

chrome.runtime.onStartup.addListener(() => {
  init();
});

async function init() {
  const settings = await getSettings();
  backendPort = settings.backendPort;
  checkHealthAndConnect();
}

function getBaseUrl() {
  return `http://127.0.0.1:${backendPort}`;
}

function getWsUrl() {
  return `ws://127.0.0.1:${backendPort}/api/ws/sync`;
}

// Offscreen document management
async function ensureOffscreenDocument() {
  const contexts = await (chrome.runtime as any).getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Audio recording with microphone access',
  });
}

async function closeOffscreenDocument() {
  const contexts = await (chrome.runtime as any).getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (contexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

// Open a small window to trigger native mic permission dialog
function openMicPermissionWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('mic-permission.html'),
    type: 'popup',
    width: 420,
    height: 220,
    focused: true,
  });
}

// Context menus
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'upload-image',
      title: 'Upload image to Verbatim',
      contexts: ['image'],
    });
    chrome.contextMenus.create({
      id: 'upload-link',
      title: 'Upload link to Verbatim',
      contexts: ['link'],
    });
    chrome.contextMenus.create({
      id: 'send-selection',
      title: 'Send to Verbatim Chat',
      contexts: ['selection'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'upload-image' && info.srcUrl) {
    try {
      const response = await fetch(info.srcUrl);
      const blob = await response.blob();
      const filename = info.srcUrl.split('/').pop()?.split('?')[0] || 'image.png';

      const formData = new FormData();
      formData.append('file', blob, filename);

      await fetch(`${getBaseUrl()}/api/documents`, {
        method: 'POST',
        body: formData,
      });

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Verbatim Studio',
        message: `Image uploaded: ${filename}`,
      });
    } catch (err) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Verbatim Studio',
        message: 'Failed to upload image. Is Verbatim Studio running?',
      });
    }
  }

  if (info.menuItemId === 'send-selection' && info.selectionText) {
    if (tab?.id) {
      chrome.sidePanel.open({ tabId: tab.id });
      await chrome.storage.session.set({
        pendingContext: {
          selected_text: info.selectionText,
          page_url: tab.url,
        },
      });
    }
  }
});

// Health check
async function checkHealthAndConnect() {
  try {
    const res = await fetch(`${getBaseUrl()}/health`);
    if (res.ok) {
      setConnected(true);
      connectWebSocket();
      updateJobBadge();
    } else {
      setConnected(false);
    }
  } catch {
    setConnected(false);
  }

  if (!connected) {
    if (!healthCheckTimer) {
      healthCheckTimer = setInterval(() => {
        if (!connected) checkHealthAndConnect();
      }, 30000);
    }
  } else if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

function setConnected(isConnected: boolean) {
  connected = isConnected;
  chrome.runtime.sendMessage({ type: 'CONNECTION_STATUS', connected }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({
    color: isConnected ? '#22c55e' : '#ef4444',
  });
  if (!isConnected) {
    chrome.action.setBadgeText({ text: '!' });
  }
}

// WebSocket
function connectWebSocket() {
  if (ws?.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      reconnectAttempts = 0;
      console.log('[Verbatim] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    checkHealthAndConnect();
  }, delay);
}

function handleWSMessage(msg: WSMessage) {
  if (msg.type === 'job_progress') {
    const payload = msg.payload as {
      job_id: string;
      status: string;
      progress: number;
      message?: string;
      type?: string;
    };

    const job: Job = {
      id: payload.job_id,
      type: payload.type || 'unknown',
      status: payload.status as Job['status'],
      progress: payload.progress,
      message: payload.message,
      created_at: new Date().toISOString(),
    };

    chrome.runtime.sendMessage({ type: 'JOB_UPDATE', job }).catch(() => {});

    if (payload.status === 'completed') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Verbatim Studio',
        message: payload.message || `Job completed: ${payload.type || payload.job_id}`,
      });
    }

    updateJobBadge();
  }

  if (msg.type === 'invalidate') {
    const payload = msg.payload as { resource: string; id?: string };
    chrome.runtime.sendMessage({
      type: 'INVALIDATE',
      resource: payload.resource,
      id: payload.id,
    }).catch(() => {});
  }
}

async function updateJobBadge() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/jobs`);
    if (!res.ok) return;
    const data = await res.json();
    const jobs: Job[] = data.items || data;
    const activeCount = jobs.filter((j) => j.status === 'pending' || j.status === 'running').length;
    chrome.action.setBadgeText({ text: activeCount > 0 ? String(activeCount) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
  } catch {
    // ignore
  }
}

// Message handling from popup/sidepanel/offscreen
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CONNECTION_STATUS') {
    sendResponse({ connected });
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
      }
    });
    return true;
  }

  // Recording messages: popup -> service worker -> offscreen
  if (message.type === 'START_RECORDING') {
    ensureOffscreenDocument().then(() => {
      // Small delay to ensure offscreen script has registered its listener
      setTimeout(() => {
        chrome.runtime.sendMessage({ target: 'offscreen', action: 'start' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: 'Failed to communicate with recorder' });
            return;
          }
          // If mic access failed, open a small window to trigger native permission dialog
          if (response?.error) {
            openMicPermissionWindow();
            sendResponse({ error: 'mic_permission_needed' });
            return;
          }
          sendResponse(response);
        });
      }, 150);
    }).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'PAUSE_RECORDING') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'pause' });
    return false;
  }

  if (message.type === 'RESUME_RECORDING') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'resume' });
    return false;
  }

  if (message.type === 'STOP_RECORDING') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'stop' });
    return false;
  }

  // Offscreen -> service worker: recording complete, store data URL
  if (message.type === 'RECORDING_COMPLETE') {
    pendingRecordingDataUrl = message.dataUrl;
    // Forward to popup
    chrome.runtime.sendMessage({
      type: 'RECORDING_COMPLETE',
      duration: message.duration,
      size: message.size,
    }).catch(() => {});
    // Close offscreen document
    closeOffscreenDocument().catch(() => {});
    return false;
  }

  // Audio level and duration updates: offscreen -> forward to popup
  if (message.type === 'AUDIO_LEVEL' || message.type === 'RECORDING_DURATION' ||
      message.type === 'RECORDING_STARTED' || message.type === 'RECORDING_STATE') {
    // Already broadcast to all listeners
    return false;
  }

  // Upload the pending recording
  if (message.type === 'UPLOAD_RECORDING') {
    if (!pendingRecordingDataUrl) {
      sendResponse({ error: 'No recording data' });
      return true;
    }
    uploadPendingRecording(message.name, message.projectId)
      .then((result) => sendResponse({ success: true, recording: result }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  // Screen capture
  if (message.type === 'START_SCREEN_CAPTURE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            sendResponse({ error: 'Failed to capture tab' });
            return;
          }
          chrome.tabs.sendMessage(tabs[0].id!, {
            type: 'SCREEN_CAPTURE_RESULT',
            dataUrl,
          }).catch(() => {
            // Content script not loaded, just upload the full screenshot
            uploadScreenshot(dataUrl);
          });
          sendResponse({ success: true });
        });
      }
    });
    return true;
  }

  if (message.type === 'CAPTURE_REGION') {
    handleRegionCapture(message.region, message.dataUrl);
    return true;
  }

  return false;
});

async function uploadPendingRecording(name: string, projectId?: string) {
  if (!pendingRecordingDataUrl) throw new Error('No recording data');

  const response = await fetch(pendingRecordingDataUrl);
  const blob = await response.blob();
  pendingRecordingDataUrl = null;

  const formData = new FormData();
  formData.append('file', blob, `${name}.webm`);
  formData.append('title', name);
  formData.append('transcribe', 'true');
  if (projectId) formData.append('project_id', projectId);

  const res = await fetch(`${getBaseUrl()}/api/recordings/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const recording = await res.json();

  // Trigger transcription automatically after upload
  if (recording?.id) {
    fetch(`${getBaseUrl()}/api/recordings/${recording.id}/transcribe`, {
      method: 'POST',
    }).catch(() => {});
  }

  return recording;
}

async function uploadScreenshot(dataUrl: string) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append('file', blob, `screenshot-${Date.now()}.png`);

    await fetch(`${getBaseUrl()}/api/documents`, {
      method: 'POST',
      body: formData,
    });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Verbatim Studio',
      message: 'Screenshot uploaded successfully',
    });
  } catch {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Verbatim Studio',
      message: 'Failed to upload screenshot',
    });
  }
}

async function handleRegionCapture(
  region: { x: number; y: number; width: number; height: number },
  dataUrl: string,
) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob, region.x, region.y, region.width, region.height);

    const canvas = new OffscreenCanvas(region.width, region.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });

    const formData = new FormData();
    formData.append('file', croppedBlob, `screenshot-${Date.now()}.png`);

    await fetch(`${getBaseUrl()}/api/documents`, {
      method: 'POST',
      body: formData,
    });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Verbatim Studio',
      message: 'Screenshot uploaded successfully',
    });
  } catch (err) {
    console.error('Failed to upload screenshot:', err);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Verbatim Studio',
      message: 'Failed to upload screenshot',
    });
  }
}
