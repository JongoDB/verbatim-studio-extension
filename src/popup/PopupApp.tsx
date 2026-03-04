import React, { useState, useEffect } from 'react';
import {
  Mic,
  Upload,
  Search,
  MessageSquare,
  Camera,
  Settings,
  Briefcase,
} from 'lucide-react';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useActiveJobs } from '@/hooks/useActiveJobs';
import { useDarkMode } from '@/hooks/useDarkMode';
import { RecordingView } from './views/RecordingView';
import { UploadView } from './views/UploadView';
import { SearchView } from './views/SearchView';
import { JobsView } from './views/JobsView';
import { ScreenCaptureView } from './views/ScreenCaptureView';

type View = 'home' | 'recording' | 'upload' | 'search' | 'jobs' | 'capture';

export function PopupApp() {
  const [view, setView] = useState<View>('home');
  const connected = useConnectionStatus();
  const activeJobs = useActiveJobs();
  useDarkMode();

  // Auto-open capture view if there's a pending screenshot from region select
  useEffect(() => {
    chrome.storage.session.get('pendingCapture', (data) => {
      if (data.pendingCapture) {
        setView('capture');
      }
    });
  }, []);

  const openSidePanel = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    window.close();
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (view !== 'home') {
    return (
      <div className="w-[380px] min-h-[480px] flex flex-col">
        <Header
          connected={connected}
          onBack={() => setView('home')}
          jobCount={activeJobs.length}
        />
        <div className="flex-1 overflow-y-auto">
          {view === 'recording' && <RecordingView connected={connected} />}
          {view === 'upload' && <UploadView connected={connected} />}
          {view === 'search' && <SearchView connected={connected} />}
          {view === 'jobs' && <JobsView />}
          {view === 'capture' && <ScreenCaptureView connected={connected} />}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[380px] min-h-[480px] flex flex-col">
      <Header connected={connected} jobCount={activeJobs.length} />

      {!connected ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <img
            src={chrome.runtime.getURL('verbatim-icon.png')}
            alt="Verbatim"
            className="w-16 h-16 rounded-2xl mb-4"
          />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Verbatim Studio not detected
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Start Verbatim Studio to connect
          </p>
        </div>
      ) : (
        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard
              icon={<Mic className="w-5 h-5" />}
              label="Record Audio"
              description="Capture & transcribe"
              onClick={() => setView('recording')}
            />
            <FeatureCard
              icon={<Camera className="w-5 h-5" />}
              label="Screen Capture"
              description="Clip & upload"
              onClick={() => setView('capture')}
            />
            <FeatureCard
              icon={<Upload className="w-5 h-5" />}
              label="Upload Files"
              description="Documents & media"
              onClick={() => setView('upload')}
            />
            <FeatureCard
              icon={<Search className="w-5 h-5" />}
              label="Search"
              description="Find anything"
              onClick={() => setView('search')}
            />
            <FeatureCard
              icon={<MessageSquare className="w-5 h-5" />}
              label="Chat with Max"
              description="AI assistant"
              onClick={openSidePanel}
              accent
            />
            <FeatureCard
              icon={<Briefcase className="w-5 h-5" />}
              label="Jobs"
              description={activeJobs.length > 0 ? `${activeJobs.length} active` : 'View status'}
              onClick={() => setView('jobs')}
              badge={activeJobs.length > 0 ? activeJobs.length : undefined}
            />
          </div>
        </div>
      )}

      <div className="border-t px-4 py-2 flex justify-end">
        <button
          onClick={openOptions}
          className="btn-ghost p-1.5 rounded-lg"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Header({
  connected,
  onBack,
  jobCount,
}: {
  connected: boolean;
  onBack?: () => void;
  jobCount?: number;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="btn-ghost p-1 rounded-lg text-sm"
          >
            &larr;
          </button>
        )}
        <img
          src={chrome.runtime.getURL('verbatim-logo.png')}
          alt="Verbatim Studio"
          className="h-12"
        />
      </div>
      <ConnectionBadge connected={connected} />
    </div>
  );
}

function FeatureCard({
  icon,
  label,
  description,
  onClick,
  accent,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left hover:shadow-md transition-shadow relative ${
        accent ? 'border-verbatim-500/30 bg-verbatim-50 dark:bg-verbatim-900/10' : ''
      }`}
    >
      <div
        className={`mb-2 ${accent ? 'text-verbatim-500' : 'text-gray-500 dark:text-gray-400'}`}
      >
        {icon}
      </div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
      {badge !== undefined && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-verbatim-500 text-white text-xs flex items-center justify-center font-medium">
          {badge}
        </div>
      )}
    </button>
  );
}
