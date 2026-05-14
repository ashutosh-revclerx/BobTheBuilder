import type { ComponentConfig } from '../../types/template';
import { resolveBackground } from '../../utils/styleUtils';

interface EmbedProps {
  config: ComponentConfig;
  readOnly?: boolean;
}

/**
 * Embed component. Renders a sandboxed iframe.
 *
 * URL conversion: when the user pastes a "human" YouTube/Vimeo URL we rewrite
 * it to the corresponding embed URL so it actually plays. Anything else is
 * used as-is — works for Loom, Figma, CodePen, public iframe-friendly pages.
 *
 * The iframe is sandboxed for safety. We allow scripts + same-origin so video
 * players work, but block forms/popups.
 */

const SANDBOX_PERMISSIONS = 'allow-scripts allow-same-origin allow-presentation';

function toEmbedUrl(raw: string): string {
  if (!raw) return '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw; // invalid URL — let the iframe surface the error
  }

  const host = url.hostname.replace(/^www\./, '');

  // YouTube — handle watch?v=, youtu.be/, /shorts/
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = url.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}`;
    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  }
  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    if (id) return `https://www.youtube.com/embed/${id}`;
  }
  if (host === 'youtube.com' && url.pathname.startsWith('/embed/')) {
    return raw; // already an embed URL
  }

  // Vimeo — vimeo.com/<id> → player.vimeo.com/video/<id>
  if (host === 'vimeo.com') {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  }

  // Loom — loom.com/share/<id> → loom.com/embed/<id>
  if (host === 'loom.com' && url.pathname.startsWith('/share/')) {
    return raw.replace('/share/', '/embed/');
  }

  return raw;
}

export default function Embed({ config, readOnly = false }: EmbedProps) {
  const { style, data, label } = config;
  const rawUrl = (data.src ?? data.mockValue ?? '') as string;
  const embedUrl = toEmbedUrl(rawUrl);

  const wrapperStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    background: resolveBackground(style),
    color: style.textColor,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    border: style.borderWidth
      ? `${style.borderWidth}px solid ${style.borderColor || '#e5e7eb'}`
      : undefined,
    padding: `${style.padding ?? 0}px`,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (!embedUrl) {
    return (
      <div className="embed-component embed-component--empty" style={wrapperStyle}>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>▶️</div>
          <div>Paste a YouTube / Vimeo / iframe-friendly URL in the Data tab</div>
        </div>
      </div>
    );
  }

  return (
    <div className="embed-component" style={wrapperStyle}>
      <iframe
        src={embedUrl}
        title={label || 'Embedded content'}
        sandbox={SANDBOX_PERMISSIONS}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
          // In the builder we disable pointer events on the iframe so clicks
          // go to the wrapper (component selection). In the customer view
          // (readOnly=true) the iframe is fully interactive so videos play.
          pointerEvents: readOnly ? 'auto' : 'none',
        }}
      />
      {!readOnly && (
        <div className="embed-component__editor-hint" aria-hidden="true">
          Preview mode only — open in customer view (or hit Preview) to play
        </div>
      )}
    </div>
  );
}
