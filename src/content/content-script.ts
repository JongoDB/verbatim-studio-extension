// Content script for Verbatim Studio Extension
// Handles: screen region selection overlay, text selection forwarding

let overlayActive = false;

// Track the last non-empty text selection so it survives focus changes
// (clicking the side panel Globe button shifts focus away from the page,
// which can cause window.getSelection() to return empty)
let lastSelection = '';
document.addEventListener('selectionchange', () => {
  const text = window.getSelection()?.toString() || '';
  if (text) lastSelection = text;
});

function getCurrentSelection(): string {
  const live = window.getSelection()?.toString() || '';
  return live || lastSelection;
}

// Listen for messages from the service worker / popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCREEN_CAPTURE_RESULT') {
    showRegionSelector(message.dataUrl);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_SELECTION') {
    sendResponse({ selectedText: getCurrentSelection() });
    return true;
  }

  if (message.type === 'GET_PAGE_CONTEXT') {
    const selectedText = getCurrentSelection();
    const pageTitle = document.title || '';
    const metaDesc =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || '';

    // Extract readable text from the page body, stripping nav/script/style noise
    let pageText = '';
    try {
      const main =
        document.querySelector('main') ||
        document.querySelector('article') ||
        document.querySelector('[role="main"]') ||
        document.body;
      const clone = main.cloneNode(true) as HTMLElement;
      // Remove noisy elements
      clone.querySelectorAll('script, style, nav, header, footer, noscript, iframe, svg')
        .forEach((el) => el.remove());
      pageText = (clone.innerText || clone.textContent || '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 5000);
    } catch {
      // ignore
    }

    sendResponse({ selectedText, pageTitle, metaDesc, pageText });
    return true;
  }

  return false;
});

function showRegionSelector(captureDataUrl: string) {
  if (overlayActive) return;
  overlayActive = true;

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'verbatim-region-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    cursor: 'crosshair',
    background: 'rgba(0, 0, 0, 0.3)',
  });

  // Canvas for the screenshot
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
  });

  // Selection box
  const selectionBox = document.createElement('div');
  Object.assign(selectionBox.style, {
    position: 'absolute',
    border: '2px solid hsl(217, 68%, 54%)',
    background: 'rgba(59, 130, 246, 0.1)',
    display: 'none',
    pointerEvents: 'none',
  });

  // Instructions
  const instructions = document.createElement('div');
  Object.assign(instructions.style, {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    pointerEvents: 'none',
    zIndex: '1',
  });
  instructions.textContent = 'Drag to select a region. Press Escape to cancel.';

  overlay.appendChild(canvas);
  overlay.appendChild(selectionBox);
  overlay.appendChild(instructions);
  document.body.appendChild(overlay);

  // Load the screenshot onto the canvas
  const img = new Image();
  img.onload = () => {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Darken the canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  img.src = captureDataUrl;

  let startX = 0;
  let startY = 0;
  let dragging = false;

  const onMouseDown = (e: MouseEvent) => {
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;
    selectionBox.style.display = 'block';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    selectionBox.style.left = x + 'px';
    selectionBox.style.top = y + 'px';
    selectionBox.style.width = w + 'px';
    selectionBox.style.height = h + 'px';
  };

  const onMouseUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;

    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    cleanup();

    if (w < 10 || h < 10) return; // Too small, ignore

    // Crop the region from the original image using a canvas
    const dpr = window.devicePixelRatio;
    const cropCanvas = document.createElement('canvas');
    const cropW = Math.round(w * dpr);
    const cropH = Math.round(h * dpr);
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d')!;
    cropCtx.drawImage(
      img,
      Math.round(x * dpr), Math.round(y * dpr), cropW, cropH,
      0, 0, cropW, cropH,
    );
    const croppedDataUrl = cropCanvas.toDataURL('image/png');

    // Send cropped image to service worker for preview
    chrome.runtime.sendMessage({
      type: 'CAPTURE_REGION',
      croppedDataUrl,
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  function cleanup() {
    overlay.removeEventListener('mousedown', onMouseDown);
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
    overlayActive = false;
  }

  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);
}
