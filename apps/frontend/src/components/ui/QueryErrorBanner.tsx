import { useState } from 'react';
import { humanizeQueryError } from '../../engine/runtimeUtils';

interface QueryErrorBannerProps {
  queryName: string;
  error: string;
  onRetry: () => Promise<void> | void;
  compact?: boolean;
}

export default function QueryErrorBanner({ queryName, error, onRetry, compact = false }: QueryErrorBannerProps) {
  const [retrying, setRetrying] = useState(false);
  const message = humanizeQueryError(error);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={`query-error-banner${compact ? ' compact' : ''}`} role="alert" aria-label={`Query error for ${queryName}`}>
      <div className="query-error-banner-icon">⚠</div>
      <div className="query-error-banner-copy">
        <div className="query-error-banner-title">{compact ? 'Error' : 'Failed to load data'}</div>
        {!compact ? <div className="query-error-banner-message">{message}</div> : null}
      </div>
      <button className="query-error-banner-retry" onClick={() => void handleRetry()} disabled={retrying}>
        {retrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
}
