// Offscreen document for audio recording via getUserMedia
// This runs in a hidden document so permission prompts don't close the popup

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;
let analyser: AnalyserNode | null = null;
let audioContext: AudioContext | null = null;
let levelTimer: ReturnType<typeof setInterval> | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;
let startTime = 0;
let pausedDuration = 0;
let pauseStart = 0;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.target) {
    case 'offscreen':
      break;
    default:
      return false;
  }

  switch (message.action) {
    case 'start':
      startRecording()
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;

    case 'pause':
      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.pause();
        pauseStart = Date.now();
      }
      return false;

    case 'resume':
      if (mediaRecorder?.state === 'paused') {
        pausedDuration += Date.now() - pauseStart;
        mediaRecorder.resume();
      }
      return false;

    case 'stop':
      stopRecording();
      return false;
  }
});

async function startRecording() {
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100,
    },
  });

  chunks = [];

  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus',
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start(1000);
  startTime = Date.now();
  pausedDuration = 0;

  // Send audio level updates ~10fps
  levelTimer = setInterval(() => {
    if (!analyser || mediaRecorder?.state === 'paused') {
      chrome.runtime.sendMessage({ type: 'AUDIO_LEVEL', level: 0 }).catch(() => {});
      return;
    }
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    chrome.runtime.sendMessage({ type: 'AUDIO_LEVEL', level: avg / 255 }).catch(() => {});
  }, 100);

  // Send duration updates
  durationTimer = setInterval(() => {
    const paused = mediaRecorder?.state === 'paused' ? Date.now() - pauseStart : 0;
    const elapsed = (Date.now() - startTime - pausedDuration - paused) / 1000;
    chrome.runtime.sendMessage({
      type: 'RECORDING_DURATION',
      duration: elapsed,
      isPaused: mediaRecorder?.state === 'paused',
    }).catch(() => {});
  }, 200);

  chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' }).catch(() => {});
}

function stopRecording() {
  if (!mediaRecorder) return;

  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const duration = (Date.now() - startTime - pausedDuration) / 1000;

    const reader = new FileReader();
    reader.onload = () => {
      chrome.runtime.sendMessage({
        type: 'RECORDING_COMPLETE',
        dataUrl: reader.result as string,
        duration,
        size: blob.size,
      }).catch(() => {});
    };
    reader.readAsDataURL(blob);

    cleanup();
  };

  mediaRecorder.stop();
}

function cleanup() {
  if (levelTimer) clearInterval(levelTimer);
  if (durationTimer) clearInterval(durationTimer);
  stream?.getTracks().forEach((t) => t.stop());
  audioContext?.close();
  mediaRecorder = null;
  stream = null;
  analyser = null;
  audioContext = null;
  levelTimer = null;
  durationTimer = null;
}
