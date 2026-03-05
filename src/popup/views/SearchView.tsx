import React, { useState, useCallback } from 'react';
import { Search, FileText, Mic, StickyNote, MessageSquare, ExternalLink } from 'lucide-react';
import { search } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';
import { formatRelativeTime } from '@/lib/utils';
import type { SearchResult } from '@/types';

interface SearchViewProps {
  connected: boolean;
}

export function SearchView({ connected }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const data = await search(query.trim());
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  if (!connected) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Connect to Verbatim Studio to search
      </div>
    );
  }

  const openInApp = (result: SearchResult) => {
    let path = '';

    if (result.recording_id) {
      path = `/recordings/${result.recording_id}`;
    } else if (result.document_id) {
      path = `/documents/${result.document_id}`;
    } else if (result.conversation_id) {
      path = `/conversations/${result.conversation_id}`;
    } else if (result.note_id) {
      path = `/notes/${result.note_id}`;
    }

    if (path) {
      // Use verbatim:// custom protocol to open in the Electron desktop app
      chrome.tabs.create({ url: `verbatim:/${path}` });
    }
  };

  // Group results by type
  const grouped = results.reduce(
    (acc, r) => {
      const key = getGroupKey(r);
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Search className="w-4 h-4 text-verbatim-500" />
        Search
      </h2>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Search recordings, documents, notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button
          className="btn-primary text-sm px-3"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
        >
          {searching ? '...' : 'Go'}
        </button>
      </div>

      {searching && (
        <div className="text-center py-4 text-sm text-gray-500">Searching...</div>
      )}

      {searched && !searching && results.length === 0 && (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="No results"
          description="Try a different search term"
        />
      )}

      {!searching && Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <TypeIcon type={type} />
            {groupLabel(type)}
            <span className="text-gray-400">({items.length})</span>
          </div>
          <div className="space-y-1.5">
            {items.map((result) => (
              <div
                key={result.id}
                className="card p-3 hover:shadow-sm transition-shadow cursor-pointer group"
                onClick={() => openInApp(result)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">
                    <HighlightText
                      text={result.title || result.recording_title || result.document_title || result.conversation_title || 'Untitled'}
                      query={query}
                    />
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                {result.text && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    <HighlightText text={truncateAround(result.text, query, 150)} query={query} />
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                  {result.created_at && (
                    <span>{formatRelativeTime(result.created_at)}</span>
                  )}
                  {result.match_type && (
                    <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">
                      {result.match_type}
                    </span>
                  )}
                  {result.start_time != null && (
                    <span>
                      at {Math.floor(result.start_time / 60)}:{String(Math.floor(result.start_time % 60)).padStart(2, '0')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Truncate text centered around the first match of the query */
function truncateAround(text: string, query: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  const terms = query.trim().toLowerCase().split(/\s+/);
  const lower = text.toLowerCase();
  let firstMatch = -1;

  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1) {
      firstMatch = idx;
      break;
    }
  }

  if (firstMatch === -1) {
    return text.slice(0, maxLen) + '...';
  }

  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, firstMatch - half);
  let end = Math.min(text.length, start + maxLen);
  if (end - start < maxLen) start = Math.max(0, end - maxLen);

  let result = text.slice(start, end);
  if (start > 0) result = '...' + result;
  if (end < text.length) result = result + '...';
  return result;
}

/** Render text with query terms highlighted */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const terms = query.trim().split(/\s+/).filter(Boolean);
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function getGroupKey(r: SearchResult): string {
  if (r.type === 'segment') return 'recording';
  if (r.type === 'document_chunk') return 'document';
  if (r.note_id) return 'note';
  if (r.conversation_id) return 'conversation';
  return r.type || 'other';
}

function groupLabel(key: string): string {
  switch (key) {
    case 'recording': return 'Recordings';
    case 'document': return 'Documents';
    case 'note': return 'Notes';
    case 'conversation': return 'Conversations';
    default: return key.charAt(0).toUpperCase() + key.slice(1);
  }
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'recording':
      return <Mic className="w-3 h-3" />;
    case 'document':
      return <FileText className="w-3 h-3" />;
    case 'conversation':
      return <MessageSquare className="w-3 h-3" />;
    default:
      return <StickyNote className="w-3 h-3" />;
  }
}
