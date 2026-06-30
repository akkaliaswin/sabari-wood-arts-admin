'use client';

import { useState, useEffect, use, useCallback } from 'react';
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

interface LabourAttendanceShort {
  id: string;
  attendanceDate: string;
  status: string;
  remarks: string | null;
  project?: ProjectShort | null;
  otHours?: number;
}

interface ProjectLabourAssignmentShort {
  id: string;
  projectId: string;
  role: string;
  assignedDate: string;
  unassignedDate: string | null;
  isActive: boolean;
  remarks: string | null;
  project: ProjectShort;
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
  attendances: LabourAttendanceShort[];
  labourAssignments: ProjectLabourAssignmentShort[];
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  attendancePercentage: number;
  totalOtThisMonth?: number;
  totalOtThisYear?: number;
  lifetimeOtHours?: number;
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
  const [activeTab, setActiveTab] = useState<'profile' | 'attendance' | 'projects' | 'wages' | 'overtime'>('profile');

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

  const fetchLabourerDetails = useCallback(async () => {
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLabourerDetails();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLabourerDetails]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // Phone validation: Exactly 10 digits, only digits allowed.
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error updating profile';
      alert(errorMsg);
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

  const activeAssignment = labourer.labourAssignments?.find(a => a.isActive);

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Link href="/labourers" className="btn btn-secondary btn-sm">
          ⬅️ Back to Labourers
        </Link>
      </div>

      <div className="page-title-section" style={{ marginBottom: '20px' }}>
        <div>
          <span className="badge badge-pending" style={{ marginBottom: '4px' }}>{labourer.labourCode}</span>
          <h1 className="page-title">{labourer.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>
            Skill: <strong>{labourer.skillType}</strong> • Status:{' '}
            <span className={`badge badge-${labourer.activeStatus ? 'completed' : 'cancelled'}`} style={{ display: 'inline-block', padding: '2px 8px' }}>
              {labourer.activeStatus ? 'Active' : 'Inactive'}
            </span>
            {activeAssignment && (
              <span className="badge badge-pending" style={{ marginLeft: '8px', background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                📍 Allocated to {activeAssignment.project.projectName}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-container" style={{ marginBottom: '24px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => { setActiveTab('profile'); setEditMode(false); }}
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '100px', fontWeight: 'bold' }}
        >
          👤 Profile Info
        </button>
        <button
          onClick={() => { setActiveTab('attendance'); setEditMode(false); }}
          className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '100px', fontWeight: 'bold' }}
        >
          📅 Attendance ({labourer.totalWorkingDays})
        </button>
        <button
          onClick={() => { setActiveTab('projects'); setEditMode(false); }}
          className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '100px', fontWeight: 'bold' }}
        >
          🪵 Projects History ({labourer.labourAssignments?.length || 0})
        </button>
        <button
          onClick={() => { setActiveTab('wages'); setEditMode(false); }}
          className={`tab-button ${activeTab === 'wages' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '100px', fontWeight: 'bold' }}
        >
          💳 Wages & Paid ({labourer.labourCosts.length})
        </button>
        <button
          onClick={() => { setActiveTab('overtime'); setEditMode(false); }}
          className={`tab-button ${activeTab === 'overtime' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '100px', fontWeight: 'bold' }}
        >
          ⏰ Overtime History ({labourer.attendances.filter(a => Number(a.otHours || 0) > 0).length})
        </button>
      </div>

