import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, Film, X, CheckCircle } from 'lucide-react';
import { ProjectSelect } from '@/components/ProjectSelect';
import { ProgressBar } from '@/components/ProgressBar';
import { uploadDocument, uploadRecording, triggerOcr } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/ogg',
  'audio/webm',
  'audio/x-m4a',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

interface UploadViewProps {
  connected: boolean;
}

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export function UploadView({ connected }: UploadViewProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [projectId, setProjectId] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [runOcr, setRunOcr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAll = async () => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'pending') continue;

      setItems((prev) => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'uploading', progress: 50 };
        return updated;
      });

      try {
        const file = items[i].file;
        const isAudioVideo =
          file.type.startsWith('audio/') || file.type.startsWith('video/');

        if (isAudioVideo) {
          await uploadRecording(file, file.name, projectId || undefined);
        } else {
          const doc = await uploadDocument(file, file.name, projectId || undefined);
          if (runOcr && file.type.startsWith('image/') && doc?.id) {
            triggerOcr(doc.id).catch(() => {});
          }
        }

        setItems((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: 'done', progress: 100 };
          return updated;
        });
      } catch (err) {
        setItems((prev) => {
          const updated = [...prev];
          updated[i] = {
            ...updated[i],
            status: 'error',
            error: 'Upload failed',
          };
          return updated;
        });
      }
    }
  };

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  if (!connected) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Connect to Verbatim Studio to upload files
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Upload className="w-4 h-4 text-verbatim-500" />
        Upload Files
      </h2>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-verbatim-500 bg-verbatim-50 dark:bg-verbatim-900/10'
            : 'border-gray-300 dark:border-gray-600 hover:border-verbatim-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PDF, DOCX, XLSX, PPTX, images, audio, video
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Project selection & OCR */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
              Assign to project (optional)
            </label>
            <ProjectSelect value={projectId} onChange={setProjectId} />
          </div>
          {items.some((item) => item.file.type.startsWith('image/')) && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={runOcr}
                onChange={(e) => setRunOcr(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Run OCR on images
              </span>
            </label>
          )}
        </div>
      )}

      {/* File list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="card p-3 flex items-center gap-3">
              <FileIcon type={item.file.type} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.file.name}</div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(item.file.size)}
                  {item.error && (
                    <span className="text-red-500 ml-2">{item.error}</span>
                  )}
                </div>
                {item.status === 'uploading' && (
                  <ProgressBar progress={item.progress} className="mt-1" />
                )}
              </div>
              {item.status === 'done' ? (
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <button
                  onClick={() => removeItem(i)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <button className="btn-primary w-full text-sm" onClick={uploadAll}>
          Upload {pendingCount} file{pendingCount > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith('image/'))
    return <Image className="w-5 h-5 text-purple-500 flex-shrink-0" />;
  if (type.startsWith('audio/') || type.startsWith('video/'))
    return <Film className="w-5 h-5 text-blue-500 flex-shrink-0" />;
  return <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />;
}
