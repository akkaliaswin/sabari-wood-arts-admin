'use client';

import React from 'react';

export default function SettingsPage() {
  return (
    <div>
      <div className="page-title-section">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', marginTop: '24px' }}>
        <div className="empty-state">
          <div className="empty-state-icon" style={{ fontSize: '3rem' }}>⚙️</div>
          <h3 style={{ margin: '12px 0 8px 0' }}>Sabari Wood Arts Settings</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
            System configuration parameters, theme settings, user profiles, and backup options are managed here.
          </p>
          <div style={{ marginTop: '20px', padding: '12px', background: 'var(--primary-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>
              ℹ️ Standard ERP configuration: No active overrides are required for general operation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
