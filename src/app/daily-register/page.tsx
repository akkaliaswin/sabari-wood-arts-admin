'use client';

import React, { useState, useEffect } from 'react';

interface ActiveLabourer {
  id: string;
  name: string;
  skillType: string;
}

interface ActiveProject {
  id: string;
  projectName: string;
  status: string;
  client?: {
    name: string;
  };
}

interface TodayPayment {
  amount: number;
  createdAt: string;
  paymentType: string;
  remarks?: string;
}

interface RegisterRow {
  labourerId: string;
  name: string;
  skillType: string;
  status: string; // '' (Not Selected), Present, Absent, Half Day, Leave
  projectIds: string[]; // Selected project IDs
  amountPaid: string; // numeric text
  paymentType: string; // Daily Wage, Advance, Partial Settlement
  remarks: string;
  todayPayments: TodayPayment[];
}

const attendanceOptions = [
  { value: 'Present', label: 'Present', activeColor: '#047857', activeBg: '#ecfdf5', inactiveBg: 'white', border: '#059669' },
  { value: 'Absent', label: 'Absent', activeColor: '#b91c1c', activeBg: '#fef2f2', inactiveBg: 'white', border: '#dc2626' },
  { value: 'Half Day', label: 'Half Day', activeColor: '#d97706', activeBg: '#fffbeb', inactiveBg: 'white', border: '#d97706' },
  { value: 'Leave', label: 'Leave', activeColor: '#1d4ed8', activeBg: '#eff6ff', inactiveBg: 'white', border: '#2563eb' }
];

