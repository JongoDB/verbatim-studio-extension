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

// Paginated response wrapper
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// Health
export async function checkHealth(): Promise<HealthResponse> {
  return request('/health');
}

// Recordings
export async function listRecordings(): Promise<Recording[]> {
  const data = await request<PaginatedResponse<Recording>>('/api/recordings');
  return data.items;
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
  formData.append('title', name);
  formData.append('transcribe', 'true');
  if (projectId) formData.append('project_id', projectId);

  const res = await fetch(`${_baseUrl}/api/recordings/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// Documents
export async function listDocuments(): Promise<Document[]> {
  const data = await request<PaginatedResponse<Document>>('/api/documents');
  return data.items;
}

export async function uploadDocument(
  file: Blob,
  filename: string,
  projectId?: string,
): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file, filename);
  if (projectId) formData.append('project_id', projectId);

  const res = await fetch(`${_baseUrl}/api/documents`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function triggerOcr(documentId: string): Promise<void> {
  await fetch(`${_baseUrl}/api/documents/${documentId}/ocr`, {
    method: 'POST',
  });
}

// Projects
export async function listProjects(): Promise<Project[]> {
  const data = await request<PaginatedResponse<Project>>('/api/projects');
  return data.items;
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
  // Build request body matching ChatRequest schema
  const body: Record<string, unknown> = { message };
  if (context?.selected_text) body.context = context.selected_text;
  if (context?.page_url) body.page_url = context.page_url;
  if (context?.document_ids?.length) body.document_ids = context.document_ids;
  if (context?.recording_ids?.length) body.recording_ids = context.recording_ids;

  const res = await fetch(`${_baseUrl}/api/ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  const data = await request<PaginatedResponse<Conversation>>('/api/conversations');
  return data.items;
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
export async function search(query: string): Promise<SearchResponse> {
  return request(`/api/search/global?q=${encodeURIComponent(query)}`);
}

// Jobs
export async function listJobs(): Promise<Job[]> {
  const data = await request<PaginatedResponse<Job>>('/api/jobs');
  return data.items;
}

export async function getJob(id: string): Promise<Job> {
  return request(`/api/jobs/${id}`);
}
