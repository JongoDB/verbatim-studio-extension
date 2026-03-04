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
  const recording = await res.json();

  // Trigger transcription automatically after upload and track the job
  if (recording?.id) {
    await triggerTranscription(recording.id);
  }

  return recording;
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

export async function getDocument(id: string): Promise<Document> {
  return request(`/api/documents/${id}`);
}

// Fetch the text content of a document, trying multiple approaches
export async function getDocumentContent(id: string): Promise<string> {
  // First try: the document object itself may include text
  try {
    const doc = await getDocument(id);
    if (doc.text) return doc.text;
    if (doc.content) return doc.content;
    if (doc.extracted_text) return doc.extracted_text;
  } catch {
    // ignore
  }

  // Second try: dedicated content endpoint
  try {
    const res = await fetch(`${_baseUrl}/api/documents/${id}/content`);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const data = await res.json();
        return data.text || data.content || data.extracted_text || JSON.stringify(data);
      }
      return await res.text();
    }
  } catch {
    // ignore
  }

  // Third try: chunks endpoint (RAG)
  try {
    const res = await fetch(`${_baseUrl}/api/documents/${id}/chunks`);
    if (res.ok) {
      const data = await res.json();
      const chunks = Array.isArray(data) ? data : data.items || data.chunks || [];
      if (chunks.length > 0) {
        return chunks.map((c: any) => c.text || c.content || '').filter(Boolean).join('\n\n');
      }
    }
  } catch {
    // ignore
  }

  return '';
}

// Fetch transcript text for a recording
export async function getRecordingTranscript(id: string): Promise<string> {
  // First try: the recording object includes transcript
  try {
    const rec = await getRecording(id);
    if (rec.transcript) return rec.transcript;
  } catch {
    // ignore
  }

  // Second try: dedicated transcript endpoint
  try {
    const res = await fetch(`${_baseUrl}/api/recordings/${id}/transcript`);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const data = await res.json();
        return data.text || data.transcript || data.content || '';
      }
      return await res.text();
    }
  } catch {
    // ignore
  }

  // Third try: segments endpoint
  try {
    const res = await fetch(`${_baseUrl}/api/recordings/${id}/segments`);
    if (res.ok) {
      const data = await res.json();
      const segments = Array.isArray(data) ? data : data.items || data.segments || [];
      if (segments.length > 0) {
        return segments.map((s: any) => s.text || '').filter(Boolean).join(' ');
      }
    }
  } catch {
    // ignore
  }

  return '';
}

export async function triggerOcr(documentId: string): Promise<void> {
  try {
    await fetch(`${_baseUrl}/api/documents/${documentId}/ocr`, {
      method: 'POST',
    });
  } catch {
    // ignore
  }
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
    documents_content?: string;
  },
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // Build request body matching ChatRequest schema
  const body: Record<string, unknown> = { message };

  // Build rich context: combine selected text, page URL, and document/recording content
  const contextParts: string[] = [];
  if (context?.selected_text) contextParts.push(context.selected_text);
  if (context?.documents_content) contextParts.push(context.documents_content);

  if (contextParts.length > 0) body.context = contextParts.join('\n\n');
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
  const data = await request<PaginatedResponse<Conversation> | Conversation[]>('/api/conversations');
  return Array.isArray(data) ? data : (data as PaginatedResponse<Conversation>).items || [];
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

// Transcription
export async function triggerTranscription(recordingId: string): Promise<void> {
  try {
    await fetch(`${_baseUrl}/api/recordings/${recordingId}/transcribe`, {
      method: 'POST',
    });
  } catch {
    // ignore
  }
}

// Jobs — fetch all jobs from backend (source of truth for both extension and Electron app)
export async function listJobs(): Promise<Job[]> {
  const data = await request<PaginatedResponse<Job> | Job[]>('/api/jobs');
  return Array.isArray(data) ? data : (data as PaginatedResponse<Job>).items;
}

export async function getJob(id: string): Promise<Job> {
  return request(`/api/jobs/${id}`);
}

export async function cancelJob(id: string): Promise<void> {
  await request(`/api/jobs/${id}/cancel`, { method: 'POST' });
}
