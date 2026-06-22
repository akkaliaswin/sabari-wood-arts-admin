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
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred loading labourers';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      alert(errorMsg);
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href="/labourers/attendance" className="btn btn-secondary btn-sm">
            📅 Attendance Tracker
          </Link>
          <button onClick={() => setShowDrawer(true)} className="btn btn-primary btn-sm">
            ➕ Register Labourer
          </button>
        </div>
      </div>

      {/* Labour Widgets */}
      {metrics && (
        <>
          <div className="stat-grid stat-grid-scrollable" style={{ marginBottom: '16px' }}>
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

            <div className={`stat-card secondary-metric ${showAllMetrics ? 'show-mobile' : ''}`} style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="stat-label">Paid This Month</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {formatCurrency(metrics.labourCostThisMonth)}
              </div>
            </div>

            <div className={`stat-card secondary-metric ${showAllMetrics ? 'show-mobile' : ''}`} style={{ borderLeft: '4px solid var(--info)' }}>
              <div className="stat-label">Highest Paid Labourer</div>
              <div className="stat-value" style={{ fontSize: '1.05rem', color: 'var(--primary)', fontWeight: 'bold', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
                👤 {metrics.highestPaidLabourer}
              </div>
            </div>
          </div>
          
          <div className="toggle-metrics-container">
            <button 
              onClick={() => setShowAllMetrics(!showAllMetrics)} 
              className="btn btn-secondary btn-sm" 
              style={{ minHeight: '32px', height: '32px', fontSize: '0.8rem', padding: '4px 8px', marginBottom: '16px' }}
            >
              {showAllMetrics ? 'Show Less Metrics ▲' : 'Show All Metrics ▼'}
            </button>
          </div>
        </>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ background: '#faf9f6', padding: '16px', marginBottom: '20px' }}>
        <div className="filter-bar-layout">
          <div className="search-box-wrapper">
            <input
              type="text"
              placeholder={searchField === 'name' ? "Search by name..." : "Search by 10-digit phone..."}
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          
          <button 
            onClick={() => setShowMobileFilters(!showMobileFilters)} 
            className="btn btn-secondary btn-sm toggle-filters-btn"
          >
            ⚙️ {showMobileFilters ? 'Hide Filters' : 'Filters'}
          </button>

          <div className={`mobile-filters ${showMobileFilters ? 'open' : ''}`}>
            <div className="form-group" style={{ marginBottom: 0 }}>
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
            
            <div className="form-group" style={{ marginBottom: 0 }}>
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
            {filteredLabourers.map((lab) => {
              const isExpanded = expandedCards[lab.id] || false;
              const isMenuOpen = activeMenuId === lab.id;
              return (
                <div key={lab.id} className="mobile-list-card" style={{ borderLeft: `4px solid ${lab.activeStatus ? 'var(--success)' : 'var(--danger)'}`, position: 'relative' }}>
                  <div className="mobile-list-header">
                    <div>
                      <div className="mobile-list-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        {lab.name}
                        <span className={`badge badge-${lab.activeStatus ? 'completed' : 'cancelled'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                          {lab.activeStatus ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mobile-list-subtitle" style={{ marginTop: '2px' }}>
                        {lab.labourCode} • <span className="badge badge-pending" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', verticalAlign: 'middle' }}>{lab.skillType}</span>
                      </div>
                    </div>
                    
                    <div className="mobile-menu-container">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : lab.id); }} 
                        className="ellipsis-btn"
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        ⋮
                      </button>
                      {isMenuOpen && (
                        <div className="mobile-dropdown-menu">
                          <Link href={`/labourers/${lab.id}`} className="dropdown-item">
                            🪚 Profile Details
                          </Link>
                          <Link href={`/labourers/attendance?labourerId=${lab.id}`} className="dropdown-item">
                            📅 Attendance
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                    <strong>Phone:</strong> <a href={`tel:${lab.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}>{lab.phone}</a>
                  </div>
                  
                  <button onClick={() => toggleCard(lab.id)} className="view-details-btn">
                    {isExpanded ? '▲ Hide Details' : '▼ View Details'}
                  </button>
                  
                  {isExpanded && (
                    <div className="mobile-details-expanded">
                      <div><strong>Joined:</strong> {new Date(lab.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div><strong>Address:</strong> {lab.address || '—'}</div>
                      <div><strong>Notes:</strong> {lab.notes || '—'}</div>
                    </div>
                  )}
                </div>
              );
            })}
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
          .filter-bar-layout {
            display: flex;
            gap: 16px;
            align-items: center;
          }
          .search-box-wrapper {
            flex: 2;
          }
          .mobile-filters {
            display: flex !important;
            gap: 16px;
            align-items: center;
            flex: 2;
          }
          .mobile-filters .form-group {
            flex: 1;
            margin-bottom: 0 !important;
          }
          .toggle-filters-btn {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .table-container { display: none !important; }
          .mobile-list-container { display: block !important; }
          .filter-bar-layout {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .toggle-filters-btn {
            display: inline-flex !important;
            justify-content: center;
            width: 100%;
          }
          .mobile-filters {
            display: none;
            flex-direction: column;
            gap: 12px;
            margin-top: 8px;
          }
          .mobile-filters.open {
            display: flex !important;
          }
          .mobile-filters .form-group {
            width: 100% !important;
            margin-bottom: 8px !important;
          }
          
          /* scrollable widgets */
          .stat-grid-scrollable {
            display: flex !important;
            overflow-x: auto;
            gap: 12px;
            padding-bottom: 8px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .stat-grid-scrollable .stat-card {
            flex: 0 0 200px;
            scroll-snap-align: start;
            padding: 10px 12px;
            margin-bottom: 0;
            height: auto;
          }
          .secondary-metric {
            display: none !important;
          }
          .secondary-metric.show-mobile {
            display: block !important;
          }
          .toggle-metrics-container {
            display: flex;
            justify-content: flex-end;
          }
          
          /* ellipsis dropdown */
          .mobile-menu-container {
            position: relative;
          }
          .mobile-dropdown-menu {
            position: absolute;
            right: 0;
            top: 32px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-md);
            z-index: 100;
            min-width: 140px;
          }
          .dropdown-item {
            display: block;
            padding: 10px 12px;
            font-size: 0.85rem;
            color: var(--text-primary);
            border-bottom: 1px solid var(--border);
            text-decoration: none !important;
          }
          .dropdown-item:last-child {
            border-bottom: none;
          }
          .dropdown-item:hover {
            background-color: var(--primary-light);
            color: var(--primary);
          }
          .view-details-btn {
            background: none;
            border: none;
            color: var(--primary);
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            padding: 6px 0 0 0;
            margin-top: 4px;
            display: block;
          }
          .mobile-details-expanded {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed var(--border);
            font-size: 0.8rem;
            color: var(--text-muted);
            line-height: 1.4;
          }
        }
      `}</style>
    </div>
  );
}
