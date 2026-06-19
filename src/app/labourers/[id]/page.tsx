'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface ProjectShort {
  id: string;
  projectName: string;
  projectCode: string;
}

interface WorkItemShort {
  id: string;
  workType: string;
  workCode: string;
}

interface LabourCost {
  id: string;
  labourCode: string;
  amount: number;
  paymentDate: string;
  remarks: string | null;
  workDescription: string | null;
  project: ProjectShort;
  workItem: WorkItemShort | null;
}

interface LabourerDetail {
  id: string;
  labourCode: string;
  name: string;
  phone: string;
  address: string | null;
  skillType: string;
  joiningDate: string;
  activeStatus: boolean;
  notes: string | null;
  labourCosts: LabourCost[];
  totalPaid: number;
  projectsCount: number;
}

export default function LabourerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  
  const [labourer, setLabourer] = useState<LabourerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);

  // Edit fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [skillType, setSkillType] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [activeStatus, setActiveStatus] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const skills = ['Carpenter', 'Polisher', 'Painter', 'Helper', 'Installer'];

  useEffect(() => {
    fetchLabourerDetails();
  }, [id]);

  const fetchLabourerDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/labourers/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Labourer profile not found');
        throw new Error('Failed to load profile details');
      }
      const data = await res.json();
      setLabourer(data);

      // Populate edit states
      setName(data.name || '');
      setPhone(data.phone || '');
      setAddress(data.address || '');
      setSkillType(data.skillType || 'Carpenter');
      setJoiningDate(data.joiningDate ? data.joiningDate.split('T')[0] : '');
      setActiveStatus(data.activeStatus !== undefined ? data.activeStatus : true);
      setNotes(data.notes || '');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch(`/api/labourers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
          skillType,
          joiningDate,
          activeStatus,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update labourer details');
      alert('Labourer profile updated successfully!');
      setEditMode(false);
      fetchLabourerDetails();
    } catch (err: any) {
      alert(err.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (loading) {
    return <div className="empty-state"><p>Loading labourer workspace...</p></div>;
  }

  if (error || !labourer) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Labourer Not Found</h3>
        <p>{error || 'The requested labourer record is unavailable.'}</p>
        <Link href="/labourers" className="btn btn-secondary btn-sm" style={{ marginTop: '12px', display: 'inline-flex' }}>
          ⬅️ Back to Labourers
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Link href="/labourers" className="btn btn-secondary btn-sm">
          ⬅️ Back to Labourers
        </Link>
      </div>

      <div className="page-title-section">
        <div>
          <span className="badge badge-pending" style={{ marginBottom: '4px' }}>{labourer.labourCode}</span>
          <h1 className="page-title">{labourer.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>
            Skill: <strong>{labourer.skillType}</strong> • Status:{' '}
            <span className={`badge badge-${labourer.activeStatus ? 'completed' : 'cancelled'}`} style={{ display: 'inline-block', padding: '2px 8px' }}>
              {labourer.activeStatus ? 'Active' : 'Inactive'}
            </span>
          </p>
        </div>
        <button onClick={() => setEditMode(!editMode)} className="btn btn-secondary">
          {editMode ? '📋 View Payments' : '⚙️ Edit Profile'}
        </button>
      </div>

      {/* Metrics widgets */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-label">Total Earnings / Wages Paid</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {formatCurrency(labourer.totalPaid)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">Projects Worked On</div>
          <div className="stat-value">{labourer.projectsCount}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Phone Number</div>
          <div className="stat-value" style={{ fontSize: '1.2rem', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
            📞 {labourer.phone}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Joining Date</div>
          <div className="stat-value" style={{ fontSize: '1.2rem', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
            📅 {new Date(labourer.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>

      {editMode ? (
        /* Edit Form Workspace */
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Edit Labourer Profile Details</h3>
          <form onSubmit={handleUpdateProfile}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Skill Type *</label>
                <select
                  className="form-control"
                  value={skillType}
                  onChange={(e) => setSkillType(e.target.value)}
                >
                  {skills.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Joining Date *</label>
                <input
                  type="date"
                  className="form-control"
                  required
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-control"
                style={{ minHeight: '80px' }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
              <input
                type="checkbox"
                id="editActiveStatus"
                checked={activeStatus}
                onChange={(e) => setActiveStatus(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <label htmlFor="editActiveStatus" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Active Status</label>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '12px' }}>
              {saving ? 'Saving...' : '💾 Update Profile Details'}
            </button>
          </form>
        </div>
      ) : (
        /* Payment History Workspace */
        <div>
          {/* Notes Log */}
          {labourer.notes && (
            <div className="card" style={{ background: '#faf9f6', padding: '12px 16px', marginBottom: '24px' }}>
              <strong>Notes & Terms:</strong>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>{labourer.notes}</p>
            </div>
          )}

          <h3 style={{ marginBottom: '12px' }}>Wages Payment History ({labourer.labourCosts.length})</h3>
          {labourer.labourCosts.length === 0 ? (
            <div className="empty-state"><p>No payment entries logged for this labourer yet.</p></div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-container" style={{ display: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Date</th>
                      <th>Project</th>
                      <th>Work Item Scope</th>
                      <th>Remarks</th>
                      <th>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourer.labourCosts.map((cost) => (
                      <tr key={cost.id}>
                        <td><strong>{cost.labourCode}</strong></td>
                        <td>{new Date(cost.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <Link href={`/projects/${cost.project.id}`} style={{ fontWeight: '600', color: 'var(--primary)' }}>
                            {cost.project.projectName} ({cost.project.projectCode})
                          </Link>
                        </td>
                        <td>
                          {cost.workItem ? (
                            <span className="badge badge-pending">{cost.workItem.workType} ({cost.workItem.workCode})</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Project Level</span>
                          )}
                        </td>
                        <td>
                          <div>{cost.workDescription || '—'}</div>
                          {cost.remarks && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({cost.remarks})</div>}
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--danger)' }}>
                          {formatCurrency(Number(cost.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="mobile-list-container">
                {labourer.labourCosts.map((cost) => (
                  <div key={cost.id} className="mobile-list-card" style={{ borderLeft: '4px solid var(--danger)' }}>
                    <div className="mobile-list-header">
                      <div>
                        <div className="mobile-list-title">₹{Number(cost.amount).toLocaleString('en-IN')}</div>
                        <div className="mobile-list-subtitle">
                          {new Date(cost.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>{cost.labourCode}</span>
                    </div>
                    <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px', fontSize: '0.85rem' }}>
                      <strong>Project:</strong> {cost.project.projectName} <br />
                      <strong>Item:</strong> {cost.workItem ? `${cost.workItem.workType} (${cost.workItem.workCode})` : 'Project Level'} <br />
                      <strong>Work Done:</strong> {cost.workDescription || '—'}
                      {cost.remarks && <div><strong>Remarks:</strong> {cost.remarks}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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
