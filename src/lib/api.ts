import type {
  HealthResponse,
  Recording,
  Document,
  Project,
  Conversation,
  Job,
  SearchResponse,
} from '@/types';

let _baseUrl = 'http://127.0.0.1:52780';

export function setBaseUrl(port: number) {
  _baseUrl = `http://127.0.0.1:${port}`;
}

export function getBaseUrl() {
  return _baseUrl;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${_baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Health
export async function checkHealth(): Promise<HealthResponse> {
  return request('/health');
}

// Recordings
export async function listRecordings(): Promise<Recording[]> {
  return request('/api/recordings');
}

export async function getRecording(id: string): Promise<Recording> {
  return request(`/api/recordings/${id}`);
}

export async function uploadRecording(
  file: Blob,
  name: string,
  projectId?: string,
): Promise<Recording> {
  const formData = new FormData();
  formData.append('file', file, `${name}.webm`);
  formData.append('name', name);
  if (projectId) formData.append('project_id', projectId);

  const res = await fetch(`${_baseUrl}/api/recordings`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// Documents
export async function listDocuments(): Promise<Document[]> {
  return request('/api/documents');
}

export async function uploadDocument(
  file: Blob,
  filename: string,
  projectId?: string,
): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file, filename);
  if (projectId) formData.append('project_id', projectId);

  const res = await fetch(`${_baseUrl}/api/documents/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// Projects
export async function listProjects(): Promise<Project[]> {
  return request('/api/projects');
}

// AI Chat (SSE streaming)
export async function streamChat(
  message: string,
  context?: {
    page_url?: string;
    selected_text?: string;
    document_ids?: string[];
    recording_ids?: string[];
  },
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${_baseUrl}/api/ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context }),
    signal,
  });

  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content || parsed.text || parsed.delta || '';
          if (text) {
            fullText += text;
            onChunk?.(text);
          }
        } catch {
          // Raw text chunk
          if (data.trim()) {
            fullText += data;
            onChunk?.(data);
          }
        }
      }
    }
  }

  return fullText;
}

export async function streamMultiChat(
  message: string,
  documentIds: string[],
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${_baseUrl}/api/ai/chat/multi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, document_ids: documentIds }),
    signal,
  });

  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content || parsed.text || parsed.delta || '';
          if (text) {
            fullText += text;
            onChunk?.(text);
          }
        } catch {
          if (data.trim()) {
            fullText += data;
            onChunk?.(data);
          }
        }
      }
    }
  }

  return fullText;
}

// Conversations
export async function listConversations(): Promise<Conversation[]> {
  return request('/api/conversations');
}

export async function saveConversation(conversation: {
  title: string;
  messages: Array<{ role: string; content: string }>;
}): Promise<Conversation> {
  return request('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(conversation),
  });
}

// Search
export async function search(
  query: string,
  mode: 'semantic' | 'keyword' = 'keyword',
): Promise<SearchResponse> {
  return request(`/api/search?q=${encodeURIComponent(query)}&mode=${mode}`);
}

// Jobs
export async function listJobs(): Promise<Job[]> {
  return request('/api/jobs');
}

export async function getJob(id: string): Promise<Job> {
  return request(`/api/jobs/${id}`);
}
