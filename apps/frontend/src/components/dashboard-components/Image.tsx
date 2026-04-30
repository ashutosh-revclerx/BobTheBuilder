import type { ComponentConfig } from '../../types/template';
import { resolveBackground } from '../../utils/styleUtils';

interface ImageProps {
  config: ComponentConfig;
}

/**
 * Image component. The src can come from two places (`data` field):
 *   - data.src        — a URL pasted by the engineer (preferred)
 *   - data.uploadedSrc — a base64 data-URL from the file uploader (size-capped
 *                        in DataTab; lives in the dashboard config JSON itself)
 *
 * Resolution order: uploadedSrc → src → mockValue → empty placeholder.
 */
export default function Image({ config }: ImageProps) {
  const { style, data, label } = config;

  const src =
    (typeof data.uploadedSrc === 'string' && data.uploadedSrc) ||
    (typeof data.src === 'string' && data.src) ||
    (typeof data.mockValue === 'string' && data.mockValue) ||
    '';

  const altText = data.alt ?? label ?? 'Image';
  const fit = (data.fit ?? 'contain') as 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  const linkTo = data.linkTo as string | undefined;

  const wrapperStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: resolveBackground(style),
    color: style.textColor,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    border: style.borderWidth
      ? `${style.borderWidth}px solid ${style.borderColor || '#e5e7eb'}`
      : undefined,
    padding: `${style.padding ?? 0}px`,
    overflow: 'hidden',
    cursor: linkTo ? 'pointer' : 'default',
  };

  const imgStyle: React.CSSProperties = {
    maxWidth: '100%',
    maxHeight: '100%',
    width: fit === 'cover' || fit === 'fill' ? '100%' : 'auto',
    height: fit === 'cover' || fit === 'fill' ? '100%' : 'auto',
    objectFit: fit,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    display: 'block',
  };

  const handleClick = () => {
    if (linkTo) window.open(linkTo, '_blank', 'noopener,noreferrer');
  };

  if (!src) {
    return (
      <div className="image-component image-component--empty" style={wrapperStyle}>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🖼️</div>
          <div>Paste an image URL or upload a file in the Data tab</div>
        </div>
      </div>
    );
  }

  return (
    <div className="image-component" style={wrapperStyle} onClick={handleClick}>
      <img src={src} alt={altText} style={imgStyle} loading="lazy" />
    </div>
  );
}
