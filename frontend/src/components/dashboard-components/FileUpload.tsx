import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentConfig } from '../../types/template';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';
import { API_BASE_URL, apiFetch } from '../../config/api';

interface FileUploadProps {
  config: ComponentConfig;
}

interface UploadedFile {
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
}

interface UploadSuccess {
  results: UploadedFile[];
  sessionId?: string;
  payload?: unknown;
}

interface ProgressState {
  active:    boolean;
  percent:   number;        // 0..100
  status:    string;        // human label
  done:      boolean;
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 60; // 2 minutes max

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Best-effort extraction across common progress-API response shapes.
function readProgress(payload: unknown): { percent: number; status: string; done: boolean } {
  const inner =
    payload && typeof payload === 'object' && 'data' in payload
      ? (payload as any).data
      : payload;
  if (!inner || typeof inner !== 'object') {
    return { percent: 0, status: 'processing', done: false };
  }
  const obj = inner as Record<string, unknown>;
  const pct = Number(obj.percent ?? obj.progress ?? obj.completion ?? 0);
  const status = String(obj.status ?? obj.state ?? obj.message ?? 'processing');
  const explicitDone =
    obj.done === true ||
    obj.complete === true ||
    obj.completed === true ||
    /(complete|done|success|ready|finished)/i.test(status);
  return {
    percent: Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0,
    status,
    done: explicitDone || pct >= 100,
  };
}

export default function FileUpload({ config }: FileUploadProps) {
  const { style, data, label } = config;
  const setComponentState = useEditorStore((s) => s.setComponentState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    active: false,
    percent: 0,
    status: '',
    done: false,
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const bg = useMemo(
    () => resolveBackground(style),
    [style.backgroundColor, style.backgroundGradient],
  );

  // Configurable from the data tab.
  const accept = ((data as any).accept as string) || '.xlsx,.xls,.csv,.pdf,.docx,.txt';
  const multiple = ((data as any).multiple as boolean) ?? true;
  const uploadUrl = ((data as any).uploadUrl as string) || '';
  const fieldName = ((data as any).fieldName as string) || 'file';
  const resourceId = ((data as any).resourceId as string) || '';
  const resourceName = ((data as any).resourceName as string) || '';
  const endpointPath = ((data as any).endpointPath as string) || '';
  // Optional polling endpoint pattern. Use {session_id} as placeholder.
  const progressEndpointTemplate = ((data as any).progressEndpoint as string) || '';

  const uploadBatch = async (selectedFiles: File[]): Promise<UploadSuccess> => {
    const form = new FormData();
    selectedFiles.forEach((file) => form.append(fieldName, file));

    try {
      const target = uploadUrl ? uploadUrl : `${API_BASE_URL}/execute/upload`;
      const headers: Record<string, string> = {};
      const customerToken = window.location.pathname.startsWith('/customer/')
        ? new URLSearchParams(window.location.search).get('token')
        : null;
      const dashboardId = useEditorStore.getState().activeTemplateId;
      if (!uploadUrl) {
        if (resourceId)   headers['x-btb-resource-id']   = resourceId;
        if (resourceName) headers['x-btb-resource-name'] = resourceName;
        if (endpointPath) headers['x-btb-endpoint-path'] = endpointPath;
        if (fieldName)    headers['x-btb-field-name']    = fieldName;
        if (customerToken) headers['x-dashboard-token'] = customerToken;
        if (dashboardId)   headers['x-btb-dashboard-id'] = dashboardId;
      }

      const res = uploadUrl
        ? await fetch(target, { method: 'POST', body: form, headers })
        : await apiFetch(target, { method: 'POST', body: form, headers });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return {
          results: selectedFiles.map((file) => ({
            name: file.name,
            size: file.size,
            status: 'error',
            message: txt.slice(0, 120) || `HTTP ${res.status}`,
          })),
        };
      }
      const payload = await res.json().catch(() => ({}));
      setComponentState(config.id, 'lastUpload', { files: selectedFiles.map((file) => file.name), response: payload });

      const inner =
        payload && typeof payload === 'object' && 'data' in payload
          ? (payload as any).data
          : payload;
      const sid =
        inner && typeof inner === 'object'
          ? ((inner.session_id ?? inner.sessionId ?? inner.id) as string | undefined)
          : undefined;

      return {
        results: selectedFiles.map((file) => ({ name: file.name, size: file.size, status: 'success' })),
        sessionId: sid,
        payload: inner,
      };
    } catch (err) {
      return {
        results: selectedFiles.map((file) => ({
          name: file.name,
          size: file.size,
          status: 'error',
          message: (err as Error).message,
        })),
      };
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

    const uploadResult = await uploadBatch(list);
    setFiles((prev) => {
      const next = [...prev];
      uploadResult.results.forEach((result, i) => {
        next[next.length - uploadResult.results.length + i] = result;
      });
      return next;
    });

    // The session_id is shared across all files in the upload — pick the
    // first non-empty one.
    const sid = uploadResult.sessionId;
    const uploadPayload = uploadResult.payload;
    const uploadObject = uploadPayload && typeof uploadPayload === 'object'
      ? uploadPayload as Record<string, unknown>
      : null;

    if (uploadPayload != null) {
      setComponentState(config.id, 'uploadResponse', uploadPayload);
    }
    if (Array.isArray(uploadObject?.tables)) {
      setComponentState(config.id, 'tables', uploadObject.tables);
    }
    if (typeof uploadObject?.message === 'string') {
      setComponentState(config.id, 'message', uploadObject.message);
    }

    if (sid) {
      setComponentState(config.id, 'sessionId', sid);
      setComponentState(config.id, 'value', sid);
      const alreadyProcessed = Array.isArray(uploadObject?.tables) || !progressEndpointTemplate;
      setComponentState(config.id, 'cleaningComplete', alreadyProcessed);
      if (alreadyProcessed) {
        setComponentState(config.id, 'progressPercent', 100);
        setProgress({ active: false, percent: 100, status: 'complete', done: true });
      } else {
        setActiveSessionId(sid);
        setProgress({ active: true, percent: 0, status: 'starting', done: false });
      }
    }
    setComponentState(
      config.id,
      'uploadedFiles',
      uploadResult.results.filter((result) => result.status === 'success').map((result) => result.name),
    );
  };

  // Poll progress endpoint after upload succeeds with a session_id.
  useEffect(() => {
    if (!activeSessionId || !progressEndpointTemplate) return;
    if (progress.done) return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      while (!cancelled && attempts < POLL_MAX_ATTEMPTS) {
        attempts++;
        try {
          const path = progressEndpointTemplate.replace(
            /{session_id}|{sessionId}/g,
            activeSessionId,
          );
          const res = await apiFetch(`${API_BASE_URL}/execute`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(window.location.pathname.startsWith('/customer/')
                ? { 'x-dashboard-token': new URLSearchParams(window.location.search).get('token') || '' }
                : {}),
              ...(useEditorStore.getState().activeTemplateId
                ? { 'x-btb-dashboard-id': useEditorStore.getState().activeTemplateId || '' }
                : {}),
            },
            body: JSON.stringify({
              queryName: `${config.id}:progress`,
              resource: resourceName, // friendly name path
              endpoint: path,
              method: 'GET',
              dashboardId: useEditorStore.getState().activeTemplateId,
            }),
          });
          if (res.ok) {
            const json = await res.json();
            const result = json?.data ?? json;
            const p = readProgress(result);
            if (cancelled) return;
            setProgress({ active: true, percent: p.percent, status: p.status, done: p.done });
            if (p.done) {
              setComponentState(config.id, 'cleaningComplete', true);
              setComponentState(config.id, 'progressPercent', 100);
              return;
            }
            setComponentState(config.id, 'progressPercent', p.percent);
          }
        } catch {
          /* swallow and keep trying */
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      if (!cancelled && attempts >= POLL_MAX_ATTEMPTS) {
        setProgress((prev) => ({ ...prev, active: false, status: 'timed-out' }));
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, progressEndpointTemplate, resourceName, config.id, setComponentState, progress.done]);

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
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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

      {progress.active && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: progress.done ? '#dcfce7' : '#1e293b',
            color: progress.done ? '#065f46' : '#e2e8f0',
            fontSize: 11,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>
              {progress.done ? '✓ Cleaning complete' : `⏳ ${progress.status || 'Processing'}…`}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress.percent}%`,
                background: progress.done ? '#10b981' : accent,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 100,
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
                background:
                  f.status === 'success' ? '#dcfce7'
                  : f.status === 'error' ? '#fee2e2'
                  : '#f1f5f9',
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
