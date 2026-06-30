'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  projectCode: string;
  projectName: string;
  projectType: string | null;
  status: string;
  quotedAmount: number;
}

interface ClientDetail {
  id: string;
  clientCode: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  location: string | null;
  address: string | null;
  referredBy: string | null;
  remarks: string | null;
  totalBusinessValue: number;
  paymentStatus: string;
  projects: Project[];
  financialSummary?: {
    totalProjectValue: number;
    totalAmountReceived: number;
    outstandingAmount: number;
    profit: number;
    numberOfProjects: number;
    lastPaymentDate: string | null;
  };
}

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Edit form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    fetchClientDetails();
  }, [id]);

  const fetchClientDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${id}?t=${Date.now()}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Client not found');
        throw new Error('Failed to fetch client details');
      }
      const data = await res.json();
      setClient(data);

      // Populate edit form states
      setName(data.name || '');
      setPhone(data.phone || '');
      setAlternatePhone(data.alternatePhone || '');
      setLocation(data.location || '');
      setAddress(data.address || '');
      setReferredBy(data.referredBy || '');
      setRemarks(data.remarks || '');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setEditError('Name and Phone number are required.');
      return;
    }

    // Phone validations: Exactly 10 digits, only digits allowed.
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      setEditError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (alternatePhone.trim() && !phoneRegex.test(alternatePhone.trim())) {
      setEditError('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setEditSubmitting(true);
      setEditError('');
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          alternatePhone: alternatePhone.trim() || null,
          location: location.trim() || null,
          address: address.trim() || null,
          referredBy: referredBy.trim() || null,
          remarks: remarks.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update client');
      }

      setIsEditing(false);
      fetchClientDetails();
    } catch (err: any) {
      setEditError(err.message || 'An error occurred during update.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client? This will soft-delete their profile and all associated projects.')) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete client');
      
      router.push('/clients');
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadgeClass = (status: string) => {
    return `badge badge-${status.toLowerCase().replace(/ /g, '-')}`;
  };

  const getPaymentStatusBadge = (status: string) => {
    let bg = '#f3f4f6';
    let fg = '#4b5563';
    if (status === 'Pending') {
      bg = 'var(--warning-light)';
      fg = 'var(--warning)';
    } else if (status === 'Partially Paid') {
      bg = 'var(--info-light)';
      fg = 'var(--info)';
    } else if (status === 'Paid Full') {
      bg = 'var(--success-light)';
      fg = 'var(--success)';
    }
    return (
      <span className="badge" style={{ backgroundColor: bg, color: fg }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading client profile details...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Client Not Found</h3>
        <p>{error || 'The requested client database entry is unavailable.'}</p>
        <Link href="/clients" className="btn btn-secondary btn-sm" style={{ marginTop: '12px', display: 'inline-flex' }}>
          ⬅️ Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Link href="/clients" className="btn btn-secondary btn-sm">
          ⬅️ Back to Clients
        </Link>
      </div>

      <div className="page-title-section">
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <span className="badge badge-pending">{client.clientCode}</span>
            {getPaymentStatusBadge(client.paymentStatus)}
          </div>
          <h1 className="page-title">{client.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn btn-secondary"
          >
            {isEditing ? '❌ Cancel' : '✏️ Edit Profile'}
          </button>
          {!isEditing && (
            <button
              onClick={handleDelete}
              className="btn btn-danger"
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Edit Client Profile</h3>
          {editError && (
            <div className="card" style={{ borderColor: 'var(--danger)', background: 'var(--danger-light)', padding: '10px', marginBottom: '16px' }}>
              <p style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 'bold' }}>⚠️ {editError}</p>
            </div>
          )}
          <form onSubmit={handleUpdate}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={editSubmitting}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={editSubmitting}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Alternate Phone</label>
                <input
                  type="tel"
                  className="form-control"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  disabled={editSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label">General Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={editSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Address</label>
              <textarea
                className="form-control"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={editSubmitting}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Referred By</label>
                <input
                  type="text"
                  className="form-control"
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                  disabled={editSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Remarks / Notes</label>
                <input
                  type="text"
                  className="form-control"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={editSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={editSubmitting}
            >
              {editSubmitting ? 'Saving Updates...' : 'Save Changes'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {/* Client Details Card */}
          <div className="card">
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Client Profile</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Phone</span>
                <span className="detail-value">{client.phone}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Alternate Phone</span>
                <span className="detail-value">{client.alternatePhone || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Site/General Location</span>
                <span className="detail-value">{client.location || '—'}</span>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 3' }}>
                <span className="detail-label">Full Address</span>
                <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{client.address || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Referred By</span>
                <span className="detail-value">{client.referredBy || '—'}</span>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <span className="detail-label">Remarks / Business Notes</span>
                <span className="detail-value">{client.remarks || '—'}</span>
              </div>
            </div>
          </div>

          {/* Financial Summary Section */}
          <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Financial Summary</h3>
            <div className="stat-grid" style={{ border: 'none', padding: 0, boxShadow: 'none', margin: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <div className="stat-card" style={{ padding: '12px' }}>
                <div className="stat-label">Total Project Value</div>
                <div className="stat-value">{formatCurrency(client.financialSummary?.totalProjectValue ?? client.totalBusinessValue ?? 0)}</div>
              </div>
              <div className="stat-card" style={{ padding: '12px', borderLeft: '3px solid var(--success)' }}>
                <div className="stat-label">Total Received</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  {formatCurrency(client.financialSummary?.totalAmountReceived ?? 0)}
                </div>
              </div>
              <div className="stat-card" style={{ padding: '12px', borderLeft: client.paymentStatus === 'No Projects' ? '3px solid var(--info)' : (client.financialSummary?.outstandingAmount ?? 0) > 0 ? '3px solid var(--warning)' : '3px solid var(--success)' }}>
                <div className="stat-label">Outstanding Amount</div>
                {client.paymentStatus === 'No Projects' ? (
                  <div className="stat-value" style={{ color: 'var(--info)', fontSize: '1.1rem', fontWeight: 'bold', paddingTop: '4px' }}>
                    No Projects
                  </div>
                ) : (client.financialSummary?.outstandingAmount ?? 0) > 0 ? (
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>
                    {formatCurrency(client.financialSummary?.outstandingAmount ?? 0)}
                  </div>
                ) : (
                  <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.1rem', fontWeight: 'bold', paddingTop: '4px' }}>
                    ✅ Paid in Full
                  </div>
                )}
              </div>
              <div className="stat-card" style={{ padding: '12px', borderLeft: '3px solid var(--success)', background: 'var(--primary-light)' }}>
                <div className="stat-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Profit</div>
                <div className="stat-value" style={{ color: (client.financialSummary?.profit ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatCurrency(client.financialSummary?.profit ?? 0)}
                </div>
              </div>
              <div className="stat-card" style={{ padding: '12px' }}>
                <div className="stat-label">Number of Projects</div>
                <div className="stat-value">{client.financialSummary?.numberOfProjects ?? client.projects.length ?? 0}</div>
              </div>
            </div>
            {client.financialSummary?.lastPaymentDate && (
              <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ℹ️ Last payment received on:{' '}
                <strong>
                  {new Date(client.financialSummary.lastPaymentDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            )}
          </div>

          {/* Associated Projects Listing */}
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Projects Log ({client.projects.length})</h3>
            {client.projects.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🪵</div>
                <p>No projects registered for this client. Create one in the Projects module.</p>
                <Link href={`/projects?new=true&clientId=${client.id}`} className="btn btn-primary btn-sm" style={{ marginTop: '12px' }}>
                  ➕ New Project
                </Link>
              </div>
            ) : (
              <>
                {/* Desktop view */}
                <div className="table-container" style={{ display: 'none' }}>
                  <table style={{ display: 'table' }}>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Project Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Quoted Value</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.projects.map((project) => (
                        <tr key={project.id}>
                          <td>
                            <strong style={{ color: 'var(--primary)' }}>{project.projectCode}</strong>
                          </td>
                          <td>{project.projectName}</td>
                          <td>{project.projectType || '—'}</td>
                          <td>
                            <span className={getStatusBadgeClass(project.status)}>
                              {project.status}
                            </span>
                          </td>
                          <td>{formatCurrency(project.quotedAmount)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <Link href={`/projects/${project.id}`} className="btn btn-secondary btn-sm">
                              🪵 View Console
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view */}
                <div className="mobile-list-container">
                  {client.projects.map((project) => (
                    <div key={project.id} className="mobile-list-card" style={{ borderLeft: '3px solid var(--primary)' }}>
                      <div className="mobile-list-header">
                        <div>
                          <span className={getStatusBadgeClass(project.status)} style={{ marginBottom: '6px' }}>
                            {project.status}
                          </span>
                          <div className="mobile-list-title">{project.projectName}</div>
                          <div className="mobile-list-subtitle">{project.projectCode} • {project.projectType || 'Standard'}</div>
                        </div>
                        <Link href={`/projects/${project.id}`} className="btn btn-secondary btn-sm">
                          🪵 Open
                        </Link>
                      </div>
                      <div className="mobile-list-row" style={{ marginTop: '8px' }}>
                        <span>Quoted Amount:</span>
                        <span>{formatCurrency(project.quotedAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @media (min-width: 768px) {
          .table-container { display: block !important; }
          .mobile-list-container { display: none !important; }
        }
        @media (max-width: 767px) {
          .table-container { display: none !important; }
          .mobile-list-container { display: block !important; }
        }
      `}</style>
    </div>
  );
}
