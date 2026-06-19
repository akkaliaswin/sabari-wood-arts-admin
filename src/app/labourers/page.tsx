'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Labourer {
  id: string;
  labourCode: string;
  name: string;
  phone: string;
  address: string | null;
  skillType: string;
  joiningDate: string;
  activeStatus: boolean;
  notes: string | null;
}

interface LabourMetrics {
  totalLabourers: number;
  activeLabourers: number;
  totalLabourCost: number;
  labourCostThisMonth: number;
  highestPaidLabourer: string;
}

export default function LabourersPage() {
  const [labourers, setLabourers] = useState<Labourer[]>([]);
  const [metrics, setMetrics] = useState<LabourMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('name'); // 'name' or 'phone'
  const [skillFilter, setSkillFilter] = useState('');

  // Register form states
  const [showDrawer, setShowDrawer] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [skillType, setSkillType] = useState('Carpenter');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeStatus, setActiveStatus] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const skills = ['Carpenter', 'Polisher', 'Painter', 'Helper', 'Installer'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch labourers list
      const labRes = await fetch('/api/labourers');
      if (!labRes.ok) throw new Error('Failed to load labourers');
      const labData = await labRes.json();
      setLabourers(labData);

      // Fetch dashboard metrics for labourers
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setMetrics(dashData.labourMetrics);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred loading labourers');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Phone validations: Exactly 10 digits, only digits allowed.
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/labourers', {
        method: 'POST',
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to register labourer');
      }

      // Reset form fields
      setName('');
      setPhone('');
      setAddress('');
      setSkillType('Carpenter');
      setJoiningDate(new Date().toISOString().split('T')[0]);
      setActiveStatus(true);
      setNotes('');
      setShowDrawer(false);

      // Refresh data
      fetchData();
      alert('Labourer registered successfully!');
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const filteredLabourers = labourers.filter((lab) => {
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      if (searchField === 'name') {
        matchesSearch = lab.name.toLowerCase().includes(query);
      } else if (searchField === 'phone') {
        matchesSearch = lab.phone.includes(query);
      } else {
        matchesSearch = lab.name.toLowerCase().includes(query) || lab.phone.includes(query);
      }
    }
    const matchesSkill = skillFilter ? lab.skillType === skillFilter : true;
    return matchesSearch && matchesSkill;
  });

  return (
    <div>
      <div className="page-title-section">
        <h1 className="page-title">Labour Management</h1>
        <button onClick={() => setShowDrawer(true)} className="btn btn-primary">
          ➕ Register Labourer
        </button>
      </div>

      {/* Labour Widgets */}
      {metrics && (
        <div className="stat-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <div className="stat-label">Total Labourers</div>
            <div className="stat-value">{metrics.totalLabourers}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Active: {metrics.activeLabourers}
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <div className="stat-label">Total Wages Paid</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>
              {formatCurrency(metrics.totalLabourCost)}
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
            <div className="stat-label">Paid This Month</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {formatCurrency(metrics.labourCostThisMonth)}
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
            <div className="stat-label">Highest Paid Labourer</div>
            <div className="stat-value" style={{ fontSize: '1.05rem', color: 'var(--primary)', fontWeight: 'bold', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
              👤 {metrics.highestPaidLabourer}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ background: '#faf9f6', padding: '16px', marginBottom: '20px' }}>
        <div className="form-row" style={{ marginBottom: 0, alignItems: 'center' }}>
          <div className="form-group" style={{ width: '160px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: '500' }}>Search Field</label>
            <select
              className="form-control"
              value={searchField}
              onChange={(e) => { setSearchField(e.target.value); setSearchQuery(''); }}
            >
              <option value="name">Labour Name</option>
              <option value="phone">Phone Number</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: '500' }}>Search Labourers</label>
            <input
              type="text"
              placeholder={searchField === 'name' ? "Enter name..." : "Enter 10-digit phone..."}
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: '500' }}>Skill Filter</label>
            <select
              className="form-control"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
            >
              <option value="">-- All Skills --</option>
              {skills.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading labourers master logs...</p></div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)' }}>Error: {error}</p>
        </div>
      ) : filteredLabourers.length === 0 ? (
        <div className="empty-state">
          <p>No labourers found matching the criteria.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="table-container" style={{ display: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Skill Type</th>
                  <th>Phone Number</th>
                  <th>Joining Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLabourers.map((lab) => (
                  <tr key={lab.id}>
                    <td><strong>{lab.labourCode}</strong></td>
                    <td>{lab.name}</td>
                    <td><span className="badge badge-pending">{lab.skillType}</span></td>
                    <td>{lab.phone}</td>
                    <td>{new Date(lab.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <span className={`badge badge-${lab.activeStatus ? 'completed' : 'cancelled'}`}>
                        {lab.activeStatus ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/labourers/${lab.id}`} className="btn btn-secondary btn-sm">
                        🪚 Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-list-container">
            {filteredLabourers.map((lab) => (
              <div key={lab.id} className="mobile-list-card" style={{ borderLeft: `4px solid ${lab.activeStatus ? 'var(--success)' : 'var(--danger)'}` }}>
                <div className="mobile-list-header">
                  <div>
                    <div className="mobile-list-title">{lab.name}</div>
                    <div className="mobile-list-subtitle">{lab.labourCode} • {lab.skillType}</div>
                  </div>
                  <Link href={`/labourers/${lab.id}`} className="btn btn-secondary btn-sm">
                    🪚 Profile
                  </Link>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Phone: {lab.phone} <br />
                  Joined: {new Date(lab.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Drawer Register Overlay */}
      {showDrawer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '480px',
            height: '100%',
            borderRadius: 0,
            margin: 0,
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '-4px 0 16px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem' }}>Register New Labourer</h2>
              <button onClick={() => setShowDrawer(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
                ❌ Close
              </button>
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. Ramesh Polisher"
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
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

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

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  className="form-control"
                  placeholder="Home address details..."
                  style={{ minHeight: '60px' }}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
                <input
                  type="checkbox"
                  id="activeStatus"
                  checked={activeStatus}
                  onChange={(e) => setActiveStatus(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <label htmlFor="activeStatus" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Active / Available for Projects</label>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Wage terms, specializations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: '24px' }}>
                {submitting ? 'Registering...' : '💾 Save Labourer Profile'}
              </button>
            </form>
          </div>
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
