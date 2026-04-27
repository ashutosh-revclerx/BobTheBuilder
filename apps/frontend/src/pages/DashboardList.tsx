import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:3001';

interface DashboardSummary {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'live';
  created_at: string;
  updated_at: string;
}

interface CustomerSummary {
  id: string;
  name: string;
  slug: string;
  dashboard_id: string | null;
  created_at: string;
}

/* ─── Toast system ─────────────────────────────────────────────────────────── */
type ToastType = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

let toastCounter = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev.slice(-2), { id, message, type, exiting: false }]);

    // Auto-dismiss after 3s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 200);
    }, 3000);
  }, []);

  return { toasts, push };
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/* ─── Dashboard Card ───────────────────────────────────────────────────────── */
function DashboardCard({
  dashboard,
  customer,
  index,
  mounted,
  onDelete,
  onEdit,
}: {
  dashboard: DashboardSummary;
  customer: CustomerSummary | undefined;
  index: number;
  mounted: boolean;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const delay = Math.min(index * 50, 400);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(dashboard.id);
      setRemoving(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article
      className={`dl-card ${mounted ? 'dl-card--visible' : ''} ${removing ? 'dl-card--removing' : ''}`}
      style={{ transitionDelay: mounted ? `${delay}ms` : '0ms' }}
    >
      {/* Top row — name + badge */}
      <div className="dl-card__top">
        <h2 className="dl-card__name">{dashboard.name}</h2>
        <span className={`dl-card__badge dl-card__badge--${dashboard.status}`}>
          {dashboard.status}
        </span>
      </div>

      {/* Middle — customer + time */}
      <div className="dl-card__middle">
        {customer ? (
          <span className="dl-card__customer">{customer.name}</span>
        ) : (
          <span className="dl-card__customer dl-card__customer--empty">
            No customer assigned
          </span>
        )}
        <span className="dl-card__time">{formatRelativeTime(dashboard.updated_at)}</span>
      </div>

      {/* Bottom — actions or confirm */}
      <div className="dl-card__bottom">
        {confirmDelete ? (
          <div className="dl-card__confirm">
            <span className="dl-card__confirm-text">Remove this dashboard?</span>
            <button
              className="dl-card__confirm-btn dl-card__confirm-btn--danger"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Confirm'}
            </button>
            <button
              className="dl-card__confirm-btn"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="dl-card__actions">
            <button
              className="dl-card__action dl-card__action--edit"
              onClick={() => onEdit(dashboard.id)}
            >
              Edit
            </button>
            <span className="dl-card__divider">|</span>
            <button
              className="dl-card__action dl-card__action--delete"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ─── Skeleton Card ────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="dl-card dl-card--skeleton dl-card--visible">
      <div className="dl-card__top">
        <div className="dl-skel dl-skel--name" />
        <div className="dl-skel dl-skel--badge" />
      </div>
      <div className="dl-card__middle">
        <div className="dl-skel dl-skel--customer" />
      </div>
      <div className="dl-card__bottom">
        <div className="dl-skel dl-skel--action" />
        <div className="dl-skel dl-skel--action dl-skel--action-short" />
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */
export default function DashboardList() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { toasts, push: pushToast } = useToasts();

  // Trigger the staggered entrance animation after mount
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!loading && !mountedRef.current) {
      // Small delay so the DOM paints the initial state first
      requestAnimationFrame(() => {
        setMounted(true);
        mountedRef.current = true;
      });
    }
  }, [loading]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [dashboardsResponse, customersResponse] = await Promise.all([
          fetch(`${API_BASE}/api/dashboards`),
          fetch(`${API_BASE}/api/customers`),
        ]);

        if (cancelled) return;

        let dashboardsJson: DashboardSummary[] = [];
        let customersJson: CustomerSummary[] = [];

        if (dashboardsResponse.ok) {
          const json = await dashboardsResponse.json();
          if (Array.isArray(json)) dashboardsJson = json;
        }

        if (customersResponse.ok) {
          const json = await customersResponse.json();
          if (Array.isArray(json)) customersJson = json;
        }

        setDashboards(dashboardsJson);
        setCustomers(customersJson);
      } catch (err) {
        console.error('Failed to load dashboard list data:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const customerByDashboardId = useMemo(
    () =>
      customers.reduce<Record<string, CustomerSummary>>((acc, customer) => {
        if (customer.dashboard_id) {
          acc[customer.dashboard_id] = customer;
        }
        return acc;
      }, {}),
    [customers],
  );

  const liveCount = useMemo(
    () => dashboards.filter((d) => d.status === 'live').length,
    [dashboards],
  );

  const handleCreateDashboard = async () => {
    setCreating(true);
    try {
      const response = await fetch(`${API_BASE}/api/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Untitled Dashboard',
          slug: `untitled-${Date.now()}`,
          config: { components: [], queries: [] },
          status: 'draft',
        }),
      });

      const payload = (await response.json()) as DashboardSummary;
      navigate(`/builder/${payload.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    const response = await fetch(`${API_BASE}/api/dashboards/${dashboardId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      pushToast('Failed to delete dashboard', 'error');
      throw new Error('Delete failed');
    }

    // Remove after card's exit animation
    setTimeout(() => {
      setDashboards((current) =>
        current.filter((dashboard) => dashboard.id !== dashboardId),
      );
      setCustomers((current) =>
        current.filter((customer) => customer.dashboard_id !== dashboardId),
      );
    }, 200);
    pushToast('Dashboard deleted', 'success');
  };

  return (
    <div className="dl-page">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <header className="dl-header">
        <div className="dl-header__left">
          <span className="dl-header__wordmark">BobTheBuilder</span>
          <span className="dl-header__tagline">
            Build and ship customer dashboards without writing frontend code.
          </span>
        </div>
        <button
          className="dl-header__cta"
          onClick={() => void handleCreateDashboard()}
          disabled={creating}
        >
          {creating ? (
            <span className="dl-header__cta-spinner" />
          ) : (
            '+ New Dashboard'
          )}
        </button>
      </header>

      {/* ─── Body ────────────────────────────────────────────────────── */}
      <main className="dl-body">
        {/* Section title row */}
        <div className="dl-section-row">
          <h1 className="dl-section-title">Your Dashboards</h1>
          {!loading && dashboards.length > 0 && (
            <div className="dl-stats">
              <span>{dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}</span>
              <span className="dl-stats__dot">·</span>
              <span>{customers.length} customer{customers.length !== 1 ? 's' : ''}</span>
              <span className="dl-stats__dot">·</span>
              <span>{liveCount} live</span>
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="dl-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : dashboards.length === 0 ? (
          <div className="dl-empty">
            <svg viewBox="0 0 120 120" className="dl-empty__icon" aria-hidden="true">
              <rect x="20" y="26" width="80" height="68" rx="16" />
              <rect x="34" y="42" width="20" height="36" rx="6" />
              <rect x="60" y="52" width="26" height="10" rx="5" />
              <rect x="60" y="68" width="18" height="10" rx="5" />
            </svg>
            <h2 className="dl-empty__title">No dashboards yet</h2>
            <p className="dl-empty__desc">
              Create your first dashboard to get started
            </p>
            <button
              className="dl-header__cta"
              onClick={() => void handleCreateDashboard()}
              disabled={creating}
            >
              {creating ? 'Creating…' : 'Create Dashboard'}
            </button>
          </div>
        ) : (
          <div className="dl-grid">
            {dashboards.map((dashboard, index) => (
              <DashboardCard
                key={dashboard.id}
                dashboard={dashboard}
                customer={customerByDashboardId[dashboard.id]}
                index={index}
                mounted={mounted}
                onDelete={handleDeleteDashboard}
                onEdit={(id) => navigate(`/builder/${id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ─── Toast Stack ─────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="dl-toast-stack">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`dl-toast dl-toast--${toast.type} ${toast.exiting ? 'dl-toast--exit' : ''}`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
