(async () => {
  const msg = document.getElementById('msg');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    msg.textContent = 'Microphone access granted!';
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
    setTimeout(() => window.close(), 800);
  } catch (err) {
    msg.textContent =
      'Microphone access was denied. Please click the lock icon in your address bar to allow access, then try again.';
    msg.classList.add('error');
  }
})();
