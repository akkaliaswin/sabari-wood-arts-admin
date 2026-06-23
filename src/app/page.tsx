'use client';

import { useState, useEffect } from 'react';
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
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dashboard?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to load dashboard metrics');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
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
        <p>Loading dashboard metrics...</p>
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

  return (
    <div>
      <div className="page-title-section">
        <h1 className="page-title">Dashboard Summary</h1>
        <button onClick={fetchDashboardStats} className="btn btn-secondary btn-sm">
          🔄 Refresh
        </button>
      </div>

      <h3 style={{ margin: '8px 0 12px 0', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Project Collections Overview</h3>
      {/* Main KPI Stats Grid */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-label">Active Projects</div>
          <div className="stat-value">{stats.totalActiveProjects}</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">Active Project Value</div>
          <div className="stat-value">{formatCurrency(stats.totalProjectValue)}</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label">Collections Received</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(stats.totalCollectionsReceived)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label">Pending Collections</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {formatCurrency(stats.pendingCollections)}
          </div>
        </div>
      </div>

      <h3 style={{ margin: '16px 0 12px 0', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Project Status Pipeline</h3>
      <div className="stat-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {Object.entries(stats.pipelineCounts).map(([statusName, count]) => {
          let accent = 'var(--text-muted)';
          if (statusName === 'Lead') accent = '#808080';
          if (statusName === 'Measurement Done') accent = '#4a90e2';
          if (statusName === 'Quotation Sent') accent = '#f5a623';
          if (statusName === 'Advance Received') accent = '#2ecc71';
          if (statusName === 'Production') accent = '#9b59b6';
          if (statusName === 'Installation') accent = '#34495e';
          if (statusName === 'Completed') accent = 'var(--success)';
          if (statusName === 'On Hold') accent = 'var(--warning)';
          if (statusName === 'Cancelled') accent = 'var(--danger)';

          return (
            <div key={statusName} className="stat-card" style={{ borderTop: `3px solid ${accent}`, padding: '12px' }}>
              <div className="stat-label" style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statusName}</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: accent }}>{count}</div>
            </div>
          );
        })}
      </div>

      <h3 style={{ margin: '16px 0 12px 0', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Financial Overview</h3>
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">Total Revenue (Quoted)</div>
          <div className="stat-value">{formatCurrency(stats.totalRevenue)}</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-label">Total Material Cost</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {formatCurrency(stats.totalMaterialCost)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-label">Total Labour Cost</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {formatCurrency(stats.totalLabourCost)}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--primary-light)', borderLeft: '4px solid var(--primary)', gridColumn: 'span 2' }}>
          <div className="stat-label" style={{ color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Estimated Profit
            <span title="Estimated Profit = projected profit based on quotation and current expenses." style={{ cursor: 'help', fontSize: '0.85rem' }}>ℹ️</span>
          </div>
          <div className="stat-value" style={{ color: stats.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatCurrency(stats.grossProfit)}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginTop: '2px' }}>
            Avg Margin: {stats.averageMargin.toFixed(1)}%
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--success-light)', borderLeft: '4px solid var(--success)', gridColumn: 'span 2' }}>
          <div className="stat-label" style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Net Cash Position
            <span title="Net Cash Position = actual cash collected minus current expenses." style={{ cursor: 'help', fontSize: '0.85rem' }}>ℹ️</span>
          </div>
          <div className="stat-value" style={{ color: stats.netCashPosition >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatCurrency(stats.netCashPosition)}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginTop: '2px' }}>
            Actual Cash vs Expenses
          </div>
        </div>
      </div>

      <h3 style={{ margin: '16px 0 12px 0', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Labour Master Dashboard Summary</h3>
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Registered Labourers</div>
          <div className="stat-value">{stats.labourMetrics.totalLabourers}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Active & Available: {stats.labourMetrics.activeLabourers}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-label">Total Wages Paid</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {formatCurrency(stats.labourMetrics.totalLabourCost)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label">Wages Paid (This Month)</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {formatCurrency(stats.labourMetrics.labourCostThisMonth)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="stat-label">Highest Paid Labourer</div>
          <div className="stat-value" style={{ fontSize: '1.1rem', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', minHeight: '38px' }}>
            👤 {stats.labourMetrics.highestPaidLabourer}
          </div>
        </div>
      </div>

      <h3 style={{ margin: '16px 0 12px 0', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Business Performance Insights</h3>
      <div className="stat-grid">
        <div className="stat-card" style={{ gridColumn: 'span 2', borderLeft: '4px solid var(--info)' }}>
          <div className="stat-label">Most Profitable Work Type</div>
          <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
            🔨 {stats.mostProfitableWorkType}
          </div>
        </div>
        <div className="stat-card" style={{ gridColumn: 'span 2', borderLeft: '4px solid var(--info)' }}>
          <div className="stat-label">Most Profitable Project</div>
          <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
            🪵 {stats.mostProfitableProject}
          </div>
        </div>
      </div>

      {/* Welcome Card & Shortcuts */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '8px' }}>Welcome to Sabari Wood Arts Admin</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '16px' }}>
          Use the navigation links or quick actions below to manage clients, start new interior or furniture projects, and log payments or purchases.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/clients" className="btn btn-primary">
            👥 Manage Clients
          </Link>
          <Link href="/projects" className="btn btn-secondary">
            🪵 View Projects
          </Link>
          <Link href="/labourers" className="btn btn-secondary">
            🪚 Manage Labourers
          </Link>
        </div>
      </div>
    </div>
  );
}
