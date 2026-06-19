'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Client {
  id: string;
  clientCode: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  location: string | null;
  address: string | null;
  referredBy: string | null;
  remarks: string | null;
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('name'); // 'name' or 'phone'
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchClients();
  }, [search, searchField]);

  const fetchClients = async () => {
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(search)}&searchField=${searchField}&t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      setClients(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setFormError('Name and Phone number are required.');
      return;
    }

    // Phone validations: Exactly 10 digits, only digits allowed.
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (alternatePhone.trim() && !phoneRegex.test(alternatePhone.trim())) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError('');
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          alternatePhone: alternatePhone.trim() || null,
          location: location.trim() || null,
          address: address.trim() || null,
          referredBy: referredBy.trim() || null,
          remarks: remarks.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to register client');
      }

      // Success
      setName('');
      setPhone('');
      setAlternatePhone('');
      setLocation('');
      setAddress('');
      setReferredBy('');
      setRemarks('');
      setShowAddForm(false);
      fetchClients();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during submission.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-title-section">
        <h1 className="page-title">Clients Module</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary"
        >
          {showAddForm ? '❌ Cancel' : '➕ Add Client'}
        </button>
      </div>

      {/* Collapsible Registration Form */}
      {showAddForm && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>New Client Registration</h3>
          {formError && (
            <div className="card" style={{ borderColor: 'var(--danger)', background: 'var(--danger-light)', padding: '10px', marginBottom: '16px' }}>
              <p style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 'bold' }}>⚠️ {formError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Aswin Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={formSubmitting}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={formSubmitting}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Alternate Phone</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. 9876543211"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label">General Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Adyar, Chennai"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Address</label>
              <textarea
                className="form-control"
                placeholder="Complete billing/site address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={formSubmitting}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Referred By</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rajan (Supervisor)"
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Remarks / Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Additional client details..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Saving Client Profile...' : 'Save Client Profile'}
            </button>
          </form>
        </div>
      )}

      {/* Search & Filter Header */}
      <div className="filter-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <select
          className="form-control"
          value={searchField}
          onChange={(e) => { setSearchField(e.target.value); setSearch(''); }}
          style={{ width: '160px', minHeight: '44px' }}
        >
          <option value="name">Client Name</option>
          <option value="phone">Phone Number</option>
        </select>
        <div className="search-input-wrapper" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-control"
            placeholder={searchField === 'name' ? "Enter client name..." : "Enter 10-digit phone number..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Listings Section */}
      {loading ? (
        <div className="empty-state">
          <p>Loading clients database...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)' }}>Error loading database: {error}</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">👥</div>
          <p>No clients found. Register a client using the "Add Client" button above.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="table-container" style={{ display: 'none' }}>
            <table style={{ display: 'table' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Referred By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong style={{ color: 'var(--primary)' }}>{client.clientCode}</strong>
                    </td>
                    <td>{client.name}</td>
                    <td>{client.phone}</td>
                    <td>{client.location || '—'}</td>
                    <td>{client.referredBy || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/clients/${client.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        📂 View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (Visible by CSS on small screens) */}
          <div className="mobile-list-container">
            {clients.map((client) => (
              <div key={client.id} className="mobile-list-card">
                <div className="mobile-list-header">
                  <div>
                    <span className="badge badge-pending" style={{ marginBottom: '6px' }}>
                      {client.clientCode}
                    </span>
                    <div className="mobile-list-title">{client.name}</div>
                  </div>
                  <Link
                    href={`/clients/${client.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    📂 Open
                  </Link>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div className="mobile-list-row">
                    <span>Phone:</span>
                    <span>{client.phone}</span>
                  </div>
                  {client.location && (
                    <div className="mobile-list-row">
                      <span>Location:</span>
                      <span>{client.location}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <style jsx global>{`
            /* Show/hide table and list container by breakpoint */
            @media (min-width: 768px) {
              .table-container {
                display: block !important;
              }
              .mobile-list-container {
                display: none !important;
              }
            }
            @media (max-width: 767px) {
              .table-container {
                display: none !important;
              }
              .mobile-list-container {
                display: block !important;
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
