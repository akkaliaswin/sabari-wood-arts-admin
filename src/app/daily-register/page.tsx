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
  otHours: string;
  todayOt: number;
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

  // Weekly Glance State Variables
  const [activeRegisterTab, setActiveRegisterTab] = useState<'today' | 'weekly'>('today');
  const [weekRefDate, setWeekRefDate] = useState<Date>(new Date());
  const [weeklyAttendance, setWeeklyAttendance] = useState<any[]>([]);
  const [weeklyPayments, setWeeklyPayments] = useState<any[]>([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [selectedTileDetail, setSelectedTileDetail] = useState<any | null>(null);

  // Weekly Glance Filters
  const [searchWeeklyQuery, setSearchWeeklyQuery] = useState('');
  const [filterWeeklyProject, setFilterWeeklyProject] = useState('');
  const [filterWeeklyRole, setFilterWeeklyRole] = useState('');

  const getWeekDays = (refDate: Date) => {
    const ref = new Date(refDate);
    const day = ref.getDay();
    // Monday is first day (1), Sunday is last (0)
    const diff = ref.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(ref.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const loadWeeklyGlanceData = async (refDate: Date) => {
    try {
      setWeeklyLoading(true);
      const days = getWeekDays(refDate);
      const startDate = days[0].toISOString().split('T')[0];
      const endDate = days[6].toISOString().split('T')[0];

      // Fetch attendances
      const attRes = await fetch(`/api/labourers/attendance?startDate=${startDate}&endDate=${endDate}&t=${Date.now()}`);
      let attData: any = {};
      if (attRes.ok) {
        attData = await attRes.json();
      }
      const records = attData.records || [];
      setWeeklyAttendance(records);

      // Fetch payments
      const payRes = await fetch(`/api/labourers/payments?startDate=${startDate}&endDate=${endDate}&t=${Date.now()}`);
      let payData: any[] = [];
      if (payRes.ok) {
        payData = await payRes.json();
      }
      setWeeklyPayments(payData);
    } catch (err) {
      console.error('Error loading weekly glance:', err);
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handlePrevWeek = () => {
    const nextDate = new Date(weekRefDate);
    nextDate.setDate(nextDate.getDate() - 7);
    setWeekRefDate(nextDate);
  };

  const handleNextWeek = () => {
    const nextDate = new Date(weekRefDate);
    nextDate.setDate(nextDate.getDate() + 7);
    setWeekRefDate(nextDate);
  };

  const handleCurrentWeek = () => {
    setWeekRefDate(new Date());
  };

  useEffect(() => {
    loadWeeklyGlanceData(weekRefDate);
  }, [weekRefDate]);

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
          todayPayments: paymentsMap.get(lab.id) || [],
          otHours: logged && logged.otHours ? String(logged.otHours) : '',
          todayOt: logged && logged.otHours ? Number(logged.otHours) : 0
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
        remarks: r.remarks ? r.remarks.trim() : null,
        otHours: r.otHours ? Number(r.otHours) : 0.0
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
      
      await Promise.all([
        loadRegisterData(),
        loadWeeklyGlanceData(weekRefDate)
      ]);
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

  // Helper to compute day tile data for Weekly Glance
  const getDayTileData = (labourerId: string, dDate: Date) => {
    const dateStr = dDate.toISOString().split('T')[0];
    
    // 1. Find attendance record
    const att = weeklyAttendance.find(
      (a) => a.labourerId === labourerId && a.attendanceDate.split('T')[0] === dateStr
    );

    // 2. Find payments logged on this date for this worker
    const dayPayments = weeklyPayments.filter(
      (p) => p.labourerId === labourerId && p.paymentDate.split('T')[0] === dateStr
    );
    const paySum = dayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      date: dDate,
      attendance: att,
      payments: dayPayments,
      paySum,
      status: att ? att.status : '', // Present, Half Day, Absent, Leave
      otHours: att ? (att.otHours || 0) : 0,
      remarks: att ? (att.remarks || '') : ''
    };
  };

  // Date range display helper for Weekly Glance
  const formatDateRange = () => {
    const days = getWeekDays(weekRefDate);
    const start = days[0];
    const end = days[6];
    const startStr = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  // Filtered workers list for Weekly Glance Board
  const weeklyWorkersFiltered = rows.filter((r) => {
    const matchesName = r.name.toLowerCase().includes(searchWeeklyQuery.toLowerCase());
    const matchesRole = filterWeeklyRole ? r.skillType === filterWeeklyRole : true;
    const workerAtts = weeklyAttendance.filter(a => a.labourerId === r.labourerId);
    const matchesProject = filterWeeklyProject
      ? workerAtts.some(a => a.projectId === filterWeeklyProject)
      : true;

    return matchesName && matchesRole && matchesProject;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }} className="register-content">
      
      {/* Unified Main Register Header */}
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
              {activeRegisterTab === 'today' ? formattedHeaderDate : `Week: ${formatDateRange()}`}
            </p>
          </div>

          {/* Today's Register / Weekly Glance Tabs */}
          <div style={{ display: 'flex', background: '#f0ebd8', borderRadius: '30px', padding: '4px', border: '1px solid #dfd8cb' }}>
            <button
              onClick={() => setActiveRegisterTab('today')}
              style={{
                border: 'none',
                borderRadius: '25px',
                padding: '8px 20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s ease',
                background: activeRegisterTab === 'today' ? '#df662e' : 'transparent',
                color: activeRegisterTab === 'today' ? 'white' : '#6d5f50',
                boxShadow: activeRegisterTab === 'today' ? '0 2px 6px rgba(223,102,46,0.2)' : 'none'
              }}
            >
              Today's Register
            </button>
            <button
              onClick={() => setActiveRegisterTab('weekly')}
              style={{
                border: 'none',
                borderRadius: '25px',
                padding: '8px 20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s ease',
                background: activeRegisterTab === 'weekly' ? '#df662e' : 'transparent',
                color: activeRegisterTab === 'weekly' ? 'white' : '#6d5f50',
                boxShadow: activeRegisterTab === 'weekly' ? '0 2px 6px rgba(223,102,46,0.2)' : 'none'
              }}
            >
              Weekly Glance
            </button>
          </div>
        </div>

        {/* Date selection & stats summary (Only for Today's view) */}
        {activeRegisterTab === 'today' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', paddingTop: '16px', borderTop: '2px dashed #dfd8cb' }}>
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

            {/* Dynamic Supervisor Stats Panel */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              marginTop: '16px'
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
          </>
        )}

        {/* Week navigation (Only for Weekly view) */}
        {activeRegisterTab === 'weekly' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '2px dashed #dfd8cb' }}>
            <button onClick={handlePrevWeek} className="btn btn-secondary btn-sm" style={{ padding: '8px 16px', fontWeight: 'bold' }}>
              ◀ Previous Week
            </button>
            <button onClick={handleCurrentWeek} className="btn btn-primary btn-sm" style={{ padding: '8px 16px', fontWeight: 'bold', background: '#df662e', border: 'none' }}>
              Current Week
            </button>
            <button onClick={handleNextWeek} className="btn btn-secondary btn-sm" style={{ padding: '8px 16px', fontWeight: 'bold' }}>
              Next Week ▶
            </button>
          </div>
        )}
      </div>

      {/* Weekly Glance Board section */}
      {activeRegisterTab === 'weekly' && (
        <div className="weekly-glance-section" style={{
          background: '#fcfaf5',
          border: '2px solid #dfd8cb',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
        }}>
          {/* Weekly Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6d5f50', display: 'block', marginBottom: '4px' }}>Search Labourer</label>
              <input
                type="text"
                placeholder="Search name..."
                className="form-control"
                value={searchWeeklyQuery}
                onChange={(e) => setSearchWeeklyQuery(e.target.value)}
                style={{ background: 'white', border: '1px solid #dfd8cb', borderRadius: '6px', padding: '8px 10px', fontSize: '0.9rem', width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6d5f50', display: 'block', marginBottom: '4px' }}>Filter By Project</label>
              <select
                className="form-control"
                value={filterWeeklyProject}
                onChange={(e) => setFilterWeeklyProject(e.target.value)}
                style={{ background: 'white', border: '1px solid #dfd8cb', borderRadius: '6px', padding: '8px 10px', fontSize: '0.9rem', width: '100%' }}
              >
                <option value="">-- All Projects --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectName}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6d5f50', display: 'block', marginBottom: '4px' }}>Filter By Role</label>
              <select
                className="form-control"
                value={filterWeeklyRole}
                onChange={(e) => setFilterWeeklyRole(e.target.value)}
                style={{ background: 'white', border: '1px solid #dfd8cb', borderRadius: '6px', padding: '8px 10px', fontSize: '0.9rem', width: '100%' }}
              >
                <option value="">-- All Roles --</option>
                {['Carpenter', 'Polisher', 'Painter', 'Helper', 'Installer'].map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Glance Grid Content */}
          {weeklyLoading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#8c7d6b' }}>
              🔄 Loading weekly glance tracker...
            </div>
          ) : weeklyWorkersFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#8c7d6b', background: 'white', border: '1px dashed #dfd8cb', borderRadius: '8px' }}>
              No matching labourers found for the active filters.
            </div>
          ) : (
            <div>
              {/* Desktop Board Layout */}
              <div className="weekly-desktop-board" style={{ display: 'none', flexDirection: 'column', gap: '16px' }}>
                {/* Grid header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '180px repeat(7, 1fr) 200px',
                  gap: '10px',
                  alignItems: 'center',
                  borderBottom: '2px solid #dfd8cb',
                  paddingBottom: '8px',
                  fontWeight: 'bold',
                  color: '#6d5f50',
                  fontSize: '0.85rem'
                }}>
                  <div>Labourer</div>
                  {getWeekDays(weekRefDate).map((d, dIdx) => (
                    <div key={dIdx} style={{ textAlign: 'center' }}>
                      {d.toLocaleDateString('en-IN', { weekday: 'short' })}<br/>
                      <span style={{ fontSize: '0.75rem', color: '#8c7d6b' }}>{d.getDate()}</span>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right' }}>Weekly Summary</div>
                </div>

                {/* Grid body rows */}
                {weeklyWorkersFiltered.map((worker) => {
                  const weekTiles = getWeekDays(weekRefDate).map((d) => getDayTileData(worker.labourerId, d));
                  const pCount = weekTiles.filter(t => t.status === 'Present').length;
                  const hCount = weekTiles.filter(t => t.status === 'Half Day').length;
                  const aCount = weekTiles.filter(t => t.status === 'Absent' || t.status === 'Leave').length;
                  const totalPaidWeek = weekTiles.reduce((sum, t) => sum + t.paySum, 0);
                  const totalOtWeek = weekTiles.reduce((sum, t) => sum + t.otHours, 0);

                  return (
                    <div key={worker.labourerId} style={{
                      display: 'grid',
                      gridTemplateColumns: '180px repeat(7, 1fr) 200px',
                      gap: '10px',
                      alignItems: 'center',
                      borderBottom: '1px solid #eee0cd',
                      paddingBottom: '10px'
                    }}>
                      {/* Labour details */}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#3d3429' }}>{worker.name}</div>
                        <span style={{ fontSize: '0.75rem', background: '#f0ebd8', color: '#7a6a53', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                          {worker.skillType}
                        </span>
                      </div>

                      {/* 7 Days Tiles */}
                      {weekTiles.map((tile, tileIdx) => {
                        const { status, paySum, otHours, remarks, attendance } = tile;
                        
                        // Determine colors based on status
                        let color = '#6b7280';
                        let bg = '#f3f4f6';
                        let border = '1px solid #e5e7eb';
                        let statusLabel = '—';

                        if (status === 'Present') {
                          color = '#047857';
                          bg = '#ecfdf5';
                          border = '2px solid #a7f3d0';
                          statusLabel = attendance?.project ? attendance.project.projectName : 'Bench';
                        } else if (status === 'Half Day') {
                          color = '#b45309';
                          bg = '#fffbeb';
                          border = '2px solid #fef3c7';
                          statusLabel = attendance?.project ? attendance.project.projectName : 'Bench';
                        } else if (status === 'Absent' || status === 'Leave') {
                          color = '#b91c1c';
                          bg = '#fef2f2';
                          border = '2px solid #fee2e2';
                          statusLabel = status === 'Leave' ? 'Leave' : 'Absent';
                        }

                        return (
                          <div
                            key={tileIdx}
                            onClick={() => setSelectedTileDetail({
                              ...tile,
                              workerName: worker.name,
                              status
                            })}
                            style={{
                              background: bg,
                              border,
                              color,
                              borderRadius: '8px',
                              padding: '8px',
                              height: '80px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                          >
                            {/* Project Name or status */}
                            <div style={{ fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {status === 'Present' ? `🟢 ${statusLabel}` : status === 'Half Day' ? `🟡 ${statusLabel}` : status === 'Absent' || status === 'Leave' ? `🔴 ${statusLabel}` : '—'}
                            </div>

                            {/* Payout & OT & Notes */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                {paySum > 0 && (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857' }}>
                                    ₹{paySum}
                                  </span>
                                )}
                                {otHours > 0 && (
                                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 3px' }}>
                                    OT {otHours}h
                                  </span>
                                )}
                              </div>
                              {remarks && (
                                <span style={{ fontSize: '0.75rem' }} title={remarks}>📝</span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Weekly worker summary metrics */}
                      <div style={{
                        textAlign: 'right',
                        fontSize: '0.8rem',
                        color: '#3d3429',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        justifyContent: 'center',
                        height: '100%'
                      }}>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>P:</span> {pCount} | <span style={{ fontWeight: 'bold' }}>H:</span> {hCount} | <span style={{ fontWeight: 'bold' }}>A:</span> {aCount}
                        </div>
                        <div style={{ color: '#047857', fontWeight: 800 }}>
                          Paid: ₹{totalPaidWeek}
                        </div>
                        <div style={{ color: '#1d4ed8', fontWeight: 'bold' }}>
                          OT: {totalOtWeek} hrs
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Planner Layout */}
              <div className="weekly-mobile-board" style={{ display: 'none', flexDirection: 'column', gap: '16px' }}>
                {weeklyWorkersFiltered.map((worker) => {
                  const weekTiles = getWeekDays(weekRefDate).map((d) => getDayTileData(worker.labourerId, d));
                  const pCount = weekTiles.filter(t => t.status === 'Present').length;
                  const hCount = weekTiles.filter(t => t.status === 'Half Day').length;
                  const aCount = weekTiles.filter(t => t.status === 'Absent' || t.status === 'Leave').length;
                  const totalPaidWeek = weekTiles.reduce((sum, t) => sum + t.paySum, 0);
                  const totalOtWeek = weekTiles.reduce((sum, t) => sum + t.otHours, 0);

                  return (
                    <div key={worker.labourerId} style={{
                      background: 'white',
                      border: '1px solid #dfd8cb',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      {/* Card Header info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#3d3429', margin: 0 }}>{worker.name}</h4>
                          <span style={{ fontSize: '0.75rem', background: '#f0ebd8', color: '#7a6a53', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold', marginTop: '2px' }}>
                            {worker.skillType}
                          </span>
                        </div>
                        
                        {/* Mobile totals sum summaries */}
                        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#8c7d6b' }}>
                          <strong>Paid: ₹{totalPaidWeek}</strong> • <strong>OT: {totalOtWeek}h</strong>
                        </div>
                      </div>

                      {/* Mon-Sun cards layout stack */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {weekTiles.map((tile, tileIdx) => {
                          const { status, paySum, otHours, remarks } = tile;
                          
                          let bg = '#f3f4f6';
                          let border = '1px solid #e5e7eb';
                          let indicatorColor = '#6b7280';

                          if (status === 'Present') {
                            bg = '#ecfdf5';
                            border = '1px solid #a7f3d0';
                            indicatorColor = '#047857';
                          } else if (status === 'Half Day') {
                            bg = '#fffbeb';
                            border = '1px solid #fef3c7';
                            indicatorColor = '#b45309';
                          } else if (status === 'Absent' || status === 'Leave') {
                            bg = '#fef2f2';
                            border = '1px solid #fee2e2';
                            indicatorColor = '#b91c1c';
                          }

                          return (
                            <div
                              key={tileIdx}
                              onClick={() => setSelectedTileDetail({
                                ...tile,
                                workerName: worker.name,
                                status
                              })}
                              style={{
                                background: bg,
                                border,
                                borderRadius: '6px',
                                padding: '4px 2px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                height: '62px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                              }}
                            >
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#8c7d6b' }}>
                                {getWeekDays(weekRefDate)[tileIdx].toLocaleDateString('en-IN', { weekday: 'narrow' })}
                              </span>
                              
                              {/* Circle indicator status icon */}
                              <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: indicatorColor,
                                margin: '0 auto'
                              }} />
                              
                              {/* Tiny details tags */}
                              <div style={{ fontSize: '0.55rem', fontWeight: 'bold' }}>
                                {paySum > 0 ? `₹${paySum}` : otHours > 0 ? `OT` : remarks ? `📝` : ' '}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Compact Project status text display (only showing days where they actually worked) */}
                      <div style={{ fontSize: '0.75rem', background: '#faf9f6', padding: '6px 10px', borderRadius: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#6d5f50' }}>Projects this week:</span>
                        {(() => {
                          const projectsWorked = weekTiles
                            .filter(t => (t.status === 'Present' || t.status === 'Half Day') && t.attendance?.project)
                            .map(t => t.attendance.project.projectName);
                          const uniqueProjects = Array.from(new Set(projectsWorked));
                          return uniqueProjects.length > 0
                            ? uniqueProjects.join(', ')
                            : <span style={{ color: '#8c7d6b', fontStyle: 'italic' }}>Bench (No active projects)</span>;
                        })()}
                      </div>

                      {/* Stats badge counter summaries */}
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: '#6d5f50' }}>
                        <span>Present: <strong>{pCount}</strong></span> • 
                        <span>Half Day: <strong>{hCount}</strong></span> • 
                        <span>Absent: <strong>{aCount}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>
      )}

      {activeRegisterTab === 'today' && (
        <>

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
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '5%' }}>SL</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '20%' }}>Labour Name</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '15%' }}>Attendance Status</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '22%' }}>Projects Worked Today</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '10%' }}>OT Hours</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '14%' }}>Amount Paid</th>
                    <th style={{ padding: '16px', color: '#6d5f50', fontSize: '0.9rem', fontWeight: 'bold', width: '14%' }}>Supervisor Notes</th>
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

                            {row.todayOt > 0 && (
                              <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 'bold', marginTop: '2px' }}>
                                OT Today: {row.todayOt} hrs
                              </span>
                            )}
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

                        {/* OT Hours */}
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="OT Hours"
                            className="form-control"
                            value={row.otHours}
                            onChange={(e) => handleRowChange(idx, 'otHours', e.target.value)}
                            style={{
                              fontSize: '0.9rem',
                              border: '1px solid #dfd8cb',
                              borderRadius: '6px',
                              padding: '6px',
                              maxWidth: '90px',
                              background: row.otHours && Number(row.otHours) > 0 ? '#eff6ff' : 'white'
                            }}
                          />
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

                    {/* OT Hours Section (Mobile Friendly) */}
                    <div>
                      <label style={{ color: '#6d5f50', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>
                        Overtime Hours (OT)
                      </label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="0.0"
                          className="form-control"
                          value={row.otHours}
                          onChange={(e) => handleRowChange(idx, 'otHours', e.target.value)}
                          style={{
                            fontSize: '1rem',
                            height: '44px',
                            minHeight: '44px',
                            border: '1px solid #dfd8cb',
                            borderRadius: '8px',
                            padding: '10px',
                            flex: 1,
                            background: row.otHours && Number(row.otHours) > 0 ? '#eff6ff' : 'white'
                          }}
                        />
                        {row.todayOt > 0 && (
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: '#1d4ed8',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '10px 14px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            OT Today: {row.todayOt} hrs
                          </span>
                        )}
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
        </>
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

      {/* SEARCHABLE TILE DETAIL MODAL (Weekly Glance Side Drawer) */}
      {selectedTileDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(61, 52, 41, 0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 3000,
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: '#fffdf9',
            height: '100%',
            boxShadow: '-8px 0 32px rgba(61, 52, 41, 0.15)',
            borderLeft: '2px solid #dfd8cb',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee0cd', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', color: '#3d3429', fontWeight: 800, margin: 0 }}>
                  📅 {new Date(selectedTileDetail.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <p style={{ margin: '4px 0 0 0', color: '#8c7d6b', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  Worker: {selectedTileDetail.workerName}
                </p>
              </div>
              <button
                onClick={() => setSelectedTileDetail(null)}
                style={{
                  background: '#f0ebd8',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: '#3d3429',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Attendance */}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#8c7d6b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Attendance</span>
                {selectedTileDetail.status ? (
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    padding: '6px 16px',
                    borderRadius: '8px',
                    display: 'inline-block',
                    background: selectedTileDetail.status === 'Present' ? '#ecfdf5' : selectedTileDetail.status === 'Half Day' ? '#fffbeb' : '#fef2f2',
                    color: selectedTileDetail.status === 'Present' ? '#047857' : selectedTileDetail.status === 'Half Day' ? '#b45309' : '#b91c1c',
                    border: `1px solid ${selectedTileDetail.status === 'Present' ? '#a7f3d0' : selectedTileDetail.status === 'Half Day' ? '#fef3c7' : '#fee2e2'}`
                  }}>
                    {selectedTileDetail.status}
                  </span>
                ) : (
                  <span style={{ color: '#8c7d6b', fontStyle: 'italic' }}>No attendance logged today.</span>
                )}
              </div>

              {/* Project */}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#8c7d6b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Project Worked</span>
                {selectedTileDetail.attendance && selectedTileDetail.attendance.project ? (
                  <div style={{ background: 'white', border: '1px solid #dfd8cb', borderRadius: '8px', padding: '12px' }}>
                    <strong style={{ color: '#3d3429', display: 'block' }}>{selectedTileDetail.attendance.project.projectName}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#8c7d6b' }}>Code: {selectedTileDetail.attendance.project.projectCode}</span>
                  </div>
                ) : selectedTileDetail.status ? (
                  <span style={{ color: '#3d3429', fontWeight: '500' }}>Bench / General Office</span>
                ) : (
                  <span style={{ color: '#8c7d6b', fontStyle: 'italic' }}>—</span>
                )}
              </div>

              {/* OT */}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#8c7d6b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Overtime (OT)</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: selectedTileDetail.otHours > 0 ? '#1d4ed8' : '#3d3429' }}>
                  {selectedTileDetail.otHours} hours
                </div>
              </div>

              {/* Payments */}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#8c7d6b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Payments Today</span>
                {selectedTileDetail.payments.length === 0 ? (
                  <span style={{ color: '#8c7d6b', fontStyle: 'italic' }}>No payments logged today.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedTileDetail.payments.map((p: any, pIdx: number) => (
                      <div key={pIdx} style={{
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <strong style={{ color: '#047857', fontSize: '1.1rem' }}>₹{p.amount}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#065f46' }}>
                            Type: {p.paymentType}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#047857' }}>
                          {new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    <div style={{ borderTop: '2px solid #a7f3d0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#047857' }}>
                      <span>Total Paid:</span>
                      <span>₹{selectedTileDetail.paySum}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#8c7d6b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Supervisor Remarks</span>
                <div style={{ background: 'white', border: '1px solid #dfd8cb', borderRadius: '8px', padding: '12px', minHeight: '60px', color: '#3d3429', fontStyle: selectedTileDetail.remarks ? 'normal' : 'italic' }}>
                  {selectedTileDetail.remarks || 'No notes logged today.'}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ borderTop: '2px solid #eee0cd', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedTileDetail(null)}
                style={{
                  background: '#df662e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '10px 24px',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(223, 102, 46, 0.15)'
                }}
              >
                Close Details
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
          .weekly-desktop-board { display: flex !important; }
          .weekly-mobile-board { display: none !important; }
          
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
          .weekly-desktop-board { display: none !important; }
          .weekly-mobile-board { display: flex !important; }
          
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
