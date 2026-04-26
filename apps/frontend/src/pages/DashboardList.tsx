import { useEffect, useMemo, useState } from 'react';
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Updated ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export default function DashboardList() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

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
    setDeletingId(dashboardId);
    try {
      const response = await fetch(`${API_BASE}/api/dashboards/${dashboardId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setRemovingIds((current) => [...current, dashboardId]);
      window.setTimeout(() => {
        setDashboards((current) => current.filter((dashboard) => dashboard.id !== dashboardId));
        setCustomers((current) => current.filter((customer) => customer.dashboard_id !== dashboardId));
        setRemovingIds((current) => current.filter((id) => id !== dashboardId));
      }, 180);
      setToastMessage('Dashboard deleted');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="dashboard-list-page">
      <header className="dashboard-list-header">
        <div className="gallery-logo">
          <div className="gallery-logo-icon">D</div>
          <span className="gallery-logo-text">Dashboard Platform</span>
        </div>
        <button className="btn-topbar primary" onClick={() => void handleCreateDashboard()} disabled={creating}>
          {creating ? <span className="spinner dashboard-list-button-spinner" /> : null}
          <span>{creating ? 'Creating...' : 'New Dashboard'}</span>
        </button>
      </header>

      <main className="dashboard-list-content">
        {loading ? (
          <div className="dashboard-list-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="dashboard-card dashboard-card-skeleton">
                <div className="skeleton dashboard-card-skeleton-title" />
                <div className="skeleton dashboard-card-skeleton-badge" />
                <div className="skeleton dashboard-card-skeleton-line" />
                <div className="skeleton dashboard-card-skeleton-line short" />
                <div className="dashboard-card-actions">
                  <div className="skeleton dashboard-card-skeleton-button" />
                  <div className="skeleton dashboard-card-skeleton-button" />
                </div>
              </div>
            ))}
          </div>
        ) : dashboards.length === 0 ? (
          <div className="dashboard-list-empty">
            <svg viewBox="0 0 120 120" className="dashboard-list-empty-icon" aria-hidden="true">
              <rect x="20" y="26" width="80" height="68" rx="16" />
              <rect x="34" y="42" width="20" height="36" rx="6" />
              <rect x="60" y="52" width="26" height="10" rx="5" />
              <rect x="60" y="68" width="18" height="10" rx="5" />
            </svg>
            <h1>No dashboards yet</h1>
            <p>Create your first dashboard to get started</p>
            <button className="btn-topbar primary dashboard-list-empty-button" onClick={() => void handleCreateDashboard()} disabled={creating}>
              {creating ? 'Creating...' : 'Create Dashboard'}
            </button>
          </div>
        ) : (
          <div className="dashboard-list-grid">
            {dashboards.map((dashboard) => {
              const assignedCustomer = customerByDashboardId[dashboard.id];
              const isConfirming = confirmDeleteId === dashboard.id;
              const isRemoving = removingIds.includes(dashboard.id);
              return (
                <article key={dashboard.id} className={`dashboard-card${isRemoving ? ' dashboard-card-removing' : ''}`}>
                  <div className="dashboard-card-header">
                    <h2>{dashboard.name}</h2>
                    <span className={`dashboard-card-status ${dashboard.status}`}>{dashboard.status}</span>
                  </div>
                  <div className="dashboard-card-meta">Created {formatDate(dashboard.created_at)}</div>
                  <div className="dashboard-card-meta">{formatRelativeTime(dashboard.updated_at)}</div>
                  <div className="dashboard-card-customer">{assignedCustomer?.name || 'Unassigned'}</div>
                  <div className="dashboard-card-actions">
                    <button className="btn-topbar" onClick={() => navigate(`/builder/${dashboard.id}`)}>
                      Edit
                    </button>
                    <div className="dashboard-card-delete">
                      {isConfirming ? (
                        <div className="dashboard-card-delete-confirm">
                          <span>Sure?</span>
                          <button className="btn-topbar" onClick={() => void handleDeleteDashboard(dashboard.id)} disabled={deletingId === dashboard.id}>
                            {deletingId === dashboard.id ? 'Deleting...' : 'Yes'}
                          </button>
                          <button className="btn-topbar" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="btn-topbar danger-text" onClick={() => setConfirmDeleteId(dashboard.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {toastMessage ? <div className="dashboard-list-toast">{toastMessage}</div> : null}
    </div>
  );
}
