'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ReportRow {
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  clientCode: string;
  quotedAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  materialCost: number;
  labourCost: number;
  profit: number; // Profit = Quoted - Material - Labour
  marginPercentage: number;
}

interface ReportSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalRevenue: number;
  totalPaymentsReceived: number;
  totalOutstandingCollection: number;
  totalMaterialCost: number;
  totalLabourCost: number;
  totalProfit: number;
  totalMarginPercentage: number;
  totalLabourPayments?: number;
}

interface ReportLabourPayment {
  id: string;
  paymentCode: string;
  paymentDate: string;
  amount: number;
  paymentType: string;
  remarks: string | null;
  labourerName: string;
  labourerCode: string;
}

interface DropdownItem {
  id: string;
  name: string;
}

interface ProjectDropdownItem {
  id: string;
  projectName: string;
  projectCode: string;
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<{ summary: ReportSummary; rows: ReportRow[]; labourPayments?: ReportLabourPayment[] } | null>(null);
  const [clients, setClients] = useState<DropdownItem[]>([]);
  const [projects, setProjects] = useState<ProjectDropdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWorkType, setSelectedWorkType] = useState('');

  const workTypes = [
    'Bed',
    'Wardrobe',
    'Dining Table',
    'Kitchen',
    'Door',
    'Window',
    'TV Unit',
    'Interior',
    'Full Furnishing',
    'Custom Woodwork',
  ];

  useEffect(() => {
    fetchFilters();
    generateReport();
  }, []);

  const fetchFilters = async () => {
    try {
      const clientsRes = await fetch(`/api/clients?t=${Date.now()}`);
      const projectsRes = await fetch(`/api/projects?t=${Date.now()}`);
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
    } catch (err) {
      console.error('Failed to load filter choices:', err);
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedClient) params.append('clientId', selectedClient);
      if (selectedProject) params.append('projectId', selectedProject);
      if (selectedWorkType) params.append('workType', selectedWorkType);

      params.append('t', Date.now().toString());
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to generate report');
      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred generating reports');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedClient('');
    setSelectedProject('');
    setSelectedWorkType('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div>
      <div className="page-title-section">
        <h1 className="page-title">Business Reports</h1>
        <button onClick={generateReport} className="btn btn-primary">
          📊 Generate Report
        </button>
      </div>

      {/* Reports Filter Form */}
      <div className="card" style={{ background: '#faf9f6', padding: '18px', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '14px', fontSize: '1.05rem' }}>Search Filters</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Work Type</label>
            <select
              className="form-control"
              value={selectedWorkType}
              onChange={(e) => setSelectedWorkType(e.target.value)}
            >
              <option value="">-- All Types --</option>
              {workTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Client</label>
            <select
              className="form-control"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="">-- All Clients --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Project</label>
            <select
              className="form-control"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">-- All Projects --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName} ({p.projectCode})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button
              onClick={clearFilters}
              className="btn btn-secondary btn-block"
              style={{ minHeight: '48px' }}
            >
              🧹 Clear Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <p>Compiling report data...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)' }}>Error loading report: {error}</p>
        </div>
      ) : !reportData ? (
        <div className="card empty-state">
          <p>No report generated. Click "Generate Report" above.</p>
        </div>
      ) : (
        <div>
          {/* Summary KPIs */}
          <h3 style={{ margin: '16px 0 12px 0', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Report Summary</h3>
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
              <div className="stat-label">Total Projects</div>
              <div className="stat-value">{reportData.summary.totalProjects}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Active: {reportData.summary.activeProjects} | Completed: {reportData.summary.completedProjects}
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="stat-label">Total Revenue (Quoted)</div>
              <div className="stat-value">{formatCurrency(reportData.summary.totalRevenue)}</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-label">Payments Received</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {formatCurrency(reportData.summary.totalPaymentsReceived)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '2px' }}>
                Pending: {formatCurrency(reportData.summary.totalOutstandingCollection)}
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-label">Total Material Cost</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {formatCurrency(reportData.summary.totalMaterialCost)}
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-label">Total Labour Cost</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {formatCurrency(reportData.summary.totalLabourCost)}
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-label">Labour Payments Disbursed</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {formatCurrency(reportData.summary.totalLabourPayments || 0)}
              </div>
            </div>

            <div className="stat-card" style={{ background: 'var(--primary-light)', borderLeft: '4px solid var(--success)', gridColumn: 'span 2' }}>
              <div className="stat-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Profit</div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '4px' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: reportData.summary.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatCurrency(reportData.summary.totalProfit)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginTop: '6px' }}>
                Margin: {reportData.summary.totalMarginPercentage.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Toggle detailed list button */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 20px 0' }}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="btn btn-secondary"
              style={{ minHeight: '44px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {showDetails ? '🙈 Hide Detailed Project List' : '👁️ View Detailed Project List'}
            </button>
          </div>

          {/* Detailed Row Listings */}
          {(showDetails || !!(startDate || endDate || selectedClient || selectedProject || selectedWorkType)) && (
            <div>
              <h3 style={{ margin: '24px 0 12px 0', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Detailed Ledger Rows ({reportData.rows.length})</h3>
              {reportData.rows.length === 0 ? (
                <div className="card empty-state">
                  <p>No project data matches the selected filters for this time period.</p>
                </div>
              ) : (
                <>
                  {/* Desktop view */}
                  <div className="table-container" style={{ display: 'none' }}>
                    <table style={{ display: 'table' }}>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Client</th>
                          <th>Quoted Amount</th>
                          <th>Received</th>
                          <th>Material Cost</th>
                          <th>Labour Cost</th>
                          <th>Profit</th>
                          <th>Margin %</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.rows.map((row) => (
                          <tr key={row.projectId}>
                            <td>
                              <strong>{row.projectCode}</strong>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.projectName}</div>
                            </td>
                            <td>
                              <strong>{row.clientCode}</strong>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.clientName}</div>
                            </td>
                            <td>{formatCurrency(row.quotedAmount)}</td>
                            <td style={{ color: 'var(--success)' }}>{formatCurrency(row.receivedAmount)}</td>
                            <td style={{ color: 'var(--danger)' }}>{formatCurrency(row.materialCost)}</td>
                            <td style={{ color: 'var(--danger)' }}>{formatCurrency(row.labourCost)}</td>
                            <td style={{ color: row.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                              {formatCurrency(row.profit)}
                            </td>
                            <td style={{ color: row.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                              {row.marginPercentage.toFixed(1)}%
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <Link href={`/projects/${row.projectId}`} className="btn btn-secondary btn-sm">
                                🪵 Open Console
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile view */}
                  <div className="mobile-list-container">
                    {reportData.rows.map((row) => (
                      <div key={row.projectId} className="mobile-list-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                        <div className="mobile-list-header">
                          <div>
                            <div className="mobile-list-title">{row.projectName}</div>
                            <div className="mobile-list-subtitle">{row.projectCode} • {row.clientName}</div>
                          </div>
                          <Link href={`/projects/${row.projectId}`} className="btn btn-secondary btn-sm">
                            ⚙️ Open
                          </Link>
                        </div>

                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                          <div className="mobile-list-row">
                            <span>Quoted Amount (Revenue):</span>
                            <span>{formatCurrency(row.quotedAmount)}</span>
                          </div>
                          <div className="mobile-list-row">
                            <span>Received (Collections):</span>
                            <span style={{ color: 'var(--success)' }}>{formatCurrency(row.receivedAmount)}</span>
                          </div>
                          <div className="mobile-list-row">
                            <span>Materials Cost:</span>
                            <span style={{ color: 'var(--danger)' }}>{formatCurrency(row.materialCost)}</span>
                          </div>
                          <div className="mobile-list-row">
                            <span>Labour Cost:</span>
                            <span style={{ color: 'var(--danger)' }}>{formatCurrency(row.labourCost)}</span>
                          </div>
                          <div className="mobile-list-row">
                            <span>Profit:</span>
                            <span style={{ color: row.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                              {formatCurrency(row.profit)} ({row.marginPercentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Section: Labour Cost & Payments Summary */}
          {reportData.labourPayments && reportData.labourPayments.length > 0 && (
            <div style={{ marginTop: '32px', borderTop: '2px solid var(--border)', paddingTop: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--text-primary)' }}>
                💰 Labour Disbursals Ledger ({reportData.labourPayments.length} Entries)
              </h2>
              
              {/* Desktop Table View */}
              <div className="table-container" style={{ display: 'none' }}>
                <table style={{ display: 'table' }}>
                  <thead>
                    <tr>
                      <th>Payment Code</th>
                      <th>Worker Code</th>
                      <th>Worker Name</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Remarks</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.labourPayments.map((pay) => (
                      <tr key={pay.id}>
                        <td><strong style={{ color: 'var(--primary)' }}>{pay.paymentCode}</strong></td>
                        <td>{pay.labourerCode}</td>
                        <td><strong>{pay.labourerName}</strong></td>
                        <td>{new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <span className="badge badge-pending">
                            {pay.paymentType}
                          </span>
                        </td>
                        <td>{pay.remarks || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: pay.amount < 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                          {formatCurrency(pay.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile List View */}
              <div className="mobile-list-container">
                {reportData.labourPayments.map((pay) => (
                  <div key={pay.id} className="mobile-list-card" style={{ borderLeft: '4px solid var(--success)' }}>
                    <div className="mobile-list-header">
                      <div>
                        <div className="mobile-list-title">{formatCurrency(pay.amount)}</div>
                        <div className="mobile-list-subtitle">{pay.labourerName} ({pay.labourerCode})</div>
                      </div>
                      <span className="badge badge-pending">{pay.paymentType}</span>
                    </div>
                    <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px', fontSize: '0.85rem' }}>
                      <div><strong>Date:</strong> {new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div><strong>Remarks:</strong> {pay.remarks || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
