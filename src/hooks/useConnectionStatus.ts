import { useEffect } from 'react';
import { useStore } from './useStore';
import { checkHealth } from '@/lib/api';

export function useConnectionStatus() {
  const { connected, setConnected } = useStore();

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        await checkHealth();
        if (mounted) setConnected(true);
      } catch {
        if (mounted) setConnected(false);
      }
    }

    check();

    // Also ask the service worker for its status
    chrome.runtime?.sendMessage({ type: 'GET_CONNECTION_STATUS' }, (response) => {
      if (response && mounted) {
        setConnected(response.connected);
      }
    });

    // Listen for updates from service worker
    const listener = (message: { type: string; connected?: boolean }) => {
      if (message.type === 'CONNECTION_STATUS' && mounted) {
        setConnected(message.connected!);
      }
    };
    chrome.runtime?.onMessage.addListener(listener);

    return () => {
      mounted = false;
      chrome.runtime?.onMessage.removeListener(listener);
    };
  }, [setConnected]);

  return connected;
}
