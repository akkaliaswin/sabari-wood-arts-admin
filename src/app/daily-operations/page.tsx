'use client';

import { useState, useEffect, useCallback } from 'react';

interface LabourerShort {
  id: string;
  name: string;
  labourCode: string;
  skillType: string;
  phone: string;
  todayAttendance?: {
    status: string;
    remarks: string | null;
  } | null;
}

interface WorkerInProject {
  id: string;
  assignmentId: string;
  name: string;
  labourCode: string;
  skillType: string;
  role: string;
  todayAttendance: {
    status: string;
    remarks: string | null;
  } | null;
}

interface ProjectAllocation {
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
  labourers: WorkerInProject[];
  dailyNote?: string;
}

interface ActivityItem {
  id: string;
  projectId: string;
  activityType: string;
  description: string;
  createdAt: string;
  project: {
    projectName: string;
    projectCode: string;
  };
}

interface WorkforceToday {
  presentToday: number;
  absentToday: number;
  halfDayToday: number;
  leaveToday: number;
  attendancePercentage: number;
}

function getISTDateString() {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export default function DailyOperations() {
  // Data states
  const [activeProjects, setActiveProjects] = useState<ProjectAllocation[]>([]);
  const [availableLabourers, setAvailableLabourers] = useState<LabourerShort[]>([]);
  const [timeline, setTimeline] = useState<ActivityItem[]>([]);
  const [workforceSummary, setWorkforceSummary] = useState<WorkforceToday>({
    presentToday: 0,
    absentToday: 0,
    halfDayToday: 0,
    leaveToday: 0,
    attendancePercentage: 0,
  });

  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [error, setError] = useState('');

  // Daily notes states (keyed by labourerId)
  const [labourNotes, setLabourNotes] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Project daily notes states (keyed by projectId)
  const [projectDailyNotes, setProjectDailyNotes] = useState<Record<string, string>>({});

  // UI state: Section 5 timeline expansion
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Drag-and-drop state
  const [draggingLabourerId, setDraggingLabourerId] = useState<string | null>(null);
  const [draggingSourceProjectId, setDraggingSourceProjectId] = useState<string | null>(null);
  const [draggingAssignmentId, setDraggingAssignmentId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [dragOverAvailable, setDragOverAvailable] = useState(false);

  // Fetch board data
  const refreshData = useCallback(async () => {
    try {
      const dashRes = await fetch('/api/dashboard');
      if (!dashRes.ok) {
        throw new Error('Failed to load daily operations data');
      }
      const dashData = await dashRes.json();

      const allocations = dashData.projectAllocations || [];
      setActiveProjects(allocations);
      setAvailableLabourers(dashData.unassignedLabourers || []);
      setTimeline(dashData.recentActivities || []);
      setWorkforceSummary(dashData.workforceToday || {
        presentToday: 0,
        absentToday: 0,
        halfDayToday: 0,
        leaveToday: 0,
        attendancePercentage: 0,
      });

      // Initialize daily notes state for both assigned and available workers
      const initialNotes: Record<string, string> = {};
      const initialExpanded: Record<string, boolean> = {};
      allocations.forEach((proj: ProjectAllocation) => {
        (proj.labourers || []).forEach(worker => {
          const remark = worker.todayAttendance?.remarks || '';
          initialNotes[worker.id] = remark;
          if (remark) {
            initialExpanded[worker.id] = true;
          }
        });
      });
      (dashData.unassignedLabourers || []).forEach((worker: LabourerShort) => {
        const remark = worker.todayAttendance?.remarks || '';
        initialNotes[worker.id] = remark;
        if (remark) {
          initialExpanded[worker.id] = true;
        }
      });
      setLabourNotes(initialNotes);
      setExpandedNotes(prev => {
        const next = { ...prev };
        Object.keys(initialExpanded).forEach(k => {
          next[k] = true;
        });
        return next;
      });

      // Initialize project daily notes state
      const initialProjNotes: Record<string, string> = {};
      allocations.forEach((proj: ProjectAllocation) => {
        initialProjNotes[proj.id] = proj.dailyNote || '';
      });
      setProjectDailyNotes(initialProjNotes);

      setError('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred while fetching operations data.';
      setError(errorMsg);
    }
  }, []);

  useEffect(() => {
    const initFetch = async () => {
      setLoading(true);
      await refreshData();
      setLoading(false);
    };
    initFetch();
  }, [refreshData]);

  // Drag-and-Drop Handlers
  const handleDragStart = (
    e: React.DragEvent,
    labourerId: string,
    sourceProjectId: string | null,
    assignmentId: string | null
  ) => {
    setDraggingLabourerId(labourerId);
    setDraggingSourceProjectId(sourceProjectId);
    setDraggingAssignmentId(assignmentId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', labourerId);
  };

  const handleDragOverProject = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    setDragOverProjectId(projectId);
  };

  const handleDragLeaveProject = () => {
    setDragOverProjectId(null);
  };

  const handleDropOnProject = async (e: React.DragEvent, targetProjectId: string) => {
    e.preventDefault();
    setDragOverProjectId(null);
    if (!draggingLabourerId) return;

    if (draggingSourceProjectId === targetProjectId) {
      resetDragState();
      return;
    }

    let reason = '';
    if (draggingSourceProjectId) {
      const res = prompt('Enter reason for transfer (optional):');
      if (res === null) {
        resetDragState();
        return; // Aborted
      }
      reason = res;
    }

    try {
      setOperationLoading(true);
      const res = await fetch('/api/labourers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: targetProjectId,
          labourerId: draggingLabourerId,
          role: 'Carpenter',
          remarks: draggingSourceProjectId
            ? (reason.trim() || 'Transferred during daily operations')
            : 'Allocated from available pool'
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to assign worker');
      }

      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to complete allocation transfer.';
      alert(errorMsg);
    } finally {
      setOperationLoading(false);
      resetDragState();
    }
  };

  const handleDragOverAvailable = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverAvailable(true);
  };

  const handleDragLeaveAvailable = () => {
    setDragOverAvailable(false);
  };

  const handleDropOnAvailablePool = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverAvailable(false);
    if (!draggingLabourerId) return;

    if (!draggingSourceProjectId || !draggingAssignmentId) {
      resetDragState();
      return;
    }

    try {
      setOperationLoading(true);
      const res = await fetch(`/api/labourers/assignments/${draggingAssignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: false,
          remarks: 'Released back to available pool'
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to release worker');
      }

      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to release worker.';
      alert(errorMsg);
    } finally {
      setOperationLoading(false);
      resetDragState();
    }
  };

  const resetDragState = () => {
    setDraggingLabourerId(null);
    setDraggingSourceProjectId(null);
    setDraggingAssignmentId(null);
    setDragOverProjectId(null);
    setDragOverAvailable(false);
  };

  // Section 2: Reassign/Transfer from project card dropdown (mobile visual alternative to DND)
  const handleTransferWorker = async (labourerId: string, currentProjectId: string, targetProjectId: string) => {
    if (!targetProjectId || currentProjectId === targetProjectId) return;
    const reason = prompt('Enter reason for transfer (optional):');
    if (reason === null) return; // Aborted

    try {
      setOperationLoading(true);
      const res = await fetch('/api/labourers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: targetProjectId,
          labourerId,
          role: 'Carpenter',
          remarks: reason.trim() || 'Transferred via quick reallocation dropdown'
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to transfer worker');
      }

      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to transfer worker.';
      alert(errorMsg);
    } finally {
      setOperationLoading(false);
    }
  };

  // Save 4-state attendance logs instantly
  const handleSaveLabourerAttendance = async (labourerId: string, projectId: string | null, status: string, notes?: string) => {
    try {
      setOperationLoading(true);
      const todayStr = getISTDateString();
      const res = await fetch('/api/labourers/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayStr,
          records: [
            {
              labourerId,
              status,
              projectId,
              remarks: notes !== undefined ? notes : (labourNotes[labourerId] || '')
            }
          ]
        })
      });

      if (!res.ok) {
        throw new Error('Failed to record attendance logs');
      }

      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving attendance.';
      alert(errorMsg);
    } finally {
      setOperationLoading(false);
    }
  };

  // Save labour note/remarks
  const handleSaveLabourNote = async (labourerId: string, projectId: string | null, currentStatus: string, notesText: string) => {
    // Only save if status has been marked (is not unmarked / default placeholder)
    if (!currentStatus || currentStatus === 'Unmarked') return;
    await handleSaveLabourerAttendance(labourerId, projectId, currentStatus, notesText);
  };

  // Save project daily note
  const handleSaveProjectDailyNote = async (projectId: string, noteText: string) => {
    try {
      setOperationLoading(true);
      const res = await fetch(`/api/projects/${projectId}/daily-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText })
      });

      if (!res.ok) {
        throw new Error('Failed to save project daily note');
      }

      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save project note.';
      alert(errorMsg);
    } finally {
      setOperationLoading(false);
    }
  };

  // Section 4: Available workers Quick Assign
  const handleQuickAssign = async (labourerId: string, projectId: string) => {
    if (!projectId) return;
    try {
      setOperationLoading(true);
      const res = await fetch('/api/labourers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          labourerId,
          role: 'Carpenter',
          remarks: 'Assigned from available pool'
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to assign worker');
      }

      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error assigning worker.';
      alert(errorMsg);
    } finally {
      setOperationLoading(false);
    }
  };

  // Timeline clean description parser
  const formatTimelineDescription = (desc: string) => {
    let formatted = desc;
    formatted = formatted.replace(/^Labourer\s+/, '');
    formatted = formatted.replace(/\s*\([A-Z]{3,4}\d{4}\)/, '');
    formatted = formatted.replace(/\s*\([A-Z]\d{4}\)/, '');
    formatted = formatted.replace(/\s+today\.?$/, '');
    formatted = formatted.replace(/assigned to project with role '([^']+)'/, "assigned to $1");
    formatted = formatted.replace(/transferred to project '([^']+)'/, "transferred to $1");
    formatted = formatted.replace(/transferred from project '([^']+)'/, "transferred from $1");
    formatted = formatted.replace(/unassigned from project\.?$/, "unassigned");
    return `✓ ${formatted}`;
  };

  // Timeline action icon helper
  const getTimelineIcon = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes('marked present') || d.includes('checked in') || d.includes('present')) return '🟢';
    if (d.includes('marked absent') || d.includes('absent')) return '🔴';
    if (d.includes('marked leave') || d.includes('leave')) return '🔵';
    if (d.includes('marked half day') || d.includes('half day')) return '🟡';
    if (d.includes('moved to') || d.includes('transferred')) return '🔄';
    if (d.includes('assigned as') || d.includes('assigned')) return '➕';
    if (d.includes('unassigned') || d.includes('released')) return '➖';
    return '⚡';
  };

  // Skill color style map helper
  const getSkillClassName = (skill: string) => {
    const normalized = skill.toLowerCase();
    if (normalized.includes('carpenter')) return 'skill-carpenter';
    if (normalized.includes('painter')) return 'skill-painter';
    if (normalized.includes('helper')) return 'skill-helper';
    if (normalized.includes('polisher')) return 'skill-polisher';
    return 'skill-default';
  };

  // Project health calculator (Staffing requirement check)
  const getProjectHealth = (presentCount: number, requiredCount: number) => {
    if (presentCount === 0) {
      return { text: 'Critical Labour Shortage', className: 'health-critical' };
    }
    if (presentCount === requiredCount - 1) {
      return { text: 'Short By 1 Worker', className: 'health-warning' };
    }
    if (presentCount < requiredCount) {
      return { text: `Need ${requiredCount - presentCount} More Workers`, className: 'health-critical' };
    }
    return { text: 'Fully Staffed', className: 'health-success' };
  };

  // Initials extractor
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatISTDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    };
    return new Date().toLocaleDateString('en-IN', options);
  };

  // Projects needing attention counts (shortages)
  const projectsNeedingAttention = activeProjects.filter(p => p.presentCount < p.requiredCount).length;

  // Filtered timeline updates for Section 5 (Today's Changes Panel)
  const visibleTimeline = showFullHistory ? timeline : timeline.slice(0, 5);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p style={{ marginTop: '16px', color: '#64748b' }}>Loading daily operations dashboard...</p>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 70vh;
          }
          .spinner {
            border: 4px solid rgba(0, 0, 0, 0.05);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border-left-color: var(--primary);
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="operations-workspace">
      
      {/* SECTION 1 — TODAY'S SNAPSHOT */}
      <div className="snapshot-section">
        <div className="snapshot-header">
          <div className="date-display">
            <span className="calendar-icon">📅</span>
            <div>
              <h1 className="date-title">{formatISTDate()}</h1>
              <p className="date-subtitle">Workforce Operations Snapshot</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {operationLoading && <span className="action-saving">💾 Saving...</span>}
            <button onClick={refreshData} className="btn-refresh">
              🔄 Refresh Board
            </button>
          </div>
        </div>

        <div className="snapshot-metrics-grid">
          <div className="metric-card active-projs">
            <span className="metric-val">{activeProjects.length}</span>
            <span className="metric-label">Active Projects</span>
          </div>
          <div className="metric-card present-workers">
            <span className="metric-val">{workforceSummary.presentToday}</span>
            <span className="metric-label">Present Workers</span>
          </div>
          <div className="metric-card absent-workers">
            <span className="metric-val">{workforceSummary.absentToday}</span>
            <span className="metric-label">Absent Workers</span>
          </div>
          <div className="metric-card attention-projs">
            <span className="metric-val">{projectsNeedingAttention}</span>
            <span className="metric-label">Projects Needing Attention</span>
          </div>
          <div className="metric-card available-workers">
            <span className="metric-val">{availableLabourers.length}</span>
            <span className="metric-label">Available Workers</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-banner error">
          ⚠️ {error}
        </div>
      )}

      {/* SECTION 2 — ACTIVE PROJECTS TODAY */}
      <div className="section-container">
        <div className="section-header-bar">
          <h2>🏗️ Active Projects Today</h2>
          <span className="section-hint">Drag workers from available pool to allocate them.</span>
        </div>

        <div className="projects-grid">
          {activeProjects.length === 0 ? (
            <div className="empty-section-state">
              No active projects found. Enable status in Projects module.
            </div>
          ) : (
            activeProjects.map((project) => {
              const isDragOver = dragOverProjectId === project.id;
              const workers = project.labourers || [];
              const health = getProjectHealth(project.presentCount, project.requiredCount);
              const cardStatusClass = health.className; // health-success, health-warning, health-critical

              return (
                <div 
                  key={project.id}
                  className={`project-grid-card ${cardStatusClass} ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOverProject(e, project.id)}
                  onDragLeave={handleDragLeaveProject}
                  onDrop={(e) => handleDropOnProject(e, project.id)}
                >
                  <div className="proj-card-header">
                    <div>
                      <h3 className="proj-card-title">{project.projectName}</h3>
                      <span className="proj-card-client">📍 {project.clientName}</span>
                    </div>
                    <span className="proj-card-stage">{project.status}</span>
                  </div>

                  <div className="proj-card-body">
                    {/* staffing ratio requirements metadata */}
                    <div className="proj-card-staffing">
                      <div className="requirements-summary-block">
                        <span className="req-item">Required: <strong>{project.requiredCount}</strong></span>
                        <span className="req-separator">|</span>
                        <span className="req-item">Assigned: <strong>{project.assignedCount}</strong></span>
                        <span className="req-separator">|</span>
                        <span className="req-item">Present: <strong style={{ color: '#16a34a' }}>{project.presentCount}</strong></span>
                        <span className="req-separator">|</span>
                        <span className="req-item">Absent: <strong style={{ color: '#dc2626' }}>{project.absentCount}</strong></span>
                      </div>
                      <div className={`health-status-text ${cardStatusClass}`}>
                        {health.text}
                      </div>
                    </div>

                    <div className="proj-assigned-workers-column">
                      {workers.length === 0 ? (
                        <div className="no-workers-badge">[No Workers Assigned - Drop Available Worker Here]</div>
                      ) : (
                        <div className="workers-list-vertical">
                          {workers.map((worker) => {
                            const todayStatus = worker.todayAttendance?.status || 'Unmarked';
                            
                            return (
                              <div 
                                key={worker.id} 
                                className={`worker-card-premium status-${todayStatus.toLowerCase().replace(' ', '')}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, worker.id, project.id, worker.assignmentId)}
                              >
                                <div className="worker-header-row">
                                  <div className="avatar-circle">
                                    {getInitials(worker.name)}
                                  </div>
                                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                                    <div className="worker-details-name">{worker.name}</div>
                                    <span className={`skill-tag-badge ${getSkillClassName(worker.skillType)}`}>
                                      {worker.skillType}
                                    </span>
                                  </div>
                                  
                                  <div className="status-badge-inline">
                                    <span className="status-dot"></span>
                                    <span className="status-text">{todayStatus}</span>
                                  </div>
 
                                  {/* Quick Reallocate Dropdown Menu overlay */}
                                  <select 
                                    value={project.id}
                                    onChange={(e) => handleTransferWorker(worker.id, project.id, e.target.value)}
                                    className="worker-transfer-select"
                                    title="Transfer worker to another project site"
                                  >
                                    <option value={project.id}>Stay here</option>
                                    {activeProjects.filter(p => p.id !== project.id).map(p => (
                                      <option key={p.id} value={p.id}>Move to {p.projectName}</option>
                                    ))}
                                  </select>
                                </div>
 
                                 {/* 3-State Attendance capsules on card */}
                                 <div className="attendance-capsules-grid">
                                   <button 
                                     onClick={() => handleSaveLabourerAttendance(worker.id, project.id, 'Present')}
                                     className={`capsule-btn present ${todayStatus === 'Present' ? 'active' : ''}`}
                                   >
                                     <span className="capsule-long">Present</span>
                                     <span className="capsule-short">P</span>
                                   </button>
                                   <button 
                                     onClick={() => handleSaveLabourerAttendance(worker.id, project.id, 'Absent')}
                                     className={`capsule-btn absent ${todayStatus === 'Absent' ? 'active' : ''}`}
                                   >
                                     <span className="capsule-long">Absent</span>
                                     <span className="capsule-short">A</span>
                                   </button>
                                   <button 
                                     onClick={() => handleSaveLabourerAttendance(worker.id, project.id, 'Half Day')}
                                     className={`capsule-btn halfday ${todayStatus === 'Half Day' ? 'active' : ''}`}
                                   >
                                     <span className="capsule-long">Half Day</span>
                                     <span className="capsule-short">H</span>
                                   </button>
                                 </div>
 
                                 {/* Optional remarks field shown after marking status */}
                                 {todayStatus !== 'Unmarked' && (
                                   <div className="worker-remarks-workspace">
                                     {expandedNotes[worker.id] || labourNotes[worker.id] ? (
                                       <div className="daily-note-textarea-container">
                                         <textarea 
                                           placeholder="Enter attendance remark..."
                                           value={labourNotes[worker.id] || ''}
                                           onChange={(e) => {
                                             const text = e.target.value;
                                             setLabourNotes(prev => ({ ...prev, [worker.id]: text }));
                                           }}
                                           onBlur={() => handleSaveLabourNote(worker.id, project.id, todayStatus, labourNotes[worker.id])}
                                           className="daily-note-text-area"
                                           autoFocus
                                           rows={3}
                                         />
                                       </div>
                                     ) : (
                                       <button
                                         type="button"
                                         onClick={() => setExpandedNotes(prev => ({ ...prev, [worker.id]: true }))}
                                         className="btn-add-remark"
                                       >
                                         📝 Add Remark
                                       </button>
                                     )}
                                   </div>
                                 )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Daily Project Note */}
                    <div className="project-daily-note-container">
                      <span className="proj-note-label">📝 Project Daily Notes</span>
                      <textarea 
                        placeholder={`Supervisor observations for today\n\nExample:\nBedroom wardrobe installation completed successfully.\nCustomer requested additional shelving near study table.`}
                        value={projectDailyNotes[project.id] || ''}
                        onChange={(e) => {
                          const text = e.target.value;
                          setProjectDailyNotes(prev => ({ ...prev, [project.id]: text }));
                        }}
                        onBlur={() => handleSaveProjectDailyNote(project.id, projectDailyNotes[project.id])}
                        className="project-daily-note-field"
                        rows={5}
                      />
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
 
      {/* SECTION 3 — AVAILABLE WORKERS */}
      <div className="section-container">
        <div className="section-header-bar">
          <h2>🔨 Available Worker Pool ({availableLabourers.length})</h2>
          <span className="section-hint">Unassigned available labourers. Drag to a project or assign via select.</span>
        </div>
 
        <div 
          className={`available-workers-grid ${dragOverAvailable ? 'drag-over' : ''}`}
          onDragOver={handleDragOverAvailable}
          onDragLeave={handleDragLeaveAvailable}
          onDrop={handleDropOnAvailablePool}
        >
          {availableLabourers.length === 0 ? (
            <div className="empty-section-state" style={{ gridColumn: '1 / -1' }}>
              All labourers allocated. Drag assigned worker cards back to this grid from Section 2 to release them.
            </div>
          ) : (
            availableLabourers.map((lab: LabourerShort) => {
              const todayStatus = lab.todayAttendance?.status || 'Unmarked';
              const cardStatusClass = todayStatus.toLowerCase().replace(' ', '');

              return (
                <div 
                  key={lab.id} 
                  className={`available-worker-card-premium status-${cardStatusClass}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lab.id, null, null)}
                >
                  <div className="available-worker-header">
                    <div className="avatar-circle dark">
                      {getInitials(lab.name)}
                    </div>
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <h3 className="worker-card-name">{lab.name}</h3>
                      <span className={`skill-tag-badge ${getSkillClassName(lab.skillType)}`}>
                        {lab.skillType}
                      </span>
                    </div>
                  </div>
 
                  <div className="available-actions-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                    {/* 3-State Attendance capsules on card */}
                    <div className="attendance-capsules-grid" style={{ width: '100%', border: 'none', margin: 0, padding: 0 }}>
                      <button 
                        onClick={() => handleSaveLabourerAttendance(lab.id, null, 'Present')}
                        className={`capsule-btn present ${todayStatus === 'Present' ? 'active' : ''}`}
                      >
                        <span className="capsule-long">Present</span>
                        <span className="capsule-short">P</span>
                      </button>
                      <button 
                        onClick={() => handleSaveLabourerAttendance(lab.id, null, 'Absent')}
                        className={`capsule-btn absent ${todayStatus === 'Absent' ? 'active' : ''}`}
                      >
                        <span className="capsule-long">Absent</span>
                        <span className="capsule-short">A</span>
                      </button>
                      <button 
                        onClick={() => handleSaveLabourerAttendance(lab.id, null, 'Half Day')}
                        className={`capsule-btn halfday ${todayStatus === 'Half Day' ? 'active' : ''}`}
                      >
                        <span className="capsule-long">Half Day</span>
                        <span className="capsule-short">H</span>
                      </button>
                    </div>

                    {/* Optional remarks field shown after marking status */}
                    {todayStatus !== 'Unmarked' && (
                      <div className="worker-remarks-workspace" style={{ width: '100%' }}>
                        {expandedNotes[lab.id] || labourNotes[lab.id] ? (
                          <div className="daily-note-textarea-container">
                            <textarea 
                              placeholder="Enter attendance remark..."
                              value={labourNotes[lab.id] || ''}
                              onChange={(e) => {
                                const text = e.target.value;
                                setLabourNotes(prev => ({ ...prev, [lab.id]: text }));
                              }}
                              onBlur={() => handleSaveLabourNote(lab.id, null, todayStatus, labourNotes[lab.id])}
                              className="daily-note-text-area"
                              autoFocus
                              rows={3}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedNotes(prev => ({ ...prev, [lab.id]: true }))}
                            className="btn-add-remark"
                          >
                            📝 Add Remark
                          </button>
                        )}
                      </div>
                    )}

                    {/* Assign to project dropdown select */}
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <select 
                        value="" 
                        onChange={(e) => handleQuickAssign(lab.id, e.target.value)}
                        className="available-assign-select"
                        style={{ width: '100%', maxWidth: 'none' }}
                      >
                        <option value="">➕ Assign Project...</option>
                        {activeProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.projectName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 4 — TODAY'S CHANGES PANEL (DARK GLASSMORPHIC TIMELINE) */}
      <div className="section-container activity-section">
        <div className="section-header-bar">
          <h2 style={{ color: '#f8fafc' }}>⚡ Today&apos;s Changes & Operations Feed</h2>
        </div>

        <div className="dark-activity-container">
          {visibleTimeline.length === 0 ? (
            <div className="empty-section-state text-light">
              No daily changes recorded.
            </div>
          ) : (
            <div className="timeline-thread">
              {visibleTimeline.map((act) => {
                const formattedTime = new Date(act.createdAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
                const desc = formatTimelineDescription(act.description);
                const icon = getTimelineIcon(desc);
                
                return (
                  <div key={act.id} className="timeline-item">
                    <div className="timeline-dot">
                      <span className="dot-inner"></span>
                    </div>
                    <div className="timeline-card">
                      <div className="timeline-header-row">
                        <span className="timeline-time">{formattedTime}</span>
                        <span className="timeline-icon">{icon}</span>
                      </div>
                      <p className="timeline-description">{desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {timeline.length > 5 && (
            <div className="timeline-actions-row">
              <button 
                onClick={() => setShowFullHistory(!showFullHistory)}
                className="btn-toggle-timeline"
              >
                {showFullHistory ? 'Close Timeline History' : 'View Full Timeline History'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        /* WORKSPACE GLOBAL THEME */
        body {
          background-color: #f8fafc !important;
        }

        .operations-workspace {
          display: flex;
          flex-direction: column;
          gap: 32px;
          padding: 16px 0;
          color: #334155;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* SECTION 1 - TODAY'S SNAPSHOT */
        .snapshot-section {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
        }

        .snapshot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .date-display {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .calendar-icon {
          font-size: 2.2rem;
        }

        .date-title {
          font-size: 1.8rem;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.8px;
          margin: 0;
        }

        .date-subtitle {
          font-size: 0.85rem;
          color: #64748b;
          margin-top: 4px;
          font-weight: bold;
        }

        .btn-refresh {
          background: white;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .btn-refresh:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          transform: translateY(-1px);
        }

        /* Metrics grid */
        .snapshot-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 16px;
        }

        .metric-card {
          display: flex;
          flex-direction: column;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          text-align: center;
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.03);
        }

        .metric-val {
          font-size: 2.2rem;
          font-weight: 900;
          color: #0f172a;
          line-height: 1;
        }

        .metric-label {
          font-size: 0.75rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-top: 8px;
        }

        .metric-card.active-projs .metric-val { color: #0f172a; }
        .metric-card.present-workers .metric-val { color: #16a34a; }
        .metric-card.absent-workers .metric-val { color: #dc2626; }
        .metric-card.attention-projs .metric-val { color: #d97706; }
        .metric-card.available-workers .metric-val { color: #2563eb; }

        /* GENERAL SECTION CONTAINER */
        .section-container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
        }

        .section-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }

        .section-header-bar h2 {
          font-size: 1.2rem;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
        }

        .section-hint {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 600;
        }

        .empty-section-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 120px;
          border: 2px dashed #cbd5e1;
          border-radius: 8px;
          color: #94a3b8;
          font-size: 0.8rem;
          background: #f8fafc;
        }

        /* SECTION 2 - ACTIVE PROJECTS GRID */
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .project-grid-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-top: 4px solid #cbd5e1;
          border-radius: 12px;
          padding: 18px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }

        .project-grid-card.drag-over {
          background-color: #eff6ff;
          outline: 2px dashed #2563eb;
        }

        /* STAFFING COLOR OVERWRITES FOR PROJECT CARDS */
        .project-grid-card.health-success {
          border-top-color: #22c55e;
          background-color: #fcfdfd;
        }

        .project-grid-card.health-warning {
          border-top-color: #f59e0b;
          background-color: #fffdfb;
        }

        .project-grid-card.health-critical {
          border-top-color: #ef4444;
          background-color: #fffbfb;
        }

        .project-grid-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.05);
        }

        .proj-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .proj-card-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .proj-card-client {
          font-size: 0.75rem;
          color: #64748b;
          display: block;
          margin-top: 2px;
        }

        .proj-card-stage {
          font-size: 0.65rem;
          font-weight: 800;
          background: #f1f5f9;
          color: #475569;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        /* staffing ratio text */
        .proj-card-staffing {
          display: flex;
          flex-direction: column;
          gap: 4px;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 10px;
          margin-bottom: 6px;
        }

        .requirements-summary-block {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 0.75rem;
          color: #64748b;
        }

        .req-separator {
          color: #cbd5e1;
        }

        .health-status-text {
          font-size: 0.8rem;
          font-weight: 800;
        }
        .health-status-text.health-success { color: #166534; }
        .health-status-text.health-warning { color: #9a3412; }
        .health-status-text.health-status-text.health-critical { color: #991b1b; }

        .no-workers-badge {
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 700;
          text-align: center;
          padding: 16px;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          background: #f8fafc;
        }

        /* Assigned Worker Lists inside Project Card */
        .workers-list-vertical {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Assigned worker card */
        .worker-card-premium {
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px;
          position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.01);
          transition: border-color 0.15s, background-color 0.15s;
        }

        /* Color transitions matching status */
        .worker-card-premium.status-present {
          border-color: #86efac;
          background-color: #f0fdf4;
        }
        .worker-card-premium.status-absent {
          border-color: #fca5a5;
          background-color: #fef2f2;
        }
        .worker-card-premium.status-halfday {
          border-color: #fde047;
          background-color: #fffbeb;
        }
        .worker-card-premium.status-leave {
          border-color: #93c5fd;
          background-color: #eff6ff;
        }

        .worker-card-premium:hover {
          border-color: #94a3b8;
        }

        .worker-details-name {
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
        }

        .avatar-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #64748b;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.8rem;
          flex-shrink: 0;
        }

        .avatar-circle.dark {
          background: #1e293b;
          color: #f8fafc;
        }

        /* Skill tag classes */
        .skill-tag-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 9999px;
          margin-top: 2px;
          text-transform: uppercase;
        }

        .status-badge-inline {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          color: #475569;
          background: white;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #cbd5e1;
        }

        .status-badge-inline .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-present .status-badge-inline .status-dot { background: #22c55e; }
        .status-absent .status-badge-inline .status-dot { background: #ef4444; }
        .status-halfday .status-badge-inline .status-dot { background: #f59e0b; }
        .status-leave .status-badge-inline .status-dot { background: #3b82f6; }

        /* Transfer Selector select overlay */
        .worker-transfer-select {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 36px;
          opacity: 0;
          cursor: pointer;
        }

        /* 3-State Attendance Buttons */
        .attendance-capsules-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          margin-top: 10px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 10px;
        }

        .capsule-btn {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 5px 0;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s;
          text-align: center;
          outline: none;
        }

        .capsule-btn:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }

        .capsule-btn.present.active { background: #22c55e; color: white; border-color: #22c55e; box-shadow: 0 1px 3px rgba(34,197,94,0.2); }
        .capsule-btn.absent.active { background: #ef4444; color: white; border-color: #ef4444; box-shadow: 0 1px 3px rgba(239,68,68,0.2); }
        .capsule-btn.halfday.active { background: #f59e0b; color: white; border-color: #f59e0b; box-shadow: 0 1px 3px rgba(245,158,11,0.2); }
        .capsule-btn.leave.active { background: #3b82f6; color: white; border-color: #3b82f6; box-shadow: 0 1px 3px rgba(59,130,246,0.2); }

        .capsule-short {
          display: none;
        }

        .capsule-long {
          display: inline;
        }

        @media (max-width: 640px) {
          .capsule-long {
            display: none;
          }
          .capsule-short {
            display: inline;
            font-size: 0.85rem;
            font-weight: 800;
          }
          .attendance-capsules-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            max-width: 170px;
            margin-left: auto;
            margin-right: auto;
          }
          .capsule-btn {
            padding: 0;
            border-radius: 50% !important;
            aspect-ratio: 1 / 1;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
          }
        }

        /* Notes fields */
        .worker-remarks-workspace {
          margin-top: 10px;
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .btn-add-remark {
          background: transparent;
          border: none;
          color: #4f46e5;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 0;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: color 0.15s;
          outline: none;
          width: fit-content;
        }

        .btn-add-remark:hover {
          color: #4338ca;
          text-decoration: underline;
        }

        .daily-note-textarea-container {
          width: 100%;
          margin-top: 6px;
        }

        .daily-note-text-area {
          width: 100%;
          min-height: 80px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 0.75rem;
          color: #334155;
          background-color: #f8fafc;
          outline: none;
          resize: vertical;
          box-sizing: border-box;
          font-family: inherit;
          line-height: 1.4;
          transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
        }

        .daily-note-text-area:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
          background-color: #ffffff;
        }

        /* Project Daily Note styles */
        .project-daily-note-container {
          margin-top: 16px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }

        .proj-note-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #475569;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .project-daily-note-field {
          width: 100%;
          min-height: 120px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 0.75rem;
          color: #334155;
          background-color: #fcfcfd;
          outline: none;
          resize: vertical;
          box-sizing: border-box;
          font-family: inherit;
          line-height: 1.5;
          transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
        }

        .project-daily-note-field:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
          background-color: #ffffff;
        }

        /* SECTION 3 - AVAILABLE WORKERS */
        .available-workers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
          border-radius: 8px;
          padding: 4px;
          transition: background-color 0.2s, outline 0.2s;
        }

        .available-workers-grid.drag-over {
          background-color: #eff6ff;
          outline: 2px dashed #2563eb;
        }

        .available-worker-card-premium {
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          gap: 10px;
          cursor: grab;
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .available-worker-card-premium:active {
          cursor: grabbing;
        }

        .available-worker-card-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.04);
          border-color: #94a3b8;
        }

        .available-worker-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .available-actions-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px dashed #e2e8f0;
          padding-top: 10px;
          gap: 8px;
        }

        .available-attendance-quick {
          display: flex;
          gap: 4px;
        }

        .btn-quick-att {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid #cbd5e1;
          background: white;
          font-size: 0.65rem;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-quick-att.present:hover { background: #dcfce7; color: #15803d; border-color: #22c55e; }
        .btn-quick-att.absent:hover { background: #fee2e2; color: #b91c1c; border-color: #ef4444; }
        .btn-quick-att.leave:hover { background: #dbeafe; color: #1d4ed8; border-color: #3b82f6; }

        .available-assign-select {
          background: white;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 0.75rem;
          font-weight: bold;
          padding: 4px 6px;
          border-radius: 6px;
          cursor: pointer;
          max-width: 130px;
          outline: none;
        }

        /* SECTION 4 - TIMELINE CHANGES PANEL (DARK THEME) */
        .activity-section {
          background: rgba(15, 23, 42, 0.95) !important;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px 0 rgba(15, 23, 42, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
        }

        .dark-activity-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .timeline-thread {
          display: flex;
          flex-direction: column;
          position: relative;
          padding-left: 20px;
        }

        .timeline-thread::before {
          content: '';
          position: absolute;
          left: 4px;
          top: 10px;
          bottom: 10px;
          width: 2px;
          background: #334155;
        }

        .timeline-item {
          display: flex;
          position: relative;
          margin-bottom: 12px;
        }

        .timeline-dot {
          position: absolute;
          left: -20px;
          top: 6px;
          width: 10px;
          height: 10px;
          background: #0f172a;
          border: 2px solid #38bdf8;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .dot-inner {
          width: 4px;
          height: 4px;
          background: #38bdf8;
          border-radius: 50%;
        }

        .timeline-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 8px 12px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .timeline-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .timeline-time {
          font-size: 0.7rem;
          font-weight: 800;
          color: #38bdf8;
        }

        .timeline-icon {
          font-size: 0.85rem;
        }

        .timeline-description {
          font-size: 0.8rem;
          color: #cbd5e1;
          margin: 0;
          line-height: 1.4;
        }

        .btn-toggle-timeline {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f8fafc;
          font-size: 0.75rem;
          font-weight: bold;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-toggle-timeline:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  );
}
