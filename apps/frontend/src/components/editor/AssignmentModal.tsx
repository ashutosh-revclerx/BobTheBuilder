import { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';

const API_BASE = 'http://localhost:3001';

interface Customer {
  id: string;
  name: string;
  slug: string;
}

interface AssignmentModalProps {
  dashboardId?: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AssignmentModal({ dashboardId: propDashboardId, onClose, onUpdate }: AssignmentModalProps) {
  const storeDashboardId = useEditorStore((s) => s.activeTemplateId);
  const dashboardId = propDashboardId || storeDashboardId;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [assignedCustomerIds, setAssignedCustomerIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New Customer State
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [custRes, assignRes] = await Promise.all([
          fetch(`${API_BASE}/api/customers`),
          fetch(`${API_BASE}/api/dashboards/${dashboardId}/customers`)
        ]);

        const custData = await custRes.json();
        const assignData = await assignRes.json();

        setCustomers(Array.isArray(custData) ? custData : []);
        setAssignedCustomerIds(new Set(Array.isArray(assignData) ? assignData.map((c: any) => c.id) : []));
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (dashboardId) {
      fetchData();
    }
  }, [dashboardId]);

  const handleToggle = (id: string) => {
    const next = new Set(assignedCustomerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAssignedCustomerIds(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/dashboards/${dashboardId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_ids: Array.from(assignedCustomerIds) }),
      });

      if (!response.ok) throw new Error('Failed to save');
      
      onUpdate();
      onClose();
    } catch (err) {
      alert('Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newSlug) return;
    
    setIsCreatingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, slug: newSlug }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create customer');
      }

      const created = await res.json();
      setCustomers(prev => [created, ...prev]);
      
      const next = new Set(assignedCustomerIds);
      next.add(created.id);
      setAssignedCustomerIds(next);
      
      setIsCreating(false);
      setNewName('');
      setNewSlug('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreatingLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content assignment-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isCreating ? 'Create New Customer' : 'Assign to Customers'}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {isCreating ? (
            <form onSubmit={handleCreateCustomer} className="create-customer-form">
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input 
                  className="form-input"
                  type="text" 
                  value={newName} 
                  onChange={e => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(e.target.value.toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, ''));
                    }
                  }}
                  placeholder="e.g. Acme Corp"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">URL Slug</label>
                <div className="slug-input-container">
                  <span className="slug-prefix">/c/</span>
                  <input 
                    className="form-input slug-input"
                    type="text" 
                    value={newSlug} 
                    onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                    placeholder="acme-corp"
                    required
                  />
                </div>
                <p className="form-help">This will be the customer's dashboard URL</p>
              </div>
              
              <div className="form-actions-inline">
                <button type="button" className="btn-modal-secondary" onClick={() => setIsCreating(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-primary" disabled={isCreatingLoading}>
                  {isCreatingLoading ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="modal-search">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder="Search customers..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {loading ? (
                <div className="modal-loading-state">
                  <div className="spinner-small" />
                  <span>Fetching customers...</span>
                </div>
              ) : (
                <div className="customer-list-container">
                  <div className="customer-list">
                    {filteredCustomers.map(customer => (
                      <label key={customer.id} className={`customer-item ${assignedCustomerIds.has(customer.id) ? 'selected' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={assignedCustomerIds.has(customer.id)}
                          onChange={() => handleToggle(customer.id)}
                        />
                        <div className="customer-info">
                          <span className="customer-name">{customer.name}</span>
                          <span className="customer-slug">@{customer.slug}</span>
                        </div>
                        {assignedCustomerIds.has(customer.id) && <span className="check-mark">✓</span>}
                      </label>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div className="empty-state">No customers matching "{search}"</div>
                    )}
                  </div>
                  
                  <button className="btn-inline-add" onClick={() => setIsCreating(true)}>
                    + Create New Customer
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {!isCreating && (
          <div className="modal-footer">
            <button className="btn-modal-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Assignments'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
