/// <reference lib="webworker" />

import { getSettings } from '@/lib/storage';
import type { Job, WSMessage } from '@/types';

let ws: WebSocket | null = null;
let connected = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let backendPort = 52780;

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

      await fetch(`${getBaseUrl()}/api/documents/upload`, {
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
    // Open side panel with selected text
    if (tab?.id) {
      chrome.sidePanel.open({ tabId: tab.id });
      // Store the selection for the side panel to pick up
      await chrome.storage.session.set({
        pendingContext: {
          selected_text: info.selectionText,
          page_url: tab.url,
        },
      });
    }
  }
});

// Side panel toggle
chrome.action.onClicked.addListener((tab) => {
  // This fires only if there's no default_popup. We use the popup instead.
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

  // Schedule periodic health check when disconnected
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
  // Notify all extension views
  chrome.runtime.sendMessage({ type: 'CONNECTION_STATUS', connected }).catch(() => {});
  // Update icon badge color
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

    // Broadcast to popup/sidepanel
    chrome.runtime.sendMessage({ type: 'JOB_UPDATE', job }).catch(() => {});

    // Show notification on completion
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
    const jobs: Job[] = await res.json();
    const activeCount = jobs.filter((j) => j.status === 'pending' || j.status === 'running').length;
    chrome.action.setBadgeText({ text: activeCount > 0 ? String(activeCount) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
  } catch {
    // ignore
  }
}

// Message handling from popup/sidepanel
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

  if (message.type === 'START_SCREEN_CAPTURE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            sendResponse({ error: 'Failed to capture tab' });
            return;
          }
          // Send the capture to the content script for region selection
          chrome.tabs.sendMessage(tabs[0].id!, {
            type: 'SCREEN_CAPTURE_RESULT',
            dataUrl,
          });
          sendResponse({ success: true });
        });
      }
    });
    return true;
  }

  if (message.type === 'CAPTURE_REGION') {
    // Region was selected in content script, now crop and upload
    handleRegionCapture(message.region, message.dataUrl);
    return true;
  }

  return false;
});

async function handleRegionCapture(
  region: { x: number; y: number; width: number; height: number },
  dataUrl: string,
) {
  try {
    // Create offscreen document for canvas operations if needed,
    // or just use the blob directly
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob, region.x, region.y, region.width, region.height);

    const canvas = new OffscreenCanvas(region.width, region.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });

    const formData = new FormData();
    formData.append('file', croppedBlob, `screenshot-${Date.now()}.png`);

    await fetch(`${getBaseUrl()}/api/documents/upload`, {
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
