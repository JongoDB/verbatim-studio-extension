import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Save,
  FolderOpen,
  Plus,
  Globe,
  Type,
  FileText,
  Mic,
  X,
  Loader,
  ChevronDown,
  MessageSquare,
  Upload,
} from 'lucide-react';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  streamChat,
  streamMultiChat,
  listConversations,
  saveConversation,
  listDocuments,
  listRecordings,
  uploadDocument,
  getDocumentContent,
  getRecordingTranscript,
} from '@/lib/api';
import type { ChatMessage, ChatContext, Conversation, Document, Recording } from '@/types';

interface AttachedContext {
  page_url?: string;
  page_content?: string;
  selected_text?: string;
  document_ids?: string[];
  recording_ids?: string[];
  document_names?: string[];
  recording_names?: string[];
}

export function SidePanelApp() {
  const connected = useConnectionStatus();
  useDarkMode();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState<AttachedContext>({});
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Check for pending context from context menu
  useEffect(() => {
    chrome.storage.session?.get('pendingContext', (result) => {
      if (result.pendingContext) {
        setContext((prev) => ({ ...prev, ...result.pendingContext }));
        chrome.storage.session.remove('pendingContext');
      }
    });
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [contextTooltip, setContextTooltip] = useState<string | null>(null);
  const contextTooltipTimer = useRef<ReturnType<typeof setTimeout>>();

  const showContextTooltip = useCallback((msg: string) => {
    clearTimeout(contextTooltipTimer.current);
    setContextTooltip(msg);
    contextTooltipTimer.current = setTimeout(() => setContextTooltip(null), 4000);
  }, []);

  const attachPageContext = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url) {
        showContextTooltip('No active page found.');
        return;
      }

      // Restricted pages can't run content scripts
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
        setContext((prev) => ({ ...prev, page_url: tab.url }));
        showContextTooltip('Page URL attached. This page doesn\'t support content capture.');
        return;
      }

      setContext((prev) => ({ ...prev, page_url: tab.url }));

      const handlePageContext = (response: any) => {
        const parts: string[] = [];
        if (response?.pageTitle) parts.push(response.pageTitle);
        if (response?.metaDesc) parts.push(response.metaDesc);
        if (response?.pageText) parts.push(response.pageText);
        const pageContent = parts.join('\n\n');

        if (response?.selectedText) {
          setContext((prev) => ({
            ...prev,
            selected_text: response.selectedText,
            page_content: pageContent || undefined,
          }));
          showContextTooltip('Page content and selected text attached.');
        } else if (pageContent) {
          setContext((prev) => ({
            ...prev,
            page_content: pageContent,
          }));
          showContextTooltip('Page content attached. Tip: highlight text for more targeted context.');
        } else {
          showContextTooltip('Page URL attached.');
        }
      };

      // Request full page context from content script
      const requestPageContext = () => {
        chrome.tabs.sendMessage(tab.id!, { type: 'GET_PAGE_CONTEXT' }, (response) => {
          if (chrome.runtime.lastError) {
            showContextTooltip('Page URL attached. Could not read page content.');
            return;
          }
          handlePageContext(response);
        });
      };

      // First attempt — if content script is already loaded
      chrome.tabs.sendMessage(tab.id!, { type: 'GET_PAGE_CONTEXT' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded — try to inject it
          chrome.scripting.executeScript(
            { target: { tabId: tab.id! }, files: ['content-script.js'] },
            () => {
              if (chrome.runtime.lastError) {
                showContextTooltip('Page URL attached. Content capture isn\'t available on this page.');
                return;
              }
              setTimeout(requestPageContext, 100);
            },
          );
          return;
        }
        handlePageContext(response);
      });
    });
  }, [showContextTooltip]);

  const sendMessage = async () => {
    if (!input.trim() || streaming || !connected) return;

    const messageText = input.trim();
    const hasContext =
      context.page_url ||
      context.page_content ||
      context.selected_text ||
      context.document_ids?.length ||
      context.recording_ids?.length;

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
      context: hasContext
        ? {
            page_url: context.page_url,
            selected_text: context.selected_text,
            document_ids: context.document_ids,
            recording_ids: context.recording_ids,
          }
        : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setStreaming(true);

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // Fetch actual content for attached documents and recordings
      let documentsContent = '';
      if (context.document_ids?.length) {
        const contentParts: string[] = [];
        for (let i = 0; i < context.document_ids.length; i++) {
          const docId = context.document_ids[i];
          const docName = context.document_names?.[i] || 'Document';
          try {
            const text = await getDocumentContent(docId);
            if (text) {
              contentParts.push(`[${docName}]:\n${text}`);
            }
          } catch {
            // ignore
          }
        }
        if (contentParts.length > 0) {
          documentsContent = contentParts.join('\n\n---\n\n');
        }
      }

      if (context.recording_ids?.length) {
        const transcriptParts: string[] = [];
        for (let i = 0; i < context.recording_ids.length; i++) {
          const recId = context.recording_ids[i];
          const recName = context.recording_names?.[i] || 'Recording';
          try {
            const text = await getRecordingTranscript(recId);
            if (text) {
              transcriptParts.push(`[${recName} - Transcript]:\n${text}`);
            }
          } catch {
            // ignore
          }
        }
        if (transcriptParts.length > 0) {
          documentsContent += (documentsContent ? '\n\n---\n\n' : '') + transcriptParts.join('\n\n---\n\n');
        }
      }

      // Prepend page content if captured via Globe button
      if (context.page_content) {
        const pageLabel = context.page_url ? `[Page: ${context.page_url}]` : '[Page Content]';
        documentsContent = `${pageLabel}:\n${context.page_content}` +
          (documentsContent ? '\n\n---\n\n' + documentsContent : '');
      }

      const hasMultiDocs =
        context.document_ids && context.document_ids.length > 1;

      const onChunk = (text: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + text,
          };
          return updated;
        });
      };

      if (hasMultiDocs) {
        await streamMultiChat(
          messageText,
          context.document_ids!,
          onChunk,
          abort.signal,
        );
      } else {
        await streamChat(
          messageText,
          {
            page_url: context.page_url,
            selected_text: context.selected_text,
            document_ids: context.document_ids,
            recording_ids: context.recording_ids,
            documents_content: documentsContent || undefined,
          },
          onChunk,
          abort.signal,
        );
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content:
              updated[updated.length - 1].content ||
              'Sorry, I encountered an error. Please try again.',
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleSave = async () => {
    if (messages.length === 0) return;
    try {
      const title =
        messages[0].content.slice(0, 50) +
        (messages[0].content.length > 50 ? '...' : '');
      await saveConversation({
        title,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
    } catch {
      // ignore
    }
  };

  const loadConversations = async () => {
    try {
      const convs = await listConversations();
      setConversations(convs);
      setShowConversations(true);
    } catch {
      // ignore
    }
  };

  const loadConversation = (conv: Conversation) => {
    setMessages(conv.messages);
    setShowConversations(false);
  };

  const newConversation = () => {
    setMessages([]);
    setContext({});
    setShowConversations(false);
  };

  const removeContext = (key: keyof AttachedContext) => {
    setContext((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const doc = await uploadDocument(file, file.name);
        if (doc?.id) {
          setContext((prev) => ({
            ...prev,
            document_ids: [...(prev.document_ids || []), doc.id],
            document_names: [
              ...(prev.document_names || []),
              doc.title || doc.name || doc.filename || file.name,
            ],
          }));
        }
      }
    } catch {
      // ignore upload errors
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-verbatim-500" />
          <span className="text-sm font-semibold">Chat with Max</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={newConversation}
            className="btn-ghost p-1.5 rounded-lg"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            className="btn-ghost p-1.5 rounded-lg"
            title="Save conversation"
            disabled={messages.length === 0}
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={loadConversations}
            className="btn-ghost p-1.5 rounded-lg"
            title="Load conversation"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <ConnectionBadge connected={connected} />
        </div>
      </div>

      {/* Conversation list overlay */}
      {showConversations && (
        <div className="absolute inset-0 bg-white dark:bg-gray-900 z-10 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">Saved Conversations</span>
            <button
              onClick={() => setShowConversations(false)}
              className="btn-ghost p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-8">
                No saved conversations
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="text-sm font-medium truncate">{conv.title}</div>
                  <div className="text-xs text-gray-500">
                    {conv.messages.length} messages
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-verbatim-100 dark:bg-verbatim-900/30 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-verbatim-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Hi! I'm Max, your AI assistant.
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-[240px]">
              Ask me anything about your transcripts, documents, or any topic. Attach
              context from the current page for more relevant answers.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Context chips */}
      {(context.page_url || context.page_content || context.selected_text || context.document_ids?.length || context.recording_ids?.length) && (
        <div className="px-4 py-2 border-t flex flex-wrap gap-1.5">
          {context.page_url && (
            <ContextChip
              icon={<Globe className="w-3 h-3" />}
              label={context.page_content ? 'Page Content' : 'Page URL'}
              onRemove={() => {
                setContext((prev) => {
                  const next = { ...prev };
                  delete next.page_url;
                  delete next.page_content;
                  return next;
                });
              }}
            />
          )}
          {context.selected_text && (
            <ContextChip
              icon={<Type className="w-3 h-3" />}
              label={`"${context.selected_text.slice(0, 20)}..."`}
              onRemove={() => removeContext('selected_text')}
            />
          )}
          {context.document_names?.map((name, i) => (
            <ContextChip
              key={`doc-${i}`}
              icon={<FileText className="w-3 h-3" />}
              label={name}
              onRemove={() => {
                setContext((prev) => ({
                  ...prev,
                  document_ids: prev.document_ids?.filter((_, j) => j !== i),
                  document_names: prev.document_names?.filter((_, j) => j !== i),
                }));
              }}
            />
          ))}
          {context.recording_names?.map((name, i) => (
            <ContextChip
              key={`rec-${i}`}
              icon={<Mic className="w-3 h-3" />}
              label={name}
              onRemove={() => {
                setContext((prev) => ({
                  ...prev,
                  recording_ids: prev.recording_ids?.filter((_, j) => j !== i),
                  recording_names: prev.recording_names?.filter((_, j) => j !== i),
                }));
              }}
            />
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t flex-shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex gap-1 relative">
            <button
              onClick={attachPageContext}
              className="btn-ghost p-1.5 rounded-lg text-gray-400 hover:text-verbatim-500"
              title="Capture current page URL & selected text as context for Max"
            >
              <Globe className="w-4 h-4" />
            </button>
            {contextTooltip && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-50 animate-in fade-in">
                {contextTooltip}
              </div>
            )}
            <button
              onClick={() => setShowContextPicker(!showContextPicker)}
              className="btn-ghost p-1.5 rounded-lg text-gray-400 hover:text-verbatim-500"
              title="Attach documents/recordings"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`btn-ghost p-1.5 rounded-lg text-gray-400 hover:text-verbatim-500 ${uploading ? 'animate-pulse' : ''}`}
              title="Upload file from computer"
              disabled={uploading}
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <textarea
            ref={inputRef}
            className="input flex-1 resize-none min-h-[40px] max-h-[120px]"
            placeholder={connected ? 'Message Max...' : 'Connect to Verbatim to chat'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected}
            rows={1}
          />
          {streaming ? (
            <button
              onClick={stopStreaming}
              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              className="btn-primary p-2"
              disabled={!input.trim() || !connected}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Context picker overlay */}
      {showContextPicker && (
        <ContextPicker
          onClose={() => setShowContextPicker(false)}
          onAttach={(docs, recs) => {
            setContext((prev) => ({
              ...prev,
              document_ids: [
                ...(prev.document_ids || []),
                ...docs.map((d) => d.id),
              ],
              document_names: [
                ...(prev.document_names || []),
                ...docs.map((d) => d.title || d.name || d.filename || 'Untitled'),
              ],
              recording_ids: [
                ...(prev.recording_ids || []),
                ...recs.map((r) => r.id),
              ],
              recording_names: [
                ...(prev.recording_names || []),
                ...recs.map((r) => r.title || r.name || r.filename || 'Untitled'),
              ],
            }));
            setShowContextPicker(false);
          }}
        />
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-verbatim-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
      >
        {!isUser && (
          <div className="text-xs font-semibold text-verbatim-500 mb-1">Max</div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        {message.content === '' && (
          <Loader className="w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>
    </div>
  );
}

function ContextChip({
  icon,
  label,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 text-xs">
      {icon}
      <span className="truncate max-w-[100px]">{label}</span>
      <button onClick={onRemove} className="text-gray-400 hover:text-gray-600">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function ContextPicker({
  onClose,
  onAttach,
}: {
  onClose: () => void;
  onAttach: (docs: Document[], recs: Recording[]) => void;
}) {
  const [tab, setTab] = useState<'documents' | 'recordings'>('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Document[]>([]);
  const [selectedRecs, setSelectedRecs] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listDocuments(), listRecordings()])
      .then(([docs, recs]) => {
        setDocuments(docs);
        setRecordings(recs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleDoc = (doc: Document) => {
    setSelectedDocs((prev) =>
      prev.find((d) => d.id === doc.id)
        ? prev.filter((d) => d.id !== doc.id)
        : [...prev, doc],
    );
  };

  const toggleRec = (rec: Recording) => {
    setSelectedRecs((prev) =>
      prev.find((r) => r.id === rec.id)
        ? prev.filter((r) => r.id !== rec.id)
        : [...prev, rec],
    );
  };

  return (
    <div className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-900 border-t shadow-lg max-h-[50vh] flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('documents')}
            className={`text-xs font-medium px-2 py-1 rounded ${
              tab === 'documents'
                ? 'bg-verbatim-100 text-verbatim-700 dark:bg-verbatim-900/30 dark:text-verbatim-400'
                : 'text-gray-500'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setTab('recordings')}
            className={`text-xs font-medium px-2 py-1 rounded ${
              tab === 'recordings'
                ? 'bg-verbatim-100 text-verbatim-700 dark:bg-verbatim-900/30 dark:text-verbatim-400'
                : 'text-gray-500'
            }`}
          >
            Recordings
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAttach(selectedDocs, selectedRecs)}
            className="btn-primary text-xs py-1 px-2"
            disabled={selectedDocs.length === 0 && selectedRecs.length === 0}
          >
            Attach ({selectedDocs.length + selectedRecs.length})
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-center py-4 text-sm text-gray-500">Loading...</div>
        ) : tab === 'documents' ? (
          documents.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-500">
              No documents found
            </div>
          ) : (
            documents.map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!!selectedDocs.find((d) => d.id === doc.id)}
                  onChange={() => toggleDoc(doc)}
                  className="rounded"
                />
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm truncate">{doc.title || doc.name || doc.filename || 'Untitled'}</span>
              </label>
            ))
          )
        ) : recordings.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No recordings found
          </div>
        ) : (
          recordings.map((rec) => (
            <label
              key={rec.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!!selectedRecs.find((r) => r.id === rec.id)}
                onChange={() => toggleRec(rec)}
                className="rounded"
              />
              <Mic className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm truncate">{rec.title || rec.name || rec.filename || 'Untitled'}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
