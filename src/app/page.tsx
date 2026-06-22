'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DashboardStats {
  totalActiveProjects: number;
  totalProjectValue: number;
  totalCollectionsReceived: number;
  pendingCollections: number;
  totalMaterialCost: number;
  totalLabourCost: number;
  grossMarginEstimate: number;
  totalRevenue: number;
  grossProfit: number;
  averageMargin: number;
  netCashPosition: number;
  mostProfitableWorkType: string;
  mostProfitableProject: string;
  pipelineCounts: {
    Lead: number;
    'Measurement Done': number;
    'Quotation Sent': number;
    'Advance Received': number;
    Production: number;
    Installation: number;
    Completed: number;
    'On Hold': number;
    Cancelled: number;
  };
  labourMetrics: {
    totalLabourers: number;
    activeLabourers: number;
    totalLabourCost: number;
    labourCostThisMonth: number;
    highestPaidLabourer: string;
  };
  workforceToday: {
    presentToday: number;
    absentToday: number;
    halfDayToday: number;
    leaveToday: number;
    attendancePercentage: number;
  };
  projectAllocations: {
    id: string;
    projectName: string;
    projectCode: string;
    status: string;
    clientName: string;
    assignedCount: number;
    requiredCount: number;
    presentCount: number;
    absentCount: number;
    halfDayCount: number;
    leaveCount: number;
    labourers: {
      id: string;
      assignmentId: string;
      name: string;
      labourCode: string;
      skillType: string;
      role: string;
      todayAttendance: { status: string; remarks: string | null } | null;
    }[];
  }[];
  unassignedLabourers: {
    id: string;
    name: string;
    labourCode: string;
    skillType: string;
    phone: string;
  }[];
  suggestedAssignments: {
    labourerId: string;
    labourerName: string;
    skillType: string;
    projectId: string;
    projectName: string;
  }[];
  recentActivities: {
    id: string;
    projectId: string;
    activityType: string;
    description: string;
    createdAt: string;
    project: {
      projectName: string;
      projectCode: string;
    };
  }[];
  smartInsights: {
    absentLabourersToday: { id: string; name: string; labourCode: string; remarks: string }[];
    unassignedLabourers: { id: string; name: string; labourCode: string; skillType: string }[];
    projectsWithNoAllocation: { id: string; projectName: string; projectCode: string }[];
    labourShortages: { id: string; projectName: string; projectCode: string; assignedCount: number; presentCount: number; shortage: number }[];
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Daily operations states
  const [attendanceChecklist, setAttendanceChecklist] = useState<Record<string, string>>({});
  const [attendanceRemarks, setAttendanceRemarks] = useState<Record<string, string>>({});
  const [editingAttendance, setEditingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Collapsible active project cards state
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  // Quick allocation panel states
  const [selectedProjectIdForAssign, setSelectedProjectIdForAssign] = useState<string | null>(null);
  const [assignLabourerId, setAssignLabourerId] = useState('');
  const [assignRole, setAssignRole] = useState('Carpenter');
  const [assignRemarks, setAssignRemarks] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Quick Action remarks & transfer states
  const [activeRemarksLabourerId, setActiveRemarksLabourerId] = useState<string | null>(null);
  const [quickRemarksText, setQuickRemarksText] = useState('');
  const [savingQuickRemarks, setSavingQuickRemarks] = useState(false);

  const [quickAssignLabourerId, setQuickAssignLabourerId] = useState<string | null>(null);
  const [quickAssignProjectId, setQuickAssignProjectId] = useState('');
  const [submittingQuickAssign, setSubmittingQuickAssign] = useState(false);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard metrics');
      const data: DashboardStats = await res.json();
      setStats(data);

      // Initialize daily checklist values based on the dashboard payload
      const initialChecked: Record<string, string> = {};
      const initialRemarks: Record<string, string> = {};
      data.projectAllocations.forEach((proj) => {
        proj.labourers.forEach((worker) => {
          if (worker.todayAttendance) {
            initialChecked[worker.id] = worker.todayAttendance.status;
            initialRemarks[worker.id] = worker.todayAttendance.remarks || '';
          } else {
            initialChecked[worker.id] = 'Present'; // default to Present
            initialRemarks[worker.id] = '';
          }
        });
      });
      setAttendanceChecklist(initialChecked);
      setAttendanceRemarks(initialRemarks);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboardStats();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDashboardStats]);

  const handleStatusChange = (labourerId: string, status: 'Present' | 'Absent' | 'Half Day') => {
    setAttendanceChecklist(prev => ({
      ...prev,
      [labourerId]: status
    }));
  };

  const handleRemarksChange = (labourerId: string, val: string) => {
    setAttendanceRemarks(prev => ({
      ...prev,
      [labourerId]: val
    }));
  };

  const handleToggleCollapse = (projectId: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // Submit unified daily attendance checklist
  const handleSaveAllAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stats) return;

    try {
      setSavingAttendance(true);
      const todayStr = new Date().toISOString().split('T')[0];

      // Flatten all workers into a single save request payload
      const flatRecords = stats.projectAllocations.flatMap(project => 
        project.labourers.map(worker => {
          const status = attendanceChecklist[worker.id] || 'Present';
          return {
            labourerId: worker.id,
            status,
            projectId: project.id,
            remarks: attendanceRemarks[worker.id] || `Marked ${status}`,
          };
        })
      );

      if (flatRecords.length === 0) {
        alert('No allocated workers available to mark attendance.');
        return;
      }

      const res = await fetch('/api/labourers/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayStr,
          records: flatRecords,
        }),
      });

      if (!res.ok) throw new Error('Failed to record daily attendance');

      setEditingAttendance(false);
      await fetchDashboardStats();
      alert('Daily attendance logs recorded successfully!');
    } catch (err) {
      console.error(err);
      alert('Error saving daily attendance checklist');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Quick Action: Save remarks for an absent worker today
  const handleQuickSaveRemarks = async (e: React.FormEvent, labourerId: string) => {
    e.preventDefault();
    if (!quickRemarksText.trim()) return;

    try {
      setSavingQuickRemarks(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/labourers/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayStr,
          records: [
            {
              labourerId,
              status: 'Absent',
              remarks: quickRemarksText.trim()
            }
          ]
        }),
      });

      if (!res.ok) throw new Error('Failed to save absent remarks');
      alert('Remarks saved successfully!');
      setActiveRemarksLabourerId(null);
      setQuickRemarksText('');
      await fetchDashboardStats();
    } catch (err) {
      console.error(err);
      alert('Error saving remarks');
    } finally {
      setSavingQuickRemarks(false);
    }
  };

  // Quick Action: Allocate worker to project site in 1-click
  const handleQuickAssignSubmit = async (e: React.FormEvent, labourerId: string, projectId: string) => {
    e.preventDefault();
    try {
      setSubmittingQuickAssign(true);
      const res = await fetch('/api/labourers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          labourerId,
          role: 'Carpenter',
          remarks: 'Quick allocated from available pool'
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to allocate worker');
      }

      alert('Worker allocated successfully!');
      setQuickAssignLabourerId(null);
      setQuickAssignProjectId('');
      await fetchDashboardStats();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error allocating worker';
      alert(errorMsg);
    } finally {
      setSubmittingQuickAssign(false);
    }
  };

  // Standard inline allocation submit
  const handleStandardAssignSubmit = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    if (!assignLabourerId || !assignRole) {
      alert('Please select a labourer and specify their project role.');
      return;
    }
    try {
      setAssignSubmitting(true);
      const res = await fetch('/api/labourers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          labourerId: assignLabourerId,
          role: assignRole,
          remarks: assignRemarks || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to allocate labourer');
      }

      setSelectedProjectIdForAssign(null);
      setAssignLabourerId('');
      setAssignRole('Carpenter');
      setAssignRemarks('');
      await fetchDashboardStats();
      alert('Labourer allocated successfully!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error occurred allocating labourer';
      alert(errorMsg);
    } finally {
      setAssignSubmitting(false);
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
    return (
      <div className="empty-state">
        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔄</div>
        <p>Loading operations dashboard...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Error loading dashboard</h3>
        <p>{error || 'Unable to retrieve statistics.'}</p>
        <button onClick={fetchDashboardStats} className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}>
          Retry
        </button>
      </div>
    );
  }

  // Calculate dynamic dashboard counts
  const projectsNeedingLabourCount = stats.projectAllocations.filter(
    p => p.presentCount < p.requiredCount
  ).length;

  const totalWorkersCount = stats.labourMetrics.activeLabourers;
  const isGlobalAttendanceMarked = stats.projectAllocations.length > 0 && stats.projectAllocations.every(
    p => p.labourers.length === 0 || p.labourers.every(w => w.todayAttendance !== null)
  );

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Dashboard Page Header */}
      <div className="page-title-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.8rem', fontWeight: 800 }}>Today&apos;s Operations Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>
            Workforce tracking and live project assignments for <strong>{formattedDate}</strong>
          </p>
        </div>
        <button onClick={fetchDashboardStats} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          🔄 Refresh Operations
        </button>
      </div>

      {/* SECTION 1: OPERATIONS KPI CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
          <div className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>Active Projects</div>
          <div className="stat-value" style={{ color: 'var(--primary)', fontSize: '1.8rem', fontWeight: 800 }}>
            {stats.totalActiveProjects}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)', padding: '16px' }}>
          <div className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>Workers Present Today</div>
          <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.8rem', fontWeight: 800 }}>
            {stats.workforceToday.presentToday} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {totalWorkersCount}</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)', padding: '16px' }}>
          <div className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>Workers Absent Today</div>
          <div className="stat-value" style={{ color: 'var(--danger)', fontSize: '1.8rem', fontWeight: 800 }}>
            {stats.workforceToday.absentToday}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)', padding: '16px' }}>
          <div className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>Projects Needing Labour</div>
          <div className="stat-value" style={{ color: 'var(--warning)', fontSize: '1.8rem', fontWeight: 800 }}>
            {projectsNeedingLabourCount}
          </div>
        </div>
      </div>

      {/* Main Operations Control Split Grid */}
      <div className="workforce-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Left Side: Active Projects Catalog */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* SECTION 2: ACTIVE PROJECTS CARDS */}
          <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>🪵 Active Projects Today</h2>
            
            {stats.projectAllocations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No active projects recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.projectAllocations.map(project => {
                  const isCollapsed = collapsedProjects[project.id] === true;
                  const isShortage = project.presentCount < project.requiredCount;
                  const hasNoWorkers = project.assignedCount === 0;

                  let badgeBg = 'var(--success-light)';
                  let badgeColor = 'var(--success)';
                  let badgeText = '✅ Fully Staffed';

                  if (hasNoWorkers) {
                    badgeBg = 'var(--warning-light)';
                    badgeColor = 'var(--warning)';
                    badgeText = '⚠️ No Workers Allocated';
                  } else if (isShortage) {
                    badgeBg = '#fdf2f2';
                    badgeColor = 'var(--danger)';
                    badgeText = `⚠️ Needs ${project.requiredCount - project.presentCount} Worker(s)`;
                  }

                  return (
                    <div key={project.id} style={{ background: '#fcfbf7', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      
                      {/* Interactive collapsible header wrapper */}
                      <div 
                        onClick={() => handleToggleCollapse(project.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                            {project.projectName}
                          </h3>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Client: <strong>{project.clientName}</strong> • Stage: <em>{project.status}</em>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.75rem', background: badgeBg, color: badgeColor, padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                            {badgeText}
                          </span>
                          <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                            {isCollapsed ? '➕' : '➖'}
                          </span>
                        </div>
                      </div>

                      {/* Collapsed content container */}
                      {!isCollapsed && (
                        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'white' }}>
                          
                          {/* Staffing KPI numbers */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', padding: '8px', background: '#fcfbf7', borderRadius: '4px', marginBottom: '12px', fontSize: '0.8rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Required</span>
                              <strong>{project.requiredCount}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Assigned</span>
                              <strong>{project.assignedCount}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--success)', display: 'block', fontSize: '0.7rem' }}>Present</span>
                              <strong style={{ color: 'var(--success)' }}>{project.presentCount}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--danger)', display: 'block', fontSize: '0.7rem' }}>Absent</span>
                              <strong style={{ color: 'var(--danger)' }}>{project.absentCount}</strong>
                            </div>
                          </div>

                          {/* Assigned workers names list */}
                          <div style={{ marginBottom: '12px' }}>
                            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                              Assigned Workers Today
                            </span>
                            {project.labourers.length === 0 ? (
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No workers assigned to this site. Use the selector below to allocate workers.
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {project.labourers.map(worker => (
                                  <span key={worker.id} style={{ background: '#f9f9fb', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}>
                                    👤 {worker.name} <em style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 'normal' }}>({worker.role})</em>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Allocate triggers */}
                          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}>
                            <button
                              onClick={() => setSelectedProjectIdForAssign(selectedProjectIdForAssign === project.id ? null : project.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 10px' }}
                            >
                              {selectedProjectIdForAssign === project.id ? '✖ Close Form' : '➕ Allocate Worker Inline'}
                            </button>
                          </div>

                          {selectedProjectIdForAssign === project.id && (
                            <form onSubmit={(e) => handleStandardAssignSubmit(e, project.id)} style={{ background: '#faf9f6', padding: '12px', borderRadius: '4px', marginTop: '10px', border: '1px dashed var(--border)' }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 'bold' }}>Assign Worker to Site</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Select Available Worker</label>
                                    <select
                                      className="form-control"
                                      value={assignLabourerId}
                                      onChange={(e) => setAssignLabourerId(e.target.value)}
                                      required
                                      style={{ minHeight: '34px', fontSize: '0.8rem' }}
                                    >
                                      <option value="">-- Choose --</option>
                                      {stats.unassignedLabourers.map(l => (
                                        <option key={l.id} value={l.id}>{l.name} ({l.skillType})</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Project Designation</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={assignRole}
                                      onChange={(e) => setAssignRole(e.target.value)}
                                      placeholder="e.g. Lead Carpenter"
                                      required
                                      style={{ minHeight: '34px', fontSize: '0.8rem' }}
                                    />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                                  <button type="button" onClick={() => setSelectedProjectIdForAssign(null)} className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>Cancel</button>
                                  <button type="submit" disabled={assignSubmitting} className="btn btn-primary btn-sm" style={{ padding: '3px 12px', fontSize: '0.75rem' }}>Confirm Assignment</button>
                                </div>
                              </div>
                            </form>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 4: UNIFIED DAILY ATTENDANCE CHECKLIST */}
          <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>📅 Daily Attendance Checklist</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>Date: <strong>{formattedDate}</strong></span>
              </div>
              {isGlobalAttendanceMarked && !editingAttendance ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', background: '#e6f4ea', color: '#137333', padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold' }}>
                    ✅ Attendance Completed
                  </span>
                  <button
                    onClick={() => setEditingAttendance(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    ✏️ Correct / Edit
                  </button>
                </div>
              ) : null}
            </div>

            {stats.projectAllocations.filter(p => p.labourers.length > 0).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                No workers are currently allocated to project sites. Assign workers to open attendance tracking.
              </p>
            ) : (!isGlobalAttendanceMarked || editingAttendance) ? (
              <form onSubmit={handleSaveAllAttendance}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {stats.projectAllocations
                    .filter(project => project.labourers.length > 0)
                    .map(project => (
                      <div key={project.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '10px' }}>
                          🪵 {project.projectName}
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {project.labourers.map(worker => {
                            const status = attendanceChecklist[worker.id] || 'Present';
                            return (
                              <div 
                                key={worker.id} 
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#faf9f6', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}
                              >
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{worker.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role: {worker.role}</div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  {/* Pill attendance selector */}
                                  <div style={{ display: 'flex', gap: '2px', background: '#f0ede6', padding: '2px', borderRadius: '4px' }}>
                                    {(['Present', 'Absent', 'Half Day'] as const).map(opt => {
                                      const isActive = status === opt;
                                      let activeColorStyle = {};
                                      if (isActive) {
                                        if (opt === 'Present') activeColorStyle = { background: 'var(--success)', color: 'white' };
                                        if (opt === 'Absent') activeColorStyle = { background: 'var(--danger)', color: 'white' };
                                        if (opt === 'Half Day') activeColorStyle = { background: 'var(--warning)', color: 'white' };
                                      }
                                      return (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => handleStatusChange(worker.id, opt)}
                                          style={{
                                            border: 'none',
                                            padding: '4px 10px',
                                            borderRadius: '3px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            background: 'transparent',
                                            color: 'var(--text-muted)',
                                            transition: 'all 0.1s ease',
                                            ...activeColorStyle
                                          }}
                                        >
                                          {opt}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <input
                                    type="text"
                                    placeholder="Remarks (optional)"
                                    className="form-control"
                                    value={attendanceRemarks[worker.id] || ''}
                                    onChange={(e) => handleRemarksChange(worker.id, e.target.value)}
                                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.75rem', width: '160px' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', marginTop: '10px' }}>
                    <button
                      type="submit"
                      disabled={savingAttendance}
                      className="btn btn-primary btn-block"
                      style={{ minHeight: '40px', fontWeight: 'bold' }}
                    >
                      {savingAttendance ? '💾 Saving Attendance checklist...' : '💾 Save Attendance for Today'}
                    </button>
                    {editingAttendance && (
                      <button
                        type="button"
                        onClick={() => setEditingAttendance(false)}
                        className="btn btn-secondary btn-sm"
                        style={{ height: '40px', padding: '0 16px' }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </form>
            ) : (
              <div style={{ background: '#f4fbf7', border: '1px solid #c2eed4', borderRadius: '6px', padding: '24px', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>🎉</span>
                <h4 style={{ color: '#137333', fontWeight: 'bold', margin: '0 0 4px 0' }}>All Clear! Attendance Marked</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Attendance logs are saved for all active project sites. Click the &quot;Correct / Edit&quot; button above if you need to perform corrections.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Action Center, Available pool & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* SECTION 3: ATTENTION REQUIRED */}
          <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>⚠️ Attention Required</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Alert 1: Absent Workers needing remarks */}
              {stats.smartInsights.absentLabourersToday.length === 0 ? null : (
                stats.smartInsights.absentLabourersToday.map(worker => (
                  <div key={worker.id} style={{ background: '#fdf2f2', border: '1px solid #f8b4b4', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 'bold' }}>
                        👤 {worker.name} is absent today
                      </span>
                      {activeRemarksLabourerId !== worker.id && (
                        <button
                          onClick={() => {
                            setActiveRemarksLabourerId(worker.id);
                            setQuickRemarksText(worker.remarks || '');
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 6px', fontSize: '0.7rem', borderColor: '#f8b4b4' }}
                        >
                          Log Reason
                        </button>
                      )}
                    </div>

                    {activeRemarksLabourerId === worker.id && (
                      <form onSubmit={(e) => handleQuickSaveRemarks(e, worker.id)} style={{ marginTop: '8px' }}>
                        <input
                          type="text"
                          className="form-control"
                          required
                          value={quickRemarksText}
                          onChange={(e) => setQuickRemarksText(e.target.value)}
                          placeholder="Sick leave, delay reason..."
                          style={{ minHeight: '32px', fontSize: '0.8rem', padding: '4px 8px', marginBottom: '6px' }}
                        />
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => setActiveRemarksLabourerId(null)} className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Cancel</button>
                          <button type="submit" disabled={savingQuickRemarks} className="btn btn-primary btn-sm" style={{ padding: '2px 10px', fontSize: '0.7rem' }}>Save</button>
                        </div>
                      </form>
                    )}
                  </div>
                ))
              )}

              {/* Alert 2: Labour shortages */}
              {stats.smartInsights.labourShortages.length === 0 ? null : (
                stats.smartInsights.labourShortages.map(shortage => (
                  <div key={shortage.id} style={{ background: '#fffbeb', border: '1px solid #fde8c4', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: '#b25e00', fontWeight: 'bold' }}>
                        🪵 {shortage.projectName} needs {shortage.shortage} worker(s)
                      </span>
                      <button
                        onClick={() => {
                          setCollapsedProjects(prev => ({ ...prev, [shortage.id]: false }));
                          setSelectedProjectIdForAssign(shortage.id);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', fontSize: '0.7rem', borderColor: '#fde8c4' }}
                      >
                        Allocate
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Alert 3: Unmarked daily attendance */}
              {!isGlobalAttendanceMarked && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde8c4', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#b25e00', fontWeight: 'bold' }}>
                      📝 Daily attendance checklist is incomplete
                    </span>
                    <button
                      onClick={() => {
                        setEditingAttendance(true);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.7rem', borderColor: '#fde8c4' }}
                    >
                      Complete Now
                    </button>
                  </div>
                </div>
              )}

              {/* Alert 4: Unallocated available pool */}
              {stats.unassignedLabourers.map(l => (
                <div key={l.id} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                      🪚 {l.name} ({l.skillType}) is unassigned
                    </span>
                    {quickAssignLabourerId !== l.id && (
                      <button
                        onClick={() => {
                          setQuickAssignLabourerId(l.id);
                          setQuickAssignProjectId('');
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      >
                        Assign Site
                      </button>
                    )}
                  </div>

                  {quickAssignLabourerId === l.id && (
                    <form onSubmit={(e) => handleQuickAssignSubmit(e, l.id, quickAssignProjectId)} style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <select
                        className="form-control"
                        required
                        value={quickAssignProjectId}
                        onChange={(e) => setQuickAssignProjectId(e.target.value)}
                        style={{ minHeight: '32px', fontSize: '0.8rem', padding: '4px' }}
                      >
                        <option value="">-- Choose Project Site --</option>
                        {stats.projectAllocations.map(p => (
                          <option key={p.id} value={p.id}>{p.projectName}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setQuickAssignLabourerId(null)} className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Cancel</button>
                        <button type="submit" disabled={submittingQuickAssign} className="btn btn-primary btn-sm" style={{ padding: '2px 10px', fontSize: '0.7rem' }}>Assign Worker</button>
                      </div>
                    </form>
                  )}
                </div>
              ))}

              {stats.smartInsights.absentLabourersToday.length === 0 &&
               stats.smartInsights.labourShortages.length === 0 &&
               stats.unassignedLabourers.length === 0 &&
               isGlobalAttendanceMarked && (
                <p style={{ margin: 0, color: 'var(--success)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                  🎉 All sites staffed and attendance recorded. No operational attention required!
                </p>
              )}
            </div>
          </div>

          {/* SECTION 5: WORKER AVAILABILITY & SUGGESTIONS */}
          <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>Worker Availability & Recommendations</h2>
            
            {stats.unassignedLabourers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                All active labourers are assigned to projects.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Available Labour Pool ({stats.unassignedLabourers.length})
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {stats.unassignedLabourers.map(l => (
                      <span key={l.id} style={{ background: '#f3f4f6', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        👤 {l.name} <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '0.7rem' }}>({l.skillType})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {stats.suggestedAssignments.length > 0 && (
                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                      💡 suggested allocations
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {stats.suggestedAssignments.map((suggestion, idx) => (
                        <div key={idx} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '4px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <div>
                            <strong>{suggestion.labourerName}</strong> ➔ <span style={{ color: 'var(--primary)' }}>{suggestion.projectName}</span>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch('/api/labourers/assignments', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    projectId: suggestion.projectId,
                                    labourerId: suggestion.labourerId,
                                    role: suggestion.skillType,
                                    remarks: 'Accepted dashboard auto-match allocation suggestion'
                                  }),
                                });
                                if (!res.ok) throw new Error();
                                alert('Assignment suggestion accepted!');
                                await fetchDashboardStats();
                              } catch {
                                alert('Error accepting allocation suggestions.');
                              }
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.7rem', background: '#4f46e5', border: 'none' }}
                          >
                            Assign Site
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* SECTION 6: DAILY ACTIVITY TIMELINE */}
          <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>🕒 Daily Activity Timeline</h2>
            
            {stats.recentActivities.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                No recent assignment movements logged.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '2px solid var(--border)', paddingLeft: '14px', margin: '6px 0 0 6px' }}>
                {stats.recentActivities.map((act) => {
                  let badgeIcon = '📝';
                  if (act.activityType === 'LABOUR_ASSIGNED') badgeIcon = '➕';
                  if (act.activityType === 'LABOUR_TRANSFERRED') badgeIcon = '🔄';
                  if (act.activityType === 'LABOUR_UNASSIGNED') badgeIcon = '❌';

                  return (
                    <div key={act.id} style={{ position: 'relative', fontSize: '0.8rem' }}>
                      <span style={{ position: 'absolute', left: '-22px', top: '0', background: 'white', padding: '0 2px', fontSize: '0.85rem' }}>
                        {badgeIcon}
                      </span>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {act.description}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Project: {act.project.projectName} • {new Date(act.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* SECTION 7: FINANCIAL SUMMARY (SECONDARY DECORATIVE FOOTER CARD) */}
      <div className="card" style={{ padding: '20px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>💳 Financial Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ borderLeft: '4px solid var(--primary)', padding: '10px 14px', background: '#fdfcf7', borderRadius: '4px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Active Project Value</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
              {formatCurrency(stats.totalProjectValue)}
            </div>
          </div>
          <div style={{ borderLeft: '4px solid var(--success)', padding: '10px 14px', background: '#fdfcf7', borderRadius: '4px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Collections Received</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: 'var(--success)' }}>
              {formatCurrency(stats.totalCollectionsReceived)}
            </div>
          </div>
          <div style={{ borderLeft: '4px solid var(--warning)', padding: '10px 14px', background: '#fdfcf7', borderRadius: '4px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Pending Collections</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: 'var(--warning)' }}>
              {formatCurrency(stats.pendingCollections)}
            </div>
          </div>
          <div style={{ borderLeft: '4px solid var(--success)', padding: '10px 14px', background: '#f0fdf4', borderRadius: '4px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#166534', fontWeight: 'bold' }}>Estimated profit to date</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: '#166534' }}>
              {formatCurrency(stats.grossProfit)}
            </div>
          </div>
        </div>
      </div>

      {/* Footer shortcut nav links */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
        <Link href="/clients" className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>
          👥 Clients Directory
        </Link>
        <Link href="/projects" className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>
          🪵 Projects Catalog
        </Link>
        <Link href="/labourers" className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>
          🪚 Workforce Manager
        </Link>
        <Link href="/reports" className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>
          📊 Detailed Analytics & Reports
        </Link>
      </div>

      <style jsx global>{`
        @media (min-width: 992px) {
          .workforce-dashboard-grid {
            grid-template-columns: 2.2fr 1.2fr !important;
          }
        }
      `}</style>
    </div>
  );
}
