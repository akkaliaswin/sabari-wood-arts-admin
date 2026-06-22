'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Labourer {
  id: string;
  labourCode: string;
  name: string;
  skillType: string;
  activeStatus: boolean;
  phone: string;
}

interface ProjectShort {
  id: string;
  projectName: string;
  projectCode: string;
  status: string;
}

interface ActiveAssignment {
  id: string;
  projectId: string;
  labourerId: string;
  role: string;
  assignedDate: string;
  isActive: boolean;
  remarks: string | null;
  project: {
    id: string;
    projectName: string;
    projectCode: string;
  };
  labourer: {
    id: string;
    name: string;
    labourCode: string;
    skillType: string;
  };
}

interface AttendanceRecord {
  id: string;
  labourerId: string;
  projectId: string | null;
  attendanceDate: string;
  status: string;
  remarks: string | null;
  labourer?: {
    id: string;
    name: string;
    labourCode: string;
    skillType: string;
    phone: string;
  };
  project?: {
    id: string;
    projectName: string;
    projectCode: string;
  } | null;
}

interface AnalyticsMetrics {
  presentToday: number;
  absentToday: number;
  halfDayToday: number;
  leaveToday: number;
  totalActiveLabourersCount: number;
  activeAssignmentsCount: number;
  attendancePercentage: number;
  mostActiveLabourer: string;
  monthlyTrend: { month: string; percentage: number }[];
  projectAttendanceRanking: { id: string; name: string; percentage: number }[];
  absenceTrend: { month: string; count: number }[];
  leaveAnalysis: {
    Present: number;
    Absent: number;
    'Half Day': number;
    Leave: number;
  };
  labourerSummary: {
    id: string;
    name: string;
    labourCode: string;
    skillType: string;
    totalDays: number;
    presentDays: number;
    absentDays: number;
    halfDays: number;
    percentage: number;
  }[];
}

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<'mark' | 'allocation' | 'analytics' | 'reports'>('mark');
  const [labourers, setLabourers] = useState<Labourer[]>([]);
  const [projects, setProjects] = useState<ProjectShort[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<ActiveAssignment[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Marking Form States
  const [selectedDate, setSelectedDate] = useState(() => {
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return nowIST.toISOString().split('T')[0];
  });
  const [markingRecords, setMarkingRecords] = useState<Record<string, { status: string; projectId: string; remarks: string }>>({});
  const [selectedLabourerIds, setSelectedLabourerIds] = useState<Record<string, boolean>>({});
  const [bulkStatus, setBulkStatus] = useState('Present');
  const [bulkProjectId, setBulkProjectId] = useState('');
  const [submittingMarking, setSubmittingMarking] = useState(false);

  // Allocation Manager States
  const [allocatingLabourerId, setAllocatingLabourerId] = useState('');
  const [allocateProjectId, setAllocateProjectId] = useState('');
  const [allocateRole, setAllocateRole] = useState('Carpenter');
  const [allocateRemarks, setAllocateRemarks] = useState('');
  const [submittingAllocation, setSubmittingAllocation] = useState(false);

  const [transferringAssignmentId, setTransferringAssignmentId] = useState<string | null>(null);
  const [transferProjectId, setTransferProjectId] = useState('');
  const [transferRole, setTransferRole] = useState('Carpenter');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Reports Filter States
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterLabourerId, setFilterLabourerId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterSkillType, setFilterSkillType] = useState('');
  const [filtering, setFiltering] = useState(false);

  const skills = ['Carpenter', 'Polisher', 'Painter', 'Helper', 'Installer'];

  // Fetch metrics and records
  const fetchAttendanceAndMetrics = useCallback(async (queryParamsStr = '') => {
    try {
      const res = await fetch(`/api/labourers/attendance${queryParamsStr}`);
      if (!res.ok) throw new Error('Failed to fetch attendance metrics');
      const data = await res.json();
      setRecords(data.records);
      setMetrics(data.metrics);
    } catch (err) {
      console.error('Error fetching attendance metrics:', err);
    }
  }, []);

  // Fetch active assignments
  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/labourers/assignments?isActive=true');
      if (!res.ok) throw new Error('Failed to fetch active assignments');
      const data = await res.json();
      setActiveAssignments(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch attendance for a specific date and populate marking form
  const fetchAttendanceForDate = useCallback(async (dateStr: string, activeLabsList: Labourer[], assignmentsList: ActiveAssignment[]) => {
    try {
      const res = await fetch(`/api/labourers/attendance?startDate=${dateStr}&endDate=${dateStr}`);
      if (!res.ok) throw new Error('Failed to load attendance for date');
      const data = await res.json();
      
      const savedRecords: AttendanceRecord[] = data.records;
      const initialMarking: Record<string, { status: string; projectId: string; remarks: string }> = {};

      activeLabsList.forEach(l => {
        const saved = savedRecords.find(r => r.labourerId === l.id);
        const assigned = assignmentsList.find(a => a.labourerId === l.id);

        if (saved) {
          initialMarking[l.id] = {
            status: saved.status,
            projectId: saved.projectId || '',
            remarks: saved.remarks || '',
          };
        } else {
          initialMarking[l.id] = {
            status: 'Present',
            projectId: assigned?.projectId || '',
            remarks: '',
          };
        }
      });
      setMarkingRecords(initialMarking);
    } catch (err) {
      console.error('Error loading attendance for date:', err);
    }
  }, []);

  // Load all initial lookup data
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch active labourers
      const labRes = await fetch('/api/labourers');
      if (!labRes.ok) throw new Error('Failed to load labourers');
      const labData: Labourer[] = await labRes.json();
      const activeLabs = labData.filter(l => l.activeStatus);
      setLabourers(activeLabs);

      // 2. Fetch projects
      const projRes = await fetch('/api/projects');
      if (!projRes.ok) throw new Error('Failed to load projects');
      const projData: ProjectShort[] = await projRes.json();
      const activeProjs = projData.filter(p => p.status !== 'Completed' && p.status !== 'Cancelled');
      setProjects(activeProjs);

      // 3. Fetch active assignments
      const assignRes = await fetch('/api/labourers/assignments?isActive=true');
      if (!assignRes.ok) throw new Error('Failed to load active assignments');
      const assignmentsList: ActiveAssignment[] = await assignRes.json();
      setActiveAssignments(assignmentsList);

      // 4. Fetch date-specific attendance
      await fetchAttendanceForDate(selectedDate, activeLabs, assignmentsList);

      // 5. Fetch overall analytics metrics and records
      await fetchAttendanceAndMetrics();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred loading attendance data';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, fetchAttendanceForDate, fetchAttendanceAndMetrics]);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Read pre-filtered query params if any
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const lId = params.get('labourerId');
        if (lId) {
          setFilterLabourerId(lId);
          setActiveTab('reports');
        }
      }
      fetchInitialData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInitialData]);

  // Handle date change in marking form
  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    // Reload attendance records for the newly selected date
    setLoading(true);
    await fetchAttendanceForDate(newDate, labourers, activeAssignments);
    setLoading(false);
  };

  // Run reports filtering
  const handleApplyFilters = async (e: React.FormEvent) => {
    e.preventDefault();
    setFiltering(true);
    const params = new URLSearchParams();
    if (filterStartDate) params.append('startDate', filterStartDate);
    if (filterEndDate) params.append('endDate', filterEndDate);
    if (filterLabourerId) params.append('labourerId', filterLabourerId);
    if (filterProjectId) params.append('projectId', filterProjectId);
    if (filterSkillType) params.append('skillType', filterSkillType);

    await fetchAttendanceAndMetrics('?' + params.toString());
    setFiltering(false);
  };

  const handleClearFilters = async () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterLabourerId('');
    setFilterProjectId('');
    setFilterSkillType('');
    setFiltering(true);
    await fetchAttendanceAndMetrics();
    setFiltering(false);
  };

  // Handle individual marking status change
  const handleStatusChange = (labourerId: string, status: string) => {
    setMarkingRecords(prev => ({
      ...prev,
      [labourerId]: {
        ...prev[labourerId],
        status,
      },
    }));
  };

  // Handle individual marking project change
  const handleProjectChange = (labourerId: string, projectId: string) => {
    setMarkingRecords(prev => ({
      ...prev,
      [labourerId]: {
        ...prev[labourerId],
        projectId,
      },
    }));
  };

  // Handle individual marking remarks change
  const handleRemarksChange = (labourerId: string, remarks: string) => {
    setMarkingRecords(prev => ({
      ...prev,
      [labourerId]: {
        ...prev[labourerId],
        remarks,
      },
    }));
  };

  // Select checkbox
  const handleSelectChange = (labourerId: string, checked: boolean) => {
    setSelectedLabourerIds(prev => ({
      ...prev,
      [labourerId]: checked,
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      labourers.forEach(l => {
        updated[l.id] = true;
      });
    }
    setSelectedLabourerIds(updated);
  };

  // Bulk status / project application
  const handleApplyBulkActions = () => {
    const selectedIds = Object.keys(selectedLabourerIds).filter(id => selectedLabourerIds[id]);
    if (selectedIds.length === 0) {
      alert('Please select at least one worker first using the checkboxes.');
      return;
    }

    setMarkingRecords(prev => {
      const updated = { ...prev };
      selectedIds.forEach(id => {
        updated[id] = {
          ...updated[id],
          status: bulkStatus,
          projectId: bulkProjectId !== '' ? bulkProjectId : updated[id]?.projectId || '',
        };
      });
      return updated;
    });

    alert(`Applied bulk settings to ${selectedIds.length} selected workers.`);
  };

  // Submit daily attendance marking
  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedIds = Object.keys(selectedLabourerIds).filter(id => selectedLabourerIds[id]);
      if (selectedIds.length === 0) {
        alert('Please select at least one worker to save attendance.');
        return;
      }

      setSubmittingMarking(true);
      const postRecords = labourers
        .filter(l => selectedLabourerIds[l.id])
        .map(l => ({
          labourerId: l.id,
          status: markingRecords[l.id]?.status || 'Present',
          projectId: markingRecords[l.id]?.projectId || null,
          remarks: markingRecords[l.id]?.remarks || '',
        }));

      const res = await fetch('/api/labourers/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          records: postRecords,
        }),
      });

      if (!res.ok) throw new Error('Failed to save attendance logs');

      alert('Daily attendance logs recorded successfully!');
      
      // Reload stats and current list
      await fetchAttendanceForDate(selectedDate, labourers, activeAssignments);
      await fetchAttendanceAndMetrics();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving attendance';
      alert(errorMsg);
    } finally {
      setSubmittingMarking(false);
    }
  };

  // Allocate worker to project
  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingLabourerId || !allocateProjectId || !allocateRole) {
      alert('Please fill in all allocation fields.');
      return;
    }

    try {
      setSubmittingAllocation(true);
      const res = await fetch('/api/labourers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: allocateProjectId,
          labourerId: allocatingLabourerId,
          role: allocateRole,
          remarks: allocateRemarks,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to allocate worker');
      }

      alert('Labourer allocated successfully!');
      setAllocatingLabourerId('');
      setAllocateProjectId('');
      setAllocateRemarks('');
      
      // Refresh assignments and page list
      await fetchAssignments();
      await fetchInitialData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error assigning worker';
      alert(errorMsg);
    } finally {
      setSubmittingAllocation(false);
    }
  };

  // Transfer worker to another project
  const handleTransferAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringAssignmentId || !transferProjectId || !transferRole) {
      alert('Please fill in all transfer fields.');
      return;
    }

    const assignment = activeAssignments.find(a => a.id === transferringAssignmentId);
    if (!assignment) return;

    try {
      setSubmittingTransfer(true);
      const res = await fetch('/api/labourers/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: transferProjectId,
          labourerId: assignment.labourerId,
          role: transferRole,
          remarks: transferRemarks,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to transfer worker');
      }

      alert('Labourer transferred successfully!');
      setTransferringAssignmentId(null);
      setTransferProjectId('');
      setTransferRemarks('');

      await fetchAssignments();
      await fetchInitialData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error transferring worker';
      alert(errorMsg);
    } finally {
      setSubmittingTransfer(false);
    }
  };

  // End assignment (unallocate)
  const handleEndAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to end this project assignment? The labourer will become unassigned.')) {
      return;
    }

    try {
      const res = await fetch(`/api/labourers/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: false,
        }),
      });

      if (!res.ok) throw new Error('Failed to end assignment');
      alert('Project assignment ended successfully!');
      
      await fetchAssignments();
      await fetchInitialData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error ending assignment';
      alert(errorMsg);
    }
  };

  // CSV Export utility
  const handleExportCSV = () => {
    if (records.length === 0) {
      alert('No attendance logs match the active filter criteria.');
      return;
    }

    const headers = ['Date', 'Labourer Code', 'Name', 'Skill Type', 'Assigned Project', 'Status', 'Remarks'];
    const csvRows = [
      headers.join(','),
      ...records.map(r => {
        const formattedDate = new Date(r.attendanceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const code = r.labourer?.labourCode || '';
        const name = r.labourer?.name || '';
        const skill = r.labourer?.skillType || '';
        const projectStr = r.project ? `${r.project.projectName} (${r.project.projectCode})` : 'General / Unallocated';
        const status = r.status || '';
        const remarks = r.remarks || '';

        return [
          `"${formattedDate.replace(/"/g, '""')}"`,
          `"${code.replace(/"/g, '""')}"`,
          `"${name.replace(/"/g, '""')}"`,
          `"${skill.replace(/"/g, '""')}"`,
          `"${projectStr.replace(/"/g, '""')}"`,
          `"${status.replace(/"/g, '""')}"`,
          `"${remarks.replace(/"/g, '""')}"`
        ].join(',');
      })
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Labour_Attendance_Logs_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group active assignments by project
  const assignmentsByProject = projects.map(p => {
    const list = activeAssignments.filter(a => a.projectId === p.id);
    return {
      project: p,
      assignments: list,
    };
  });

  const unassignedLabourersList = labourers.filter(l => !activeAssignments.some(a => a.labourerId === l.id));

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Link href="/labourers" className="btn btn-secondary btn-sm">
          ⬅️ Back to Labourers
        </Link>
      </div>

      <div className="page-title-section" style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Workforce & Attendance Workspace</h1>
      </div>

      {/* Primary Workspace Navigation Tabs */}
      <div className="tabs-container" style={{ marginBottom: '24px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setActiveTab('mark')}
          className={`tab-button ${activeTab === 'mark' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '130px', fontWeight: 'bold' }}
        >
          📝 Daily Marking
        </button>
        <button
          onClick={() => setActiveTab('allocation')}
          className={`tab-button ${activeTab === 'allocation' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '130px', fontWeight: 'bold' }}
        >
          🪵 Allocation Manager
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '130px', fontWeight: 'bold' }}
        >
          📊 Advanced Analytics
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
          style={{ flex: '1 0 auto', minWidth: '130px', fontWeight: 'bold' }}
        >
          📋 Reports & Exports
        </button>
      </div>

      {loading && activeTab !== 'reports' ? (
        <div className="empty-state"><p>Loading workspace systems...</p></div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)', padding: '16px', marginBottom: '24px' }}>
          <p style={{ color: 'var(--danger)' }}>⚠️ {error}</p>
        </div>
      ) : (
        <>
          {/* TAB 1: DAILY MARKING */}
          {activeTab === 'mark' && (
            <div>
              <form onSubmit={handleSaveAttendance}>
                <div className="card" style={{ background: '#faf9f6', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div className="form-group" style={{ maxWidth: '240px', marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 'bold' }}>Attendance Date</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        style={{ minHeight: '38px', fontSize: '0.95rem' }}
                      />
                    </div>
                    
                    {/* Bulk marking actions bar */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Bulk Action:</span>
                      <select
                        className="form-control"
                        style={{ width: '120px', minHeight: '36px', fontSize: '0.85rem', padding: '4px 8px' }}
                        value={bulkStatus}
                        onChange={(e) => setBulkStatus(e.target.value)}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Half Day">Half Day</option>
                        <option value="Leave">Leave</option>
                      </select>
                      
                      <select
                        className="form-control"
                        style={{ width: '160px', minHeight: '36px', fontSize: '0.85rem', padding: '4px 8px' }}
                        value={bulkProjectId}
                        onChange={(e) => setBulkProjectId(e.target.value)}
                      >
                        <option value="">-- Bulk Project --</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.projectName}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleApplyBulkActions}
                        className="btn btn-secondary btn-sm"
                        style={{ height: '36px', fontSize: '0.8rem', padding: '4px 12px' }}
                      >
                        ⚡ Apply
                      </button>
                    </div>
                  </div>
                </div>

                {labourers.length === 0 ? (
                  <div className="empty-state"><p>No active labourers found. Register labourers first.</p></div>
                ) : (
                  <div>
                    {/* Desktop table */}
                    <div className="table-container" style={{ display: 'none' }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '40px', padding: '12px 16px' }}>
                              <input
                                type="checkbox"
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                            </th>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Skill</th>
                            <th>Assign to Project</th>
                            <th>Status (Thumb-friendly Options)</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labourers.map((lab) => {
                            const current = markingRecords[lab.id] || { status: 'Present', projectId: '', remarks: '' };
                            return (
                              <tr key={lab.id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={!!selectedLabourerIds[lab.id]}
                                    onChange={(e) => handleSelectChange(lab.id, e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                  />
                                </td>
                                <td><strong>{lab.labourCode}</strong></td>
                                <td>
                                  <strong>{lab.name}</strong>
                                </td>
                                <td><span className="badge badge-pending" style={{ background: '#f5f5f5', color: '#666', border: '1px solid #ddd' }}>{lab.skillType}</span></td>
                                <td>
                                  <select
                                    className="form-control"
                                    style={{ minHeight: '34px', fontSize: '0.85rem', padding: '4px' }}
                                    value={current.projectId}
                                    onChange={(e) => handleProjectChange(lab.id, e.target.value)}
                                  >
                                    <option value="">General / Unallocated</option>
                                    {projects.map((p) => (
                                      <option key={p.id} value={p.id}>🪵 {p.projectName}</option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {['Present', 'Absent', 'Half Day', 'Leave'].map((statusOption) => {
                                      let activeClass = '';
                                      if (current.status === statusOption) {
                                        if (statusOption === 'Present') activeClass = 'active-present';
                                        if (statusOption === 'Absent') activeClass = 'active-absent';
                                        if (statusOption === 'Half Day') activeClass = 'active-half';
                                        if (statusOption === 'Leave') activeClass = 'active-leave';
                                      }
                                      return (
                                        <button
                                          key={statusOption}
                                          type="button"
                                          className={`attendance-quick-btn ${activeClass}`}
                                          onClick={() => handleStatusChange(lab.id, statusOption)}
                                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', minHeight: '28px' }}
                                        >
                                          {statusOption}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    placeholder="Remarks/comments..."
                                    className="form-control"
                                    style={{ minHeight: '34px', padding: '4px 8px', fontSize: '0.85rem' }}
                                    value={current.remarks}
                                    onChange={(e) => handleRemarksChange(lab.id, e.target.value)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards view */}
                    <div className="mobile-list-container">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', background: '#faf9f6', padding: '8px 12px', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.85rem' }}>Select All</span>
                        <input
                          type="checkbox"
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                        />
                      </div>
                      
                      {labourers.map((lab) => {
                        const current = markingRecords[lab.id] || { status: 'Present', projectId: '', remarks: '' };
                        return (
                          <div key={lab.id} className="mobile-list-card" style={{ borderLeft: '4px solid var(--primary)', padding: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={!!selectedLabourerIds[lab.id]}
                                  onChange={(e) => handleSelectChange(lab.id, e.target.checked)}
                                  style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{lab.name}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{lab.labourCode} • {lab.skillType}</div>
                                </div>
                              </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '10px' }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Allocated Project Today</label>
                              <select
                                className="form-control"
                                style={{ minHeight: '36px', fontSize: '0.85rem' }}
                                value={current.projectId}
                                onChange={(e) => handleProjectChange(lab.id, e.target.value)}
                              >
                                <option value="">General / Unallocated</option>
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>🪵 {p.projectName}</option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '10px' }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Attendance Status</label>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {['Present', 'Absent', 'Half Day', 'Leave'].map((statusOption) => {
                                  let activeClass = '';
                                  if (current.status === statusOption) {
                                    if (statusOption === 'Present') activeClass = 'active-present';
                                    if (statusOption === 'Absent') activeClass = 'active-absent';
                                    if (statusOption === 'Half Day') activeClass = 'active-half';
                                    if (statusOption === 'Leave') activeClass = 'active-leave';
                                  }
                                  return (
                                    <button
                                      key={statusOption}
                                      type="button"
                                      className={`attendance-quick-btn ${activeClass}`}
                                      onClick={() => handleStatusChange(lab.id, statusOption)}
                                      style={{ flex: 1, padding: '6px', fontSize: '0.75rem', minHeight: '36px' }}
                                    >
                                      {statusOption}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Remarks / Notes</label>
                              <input
                                type="text"
                                placeholder="Remarks..."
                                className="form-control"
                                style={{ minHeight: '36px', padding: '6px 10px', fontSize: '0.85rem' }}
                                value={current.remarks}
                                onChange={(e) => handleRemarksChange(lab.id, e.target.value)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="submit"
                      disabled={submittingMarking}
                      className="btn btn-primary btn-block"
                      style={{ marginTop: '20px', minHeight: '44px', fontWeight: 'bold' }}
                    >
                      {submittingMarking ? '💾 Saving Attendance...' : '💾 Save Attendance Logs'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 2: ALLOCATION MANAGER */}
          {activeTab === 'allocation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Form 1: Allocate unassigned workers */}
              <div className="card" style={{ padding: '20px', background: '#faf9f6' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-muted)' }}>📍 Allocate Available Worker</h3>
                
                {unassignedLabourersList.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    All active workers are currently assigned to projects. Excellent!
                  </p>
                ) : (
                  <form onSubmit={handleCreateAllocation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Labourer *</label>
                        <select
                          className="form-control"
                          required
                          value={allocatingLabourerId}
                          onChange={(e) => setAllocatingLabourerId(e.target.value)}
                          style={{ minHeight: '38px' }}
                        >
                          <option value="">-- Choose Worker --</option>
                          {unassignedLabourersList.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.labourCode}) - {l.skillType}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Assign to Project *</label>
                        <select
                          className="form-control"
                          required
                          value={allocateProjectId}
                          onChange={(e) => setAllocateProjectId(e.target.value)}
                          style={{ minHeight: '38px' }}
                        >
                          <option value="">-- Choose Project --</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.projectName} ({p.projectCode})</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Role/Designation *</label>
                        <select
                          className="form-control"
                          required
                          value={allocateRole}
                          onChange={(e) => setAllocateRole(e.target.value)}
                          style={{ minHeight: '38px' }}
                        >
                          {skills.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Allocation Comments / Remarks</label>
                      <input
                        type="text"
                        placeholder="Specific wages, shifts, instructions..."
                        className="form-control"
                        value={allocateRemarks}
                        onChange={(e) => setAllocateRemarks(e.target.value)}
                        style={{ minHeight: '36px' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingAllocation}
                      className="btn btn-primary"
                      style={{ alignSelf: 'flex-start', minWidth: '150px' }}
                    >
                      {submittingAllocation ? 'Allocating...' : '➕ Assign to Project'}
                    </button>
                  </form>
                )}
              </div>

              {/* Active project workforce listings */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Current Workforce Assignments</h3>
                
                {assignmentsByProject.length === 0 ? (
                  <div className="empty-state"><p>No active projects found.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {assignmentsByProject.map(({ project, assignments }) => (
                      <div key={project.id} className="card" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px' }}>
                          <div>
                            <span className="badge badge-pending" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{project.projectCode}</span>
                            <h4 style={{ display: 'inline-block', margin: 0, marginLeft: '8px', fontSize: '1rem', fontWeight: 'bold' }}>
                              <Link href={`/projects/${project.id}`} style={{ color: 'var(--primary)' }}>{project.projectName}</Link>
                            </h4>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Allocated: <strong>{assignments.length} workers</strong>
                          </span>
                        </div>

                        {assignments.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            ⚠️ No labourers currently allocated to this site.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Desktop worker list */}
                            <div className="table-container" style={{ display: 'none' }}>
                              <table style={{ margin: 0, boxShadow: 'none', border: 'none' }}>
                                <thead>
                                  <tr>
                                    <th>Labourer</th>
                                    <th>Designation</th>
                                    <th>Assigned Date</th>
                                    <th>Remarks</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {assignments.map(a => (
                                    <tr key={a.id} style={{ borderBottom: '1px dashed var(--border)' }}>
                                      <td>
                                        <strong>{a.labourer.name}</strong> ({a.labourer.labourCode})
                                      </td>
                                      <td><span className="badge badge-pending">{a.role}</span></td>
                                      <td>{new Date(a.assignedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                      <td><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.remarks || '—'}</span></td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                          <button
                                            onClick={() => {
                                              setTransferringAssignmentId(a.id);
                                              setTransferProjectId('');
                                              setTransferRole(a.role);
                                              setTransferRemarks('');
                                            }}
                                            className="btn btn-secondary btn-sm"
                                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                          >
                                            🔄 Transfer
                                          </button>
                                          <button
                                            onClick={() => handleEndAssignment(a.id)}
                                            className="btn btn-secondary btn-sm"
                                            style={{ padding: '3px 8px', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                          >
                                            ❌ Unassign
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile worker list */}
                            <div className="mobile-list-container" style={{ margin: 0 }}>
                              {assignments.map(a => (
                                <div key={a.id} style={{ background: '#fcfcfc', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong>{a.labourer.name} ({a.labourer.labourCode})</strong>
                                    <span className="badge badge-pending">{a.role}</span>
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    Assigned: {new Date(a.assignedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    {a.remarks && <span> • Remarks: {a.remarks}</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                    <button
                                      onClick={() => {
                                        setTransferringAssignmentId(a.id);
                                        setTransferProjectId('');
                                        setTransferRole(a.role);
                                        setTransferRemarks('');
                                      }}
                                      className="btn btn-secondary btn-sm"
                                      style={{ flex: 1, padding: '4px', fontSize: '0.75rem' }}
                                    >
                                      🔄 Transfer
                                    </button>
                                    <button
                                      onClick={() => handleEndAssignment(a.id)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ flex: 1, padding: '4px', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                    >
                                      ❌ End Allocation
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transfer Modal / Form Overlays */}
              {transferringAssignmentId && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '16px'
                }}>
                  <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '20px', margin: 'auto', background: 'white' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>🔄 Transfer Worker Assignment</h3>
                    
                    <form onSubmit={handleTransferAllocation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Transfer Target Project *</label>
                        <select
                          className="form-control"
                          required
                          value={transferProjectId}
                          onChange={(e) => setTransferProjectId(e.target.value)}
                          style={{ minHeight: '38px' }}
                        >
                          <option value="">-- Select Project --</option>
                          {projects
                            .filter(p => p.id !== activeAssignments.find(a => a.id === transferringAssignmentId)?.projectId)
                            .map(p => (
                              <option key={p.id} value={p.id}>{p.projectName}</option>
                            ))
                          }
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Role/Designation *</label>
                        <select
                          className="form-control"
                          required
                          value={transferRole}
                          onChange={(e) => setTransferRole(e.target.value)}
                          style={{ minHeight: '38px' }}
                        >
                          {skills.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Transfer Remarks</label>
                        <input
                          type="text"
                          placeholder="Reason for site movement..."
                          className="form-control"
                          value={transferRemarks}
                          onChange={(e) => setTransferRemarks(e.target.value)}
                          style={{ minHeight: '36px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setTransferringAssignmentId(null)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 12px' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingTransfer}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 16px' }}
                        >
                          {submittingTransfer ? 'Moving...' : 'Complete Transfer'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: ADVANCED ANALYTICS */}
          {activeTab === 'analytics' && metrics && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Analytics summary metric cards */}
              <div className="stat-grid">
                <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
                  <div className="stat-label">Present Today</div>
                  <div className="stat-value" style={{ color: 'var(--success)' }}>
                    {metrics.presentToday}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
                  <div className="stat-label">Absent Today</div>
                  <div className="stat-value" style={{ color: 'var(--danger)' }}>
                    {metrics.absentToday}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                  <div className="stat-label">Half Day / Leave Today</div>
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>
                    {metrics.halfDayToday + metrics.leaveToday}
                  </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div className="stat-label">Average Presence Rate</div>
                  <div className="stat-value">
                    {metrics.attendancePercentage.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Chart Grid Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                
                {/* SVG Chart 1: Monthly Attendance Rate Trend (Line Chart) */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 'bold' }}>📈 Monthly Trend (Last 6 Months)</h3>
                  
                  {metrics.monthlyTrend.length === 0 ? (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      No logs recorded yet.
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <svg viewBox="0 0 400 220" style={{ width: '100%', height: 'auto', background: '#fdfcf7', borderRadius: '8px', padding: '10px' }}>
                        {/* Grid lines */}
                        <line x1="40" y1="40" x2="380" y2="40" stroke="#e0e0e0" strokeDasharray="4" />
                        <line x1="40" y1="90" x2="380" y2="90" stroke="#e0e0e0" strokeDasharray="4" />
                        <line x1="40" y1="140" x2="380" y2="140" stroke="#e0e0e0" strokeDasharray="4" />
                        <line x1="40" y1="180" x2="380" y2="180" stroke="#999" />
                        <line x1="40" y1="40" x2="40" y2="180" stroke="#999" />

                        {/* Y-Axis scale label */}
                        <text x="10" y="45" fill="#666" fontSize="10">100%</text>
                        <text x="15" y="95" fill="#666" fontSize="10">50%</text>
                        <text x="20" y="145" fill="#666" fontSize="10">25%</text>
                        <text x="20" y="185" fill="#666" fontSize="10">0%</text>

                        {/* Line Plot */}
                        {(() => {
                          const points = metrics.monthlyTrend.map((t, idx) => {
                            const x = 60 + idx * 60;
                            // 100% maps to y=40, 0% maps to y=180. Scale = 140
                            const y = 180 - (t.percentage / 100) * 140;
                            return { x, y, ...t };
                          });

                          const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                          return (
                            <>
                              {/* Solid line */}
                              <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="3" />
                              
                              {/* Dots & labels */}
                              {points.map((p, idx) => (
                                <g key={idx}>
                                  <circle cx={p.x} cy={p.y} r="5" fill="var(--primary)" stroke="white" strokeWidth="1.5" />
                                  <text x={p.x - 12} y={p.y - 10} fill="#111" fontWeight="bold" fontSize="10">{p.percentage.toFixed(0)}%</text>
                                  <text x={p.x - 18} y="200" fill="#666" fontSize="9">{p.month}</text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  )}
                </div>

                {/* SVG Chart 2: Project Attendance Distribution (Horizontal Bar Chart) */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 'bold' }}>🪵 Project-wise Attendance Rates</h3>
                  
                  {metrics.projectAttendanceRanking.length === 0 ? (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      No active allocations to track.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {metrics.projectAttendanceRanking.map((p) => {
                        const rateColor = p.percentage >= 80 ? 'var(--success)' : p.percentage >= 50 ? 'var(--warning)' : 'var(--danger)';
                        return (
                          <div key={p.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                              <strong>{p.name}</strong>
                              <span style={{ fontWeight: 'bold', color: rateColor }}>{p.percentage.toFixed(0)}% attendance</span>
                            </div>
                            <svg width="100%" height="12" style={{ background: '#f0f0f0', borderRadius: '6px', overflow: 'hidden' }}>
                              <rect width={`${p.percentage}%`} height="100%" fill={rateColor} rx="6" ry="6" />
                            </svg>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SVG Chart 3: Leave & Absence Status Distribution (Donut Chart representation) */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 'bold' }}>📊 Attendance Distribution Status</h3>
                  
                  {(() => {
                    const total = metrics.leaveAnalysis.Present + metrics.leaveAnalysis.Absent + metrics.leaveAnalysis['Half Day'] + metrics.leaveAnalysis.Leave;
                    if (total === 0) {
                      return (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          No historical entries logged.
                        </div>
                      );
                    }

                    // Percentages
                    const presentPct = (metrics.leaveAnalysis.Present / total) * 100;
                    const absentPct = (metrics.leaveAnalysis.Absent / total) * 100;
                    const halfPct = (metrics.leaveAnalysis['Half Day'] / total) * 100;
                    const leavePct = (metrics.leaveAnalysis.Leave / total) * 100;

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
                        {/* Circular Donut via SVG stroke-dasharray */}
                        <svg width="140" height="140" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}>
                          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f0f0f0" strokeWidth="5" />
                          
                          {/* Present segment (Green) */}
                          {presentPct > 0 && (
                            <circle
                              cx="21"
                              cy="21"
                              r="15.915"
                              fill="transparent"
                              stroke="var(--success)"
                              strokeWidth="5.2"
                              strokeDasharray={`${presentPct} ${100 - presentPct}`}
                              strokeDashoffset="0"
                            />
                          )}
                          
                          {/* Absent segment (Red) */}
                          {absentPct > 0 && (
                            <circle
                              cx="21"
                              cy="21"
                              r="15.915"
                              fill="transparent"
                              stroke="var(--danger)"
                              strokeWidth="5.2"
                              strokeDasharray={`${absentPct} ${100 - absentPct}`}
                              strokeDashoffset={-presentPct}
                            />
                          )}
                          
                          {/* Half Day segment (Yellow) */}
                          {halfPct > 0 && (
                            <circle
                              cx="21"
                              cy="21"
                              r="15.915"
                              fill="transparent"
                              stroke="var(--warning)"
                              strokeWidth="5.2"
                              strokeDasharray={`${halfPct} ${100 - halfPct}`}
                              strokeDashoffset={-(presentPct + absentPct)}
                            />
                          )}

                          {/* Leave segment (Gray) */}
                          {leavePct > 0 && (
                            <circle
                              cx="21"
                              cy="21"
                              r="15.915"
                              fill="transparent"
                              stroke="#6b6964"
                              strokeWidth="5.2"
                              strokeDasharray={`${leavePct} ${100 - leavePct}`}
                              strokeDashoffset={-(presentPct + absentPct + halfPct)}
                            />
                          )}
                        </svg>

                        {/* Legend breakdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--success)', borderRadius: '2px' }} />
                            <span>Present: <strong>{metrics.leaveAnalysis.Present}</strong> ({presentPct.toFixed(0)}%)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--danger)', borderRadius: '2px' }} />
                            <span>Absent: <strong>{metrics.leaveAnalysis.Absent}</strong> ({absentPct.toFixed(0)}%)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--warning)', borderRadius: '2px' }} />
                            <span>Half Day: <strong>{metrics.leaveAnalysis['Half Day']}</strong> ({halfPct.toFixed(0)}%)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#6b6964', borderRadius: '2px' }} />
                            <span>Leave: <strong>{metrics.leaveAnalysis.Leave}</strong> ({leavePct.toFixed(0)}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Top Performer Rankings Table */}
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 'bold' }}>⭐ Top Attendance Performers</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Labourer Name</th>
                        <th>Labour Code</th>
                        <th>Skill Type</th>
                        <th>Days Logged</th>
                        <th>Wages Earned Status</th>
                        <th>Attendance Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.labourerSummary.slice(0, 5).map((lab) => {
                        const scoreColor = lab.percentage >= 80 ? 'var(--success)' : lab.percentage >= 50 ? 'var(--warning)' : 'var(--danger)';
                        return (
                          <tr key={lab.id}>
                            <td><strong>{lab.name}</strong></td>
                            <td>{lab.labourCode}</td>
                            <td><span className="badge badge-pending">{lab.skillType}</span></td>
                            <td>{lab.totalDays} days</td>
                            <td>Active Work</td>
                            <td style={{ fontWeight: 'bold', color: scoreColor }}>{lab.percentage.toFixed(0)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: REPORTS & EXPORTS */}
          {activeTab === 'reports' && (
            <div>
              {/* Reports Filter Form */}
              <div className="card" style={{ background: '#faf9f6', padding: '16px', marginBottom: '24px' }}>
                <form onSubmit={handleApplyFilters}>
                  <div className="form-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: '130px', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Start Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        style={{ minHeight: '38px', padding: '6px 12px' }}
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1, minWidth: '130px', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>End Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        style={{ minHeight: '38px', padding: '6px 12px' }}
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Labourer</label>
                      <select
                        className="form-control"
                        value={filterLabourerId}
                        onChange={(e) => setFilterLabourerId(e.target.value)}
                        style={{ minHeight: '38px', padding: '6px 12px' }}
                      >
                        <option value="">-- All Labourers --</option>
                        {labourers.map((l) => (
                          <option key={l.id} value={l.id}>{l.name} ({l.labourCode})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Project Site</label>
                      <select
                        className="form-control"
                        value={filterProjectId}
                        onChange={(e) => setFilterProjectId(e.target.value)}
                        style={{ minHeight: '38px', padding: '6px 12px' }}
                      >
                        <option value="">-- All Projects --</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.projectName}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: 1, minWidth: '130px', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Skill Type</label>
                      <select
                        className="form-control"
                        value={filterSkillType}
                        onChange={(e) => setFilterSkillType(e.target.value)}
                        style={{ minHeight: '38px', padding: '6px 12px' }}
                      >
                        <option value="">-- All Skills --</option>
                        {skills.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button type="button" onClick={handleClearFilters} className="btn btn-secondary btn-sm" style={{ height: '36px' }}>
                      🧹 Clear
                    </button>
                    <button type="submit" disabled={filtering} className="btn btn-primary btn-sm" style={{ height: '36px' }}>
                      {filtering ? 'Filtering...' : '🔍 Filter Logs'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Export CSV action header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Attendance Log Database ({records.length})</h3>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  📥 Export Logs (CSV)
                </button>
              </div>

              {records.length === 0 ? (
                <div className="empty-state"><p>No attendance logs match the active filter criteria.</p></div>
              ) : (
                <>
                  {/* Desktop Logs Table */}
                  <div className="table-container" style={{ display: 'none' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Skill Type</th>
                          <th>Project Scope</th>
                          <th>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id}>
                            <td><strong>{new Date(r.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></td>
                            <td>{r.labourer?.labourCode}</td>
                            <td>{r.labourer?.name}</td>
                            <td><span className="badge badge-pending">{r.labourer?.skillType}</span></td>
                            <td>
                              {r.project ? (
                                <Link href={`/projects/${r.project.id}`} style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                  {r.project.projectName}
                                </Link>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>General</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge badge-${r.status === 'Present' ? 'completed' : r.status === 'Absent' ? 'cancelled' : 'pending'}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>{r.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Logs Card List */}
                  <div className="mobile-list-container">
                    {records.map((r) => (
                      <div key={r.id} className="mobile-list-card" style={{ borderLeft: `4px solid ${r.status === 'Present' ? 'var(--success)' : r.status === 'Absent' ? 'var(--danger)' : 'var(--warning)'}` }}>
                        <div className="mobile-list-header">
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{r.labourer?.name} ({r.labourer?.labourCode})</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                              {new Date(r.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <span className={`badge badge-${r.status === 'Present' ? 'completed' : r.status === 'Absent' ? 'cancelled' : 'pending'}`}>
                            {r.status}
                          </span>
                        </div>
                        <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px', fontSize: '0.85rem' }}>
                          <strong>Project:</strong> {r.project ? `${r.project.projectName}` : 'General / Unallocated'} <br />
                          <strong>Skill:</strong> {r.labourer?.skillType}
                          {r.remarks && <div style={{ marginTop: '4px' }}><strong>Remarks:</strong> {r.remarks}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        /* Quick attendance buttons styling */
        .attendance-quick-btn {
          border: 1px solid var(--border);
          background: white;
          color: var(--text-muted);
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.8rem;
          transition: all 0.1s ease;
          min-height: 32px;
        }

        .attendance-quick-btn:hover {
          background: #f5f4f0;
          color: var(--text-primary);
        }

        .attendance-quick-btn.active-present {
          background: var(--success);
          color: white;
          border-color: var(--success);
        }

        .attendance-quick-btn.active-absent {
          background: var(--danger);
          color: white;
          border-color: var(--danger);
        }

        .attendance-quick-btn.active-half {
          background: var(--warning);
          color: white;
          border-color: var(--warning);
        }

        .attendance-quick-btn.active-leave {
          background: #6b6964;
          color: white;
          border-color: #6b6964;
        }

        /* Responsive layout rules */
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
