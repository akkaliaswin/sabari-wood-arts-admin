'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';

interface ClientShort {
  id: string;
  name: string;
  clientCode: string;
  phone: string;
}

interface ProjectShort {
  id: string;
  projectName: string;
  projectCode: string;
  status: string;
  quotedAmount: number;
}

interface PaymentRecord {
  id: string;
  paymentCode: string;
  projectId: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string | null;
  remarks: string | null;
  createdAt: string;
  project: {
    id: string;
    projectCode: string;
    projectName: string;
    status: string;
    quotedAmount: number;
    client: ClientShort;
  };
}

interface KPIMetrics {
  totalCollection: number;
  todayCollection: number;
  monthCollection: number;
  pendingCollection: number;
  totalTransactions: number;
}

// Sub-interface for the drawer detailed view
interface ProjectDetailsExtended {
  id: string;
  projectCode: string;
  projectName: string;
  quotedAmount: number;
  status: string;
  receivedAmount: number;
  pendingCollection: number;
  payments: {
    id: string;
    paymentCode: string;
    paymentDate: string;
    amount: number;
    paymentMode: string;
    referenceNumber: string | null;
    remarks: string | null;
  }[];
}

function PaymentsContent() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [metrics, setMetrics] = useState<KPIMetrics>({
    totalCollection: 0,
    todayCollection: 0,
    monthCollection: 0,
    pendingCollection: 0,
    totalTransactions: 0,
  });
  const [clients, setClients] = useState<ClientShort[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectShort[]>([]);

  // Selected payment for detailed drawer
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<ProjectDetailsExtended | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Active View Tab: 'all' or 'outstanding'
  const [activeTab, setActiveTab] = useState<'all' | 'outstanding'>('all');

  // Search and Filters
  const [search, setSearch] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('All'); // Today, Week, Month, LastMonth, Custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [projectStatus, setProjectStatus] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const paymentModes = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
  const projectStatuses = [
    { label: 'Lead', value: 'Lead' },
    { label: 'Quoted', value: 'Quoted' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Completed', value: 'Completed' },
  ];

  // Refresh lists & filter options on mount
  useEffect(() => {
    fetchFilterDropdowns();
  }, []);

  // Fetch payments list when filters or page changes
  useEffect(() => {
    fetchPayments();
  }, [search, dateRangePreset, startDate, endDate, paymentMode, projectStatus, selectedClientId, selectedProjectId, page, activeTab]);

  const fetchFilterDropdowns = async () => {
    try {
      const [clientsRes, projectsRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/projects'),
      ]);
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (projectsRes.ok) setProjectsList(await projectsRes.json());
    } catch (err) {
      console.error('Failed to fetch dropdown filters', err);
    }
  };

  const getEffectiveDates = () => {
    let start = startDate;
    let end = endDate;

    if (dateRangePreset !== 'Custom') {
      const now = new Date();
      if (dateRangePreset === 'Today') {
        const todayStr = now.toISOString().split('T')[0];
        start = todayStr;
        end = todayStr;
      } else if (dateRangePreset === 'Week') {
        const currentDay = now.getDay();
        const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - distanceToMonday);
        start = monday.toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
      } else if (dateRangePreset === 'Month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        start = firstDay.toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
      } else if (dateRangePreset === 'LastMonth') {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        start = firstDayLastMonth.toISOString().split('T')[0];
        end = lastDayLastMonth.toISOString().split('T')[0];
      } else {
        start = '';
        end = '';
      }
    }

    return { start, end };
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError('');
      const { start, end } = getEffectiveDates();

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        paymentMode,
        projectStatus,
        clientId: selectedClientId,
        projectId: selectedProjectId,
        startDate: start,
        endDate: end,
      });

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to retrieve payments data');

      const data = await res.json();
      setPayments(data.payments);
      setTotalCount(data.totalCount);
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err.message || 'Error occurred fetching payments');
    } finally {
      setLoading(false);
    }
  };

  // Open drawer, fetch project details for matching payment history and values
  const handleViewPaymentDetails = async (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setSelectedProjectDetails(null);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/projects/${payment.projectId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProjectDetails(data);
      }
    } catch (err) {
      console.error('Error fetching nested project details for payments', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedPayment(null);
    setSelectedProjectDetails(null);
  };

  const clearFilters = () => {
    setSearch('');
    setDateRangePreset('All');
    setStartDate('');
    setEndDate('');
    setPaymentMode('');
    setProjectStatus('');
    setSelectedClientId('');
    setSelectedProjectId('');
    setPage(1);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // CSV and Excel exports respecting current filters
  const handleExport = async (type: 'csv' | 'excel') => {
    try {
      const { start, end } = getEffectiveDates();
      const params = new URLSearchParams({
        page: '1',
        limit: '10000', // Fetch all matching records
        search,
        paymentMode,
        projectStatus,
        clientId: selectedClientId,
        projectId: selectedProjectId,
        startDate: start,
        endDate: end,
      });

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Export data fetch failed');
      const data = await res.json();
      const exportList: PaymentRecord[] = data.payments;

      let fileContent = '';
      let filename = `payments_report_${new Date().toISOString().split('T')[0]}`;

      if (activeTab === 'all') {
        const headers = [
          'Payment Code',
          'Payment Date',
          'Client Name',
          'Client Phone',
          'Project Code',
          'Project Name',
          'Amount',
          'Payment Mode',
          'Reference Number',
          'Remarks',
          'Created At',
        ];

        const rows = exportList.map((p) => [
          p.paymentCode,
          new Date(p.paymentDate).toLocaleDateString('en-IN'),
          p.project.client.name,
          p.project.client.phone,
          p.project.projectCode,
          p.project.projectName,
          p.amount.toString(),
          p.paymentMode,
          p.referenceNumber || '',
          p.remarks || '',
          new Date(p.createdAt).toLocaleString('en-IN'),
        ]);

        if (type === 'excel') {
          // Tab-separated for Excel (ends with .xls or .csv but excel handles TSV perfectly)
          fileContent = '\uFEFF' + [headers.join('\t'), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join('\t'))].join('\n');
          filename += '.tsv';
        } else {
          // Standard CSV
          fileContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
          filename += '.csv';
        }
      } else {
        // Outstanding Collections tab export
        const headers = [
          'Client Name',
          'Project Code',
          'Project Name',
          'Project Value',
          'Total Received',
          'Outstanding Amount',
          'Last Payment Date',
          'Days Since Last Payment',
        ];

        // Filter projects list for matching client/project filters
        const filteredProjects = projectsList.filter((p: any) => {
          if (selectedClientId && p.clientId !== selectedClientId) return false;
          if (selectedProjectId && p.id !== selectedProjectId) return false;
          if (projectStatus && p.status !== projectStatus) {
            // Check status mapping
            if (projectStatus === 'In Progress' && !['Advance Received', 'Production', 'Installation', 'Measurement Done'].includes(p.status)) return false;
            if (projectStatus === 'Quoted' && p.status !== 'Quotation Sent') return false;
            if (projectStatus !== 'In Progress' && projectStatus !== 'Quoted' && p.status !== projectStatus) return false;
          }
          if (search) {
            const query = search.toLowerCase();
            const clientMatch = p.client?.name?.toLowerCase().includes(query) || p.client?.phone?.includes(query);
            const projectMatch = p.projectName.toLowerCase().includes(query) || p.projectCode.toLowerCase().includes(query);
            if (!clientMatch && !projectMatch) return false;
          }
          return (p.pendingCollection || 0) > 0;
        });

        const rows = filteredProjects.map((p: any) => {
          let daysStr = 'No payments';
          if (p.lastPaymentDate) {
            const diff = Date.now() - new Date(p.lastPaymentDate).getTime();
            daysStr = Math.floor(diff / (1000 * 60 * 60 * 24)).toString();
          }
          return [
            p.client?.name || 'N/A',
            p.projectCode,
            p.projectName,
            Number(p.quotedAmount).toString(),
            Number(p.receivedAmount).toString(),
            Number(p.pendingCollection).toString(),
            p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString('en-IN') : 'N/A',
            daysStr,
          ];
        });

        if (type === 'excel') {
          fileContent = '\uFEFF' + [headers.join('\t'), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join('\t'))].join('\n');
          filename = `outstanding_collections_${new Date().toISOString().split('T')[0]}.tsv`;
        } else {
          fileContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
          filename = `outstanding_collections_${new Date().toISOString().split('T')[0]}.csv`;
        }
      }

      const blob = new Blob([fileContent], { type: type === 'excel' ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to export reports');
    }
  };

  const getAgingBadgeColor = (days: number) => {
    if (days <= 30) return { bg: 'var(--success-light)', color: 'var(--success)', text: '0-30 Days' };
    if (days <= 60) return { bg: 'var(--warning-light)', color: 'var(--warning)', text: '31-60 Days' };
    return { bg: 'var(--danger-light)', color: 'var(--danger)', text: '60+ Days' };
  };

  // Filter local projectsList for Outstanding Collections view
  const outstandingProjectsFiltered = projectsList.filter((p: any) => {
    // Basic filter checks
    if (selectedClientId && p.clientId !== selectedClientId) return false;
    if (selectedProjectId && p.id !== selectedProjectId) return false;
    if (projectStatus) {
      if (projectStatus === 'In Progress' && !['Advance Received', 'Production', 'Installation', 'Measurement Done'].includes(p.status)) return false;
      if (projectStatus === 'Quoted' && p.status !== 'Quotation Sent') return false;
      if (projectStatus !== 'In Progress' && projectStatus !== 'Quoted' && p.status !== projectStatus) return false;
    }
    if (search) {
      const query = search.toLowerCase();
      const clientMatch = p.client?.name?.toLowerCase().includes(query) || p.client?.phone?.includes(query);
      const projectMatch = p.projectName.toLowerCase().includes(query) || p.projectCode.toLowerCase().includes(query);
      if (!clientMatch && !projectMatch) return false;
    }
    // Only show projects with pending balance
    return (p.pendingCollection || 0) > 0;
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div>
      {/* Page Title Header */}
      <div className="page-title-section">
        <h1 className="page-title">Payments Management</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => fetchPayments()} className="btn btn-secondary btn-sm">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">Total Collection</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {formatCurrency(metrics.totalCollection)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label">Today's Collection</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(metrics.todayCollection)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="stat-label">This Month Collection</div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>
            {formatCurrency(metrics.monthCollection)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label">Total Outstanding Collection</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {formatCurrency(metrics.pendingCollection)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #6b6964' }}>
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
            {metrics.totalTransactions}
          </div>
        </div>
      </div>

      {/* Control Panel: Search & Filters */}
      <div className="card" style={{ background: '#faf9f6', padding: '18px', marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Filter & Search Collections</h3>
        
        <div className="form-row">
          <div className="form-group" style={{ flex: '1 1 250px' }}>
            <label className="form-label">Search</label>
            <div className="search-input-wrapper" style={{ maxWidth: '100%' }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="form-control"
                placeholder="Search Client Name/Phone, Project Name/Code, Payment/Ref Code..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <div className="form-group" style={{ flex: '1 1 180px' }}>
            <label className="form-label">Date Range Preset</label>
            <select
              className="form-control"
              value={dateRangePreset}
              onChange={(e) => { setDateRangePreset(e.target.value); setPage(1); }}
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="Week">This Week</option>
              <option value="Month">This Month</option>
              <option value="LastMonth">Last Month</option>
              <option value="Custom">Custom Range</option>
            </select>
          </div>

          {dateRangePreset === 'Custom' && (
            <>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                />
              </div>
              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                />
              </div>
            </>
          )}
        </div>

        <div className="form-row" style={{ marginTop: '4px' }}>
          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label className="form-label">Payment Mode</label>
            <select
              className="form-control"
              value={paymentMode}
              onChange={(e) => { setPaymentMode(e.target.value); setPage(1); }}
              disabled={activeTab === 'outstanding'}
            >
              <option value="">-- All Modes --</option>
              {paymentModes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label className="form-label">Project Status</label>
            <select
              className="form-control"
              value={projectStatus}
              onChange={(e) => { setProjectStatus(e.target.value); setPage(1); }}
            >
              <option value="">-- All Statuses --</option>
              {projectStatuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label className="form-label">Client Filter</label>
            <select
              className="form-control"
              value={selectedClientId}
              onChange={(e) => { setSelectedClientId(e.target.value); setPage(1); }}
            >
              <option value="">-- All Clients --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.clientCode})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label className="form-label">Project Filter</label>
            <select
              className="form-control"
              value={selectedProjectId}
              onChange={(e) => { setSelectedProjectId(e.target.value); setPage(1); }}
            >
              <option value="">-- All Projects --</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>{p.projectName} ({p.projectCode})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '12px' }}>
          <button onClick={clearFilters} className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>
            🧹 Clear Filters
          </button>
          
          {/* Reports Export Section */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Export:</span>
            <button onClick={() => handleExport('csv')} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
              📄 CSV
            </button>
            <button onClick={() => handleExport('excel')} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
              📈 Excel
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="tabs-container" style={{ marginBottom: '16px' }}>
        <button
          onClick={() => { setActiveTab('all'); setPage(1); }}
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
        >
          💳 All Payments ({totalCount})
        </button>
        <button
          onClick={() => { setActiveTab('outstanding'); setPage(1); }}
          className={`tab-button ${activeTab === 'outstanding' ? 'active' : ''}`}
        >
          ⏳ Outstanding Collections ({outstandingProjectsFiltered.length})
        </button>
      </div>

      {/* Main Listing Grid */}
      {loading ? (
        <div className="empty-state">
          <p>Compiling payment logs...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      ) : activeTab === 'all' ? (
        /* TAB 1: ALL PAYMENTS LIST */
        payments.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">💳</div>
            <p>No payments recorded matching active criteria.</p>
          </div>
        ) : (
          <>
            {/* Desktop payments list table */}
            <div className="table-container" style={{ display: 'none' }}>
              <table style={{ display: 'table' }}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Date</th>
                    <th>Client Name</th>
                    <th>Project</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Ref Number</th>
                    <th>Remarks</th>
                    <th>Logged At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => handleViewPaymentDetails(p)}>
                      <td>
                        <strong style={{ color: 'var(--primary)' }}>{p.paymentCode}</strong>
                      </td>
                      <td>{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                      <td>
                        <div><strong>{p.project.client.name}</strong></div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.project.client.phone}</div>
                      </td>
                      <td>
                        <div><strong>{p.project.projectName}</strong></div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.project.projectCode}</div>
                      </td>
                      <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td>
                        <span className="badge badge-pending" style={{ background: '#faf0e6', color: 'var(--primary)', border: '1px solid var(--border)' }}>
                          {p.paymentMode}
                        </span>
                      </td>
                      <td>{p.referenceNumber || '—'}</td>
                      <td>
                        <div style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.remarks || ''}>
                          {p.remarks || '—'}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(p.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleViewPaymentDetails(p)} className="btn btn-secondary btn-sm">
                          👁️ Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile layout payments list cards */}
            <div className="mobile-list-container">
              {payments.map((p) => (
                <div key={p.id} className="mobile-list-card" style={{ borderLeft: '4px solid var(--success)' }} onClick={() => handleViewPaymentDetails(p)}>
                  <div className="mobile-list-header">
                    <div>
                      <div className="mobile-list-title" style={{ color: 'var(--primary)' }}>{p.paymentCode}</div>
                      <div className="mobile-list-subtitle">
                        {new Date(p.paymentDate).toLocaleDateString('en-IN')} • <strong>{p.paymentMode}</strong>
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '1.1rem' }}>
                      {formatCurrency(p.amount)}
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                    <div className="mobile-list-row">
                      <span>Client:</span>
                      <span>{p.project.client.name} ({p.project.client.phone})</span>
                    </div>
                    <div className="mobile-list-row">
                      <span>Project:</span>
                      <span>{p.project.projectName} ({p.project.projectCode})</span>
                    </div>
                    {p.referenceNumber && (
                      <div className="mobile-list-row">
                        <span>Ref Number:</span>
                        <span>{p.referenceNumber}</span>
                      </div>
                    )}
                    {p.remarks && (
                      <div className="mobile-list-row">
                        <span>Remarks:</span>
                        <span>{p.remarks}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary btn-sm"
                  style={{ minWidth: '80px' }}
                >
                  ⬅️ Prev
                </button>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Page <strong>{page}</strong> of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-secondary btn-sm"
                  style={{ minWidth: '80px' }}
                >
                  Next ➡️
                </button>
              </div>
            )}
          </>
        )
      ) : (
        /* TAB 2: OUTSTANDING COLLECTIONS AGING REPORT */
        outstandingProjectsFiltered.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">⏳</div>
            <p>No projects registered with outstanding balances matching active criteria.</p>
          </div>
        ) : (
          <>
            {/* Desktop Aging report view */}
            <div className="table-container" style={{ display: 'none' }}>
              <table style={{ display: 'table' }}>
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Project Details</th>
                    <th>Project Value</th>
                    <th>Total Received</th>
                    <th>Outstanding Amount</th>
                    <th>Last Payment Date</th>
                    <th>Days Since Last Payment</th>
                    <th>Aging Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingProjectsFiltered.map((p: any) => {
                    let days = 999;
                    let daysText = 'No payments';
                    if (p.lastPaymentDate) {
                      const diff = Date.now() - new Date(p.lastPaymentDate).getTime();
                      days = Math.floor(diff / (1000 * 60 * 60 * 24));
                      daysText = `${days} Days`;
                    }
                    const badge = getAgingBadgeColor(days);

                    return (
                      <tr key={p.id}>
                        <td>
                          {p.client ? (
                            <Link href={`/clients/${p.client.id}`} style={{ fontWeight: 'bold' }}>
                              {p.client.name}
                            </Link>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td>
                          <strong>{p.projectName}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.projectCode} • Status: {p.status}</div>
                        </td>
                        <td>{formatCurrency(p.quotedAmount)}</td>
                        <td style={{ color: 'var(--success)' }}>{formatCurrency(p.receivedAmount)}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--warning)' }}>{formatCurrency(p.pendingCollection)}</td>
                        <td>{p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString('en-IN') : 'N/A'}</td>
                        <td>{daysText}</td>
                        <td>
                          <span className="badge" style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.color}` }}>
                            {badge.text}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link href={`/projects/${p.id}`} className="btn btn-secondary btn-sm">
                            ⚙️ Console
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Aging report view */}
            <div className="mobile-list-container">
              {outstandingProjectsFiltered.map((p: any) => {
                let days = 999;
                let daysText = 'No payments logged';
                if (p.lastPaymentDate) {
                  const diff = Date.now() - new Date(p.lastPaymentDate).getTime();
                  days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  daysText = `${days} Days Since Last Payment`;
                }
                const badge = getAgingBadgeColor(days);

                return (
                  <div key={p.id} className="mobile-list-card" style={{ borderLeft: `4px solid ${badge.color}` }}>
                    <div className="mobile-list-header">
                      <div>
                        <div className="mobile-list-title">{p.projectName}</div>
                        <div className="mobile-list-subtitle">
                          {p.projectCode} • Client:{' '}
                          {p.client ? (
                            <Link href={`/clients/${p.client.id}`} style={{ fontWeight: 'bold' }}>
                              {p.client.name}
                            </Link>
                          ) : (
                            'N/A'
                          )}
                        </div>
                      </div>
                      <Link href={`/projects/${p.id}`} className="btn btn-secondary btn-sm">
                        ⚙️ Open
                      </Link>
                    </div>

                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                      <div className="mobile-list-row">
                        <span>Project Value:</span>
                        <span>{formatCurrency(p.quotedAmount)}</span>
                      </div>
                      <div className="mobile-list-row">
                        <span>Total Received:</span>
                        <span style={{ color: 'var(--success)' }}>{formatCurrency(p.receivedAmount)}</span>
                      </div>
                      <div className="mobile-list-row">
                        <span>Outstanding:</span>
                        <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>{formatCurrency(p.pendingCollection)}</span>
                      </div>
                      <div className="mobile-list-row">
                        <span>Aging Status:</span>
                        <span className="badge" style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.color}` }}>
                          {badge.text} ({daysText})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      )}

      {/* PAYMENT DETAIL DRAWER / MODAL OVERLAY */}
      {selectedPayment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 999,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'stretch',
        }} onClick={handleCloseDrawer}>
          <div style={{
            width: '100%',
            maxWidth: '550px',
            background: 'var(--bg-card)',
            boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.1)',
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <span className="badge badge-pending" style={{ background: '#faf0e6', color: 'var(--primary)', border: '1px solid var(--border)', marginBottom: '4px' }}>
                  {selectedPayment.paymentCode}
                </span>
                <h2>Payment Inspection</h2>
              </div>
              <button onClick={handleCloseDrawer} className="btn btn-secondary btn-sm" style={{ fontSize: '1.2rem', padding: '4px 10px', minHeight: '36px' }}>
                ❌ Close
              </button>
            </div>

            {/* Payment Details Card */}
            <div className="card">
              <h3 style={{ marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontSize: '0.95rem' }}>Payment Info</h3>
              <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div className="detail-item">
                  <span className="detail-label">Amount Received</span>
                  <span className="detail-value" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                    {formatCurrency(selectedPayment.amount)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Payment Date</span>
                  <span className="detail-value">{new Date(selectedPayment.paymentDate).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Payment Mode</span>
                  <span className="detail-value">{selectedPayment.paymentMode}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Reference Number</span>
                  <span className="detail-value">{selectedPayment.referenceNumber || '—'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-label">Remarks / Description</span>
                  <span className="detail-value">{selectedPayment.remarks || '—'}</span>
                </div>
              </div>
            </div>

            {/* Client Details Card */}
            <div className="card">
              <h3 style={{ marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontSize: '0.95rem' }}>Client Info</h3>
              <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-label">Client Name</span>
                  <span className="detail-value" style={{ fontWeight: 'bold' }}>
                    <Link href={`/clients/${selectedPayment.project.client.id}`} onClick={handleCloseDrawer}>
                      👤 {selectedPayment.project.client.name} ({selectedPayment.project.client.clientCode})
                    </Link>
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{selectedPayment.project.client.phone}</span>
                </div>
              </div>
            </div>

            {/* Project Details Card */}
            <div className="card">
              <h3 style={{ marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontSize: '0.95rem' }}>Project Scope</h3>
              <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-label">Project Name</span>
                  <span className="detail-value" style={{ fontWeight: 'bold' }}>
                    <Link href={`/projects/${selectedPayment.projectId}`} onClick={handleCloseDrawer}>
                      🪵 {selectedPayment.project.projectName} ({selectedPayment.project.projectCode})
                    </Link>
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Project Status</span>
                  <span className="detail-value">{selectedPayment.project.status}</span>
                </div>
              </div>
            </div>

            {/* Project Financial Summary Drawer Card */}
            {drawerLoading ? (
              <p style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>Fetching project financial statistics...</p>
            ) : selectedProjectDetails ? (
              <>
                <div className="card" style={{ background: 'var(--primary-light)', borderLeft: '4px solid var(--primary)' }}>
                  <h3 style={{ marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--primary)', fontSize: '0.95rem' }}>Project Financial Summary</h3>
                  <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div className="detail-item">
                      <span className="detail-label">Project Value</span>
                      <span className="detail-value" style={{ fontWeight: 'bold' }}>
                        {formatCurrency(selectedProjectDetails.quotedAmount)}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Total Received</span>
                      <span className="detail-value" style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                        {formatCurrency(selectedProjectDetails.receivedAmount)}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Outstanding</span>
                      <span className="detail-value" style={{ fontWeight: 'bold', color: 'var(--warning)' }}>
                        {formatCurrency(selectedProjectDetails.pendingCollection)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payments History for the same project */}
                <div className="card">
                  <h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Project Collections Ledger</h3>
                  {selectedProjectDetails.payments.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No other payments logged for this project.</p>
                  ) : (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                      <table style={{ fontSize: '0.82rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Code</th>
                            <th style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Date</th>
                            <th style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Amt</th>
                            <th style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Mode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProjectDetails.payments.map((p) => (
                            <tr key={p.id} style={{ background: p.id === selectedPayment.id ? 'var(--primary-light)' : 'transparent' }}>
                              <td style={{ padding: '8px 10px' }}><strong>{p.paymentCode}</strong></td>
                              <td style={{ padding: '8px 10px' }}>{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{formatCurrency(p.amount)}</td>
                              <td style={{ padding: '8px 10px' }}>{p.paymentMode}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {/* Quick Actions / Future enhancements markers */}
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: 'auto' }}>
              <Link href={`/projects/${selectedPayment.projectId}`} onClick={handleCloseDrawer} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                🪵 Open Project Console
              </Link>
            </div>
            
            {/* Future enhancements placeholders (Architecture Ready) */}
            <div style={{ border: '1px dashed var(--border)', padding: '10px', borderRadius: 'var(--radius)', background: '#faf9f6', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <strong>🚀 Future-Ready Capabilities:</strong>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span title="Future: Send Payment Receipt instantly to Client via WhatsApp" style={{ cursor: 'help', padding: '2px 6px', background: '#e1f5fe', color: '#0288d1', borderRadius: '4px' }}>💬 WhatsApp Remind</span>
                <span title="Future: Download official payment receipt PDF statement" style={{ cursor: 'help', padding: '2px 6px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px' }}>📄 PDF Receipt</span>
                <span title="Future: Generate client overall tax invoice statement" style={{ cursor: 'help', padding: '2px 6px', background: '#fff3e0', color: '#ef6c00', borderRadius: '4px' }}>🧾 Invoice Statement</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles for desktop & mobile tables toggling */}
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

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="empty-state"><p>Loading Payments Module...</p></div>}>
      <PaymentsContent />
    </Suspense>
  );
}