      {/* Tabs Content */}
      {activeTab === 'profile' && (
        <div>
          {editMode ? (
            /* Edit Form Workspace */
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Edit Profile Details</h3>
                <button type="button" onClick={() => setEditMode(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
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
                  <label className="form-label">Notes / Terms</label>
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
            /* Details Workspace */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Labourer Information</h3>
                  <button onClick={() => setEditMode(true)} className="btn btn-primary btn-sm">
                    ⚙️ Modify Profile
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Full Name</span>
                    <strong>{labourer.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Labour Code</span>
                    <strong>{labourer.labourCode}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Phone Number</span>
                    <strong>{labourer.phone}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Skill Type</span>
                    <strong>{labourer.skillType}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Joining Date</span>
                    <strong>{new Date(labourer.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Status</span>
                    <span className={`badge badge-${labourer.activeStatus ? 'completed' : 'cancelled'}`} style={{ display: 'inline-block', marginTop: '2px' }}>
                      {labourer.activeStatus ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '16px', fontSize: '0.9rem' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Home Address</span>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{labourer.address || '—'}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Notes & Payment Terms</span>
                    <p style={{ margin: 0, fontStyle: labourer.notes ? 'normal' : 'italic', color: labourer.notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {labourer.notes || 'No notes logged.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div>
          {/* Attendance KPI widgets */}
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="stat-label">Total Working Days</div>
              <div className="stat-value">{labourer.totalWorkingDays}</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-label">Present Days</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{labourer.presentDays}</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-label">Absent Days</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{labourer.absentDays}</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="stat-label">Half Days</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{labourer.halfDays}</div>
            </div>
          </div>

          {/* Attendance Percentage Indicator */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', marginBottom: '24px', borderLeft: '4px solid var(--primary)' }}>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 'bold' }}>Overall Attendance Rate</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>Calculated from attendance log</p>
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '800',
              color: labourer.attendancePercentage >= 80 ? 'var(--success)' : labourer.attendancePercentage >= 50 ? 'var(--warning)' : 'var(--danger)'
            }}>
              {labourer.attendancePercentage.toFixed(0)}%
            </div>
          </div>

          <h3 style={{ marginBottom: '16px' }}>Daily Attendance Log Timeline</h3>
          {labourer.attendances.length === 0 ? (
            <div className="empty-state"><p>No attendance records logged for this labourer yet.</p></div>
          ) : (
            <div className="attendance-timeline-container">
              {labourer.attendances.map((att) => {
                const dateObj = new Date(att.attendanceDate);
                const dateStr = dateObj.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });
                const weekdayStr = dateObj.toLocaleDateString('en-IN', { weekday: 'long' });
                
                let statusColor = 'var(--text-muted)';
                let statusBg = '#f1f5f9';
                let statusDotColor = '#94a3b8';
                
                if (att.status === 'Present') {
                  statusColor = '#15803d';
                  statusBg = '#dcfce7';
                  statusDotColor = '#22c55e';
                } else if (att.status === 'Absent') {
                  statusColor = '#b91c1c';
                  statusBg = '#fee2e2';
                  statusDotColor = '#ef4444';
                } else if (att.status === 'Half Day') {
                  statusColor = '#b45309';
                  statusBg = '#fef3c7';
                  statusDotColor = '#f59e0b';
                } else if (att.status === 'Leave') {
                  statusColor = '#1d4ed8';
                  statusBg = '#dbeafe';
                  statusDotColor = '#3b82f6';
                }

                return (
                  <div key={att.id} className="timeline-log-item">
                    <div className="timeline-log-line-node">
                      <div className="timeline-log-dot" style={{ borderColor: statusDotColor }}>
                        <div className="timeline-log-dot-inner" style={{ backgroundColor: statusDotColor }} />
                      </div>
                    </div>
                    <div className="timeline-log-content-card">
                      <div className="timeline-log-header">
                        <div className="timeline-log-date-group">
                          <span className="timeline-log-date">{dateStr}</span>
                          <span className="timeline-log-weekday">{weekdayStr}</span>
                        </div>
                        <span className="status-pill-badge" style={{ color: statusColor, backgroundColor: statusBg }}>
                          {att.status}
                        </span>
                      </div>
                      
                      <div className="timeline-log-body">
                        <div className="timeline-log-project">
                          <strong>Allocation:</strong>{' '}
                          {att.project ? (
                            <Link href={`/projects/${att.project.id}`} className="timeline-log-project-link">
                              🪵 {att.project.projectName} ({att.project.projectCode})
                            </Link>
                          ) : (
                            <span className="unallocated-text">General / Unallocated Pool</span>
                          )}
                        </div>
                        
                        <div className="timeline-log-remarks">
                          <strong>Remarks:</strong>{' '}
                          {att.remarks ? (
                            <span className="remarks-text">{att.remarks}</span>
                          ) : (
                            <span className="no-remarks-text">No supervisor remarks logged.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>Project Allocation History</h3>

          {/* Current Active Allocation Banner */}
          <div className="card" style={{ padding: '16px', marginBottom: '24px', borderLeft: `4px solid ${activeAssignment ? '#4f46e5' : 'var(--text-muted)'}` }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>Current Workforce Assignment</h4>
            {activeAssignment ? (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
                <div>
                  Project:{' '}
                  <Link href={`/projects/${activeAssignment.project.id}`} style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                    {activeAssignment.project.projectName} ({activeAssignment.project.projectCode})
                  </Link>
                </div>
                <div>Role / Designation: <strong>{activeAssignment.role}</strong></div>
                <div>Assigned Date: <strong>{new Date(activeAssignment.assignedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
                {activeAssignment.remarks && <div>Remarks: <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>&quot;{activeAssignment.remarks}&quot;</span></div>}
              </div>
            ) : (
              <p style={{ margin: 0, marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                This labourer is currently <strong>not allocated</strong> to any project. They are available for assignment.
              </p>
            )}
          </div>

          <h4 style={{ marginBottom: '12px' }}>Assignment & Transfer Logs ({labourer.labourAssignments?.length || 0})</h4>
          {!labourer.labourAssignments || labourer.labourAssignments.length === 0 ? (
            <div className="empty-state"><p>No project assignment records logged for this labourer yet.</p></div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-container" style={{ display: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Role</th>
                      <th>Assigned Date</th>
                      <th>Unassigned Date</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourer.labourAssignments.map((assign) => (
                      <tr key={assign.id}>
                        <td>
                          <Link href={`/projects/${assign.project.id}`} style={{ fontWeight: '600', color: 'var(--primary)' }}>
                            {assign.project.projectName} ({assign.project.projectCode})
                          </Link>
                        </td>
                        <td><strong>{assign.role}</strong></td>
                        <td>{new Date(assign.assignedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          {assign.unassignedDate
                            ? new Date(assign.unassignedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'
                          }
                        </td>
                        <td>
                          <span className={`badge badge-${assign.isActive ? 'pending' : 'completed'}`} style={{
                            background: assign.isActive ? '#eef2ff' : '',
                            color: assign.isActive ? '#4f46e5' : '',
                            border: assign.isActive ? '1px solid #c7d2fe' : ''
                          }}>
                            {assign.isActive ? 'Active' : 'Completed'}
                          </span>
                        </td>
                        <td>{assign.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="mobile-list-container">
                {labourer.labourAssignments.map((assign) => (
                  <div key={assign.id} className="mobile-list-card" style={{ borderLeft: `4px solid ${assign.isActive ? '#4f46e5' : 'var(--border)'}` }}>
                    <div className="mobile-list-header">
                      <div>
                        <div className="mobile-list-title">
                          {assign.project.projectName}
                        </div>
                        <div className="mobile-list-subtitle">
                          {assign.project.projectCode} • Role: {assign.role}
                        </div>
                      </div>
                      <span className={`badge badge-${assign.isActive ? 'pending' : 'completed'}`} style={{
                        background: assign.isActive ? '#eef2ff' : '',
                        color: assign.isActive ? '#4f46e5' : '',
                        border: assign.isActive ? '1px solid #c7d2fe' : ''
                      }}>
                        {assign.isActive ? 'Active' : 'Completed'}
                      </span>
                    </div>
                    <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px', fontSize: '0.85rem' }}>
                      <div><strong>Assigned:</strong> {new Date(assign.assignedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div><strong>Unassigned:</strong> {assign.unassignedDate ? new Date(assign.unassignedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Present'}</div>
                      {assign.remarks && <div style={{ marginTop: '4px' }}><strong>Remarks:</strong> {assign.remarks}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'wages' && (
        /* Wages Payments Workspace */
        <div>
          {/* Earnings card summary */}
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-label">Total Earnings / Wages Paid</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {formatCurrency(labourer.totalPaid)}
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="stat-label">Total Payments Count</div>
              <div className="stat-value">{labourer.labourCosts.length}</div>
            </div>
          </div>

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

      {activeTab === 'overtime' && (
        /* Overtime history and stats workspace */
        <div>
          {/* Overtime stats grid */}
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="stat-label">Total OT This Month</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>
                {labourer.totalOtThisMonth || 0} hrs
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="stat-label">Total OT This Year</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {labourer.totalOtThisYear || 0} hrs
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-label">Lifetime OT Hours</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {labourer.lifetimeOtHours || 0} hrs
              </div>
            </div>
          </div>

          <h3 style={{ marginBottom: '12px' }}>Overtime Log History</h3>
          {(!labourer.attendances || labourer.attendances.filter(a => Number(a.otHours || 0) > 0).length === 0) ? (
            <div className="empty-state"><p>No overtime hours logged for this labourer yet.</p></div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-container" style={{ display: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Project Worked</th>
                      <th>Overtime Hours</th>
                      <th>Supervisor Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourer.attendances
                      .filter(a => Number(a.otHours || 0) > 0)
                      .map((att) => (
                        <tr key={att.id}>
                          <td>{new Date(att.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td>
                            {att.project ? (
                              <Link href={`/projects/${att.project.id}`} style={{ fontWeight: '600', color: 'var(--primary)' }}>
                                {att.project.projectName} ({att.project.projectCode})
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>General Bench / None</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                            {att.otHours} hrs
                          </td>
                          <td>
                            <div className="remarks-text">{att.remarks || '—'}</div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="mobile-list-container">
                {labourer.attendances
                  .filter(a => Number(a.otHours || 0) > 0)
                  .map((att) => (
                    <div key={att.id} className="mobile-list-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                      <div className="mobile-list-header">
                        <div>
                          <div className="mobile-list-title">{att.otHours} hrs</div>
                          <div className="mobile-list-subtitle">
                            {new Date(att.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px', fontSize: '0.85rem' }}>
                        <strong>Project Worked:</strong> {att.project?.projectName || 'General Bench'} <br />
                        <strong>Notes:</strong> {att.remarks || '—'}
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

        .attendance-timeline-container {
          position: relative;
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 10px;
        }
        .attendance-timeline-container::before {
          content: '';
          position: absolute;
          left: 4px;
          top: 10px;
          bottom: 10px;
          width: 2px;
          background: #e2e8f0;
        }
        .timeline-log-item {
          display: flex;
          position: relative;
        }
        .timeline-log-line-node {
          position: absolute;
          left: -20px;
          top: 8px;
          width: 10px;
          height: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .timeline-log-dot {
          width: 10px;
          height: 10px;
          border: 2px solid #94a3b8;
          border-radius: 50%;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .timeline-log-dot-inner {
          width: 4px;
          height: 4px;
          background: #94a3b8;
          border-radius: 50%;
        }
        .timeline-log-content-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .timeline-log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px dashed #f1f5f9;
          padding-bottom: 6px;
        }
        .timeline-log-date-group {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .timeline-log-date {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
        }
        .timeline-log-weekday {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }
        .status-pill-badge {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 9999px;
          text-transform: uppercase;
        }
        .timeline-log-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.85rem;
          color: #334155;
        }
        .timeline-log-project-link {
          font-weight: 600;
          color: var(--primary);
          text-decoration: none;
        }
        .timeline-log-project-link:hover {
          text-decoration: underline;
        }
        .unallocated-text {
          color: #64748b;
          font-style: italic;
        }
        .remarks-text {
          color: #0f172a;
          font-weight: 500;
        }
        .no-remarks-text {
          color: #94a3b8;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
