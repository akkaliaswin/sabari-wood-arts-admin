'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface ClientShort {
  id: string;
  name: string;
  clientCode: string;
}

interface Project {
  id: string;
  projectCode: string;
  projectName: string;
  projectType: string | null;
  status: string;
  quotedAmount: number;
  receivedAmount: number;
  pendingCollection: number;
  projectLocation: string | null;
  client: {
    id: string;
    name: string;
    clientCode: string;
  };
}

function ProjectsContent() {
  const searchParams = useSearchParams();
  const prefillClientId = searchParams.get('clientId') || '';
  const prefillOpen = searchParams.get('new') === 'true';

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientShort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('name'); // 'name' or 'code'
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showAddForm, setShowAddForm] = useState(prefillOpen);

  // Form states
  const [clientId, setClientId] = useState(prefillClientId);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [quotedAmount, setQuotedAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Lead');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const statuses = [
    'Lead',
    'Measurement Done',
    'Quotation Sent',
    'Advance Received',
    'Production',
    'Installation',
    'Completed',
    'On Hold',
    'Cancelled',
  ];

  const [projectTypes, setProjectTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchProjects();
  }, [search, selectedStatus, searchField]);

  useEffect(() => {
    fetchClientsShort();
    fetchProjectTypes();
  }, []);

  const fetchProjectTypes = async () => {
    try {
      const res = await fetch(`/api/settings/work-item-types?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const activeTypes = data.filter((t: any) => !t.isDisabled).map((t: any) => t.name);
        setProjectTypes(activeTypes);
      }
    } catch (err) {
      console.error('Failed to load project categories:', err);
    }
  };

  useEffect(() => {
    if (prefillClientId) {
      setClientId(prefillClientId);
    }
    if (prefillOpen) {
      setShowAddForm(true);
    }
  }, [prefillClientId, prefillOpen]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const url = `/api/projects?search=${encodeURIComponent(search)}&status=${encodeURIComponent(selectedStatus)}&searchField=${searchField}&t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientsShort = async () => {
    try {
      const res = await fetch(`/api/clients?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Failed to pre-fetch client short list:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !projectName.trim()) {
      setFormError('Client profile and Project name are required.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError('');
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          projectName: projectName.trim(),
          projectType: projectType || null,
          projectLocation: projectLocation.trim() || null,
          status,
          quotedAmount: quotedAmount ? Number(quotedAmount) : null,
          startDate: startDate || null,
          expectedCompletionDate: expectedCompletionDate || null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      // Success
      setProjectName('');
      setProjectType('');
      setProjectLocation('');
      setQuotedAmount('');
      setStartDate('');
      setExpectedCompletionDate('');
      setNotes('');
      setStatus('Lead');
      setShowAddForm(false);
      fetchProjects();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during submission.');
    } finally {
      setFormSubmitting(false);
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

  return (
    <div>
      <div className="page-title-section">
        <h1 className="page-title">Projects Module</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary"
        >
          {showAddForm ? '❌ Cancel' : '➕ Create Project'}
        </button>
      </div>

      {/* Project Creation Form */}
      {showAddForm && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Start New Project</h3>
          {formError && (
            <div className="card" style={{ borderColor: 'var(--danger)', background: 'var(--danger-light)', padding: '10px', marginBottom: '16px' }}>
              <p style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 'bold' }}>⚠️ {formError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select
                  className="form-control"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={formSubmitting}
                  required
                >
                  <option value="">-- Select Client Profile --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.clientCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Wardrobe & TV Unit Setup"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={formSubmitting}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Type</label>
                <select
                  className="form-control"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  disabled={formSubmitting}
                >
                  <option value="">-- Select Project Type --</option>
                  {projectTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Site Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Adyar, Chennai"
                  value={projectLocation}
                  onChange={(e) => setProjectLocation(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quoted Amount (INR)</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 150000"
                  value={quotedAmount}
                  onChange={(e) => setQuotedAmount(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={formSubmitting}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Completion Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={expectedCompletionDate}
                  onChange={(e) => setExpectedCompletionDate(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Project Scope Notes</label>
              <textarea
                className="form-control"
                placeholder="Initial measurements, material choices, wood types (Teak, Rosewood, Plywood)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={formSubmitting}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Starting Project Profile...' : 'Save & Start Project'}
            </button>
          </form>
        </div>
      )}

      {/* Search and Filters */}
      <div className="filter-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <select
          className="form-control"
          value={searchField}
          onChange={(e) => { setSearchField(e.target.value); setSearch(''); }}
          style={{ width: '160px', minHeight: '44px' }}
        >
          <option value="name">Project Name</option>
          <option value="code">Project Code</option>
        </select>
        <div className="search-input-wrapper" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-control"
            placeholder={searchField === 'name' ? "Enter project name..." : "Enter project code (e.g. P0001)..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ minWidth: '180px' }}
        >
          <option value="">-- All Project Statuses --</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Project Status quick buttons */}
      <div
        className="tabs-container"
        style={{
          border: 'none',
          backgroundColor: 'transparent',
          overflowX: 'auto',
          paddingBottom: '8px',
          gap: '8px',
        }}
      >
        <button
          onClick={() => setSelectedStatus('')}
          className={`btn btn-secondary btn-sm ${selectedStatus === '' ? 'btn-primary' : ''}`}
          style={{ minHeight: '36px', height: '36px', whiteSpace: 'nowrap' }}
        >
          All
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedStatus(s)}
            className={`btn btn-secondary btn-sm ${selectedStatus === s ? 'btn-primary' : ''}`}
            style={{ minHeight: '36px', height: '36px', whiteSpace: 'nowrap' }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Listing Content */}
      {loading ? (
        <div className="empty-state">
          <p>Loading projects database...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)' }}>Error loading database: {error}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">🪵</div>
          <p>No projects registered matching criteria. Create one using the "Create Project" button above.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="table-container" style={{ display: 'none' }}>
            <table style={{ display: 'table' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Quoted</th>
                  <th>Received</th>
                  <th>Balance Pending</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <strong style={{ color: 'var(--primary)' }}>{project.projectCode}</strong>
                    </td>
                    <td>{project.projectName}</td>
                    <td>
                      <Link href={`/clients/${project.client.id}`}>
                        {project.client.name}
                      </Link>
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(project.status)}>
                        {project.status}
                      </span>
                    </td>
                    <td>{project.quotedAmount !== null && project.quotedAmount !== undefined ? formatCurrency(project.quotedAmount) : 'Not Yet Finalized'}</td>
                    <td style={{ color: 'var(--success)', fontWeight: '500' }}>
                      {formatCurrency(project.receivedAmount)}
                    </td>
                    <td style={{ color: project.quotedAmount !== null && project.quotedAmount !== undefined && project.pendingCollection > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: '500' }}>
                      {project.quotedAmount !== null && project.quotedAmount !== undefined ? (project.pendingCollection > 0 ? formatCurrency(project.pendingCollection) : '✅ Paid in Full') : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/projects/${project.id}`} className="btn btn-secondary btn-sm">
                        ⚙️ Console
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="mobile-list-container">
            {projects.map((project) => (
              <div key={project.id} className="mobile-list-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div className="mobile-list-header">
                  <div>
                    <span className={getStatusBadgeClass(project.status)} style={{ marginBottom: '6px' }}>
                      {project.status}
                    </span>
                    <div className="mobile-list-title">{project.projectName}</div>
                    <div className="mobile-list-subtitle">
                      {project.projectCode} • Client:{' '}
                      <Link href={`/clients/${project.client.id}`} style={{ fontWeight: '600' }}>
                        {project.client.name}
                      </Link>
                    </div>
                  </div>
                  <Link href={`/projects/${project.id}`} className="btn btn-secondary btn-sm">
                    ⚙️ Open
                  </Link>
                </div>

                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                  <div className="mobile-list-row">
                    <span>Quoted Amt:</span>
                    <span>{project.quotedAmount !== null && project.quotedAmount !== undefined ? formatCurrency(project.quotedAmount) : 'Not Yet Finalized'}</span>
                  </div>
                  <div className="mobile-list-row">
                    <span>Received:</span>
                    <span style={{ color: 'var(--success)' }}>{formatCurrency(project.receivedAmount)}</span>
                  </div>
                  <div className="mobile-list-row">
                    <span>Balance Due:</span>
                    <span style={{ color: project.quotedAmount !== null && project.quotedAmount !== undefined && project.pendingCollection > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      {project.quotedAmount !== null && project.quotedAmount !== undefined ? (project.pendingCollection > 0 ? formatCurrency(project.pendingCollection) : 'Paid in Full') : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="empty-state"><p>Loading Projects List...</p></div>}>
      <ProjectsContent />
    </Suspense>
  );
}
