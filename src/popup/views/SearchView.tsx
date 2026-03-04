import React, { useState, useCallback } from 'react';
import { Search, FileText, Mic, StickyNote, ToggleLeft, ToggleRight } from 'lucide-react';
import { search } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';
import { formatRelativeTime, truncate } from '@/lib/utils';
import type { SearchResult } from '@/types';

interface SearchViewProps {
  connected: boolean;
}

export function SearchView({ connected }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'keyword' | 'semantic'>('keyword');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const data = await search(query.trim(), mode);
      setResults(data.results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query, mode]);

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

  // Group results by type
  const grouped = results.reduce(
    (acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
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

      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode(mode === 'keyword' ? 'semantic' : 'keyword')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {mode === 'semantic' ? (
            <ToggleRight className="w-4 h-4 text-verbatim-500" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {mode === 'semantic' ? 'Semantic search' : 'Keyword search'}
        </button>
      </div>

      {searching && (
        <div className="text-center py-4 text-sm text-gray-500">Searching...</div>
      )}

      {searched && !searching && results.length === 0 && (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="No results"
          description="Try a different search term or mode"
        />
      )}

      {!searching && Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <TypeIcon type={type} />
            {type === 'recording' ? 'Recordings' : type === 'document' ? 'Documents' : 'Notes'}
            <span className="text-gray-400">({items.length})</span>
          </div>
          <div className="space-y-1.5">
            {items.map((result) => (
              <div
                key={result.id}
                className="card p-3 hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="text-sm font-medium">{result.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {truncate(result.snippet, 120)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatRelativeTime(result.created_at)}
                  {result.score !== undefined && (
                    <span className="ml-2">Score: {result.score.toFixed(2)}</span>
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

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'recording':
      return <Mic className="w-3 h-3" />;
    case 'document':
      return <FileText className="w-3 h-3" />;
    default:
      return <StickyNote className="w-3 h-3" />;
  }
}
