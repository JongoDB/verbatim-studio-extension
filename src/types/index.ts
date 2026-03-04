// Verbatim Studio API types

export interface HealthResponse {
  status: string;
  version?: string;
}

export interface Recording {
  id: string;
  title?: string;
  name?: string;
  filename?: string;
  duration?: number;
  status: string;
  created_at: string;
  updated_at?: string;
  project_id?: string;
  transcript?: string;
}

export interface Document {
  id: string;
  title?: string;
  name?: string;
  filename?: string;
  content_type?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  project_id?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  context?: ChatContext;
}

export interface ChatContext {
  page_url?: string;
  selected_text?: string;
  document_ids?: string[];
  recording_ids?: string[];
}

export interface Job {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  progress?: number;
  message?: string;
  created_at: string;
  completed_at?: string;
}

// Search — matches GlobalSearchResult from the actual API
export interface SearchResult {
  id: string;
  type: string; // 'segment' | 'document_chunk' | 'note' | etc.
  title: string | null;
  text?: string;
  recording_id?: string | null;
  recording_title?: string | null;
  document_id?: string | null;
  document_title?: string | null;
  note_id?: string | null;
  conversation_id?: string | null;
  conversation_title?: string | null;
  start_time?: number | null;
  end_time?: number | null;
  created_at?: string;
  match_type?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

// WebSocket message types
export interface WSMessage {
  type: 'invalidate' | 'job_progress';
  payload: Record<string, unknown>;
}

export interface WSJobProgress {
  type: 'job_progress';
  payload: {
    job_id: string;
    status: string;
    progress: number;
    message?: string;
  };
}

export interface WSInvalidate {
  type: 'invalidate';
  payload: {
    resource: string;
    id?: string;
  };
}

// Extension internal message types
export type ExtensionMessage =
  | { type: 'GET_CONNECTION_STATUS' }
  | { type: 'CONNECTION_STATUS'; connected: boolean }
  | { type: 'GET_ACTIVE_JOBS' }
  | { type: 'ACTIVE_JOBS'; jobs: Job[] }
  | { type: 'JOB_UPDATE'; job: Job }
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'START_SCREEN_CAPTURE' }
  | { type: 'SCREEN_CAPTURE_RESULT'; dataUrl: string }
  | { type: 'CAPTURE_REGION'; region: { x: number; y: number; width: number; height: number } }
  | { type: 'INVALIDATE'; resource: string; id?: string }
  | { type: 'UPLOAD_IMAGE_URL'; url: string; pageUrl: string };

// Settings
export interface ExtensionSettings {
  backendPort: number;
  darkMode: 'system' | 'light' | 'dark';
  notificationsEnabled: boolean;
  autoReconnect: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  backendPort: 52780,
  darkMode: 'system',
  notificationsEnabled: true,
  autoReconnect: true,
};
