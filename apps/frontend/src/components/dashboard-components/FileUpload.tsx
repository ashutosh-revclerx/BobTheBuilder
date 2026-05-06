import { useMemo, useRef, useState } from 'react';
import type { ComponentConfig } from '../../types/template';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

interface FileUploadProps {
  config: ComponentConfig;
}

interface UploadedFile {
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
}

const API_BASE = 'http://localhost:3001';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({ config }: FileUploadProps) {
  const { style, data, label } = config;
  const setComponentState = useEditorStore((s) => s.setComponentState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const bg = useMemo(
    () => resolveBackground(style),
    [style.backgroundColor, style.backgroundGradient],
  );

  // Configurable from the data tab.
  const accept = ((data as any).accept as string) || '.xlsx,.xls,.csv,.pdf,.docx,.txt';
  const multiple = ((data as any).multiple as boolean) ?? true;
  const uploadUrl = ((data as any).uploadUrl as string) || ''; // resource endpoint URL
  const fieldName = ((data as any).fieldName as string) || 'file';
  const resourceId = ((data as any).resourceId as string) || '';
  const endpointPath = ((data as any).endpointPath as string) || '';

  const uploadOne = async (file: File): Promise<UploadedFile> => {
    const form = new FormData();
    form.append(fieldName, file);

    try {
      // If a direct upload URL is provided, hit it directly. Otherwise route
      // through the BTB execute endpoint with multipart support.
      const target = uploadUrl
        ? uploadUrl
        : `${API_BASE}/api/execute/upload`;

      const headers: Record<string, string> = {};
      if (!uploadUrl && resourceId) {
        headers['x-btb-resource-id'] = resourceId;
        headers['x-btb-endpoint-path'] = endpointPath;
      }

      const res = await fetch(target, {
        method: 'POST',
        body: form,
        headers,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return { name: file.name, size: file.size, status: 'error', message: txt.slice(0, 120) || `HTTP ${res.status}` };
      }
      const payload = await res.json().catch(() => ({}));
      // Stash the most recent upload result so other components can react.
      setComponentState(config.id, 'lastUpload', { file: file.name, response: payload });
      return { name: file.name, size: file.size, status: 'success' };
    } catch (err) {
      return { name: file.name, size: file.size, status: 'error', message: (err as Error).message };
    }
  };

  const handleFiles = async (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);
    const initial: UploadedFile[] = list.map((f) => ({
      name: f.name,
      size: f.size,
      status: 'uploading',
    }));
    setFiles((prev) => [...prev, ...initial]);

    const results = await Promise.all(list.map((f) => uploadOne(f)));
    setFiles((prev) => {
      const next = [...prev];
      // Replace the just-added "uploading" entries with their results
      results.forEach((r, i) => {
        next[next.length - results.length + i] = r;
      });
      return next;
    });
    setComponentState(config.id, 'uploadedFiles', results.filter((r) => r.status === 'success').map((r) => r.name));
  };

  const accent = style.borderColor || '#0ea5e9';
  const txt = style.textColor || '#0f172a';

  return (
    <div
      className="fileupload-component"
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : '12px',
        border: `2px dashed ${isDragging ? accent : (style.borderColor || '#cbd5e1')}`,
        padding: `${style.padding ?? 16}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 6,
          cursor: 'pointer',
          minHeight: 80,
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div style={{ fontSize: 32, lineHeight: 1 }}>📁</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: txt }}>
          {label || 'Upload files'}
        </div>
        <div style={{ fontSize: 12, color: txt, opacity: 0.7 }}>
          Drag &amp; drop or <span style={{ color: accent, fontWeight: 600 }}>click to browse</span>
        </div>
        <div style={{ fontSize: 11, color: txt, opacity: 0.55 }}>
          Accepts: {accept}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => void handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </div>

      {files.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 120,
            overflowY: 'auto',
            paddingTop: 8,
            borderTop: `1px solid ${style.borderColor || '#e2e8f0'}`,
          }}
        >
          {files.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                padding: '4px 8px',
                background: f.status === 'success' ? '#dcfce7' : f.status === 'error' ? '#fee2e2' : '#f1f5f9',
                borderRadius: 6,
                color: '#0f172a',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {f.status === 'success' ? '✓' : f.status === 'error' ? '✗' : '⌛'} {f.name}
              </span>
              <span style={{ opacity: 0.6, marginLeft: 8 }}>{humanSize(f.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
