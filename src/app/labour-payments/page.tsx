'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface LabourerShort {
  id: string;
  name: string;
  labourCode: string;
  skillType: string;
}

interface LabourPayment {
  id: string;
  paymentCode: string;
  paymentDate: string;
  amount: number;
  paymentType: string;
  remarks: string | null;
  labourerId: string;
  labourer: {
    id: string;
    name: string;
    labourCode: string;
    skillType: string;
  };
}

export default function LabourPaymentsPage() {
  const [payments, setPayments] = useState<LabourPayment[]>([]);
  const [labourers, setLabourers] = useState<LabourerShort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterLabourerId, setFilterLabourerId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Log Form states
  const [labourerId, setLabourerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('Daily Wage');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit Modal states
  const [editingPayment, setEditingPayment] = useState<LabourPayment | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const paymentTypes = [
    'Daily Wage',
    'Weekly Settlement',
    'Monthly Salary',
    'Advance',
    'Bonus',
    'Adjustment'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch payments
      const payRes = await fetch(`/api/labourers/payments?t=${Date.now()}`);
      if (!payRes.ok) throw new Error('Failed to load payments history');
      const payData = await payRes.json();
      setPayments(payData);

      // Fetch active workers
      const labRes = await fetch(`/api/labourers?t=${Date.now()}`);
      if (!labRes.ok) throw new Error('Failed to load labourers list');
      const labData = await labRes.json();
      setLabourers(labData.filter((l: any) => l.activeStatus));
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching payments data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labourerId || !amount) return;

    let finalAmount = Number(amount);
    if (paymentType !== 'Adjustment' && finalAmount <= 0) {
      setFormError('Amount must be greater than zero for standard payments.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      const res = await fetch('/api/labourers/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labourerId,
          paymentDate,
          amount: finalAmount,
          paymentType,
          remarks: remarks.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record transaction');
      }

      setAmount('');
      setRemarks('');
      setLabourerId('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentType('Daily Wage');
      fetchData();
      alert('Payment record added successfully!');
    } catch (err: any) {
      setFormError(err.message || 'Error occurred logging payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !editAmount) return;

    let finalAmount = Number(editAmount);
    if (editType !== 'Adjustment' && finalAmount <= 0) {
      setEditError('Amount must be greater than zero for standard payments.');
      return;
    }

    try {
      setEditSubmitting(true);
      setEditError('');
      const res = await fetch(`/api/labourers/payments/${editingPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: editDate,
          amount: finalAmount,
          paymentType: editType,
          remarks: editRemarks.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update record');
      }

      setEditingPayment(null);
      fetchData();
      alert('Payment record updated successfully!');
    } catch (err: any) {
      setEditError(err.message || 'Error updating payment.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/labourers/payments/${paymentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete record');
      }

      fetchData();
      alert('Payment record deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Error deleting payment.');
    }
  };

  const openEditModal = (pay: LabourPayment) => {
    setEditingPayment(pay);
    setEditDate(pay.paymentDate.split('T')[0]);
    setEditAmount(String(pay.amount));
    setEditType(pay.paymentType);
    setEditRemarks(pay.remarks || '');
    setEditError('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Computations for Analytics
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const startOfThisMonth = new Date(currentYear, currentMonth, 1);

  const paymentsThisMonth = payments
    .filter(p => new Date(p.paymentDate) >= startOfThisMonth)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const advancesOutstanding = Math.max(
    0,
    payments
      .filter(p => p.paymentType === 'Advance' || p.paymentType === 'Adjustment')
      .reduce((sum, p) => sum + Number(p.amount), 0)
  );

  // Group by Worker
  const workerSummaryMap: Record<string, number> = {};
  payments.forEach(p => {
    const name = p.labourer?.name || 'Legacy Worker';
    workerSummaryMap[name] = (workerSummaryMap[name] || 0) + Number(p.amount);
  });
  const paymentsByWorker = Object.entries(workerSummaryMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Monthly trend (last 6 months)
  const monthlyTrendMap: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    monthlyTrendMap[label] = 0;
  }
  payments.forEach(p => {
    const pDate = new Date(p.paymentDate);
    const label = pDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (label in monthlyTrendMap) {
      monthlyTrendMap[label] += Number(p.amount);
    }
  });
  const monthlyTrend = Object.entries(monthlyTrendMap).map(([month, amount]) => ({
    month,
    amount,
  }));

  // Filtering ledger rows
  const filteredPayments = payments.filter((pay) => {
    const matchesWorker = filterLabourerId ? pay.labourerId === filterLabourerId : true;
    
    let matchesDate = true;
    const payDateObj = new Date(pay.paymentDate);
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      start.setHours(0,0,0,0);
      matchesDate = matchesDate && payDateObj >= start;
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23,59,59,999);
      matchesDate = matchesDate && payDateObj <= end;
    }

    return matchesWorker && matchesDate;
  });

  return (
    <div>
      <div className="page-title-section">
        <h1 className="page-title">💰 Labour Payments Registry</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>
          Manage payments, advances, salary disbursements, and worker recoveries globally.
        </p>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading labour ledger statistics...</p></div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>Error: {error}</p>
        </div>
      ) : (
        <>
          {/* SECTION 1: GLOBAL ANALYTICS WIDGETS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)', padding: '16px' }}>
              <div className="stat-label">Labour Payments This Month</div>
              <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.8rem', fontWeight: 800 }}>
                {formatCurrency(paymentsThisMonth)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                All workers included
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)', padding: '16px' }}>
              <div className="stat-label">Labour Advances Outstanding</div>
              <div className="stat-value" style={{ color: 'var(--warning)', fontSize: '1.8rem', fontWeight: 800 }}>
                {formatCurrency(advancesOutstanding)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Net after recovery adjustments
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
              <div className="stat-label">Total Transactions Logged</div>
              <div className="stat-value" style={{ color: 'var(--primary)', fontSize: '1.8rem', fontWeight: 800 }}>
                {payments.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                All-time record
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '24px' }}>
            
            {/* Split Grid for Trends & Worker breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              {/* Box 1: Payments By Worker */}
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  👥 Net Disbursals By Worker
                </h3>
                {paymentsByWorker.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No worker summary available.</p>
                ) : (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {paymentsByWorker.map(item => (
                      <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', paddingBottom: '6px', borderBottom: '1px dotted var(--border)' }}>
                        <span>👤 <strong>{item.name}</strong></span>
                        <strong style={{ color: 'var(--success)' }}>{formatCurrency(item.amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box 2: Monthly Trend (CSS Chart) */}
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  📊 Monthly Disbursal Trend
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '180px', paddingTop: '20px', justifyContent: 'space-around' }}>
                  {monthlyTrend.map(item => {
                    const maxAmount = Math.max(...monthlyTrend.map(m => m.amount), 1);
                    const barHeight = Math.max(8, Math.min(100, (item.amount / maxAmount) * 100));
                    return (
                      <div key={item.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-muted)' }}>
                          {item.amount > 0 ? `${(item.amount / 1000).toFixed(0)}k` : '—'}
                        </div>
                        <div style={{
                          width: '100%',
                          maxWidth: '28px',
                          height: `${barHeight}px`,
                          backgroundColor: item.amount > 0 ? 'var(--primary)' : '#e5e7eb',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease'
                        }} />
                        <div style={{ fontSize: '0.75rem', marginTop: '6px', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {item.month}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SECTION 2: CREATE TRANSACTION LOGGER */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                ✍️ Record Labour Payment
              </h3>
              
              <form onSubmit={handleCreatePayment}>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Labourer Name *</label>
                    <select
                      className="form-control"
                      required
                      value={labourerId}
                      onChange={(e) => setLabourerId(e.target.value)}
                    >
                      <option value="">-- Choose Worker --</option>
                      {labourers.map((lab) => (
                        <option key={lab.id} value={lab.id}>
                          {lab.name} ({lab.labourCode} • {lab.skillType})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Payment Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Disbursal Type *</label>
                    <select
                      className="form-control"
                      required
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                    >
                      {paymentTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Amount (INR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 10000"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Remarks / Description / UPI Ref</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Paid weekly wages, cash advance, deduction reference..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>
                </div>

                {formError && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '12px', fontWeight: 'bold' }}>⚠️ {formError}</p>
                )}

                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '16px', minHeight: '38px' }}>
                  {submitting ? 'Logging...' : '💾 Save Disbursal Entry'}
                </button>
              </form>
            </div>

            {/* SECTION 3: PAYMENTS HISTORY TABLE & LEDGER FILTERS */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                📋 Disbursal & Advance Ledger Logs
              </h3>

              {/* Filters Box */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', background: '#faf9f6', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div className="form-group" style={{ flex: '1 0 160px', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Worker Filter</label>
                  <select
                    className="form-control"
                    value={filterLabourerId}
                    onChange={(e) => setFilterLabourerId(e.target.value)}
                    style={{ minHeight: '32px', height: '32px', fontSize: '0.8rem', padding: '4px' }}
                  >
                    <option value="">-- All Workers --</option>
                    {labourers.map((lab) => (
                      <option key={lab.id} value={lab.id}>{lab.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group" style={{ flex: '1 0 130px', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    style={{ minHeight: '32px', height: '32px', fontSize: '0.8rem', padding: '4px' }}
                  />
                </div>

                <div className="form-group" style={{ flex: '1 0 130px', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    style={{ minHeight: '32px', height: '32px', fontSize: '0.8rem', padding: '4px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', height: '48px' }}>
                  <button
                    onClick={() => { setFilterLabourerId(''); setFilterStartDate(''); setFilterEndDate(''); }}
                    className="btn btn-secondary btn-sm"
                    style={{ height: '32px', fontSize: '0.75rem' }}
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="empty-state"><p>No payment transactions found matching the filter criteria.</p></div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="table-container" style={{ display: 'none' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Payment Code</th>
                          <th>Worker Code</th>
                          <th>Worker Name</th>
                          <th>Disbursal Date</th>
                          <th>Payment Type</th>
                          <th>Remarks</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((pay) => (
                          <tr key={pay.id}>
                            <td><strong style={{ color: 'var(--primary)' }}>{pay.paymentCode}</strong></td>
                            <td>{pay.labourer?.labourCode}</td>
                            <td>
                              <Link href={`/labourers/${pay.labourerId}`} style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                                {pay.labourer?.name}
                              </Link>
                            </td>
                            <td>{new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td>
                              <span className={`badge badge-${pay.paymentType === 'Salary Payment' || pay.paymentType === 'Monthly Salary' ? 'completed' : pay.paymentType === 'Advance' ? 'pending' : 'on-hold'}`} style={{
                                backgroundColor: pay.paymentType === 'Adjustment' ? '#f3f4f6' : '',
                                color: pay.paymentType === 'Adjustment' ? '#4b5563' : ''
                              }}>
                                {pay.paymentType}
                              </span>
                            </td>
                            <td>{pay.remarks || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: '600', color: Number(pay.amount) < 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                              {formatCurrency(Number(pay.amount))}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  onClick={() => openEditModal(pay)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ minHeight: '28px', height: '28px', padding: '0 8px', fontSize: '0.75rem' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeletePayment(pay.id)}
                                  className="btn btn-danger btn-sm"
                                  style={{ minHeight: '28px', height: '28px', padding: '0 8px', fontSize: '0.75rem' }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards List View */}
                  <div className="mobile-list-container">
                    {filteredPayments.map((pay) => (
                      <div key={pay.id} className="mobile-list-card" style={{ borderLeft: `4px solid ${pay.paymentType === 'Advance' ? 'var(--warning)' : 'var(--success)'}` }}>
                        <div className="mobile-list-header">
                          <div>
                            <div className="mobile-list-title">{formatCurrency(Number(pay.amount))}</div>
                            <div className="mobile-list-subtitle">
                              {pay.labourer?.name} ({pay.labourer?.labourCode})
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <span className="badge badge-pending" style={{ margin: 0 }}>
                              {pay.paymentType}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{pay.paymentCode}</span>
                          </div>
                        </div>
                        <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px', fontSize: '0.85rem' }}>
                          <div><strong>Date:</strong> {new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          <div><strong>Remarks:</strong> {pay.remarks || '—'}</div>
                        </div>
                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => openEditModal(pay)}
                            className="btn btn-secondary btn-sm"
                            style={{ minHeight: '28px', height: '28px', padding: '0 8px', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePayment(pay.id)}
                            className="btn btn-danger btn-sm"
                            style={{ minHeight: '28px', height: '28px', padding: '0 8px', fontSize: '0.75rem' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        </>
      )}

      {/* EDIT MODAL DRAWER OVERLAY */}
      {editingPayment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>⚙️ Edit Payment Record ({editingPayment.paymentCode})</h2>
              <button onClick={() => setEditingPayment(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>
                ❌ Close
              </button>
            </div>

            <form onSubmit={handleUpdatePayment}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Labour Worker Name</label>
                <input
                  type="text"
                  className="form-control"
                  disabled
                  value={editingPayment.labourer?.name || 'Legacy Worker'}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Payment Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Payment Type *</label>
                  <select
                    className="form-control"
                    required
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                  >
                    {paymentTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Amount (INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Remarks</label>
                <input
                  type="text"
                  className="form-control"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                />
              </div>

              {editError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 'bold' }}>⚠️ {editError}</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setEditingPayment(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : '💾 Update Record'}
                </button>
              </div>
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
