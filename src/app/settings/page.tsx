'use client';

import React, { useState, useEffect } from 'react';

interface WorkItemType {
  id: string;
  name: string;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const [types, setTypes] = useState<WorkItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create state
  const [newTypeName, setNewTypeName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/settings/work-item-types?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to fetch work item types');
      const data = await res.json();
      setTypes(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    try {
      setCreating(true);
      setCreateError('');
      const res = await fetch('/api/settings/work-item-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTypeName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create type');
      }

      setNewTypeName('');
      fetchTypes();
    } catch (err: any) {
      setCreateError(err.message || 'Error creating work item type');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (type: WorkItemType) => {
    try {
      const res = await fetch('/api/settings/work-item-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: type.id,
          isDisabled: !type.isDisabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle status');
      }

      fetchTypes();
    } catch (err: any) {
      alert(err.message || 'Error updating work item type status');
    }
  };

  const startEditing = (type: WorkItemType) => {
    setEditingId(type.id);
    setEditingName(type.name);
    setUpdateError('');
  };

  const cancelEditing = () => {
    setEditingId('');
    setEditingName('');
    setUpdateError('');
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingName.trim()) return;

    try {
      setUpdating(true);
      setUpdateError('');
      const res = await fetch('/api/settings/work-item-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: editingName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update name');
      }

      setEditingId('');
      setEditingName('');
      fetchTypes();
    } catch (err: any) {
      setUpdateError(err.message || 'Error updating name');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-title-section">
        <h1 className="page-title">Settings & Configuration</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Section 1: Work Item Types Manager */}
        <div className="card">
          <h3 style={{ marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            ⚙️ Work Item Categories / Types
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px', lineHeight: '1.5' }}>
            Manage the list of work types used across project estimators and scope files. New work items will be populated using these values dynamically. Disabled categories are hidden from forms but retained in legacy logs.
          </p>

          {/* Creation form */}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">New Work Item Type</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. False Ceiling, Windows, TV Unit"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                disabled={creating}
                required
                style={{ minHeight: '40px' }}
              />
            </div>
            <button type="submit" disabled={creating} className="btn btn-primary" style={{ minHeight: '40px', padding: '0 20px' }}>
              {creating ? 'Saving...' : '➕ Add Type'}
            </button>
          </form>

          {createError && (
            <div className="card" style={{ borderColor: 'var(--danger)', background: 'var(--danger-light)', padding: '10px', marginBottom: '16px' }}>
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ {createError}</p>
            </div>
          )}

          {/* Edit/Update form overlay when active */}
          {editingId && (
            <form onSubmit={handleUpdateName} className="card" style={{ background: '#faf9f6', padding: '16px', marginBottom: '20px', border: '1px dashed var(--primary)' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Rename Work Item Type</h4>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-control"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  disabled={updating}
                  required
                  style={{ minHeight: '36px', flex: 1 }}
                />
                <button type="submit" disabled={updating} className="btn btn-primary btn-sm" style={{ minHeight: '36px' }}>
                  Save
                </button>
                <button type="button" onClick={cancelEditing} className="btn btn-secondary btn-sm" style={{ minHeight: '36px' }}>
                  Cancel
                </button>
              </div>
              {updateError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '6px', fontWeight: 'bold' }}>⚠️ {updateError}</p>
              )}
            </form>
          )}

          {/* Types List Table */}
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading types configurator...
            </div>
          ) : error ? (
            <div style={{ color: 'var(--danger)', fontWeight: 'bold' }}>Error: {error}</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.id} style={{ opacity: type.isDisabled ? 0.6 : 1 }}>
                      <td>
                        <strong>{type.name}</strong>
                      </td>
                      <td>
                        {type.isDisabled ? (
                          <span className="badge badge-on-hold" style={{ background: '#f3f4f6', color: '#4b5563' }}>Disabled</span>
                        ) : (
                          <span className="badge badge-completed">Active</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => startEditing(type)}
                            className="btn btn-secondary btn-sm"
                            style={{ minHeight: '32px', height: '32px' }}
                          >
                            ✏️ Rename
                          </button>
                          <button
                            onClick={() => handleToggleStatus(type)}
                            className={type.isDisabled ? "btn btn-primary btn-sm" : "btn btn-danger btn-sm"}
                            style={{ minHeight: '32px', height: '32px' }}
                          >
                            {type.isDisabled ? '✅ Enable' : '🚫 Disable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