export default function DailyRegisterPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [projects, setProjects] = useState<ActiveProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Dropdown & Modal State Variables
  const [activeDropdownRowIndex, setActiveDropdownRowIndex] = useState<number | null>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const [modalOpenRowIndex, setModalOpenRowIndex] = useState<number | null>(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [expandedPayRowIndices, setExpandedPayRowIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadRegisterData();
  }, [selectedDate]);

  // Click outside handler to close inline dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.project-select-container')) {
        setActiveDropdownRowIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadRegisterData = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch active projects
      const projRes = await fetch(`/api/projects?t=${Date.now()}`);
      if (!projRes.ok) throw new Error('Failed to load projects list');
      const allProjects = await projRes.json();
      const activeProjList = allProjects.filter((p: any) =>
        ['Lead', 'Measurement Done', 'Quotation Sent', 'Advance Received', 'Production', 'Installation', 'On Hold'].includes(p.status)
      );
      setProjects(activeProjList);

      // 2. Fetch active labourers
      const labRes = await fetch(`/api/labourers?t=${Date.now()}`);
      if (!labRes.ok) throw new Error('Failed to load labourers list');
      const allLabourers = await labRes.json();
      const activeWorkers: ActiveLabourer[] = allLabourers.filter((l: any) => l.activeStatus);

      // 3. Fetch active project assignments (roster)
      const assignRes = await fetch(`/api/labourers/assignments?isActive=true&t=${Date.now()}`);
      let activeAssignments: any[] = [];
      if (assignRes.ok) {
        activeAssignments = await assignRes.json();
      }
      const rosterMap = new Map<string, string[]>();
      activeAssignments.forEach((a) => {
        const prev = rosterMap.get(a.labourerId) || [];
        rosterMap.set(a.labourerId, [...prev, a.projectId]);
      });

      // 4. Fetch attendance records already logged for the selected date
      const attRes = await fetch(`/api/labourers/attendance?startDate=${selectedDate}&endDate=${selectedDate}&t=${Date.now()}`);
      let loggedAttendances: any[] = [];
      if (attRes.ok) {
        const attData = await attRes.json();
        loggedAttendances = attData.records || [];
      }
      const loggedAttMap = new Map(loggedAttendances.map(a => [a.labourerId, a]));

      // 5. Fetch all labour payments logged for the selected date
      const payRes = await fetch(`/api/labourers/payments?startDate=${selectedDate}&endDate=${selectedDate}&t=${Date.now()}`);
      let dailyPayments: any[] = [];
      if (payRes.ok) {
        dailyPayments = await payRes.json();
      }
      const paymentsMap = new Map<string, TodayPayment[]>();
      dailyPayments.forEach((p: any) => {
        const prev = paymentsMap.get(p.labourerId) || [];
        paymentsMap.set(p.labourerId, [...prev, {
          amount: Number(p.amount),
          createdAt: p.createdAt,
          paymentType: p.paymentType,
          remarks: p.remarks || undefined
        }]);
      });

      // Construct rows combining active labourers.
      // If no attendance has been logged, status defaults to '' (Not Selected) and projectIds defaults to [] (Not Selected)
      const initialRows: RegisterRow[] = activeWorkers.map((lab) => {
        const logged = loggedAttMap.get(lab.id);

        return {
          labourerId: lab.id,
          name: lab.name,
          skillType: lab.skillType,
          status: logged ? logged.status : '',
          projectIds: logged ? (logged.projectId ? [logged.projectId] : []) : [],
          amountPaid: '',
          paymentType: 'Daily Wage',
          remarks: logged ? (logged.remarks || '') : '',
          todayPayments: paymentsMap.get(lab.id) || []
        };
      });

      setRows(initialRows);
      setExpandedPayRowIndices(new Set()); // Reset history expands
    } catch (err: any) {
      setError(err.message || 'Error occurred retrieving daily register data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRowChange = (index: number, field: keyof RegisterRow, value: any) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setRows(updated);
  };

  const handleToggleProject = (rowIndex: number, projectId: string) => {
    const updated = [...rows];
    const currentProjectIds = updated[rowIndex].projectIds;
    if (currentProjectIds.includes(projectId)) {
      updated[rowIndex].projectIds = currentProjectIds.filter(id => id !== projectId);
    } else {
      updated[rowIndex].projectIds = [...currentProjectIds, projectId];
    }
    setRows(updated);
  };

  const handleDesktopTriggerClick = (index: number, event: React.MouseEvent<HTMLElement>) => {
    if (activeDropdownRowIndex === index) {
      setActiveDropdownRowIndex(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 240px space below, open upward
      setOpenUpward(spaceBelow < 240);
      setActiveDropdownRowIndex(index);
      setProjectSearchQuery('');
    }
  };

  const toggleExpandPay = (idx: number) => {
    const next = new Set(expandedPayRowIndices);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setExpandedPayRowIndices(next);
  };

  const handleSaveRegister = async () => {
    // Validation check: Ensure all workers have selected an attendance status
    const unselectedWorkers = rows.filter(r => r.status === '');
    if (unselectedWorkers.length > 0) {
      setError(`Please select an Attendance Status for all workers before saving. (${unselectedWorkers.length} unselected)`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setSaving(true);
      setError('');

      const recordsPayload = rows.map((r) => ({
        labourerId: r.labourerId,
        status: r.status,
        projectIds: r.projectIds,
        amountPaid: r.amountPaid ? Number(r.amountPaid) : null,
        paymentType: r.amountPaid ? r.paymentType : null,
        remarks: r.remarks ? r.remarks.trim() : null
      }));

      const res = await fetch('/api/labourers/daily-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          records: recordsPayload
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save register entries');
      }

      // Reset payment input values to avoid double log and reload register data
      const resetPaymentRows = rows.map(r => ({
        ...r,
        amountPaid: ''
      }));
      setRows(resetPaymentRows);
      
      await loadRegisterData();
      alert('Daily Work Register saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Error occurred saving register entries.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Lead':
        return { bg: '#f3f4f6', color: '#374151' };
      case 'Measurement Done':
        return { bg: '#eff6ff', color: '#1d4ed8' };
      case 'Quotation Sent':
        return { bg: '#f5f3ff', color: '#6d28d9' };
      case 'Advance Received':
        return { bg: '#ecfdf5', color: '#047857' };
      case 'Production':
        return { bg: '#fffbeb', color: '#b45309' };
      case 'Installation':
        return { bg: '#fff7ed', color: '#c2410c' };
      case 'On Hold':
        return { bg: '#fff1f2', color: '#be123c' };
      default:
        return { bg: '#e5e7eb', color: '#4b5563' };
    }
  };

  // Dynamic calculations for dynamic register counters
  const presentCount = rows.filter(r => r.status === 'Present').length;
  const absentCount = rows.filter(r => r.status === 'Absent').length;
  const halfDayCount = rows.filter(r => r.status === 'Half Day').length;
  const leaveCount = rows.filter(r => r.status === 'Leave').length;

  const formattedHeaderDate = new Date(selectedDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Filter projects inside multi-select dropdown / modal
  const filteredProjects = projects.filter((p) => {
    const q = projectSearchQuery.toLowerCase();
    return (
      p.projectName.toLowerCase().includes(q) ||
      (p.client?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }} className="register-content">
      
      {/* Dynamic Notebook-themed register header */}
      <div className="register-notebook-header" style={{
        background: '#fcfaf5',
        border: '2px solid #dfd8cb',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#3d3429', letterSpacing: '-0.5px' }}>
              📓 Daily Work Register
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#8c7d6b', fontSize: '0.95rem', fontWeight: 500 }}>
              {formattedHeaderDate}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#6d5f50' }}>Register Date:</label>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: 'white',
                border: '2px solid #dfd8cb',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '1rem',
                color: '#3d3429',
                fontWeight: 'bold',
                maxWidth: '180px',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        {/* Dynamic Supervisor Stats Panel */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '2px dashed #dfd8cb'
        }}>
          <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#065f46', display: 'block' }}>Present</span>
            <strong style={{ fontSize: '1.8rem', color: '#047857', fontWeight: 800 }}>{presentCount}</strong>
          </div>
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#991b1b', display: 'block' }}>Absent</span>
            <strong style={{ fontSize: '1.8rem', color: '#b91c1c', fontWeight: 800 }}>{absentCount}</strong>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#92400e', display: 'block' }}>Half Day</span>
            <strong style={{ fontSize: '1.8rem', color: '#d97706', fontWeight: 800 }}>{halfDayCount}</strong>
          </div>
          <div style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#374151', display: 'block' }}>Leave</span>
            <strong style={{ fontSize: '1.8rem', color: '#4b5563', fontWeight: 800 }}>{leaveCount}</strong>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px', color: '#b91c1c', marginBottom: '24px', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p style={{ color: '#8c7d6b', fontSize: '1.1rem' }}>🔄 Reading the supervisor notebook register...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card empty-state" style={{ background: '#fcfaf5', borderColor: '#dfd8cb' }}>
          <p style={{ color: '#8c7d6b' }}>No active labourers registered in the database settings.</p>
        </div>
      ) : (
        <div>
          {/* Main Register Notebook Container */}
          <div className="register-notebook-container" style={{
            background: '#fffdf9',
            border: '2px solid #dfd8cb',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
            overflow: 'visible',
            marginBottom: '24px'
          }}>
            
            {/* Desktop Table View */}
            <div className="table-responsive" style={{ display: 'none' }}>
              <table style={{ margin: 0, width: '100%', borderCollapse: 'collapse', overflow: 'visible' }}>
                <thead>
                  <tr style={{ background: '#fcfaf5', borderBottom: '2px solid #dfd8cb' }}>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '6%' }}>SL</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '22%' }}>Labour Name</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '16%' }}>Attendance Status</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '24%' }}>Projects Worked Today</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '16%' }}>Amount Paid</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '16%' }}>Supervisor Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const totalToday = row.todayPayments.reduce((sum, p) => sum + p.amount, 0);
                    const sortedPayments = [...row.todayPayments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                    return (
                      <tr key={row.labourerId} style={{
                        borderBottom: '1px solid #eee0cd',
                        background: idx % 2 === 0 ? 'white' : '#fefdfb',
                        transition: 'background 0.2s ease'
                      }}>
                        {/* SL column */}
                        <td style={{ padding: '16px', verticalAlign: 'middle', fontWeight: 'bold', color: '#8c7d6b' }}>
                          {idx + 1}
                        </td>

                        {/* 1. Labour Name */}
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#3d3429' }}>{row.name}</span>
                            
                            <span style={{ fontSize: '0.75rem', background: '#f0ebd8', color: '#7a6a53', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '2px', fontWeight: 'bold' }}>
                              {row.skillType}
                            </span>
                          </div>
                        </td>

                        {/* 2. Attendance Status dropdown */}
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <select
                            className="form-control"
                            value={row.status}
                            onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                            style={{
                              fontSize: '0.95rem',
                              fontWeight: 'bold',
                              border: '2px solid #dfd8cb',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              background: row.status === 'Present' ? '#ecfdf5' : row.status === 'Absent' ? '#fef2f2' : row.status === 'Half Day' ? '#fffbeb' : row.status === 'Leave' ? '#f3f4f6' : 'white',
                              color: row.status === 'Present' ? '#047857' : row.status === 'Absent' ? '#b91c1c' : row.status === 'Half Day' ? '#d97706' : row.status === 'Leave' ? '#374151' : '#8c7d6b'
                            }}
                          >
                            <option value="">-- Select --</option>
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                            <option value="Half Day">Half Day</option>
                            <option value="Leave">Leave</option>
                          </select>
                        </td>

                        {/* 3. Projects Worked Today */}
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div className="project-select-container" style={{ position: 'relative' }}>
                            
                            {/* Selector Input Trigger Box */}
                            <div
                              onClick={(e) => handleDesktopTriggerClick(idx, e)}
                              style={{
                                border: '2px solid #dfd8cb',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                background: 'white',
                                cursor: 'pointer',
                                minHeight: '38px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                boxShadow: activeDropdownRowIndex === idx ? '0 0 0 3px rgba(223, 102, 46, 0.15)' : 'none',
                                borderColor: activeDropdownRowIndex === idx ? '#df662e' : '#dfd8cb'
                              }}
                            >
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', flex: 1 }}>
                                {row.projectIds.length === 0 ? (
                                  <span style={{ color: '#8c7d6b', fontSize: '0.85rem' }}>Select Projects Worked Today...</span>
                                ) : (
                                  row.projectIds.map((pId) => {
                                    const proj = projects.find((p) => p.id === pId);
                                    return proj ? (
                                      <span key={pId} style={{
                                        fontSize: '0.75rem',
                                        background: '#f0ebd8',
                                        color: '#3d3429',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontWeight: 'bold',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}>
                                        ✓ {proj.projectName}
                                        <span
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleProject(idx, pId);
                                          }}
                                          style={{ cursor: 'pointer', color: '#8c7d6b', fontSize: '0.9rem', marginLeft: '2px' }}
                                        >
                                          ×
                                        </span>
                                      </span>
                                    ) : null;
                                  })
                                )}
                              </div>
                              <span style={{ color: '#8c7d6b', fontSize: '0.8rem' }}>▼</span>
                            </div>

                            {/* Desktop Inline Dropdown Overlay */}
                            {activeDropdownRowIndex === idx && (
                              <div style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                background: '#fffdf9',
                                border: '2px solid #dfd8cb',
                                borderRadius: '8px',
                                boxShadow: '0 8px 24px rgba(61, 52, 41, 0.12)',
                                zIndex: 1000,
                                width: '340px',
                                ...(openUpward ? { bottom: 'calc(100% + 4px)', top: 'auto' } : { top: 'calc(100% + 4px)', bottom: 'auto' })
                              }}>
                                
                                {/* Inline Search Bar */}
                                <input
                                  type="text"
                                  placeholder="🔍 Search projects..."
                                  className="form-control"
                                  value={projectSearchQuery}
                                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    fontSize: '0.85rem',
                                    padding: '6px 10px',
                                    border: '1px solid #dfd8cb',
                                    borderRadius: '6px',
                                    marginBottom: '10px',
                                    width: '100%',
                                    background: 'white'
                                  }}
                                />

                                {/* Dropdown Checklist Grid */}
                                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {filteredProjects.length === 0 ? (
                                    <div style={{ padding: '12px', color: '#8c7d6b', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
                                      No active projects matched.
                                    </div>
                                  ) : (
                                    filteredProjects.map((proj) => {
                                      const isChecked = row.projectIds.includes(proj.id);
                                      const badge = getStatusBadgeStyle(proj.status);
                                      return (
                                        <label
                                          key={proj.id}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            background: isChecked ? 'rgba(223, 102, 46, 0.04)' : 'transparent',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            margin: 0
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleProject(idx, proj.id)}
                                              style={{ cursor: 'pointer' }}
                                            />
                                            <div>
                                              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#3d3429' }}>
                                                {proj.projectName}
                                              </div>
                                              <div style={{ fontSize: '0.75rem', color: '#8c7d6b' }}>
                                                Client: {proj.client?.name || 'Unknown'}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <span style={{
                                            fontSize: '0.6rem',
                                            fontWeight: 'bold',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            backgroundColor: badge.bg,
                                            color: badge.color,
                                            textTransform: 'uppercase'
                                          }}>
                                            {proj.status}
                                          </span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>

                              </div>
                            )}

                          </div>
                        </td>

                        {/* 4. Amount Paid Today (and direct payments list details) */}
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input
                              type="number"
                              placeholder="₹ Amount"
                              className="form-control"
                              value={row.amountPaid}
                              onChange={(e) => handleRowChange(idx, 'amountPaid', e.target.value)}
                              style={{
                                fontSize: '0.9rem',
                                border: '1px solid #dfd8cb',
                                borderRadius: '6px',
                                padding: '6px',
                                maxWidth: '120px',
                                background: row.amountPaid ? '#ecfdf5' : 'white'
                              }}
                            />
                            {row.amountPaid && Number(row.amountPaid) > 0 && (
                              <select
                                value={row.paymentType}
                                onChange={(e) => handleRowChange(idx, 'paymentType', e.target.value)}
                                style={{
                                  fontSize: '0.75rem',
                                  border: '1px solid #dfd8cb',
                                  borderRadius: '4px',
                                  padding: '2px',
                                  background: '#faf9f6'
                                }}
                              >
                                <option value="Daily Wage">Daily Wage</option>
                                <option value="Advance">Advance</option>
                                <option value="Partial Settlement">Partial Settlement</option>
                              </select>
                            )}
                            
                            {/* Today's Payments summary list rendered directly in row */}
                            {row.todayPayments.length > 0 && (
                              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#3d3429' }}>
                                <div style={{ fontWeight: 'bold', color: '#6d5f50', marginBottom: '2px' }}>Today's Payments:</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {sortedPayments.slice(0, 3).map((p, pIdx) => {
                                    const pTime = new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                                    return (
                                      <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', color: '#3d3429' }}>
                                        <span>₹{p.amount} @ {pTime}</span>
                                      </div>
                                    );
                                  })}
                                  
                                  {row.todayPayments.length > 3 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandPay(idx)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#df662e',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        padding: 0,
                                        fontSize: '0.75rem',
                                        textAlign: 'left'
                                      }}
                                    >
                                      {expandedPayRowIndices.has(idx) ? 'Hide details' : `+${row.todayPayments.length - 3} more`}
                                    </button>
                                  )}
                                  
                                  {expandedPayRowIndices.has(idx) && row.todayPayments.length > 3 && (
                                    <div style={{
                                      background: '#faf9f6',
                                      border: '1px solid #dfd8cb',
                                      borderRadius: '6px',
                                      padding: '6px',
                                      marginTop: '4px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '2px'
                                    }}>
                                      {sortedPayments.slice(3).map((p, pIdx) => {
                                        const pTime = new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                                        return (
                                          <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', fontSize: '0.75rem' }}>
                                            <span>₹{p.amount} @ {pTime}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  <div style={{ borderTop: '1px solid #eee0cd', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold', color: '#047857' }}>
                                    Total Today: ₹{totalToday}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. Remarks */}
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            placeholder="Note..."
                            className="form-control"
                            value={row.remarks}
                            onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                            style={{
                              fontSize: '0.9rem',
                              border: '1px solid #dfd8cb',
                              borderRadius: '6px',
                              padding: '6px',
                              background: 'white'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Notebook View (Dedicated Mobile Layout) */}
            <div className="mobile-list-container">
              {rows.map((row, idx) => {
                const totalToday = row.todayPayments.reduce((sum, p) => sum + p.amount, 0);
                const sortedPayments = [...row.todayPayments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                return (
                  <div key={row.labourerId} style={{
                    padding: '20px',
                    borderBottom: '2px solid #dfd8cb',
                    background: idx % 2 === 0 ? 'white' : '#fefdfb',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    {/* Name and Skill header */}
                    <div>
                      <h3 style={{ fontWeight: 800, fontSize: '1.3rem', color: '#3d3429', margin: 0 }}>
                        Labour #{idx + 1} - {row.name}
                      </h3>
                      
                      <span style={{ fontSize: '0.8rem', background: '#f0ebd8', color: '#7a6a53', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px', fontWeight: 'bold' }}>
                        {row.skillType}
                      </span>
                    </div>

                    {/* Attendance Section (Segmented Color-Coded Buttons) */}
                    <div>
                      <label style={{ color: '#6d5f50', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
                        Attendance Status *
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {attendanceOptions.map((opt) => {
                          const isSelected = row.status === opt.value;
                          return (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() => handleRowChange(idx, 'status', opt.value)}
                              style={{
                                height: '44px',
                                minHeight: '44px',
                                borderRadius: '8px',
                                border: isSelected ? `2px solid ${opt.activeColor}` : '1px solid #dfd8cb',
                                background: isSelected ? opt.activeBg : opt.inactiveBg,
                                color: isSelected ? opt.activeColor : '#6d5f50',
                                fontWeight: isSelected ? 'bold' : '500',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                                userSelect: 'none'
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Projects Worked Today (Mobile trigger selector card) */}
                    <div>
                      <label style={{ color: '#6d5f50', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
                        Projects Worked Today
                      </label>
                      
                      <div
                        onClick={() => {
                          setModalOpenRowIndex(idx);
                          setProjectSearchQuery('');
                        }}
                        style={{
                          background: 'white',
                          border: '2px solid #dfd8cb',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.01)',
                          minHeight: '52px'
                        }}
                      >
                        {row.projectIds.length === 0 ? (
                          <span style={{ color: '#8c7d6b', fontSize: '0.9rem', fontStyle: 'italic' }}>
                            Select Projects Worked Today...
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {row.projectIds.map((pId) => {
                              const proj = projects.find((p) => p.id === pId);
                              if (!proj) return null;
                              const badge = getStatusBadgeStyle(proj.status);
                              return (
                                <div key={pId} style={{
                                  background: '#faf9f6',
                                  border: '1px solid #dfd8cb',
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#3d3429' }}>
                                      ✓ {proj.projectName}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#8c7d6b', marginTop: '1px' }}>
                                      Client: {proj.client?.name || 'Unknown'}
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: badge.bg,
                                    color: badge.color
                                  }}>
                                    {proj.status}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payment logged */}
                    <div>
                      <label style={{ color: '#6d5f50', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
                        Amount Paid
                      </label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          type="number"
                          placeholder="₹ Amount"
                          className="form-control"
                          value={row.amountPaid}
                          onChange={(e) => handleRowChange(idx, 'amountPaid', e.target.value)}
                          style={{
                            fontSize: '1rem',
                            height: '44px',
                            minHeight: '44px',
                            border: '1px solid #dfd8cb',
                            borderRadius: '8px',
                            padding: '10px',
                            flex: 1,
                            background: row.amountPaid ? '#ecfdf5' : 'white'
                          }}
                        />
                        {row.amountPaid && Number(row.amountPaid) > 0 && (
                          <select
                            className="form-control"
                            value={row.paymentType}
                            onChange={(e) => handleRowChange(idx, 'paymentType', e.target.value)}
                            style={{
                              fontSize: '0.9rem',
                              height: '44px',
                              minHeight: '44px',
                              border: '1px solid #dfd8cb',
                              borderRadius: '8px',
                              padding: '8px',
                              width: '150px',
                              background: '#faf9f6'
                            }}
                          >
                            <option value="Daily Wage">Wage</option>
                            <option value="Advance">Advance</option>
                            <option value="Partial Settlement">Partial</option>
                          </select>
                        )}
                      </div>

                      {/* Today's Payments list rendered directly on mobile stack */}
                      {row.todayPayments.length > 0 && (
                        <div style={{ fontSize: '0.85rem', color: '#3d3429', marginBottom: '8px' }}>
                          <div style={{ fontWeight: 'bold', color: '#6d5f50', marginBottom: '4px' }}>Today's Payments:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {sortedPayments.slice(0, 3).map((p, pIdx) => {
                              const pTime = new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                              return (
                                <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                  <span>₹{p.amount} @ {pTime}</span>
                                  <span style={{ color: '#8c7d6b', fontSize: '0.75rem' }}>{p.paymentType}</span>
                                </div>
                              );
                            })}
                            
                            {row.todayPayments.length > 3 && (
                              <button
                                type="button"
                                onClick={() => toggleExpandPay(idx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#df662e',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  padding: '2px 0',
                                  fontSize: '0.8rem',
                                  textAlign: 'left'
                                }}
                              >
                                {expandedPayRowIndices.has(idx) ? 'Hide details' : `+${row.todayPayments.length - 3} more`}
                              </button>
                            )}
                            
                            {expandedPayRowIndices.has(idx) && row.todayPayments.length > 3 && (
                              <div style={{
                                background: '#faf9f6',
                                border: '1px solid #dfd8cb',
                                borderRadius: '8px',
                                padding: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}>
                                {sortedPayments.slice(3).map((p, pIdx) => {
                                  const pTime = new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                                  return (
                                    <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.75rem' }}>
                                      <span>₹{p.amount} @ {pTime}</span>
                                      <span style={{ color: '#8c7d6b' }}>{p.paymentType}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            <div style={{ borderTop: '1px solid #eee0cd', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold', color: '#047857', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Total Today:</span>
                              <span>₹{totalToday}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Supervisor Remarks notes */}
                    <div>
                      <label style={{ color: '#6d5f50', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
                        Supervisor Notes
                      </label>
                      <textarea
                        placeholder="Enter supervisory notes..."
                        className="form-control"
                        rows={3}
                        value={row.remarks}
                        onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                        style={{
                          fontSize: '0.95rem',
                          border: '1px solid #dfd8cb',
                          borderRadius: '8px',
                          padding: '10px',
                          background: 'white',
                          width: '100%',
                          resize: 'vertical',
                          minHeight: '60px'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Action Footer: Responsive layout handling (Sticky Footer on mobile screens) */}
          <div className="sticky-mobile-footer-container">
            <button
              onClick={handleSaveRegister}
              disabled={saving}
              style={{
                background: '#df662e',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                padding: '16px 48px',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                boxShadow: '0 6px 16px rgba(223, 102, 46, 0.25)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, background 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#cb5725'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#df662e'}
            >
              {saving ? 'Saving...' : '💾 Save Today\'s Register'}
            </button>
          </div>
        </div>
      )}

      {/* SEARCHABLE MULTI-SELECT PROJECT MODAL DRAWER (Mobile Responsive Full-Screen Overlay) */}
      {modalOpenRowIndex !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(61, 52, 41, 0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px'
        }} className="modal-overlay">
          <div className="card modal-card" style={{
            width: '100%',
            maxWidth: '520px',
            height: '100%',
            maxHeight: '620px',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(61, 52, 41, 0.15)',
            border: '2px solid #dfd8cb',
            background: '#fffdf9'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #eee0cd', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#3d3429', fontWeight: 800 }}>
                  🪵 Select Projects Today
                </h2>
                <span style={{ fontSize: '0.85rem', color: '#8c7d6b' }}>
                  Assigning: <strong>{rows[modalOpenRowIndex].name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpenRowIndex(null)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 12px', height: '38px', minHeight: '38px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
            </div>

            {/* Modal Search Bar */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="🔍 Search by Project Name or Client..."
                className="control form-control"
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                style={{
                  fontSize: '1rem',
                  height: '44px',
                  minHeight: '44px',
                  border: '2px solid #dfd8cb',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  background: 'white'
                }}
              />
            </div>

            {/* Scrollable Project Cards Checklist */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px', marginBottom: '16px' }}>
              {filteredProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#8c7d6b', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  No matching active projects found.
                </div>
              ) : (
                filteredProjects.map((proj) => {
                  const isChecked = rows[modalOpenRowIndex].projectIds.includes(proj.id);
                  const badge = getStatusBadgeStyle(proj.status);
                  return (
                    <div
                      key={proj.id}
                      onClick={() => handleToggleProject(modalOpenRowIndex, proj.id)}
                      style={{
                        background: isChecked ? 'rgba(223, 102, 46, 0.04)' : 'white',
                        border: isChecked ? '2px solid #df662e' : '1px solid #dfd8cb',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                        minHeight: '60px',
                        boxShadow: isChecked ? '0 2px 8px rgba(223, 102, 46, 0.05)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        
                        {/* Custom touch-friendly checkbox indicator */}
                        <div style={{
                          width: '24px',
                          height: '24px',
                          border: isChecked ? '2px solid #df662e' : '2px solid #dfd8cb',
                          background: isChecked ? '#df662e' : 'white',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.95rem',
                          flexShrink: 0
                        }}>
                          {isChecked ? '✓' : ''}
                        </div>

                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#3d3429' }}>
                            {proj.projectName}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#8c7d6b', marginTop: '2px' }}>
                            Client: {proj.client?.name || 'Unknown'}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        {proj.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #eee0cd', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setModalOpenRowIndex(null)}
                style={{
                  background: '#df662e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '12px 32px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  minHeight: '44px',
                  width: '100%',
                  boxShadow: '0 4px 10px rgba(223, 102, 46, 0.15)'
                }}
              >
                Apply Selected ({rows[modalOpenRowIndex].projectIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media (min-width: 768px) {
          .table-responsive { display: block !important; overflow: visible !important; }
          .register-notebook-container { overflow: visible !important; }
          .table-responsive table { overflow: visible !important; }
          
          .mobile-list-container { display: none !important; }
          .sticky-mobile-footer-container {
            display: flex;
            justify-content: center;
            margin-top: 32px;
          }
          .sticky-mobile-footer-container button {
            width: auto !important;
          }
        }
        @media (max-width: 767px) {
          .table-responsive { display: none !important; }
          .mobile-list-container { display: block !important; }
          
          .register-content {
            padding-bottom: 96px !important; /* Make sure the cards list scrolling clears the sticky footer */
          }
          
          .sticky-mobile-footer-container {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #fffdf9;
            border-top: 2px solid #dfd8cb;
            padding: 12px 16px;
            z-index: 990;
            box-shadow: 0 -4px 12px rgba(61, 52, 41, 0.08);
            display: flex;
            justify-content: center;
          }

          /* Full screen modal overrides */
          .modal-overlay {
            padding: 0 !important;
          }
          .modal-card {
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
