'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ClientShort {
  id: string;
  name: string;
  clientCode: string;
  phone: string;
}

interface WorkItem {
  id: string;
  workCode: string;
  workType: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sellingPrice: number;
  status: string;
  remarks: string | null;
  materialCost: number;
  labourCost: number;
  profit: number;
  marginPercentage: number;
  statusHistory?: { id: string; previousStatus: string; newStatus: string; updatedAt: string }[];
}

interface MaterialPurchase {
  id: string;
  materialCode: string;
  purchaseDate: string;
  materialName: string;
  vendor: string | null;
  quantity: number;
  unit: string | null;
  amount: number;
  billNumber: string | null;
  remarks: string | null;
  workItemId: string | null;
  workItem: { workType: string; workCode: string } | null;
}

interface Payment {
  id: string;
  paymentCode: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string | null;
  remarks: string | null;
}

interface LabourCost {
  id: string;
  labourCode: string;
  carpenterName: string;
  workDescription: string | null;
  amount: number;
  paymentDate: string;
  remarks: string | null;
  workItemId: string | null;
  workItem: { workType: string; workCode: string } | null;
  labourerId: string | null;
  labourer: { id: string; name: string; labourCode: string } | null;
}

interface ProjectDetail {
  id: string;
  projectCode: string;
  projectName: string;
  projectType: string | null;
  projectLocation: string | null;
  status: string;
  quotedAmount: number;
  startDate: string | null;
  expectedCompletionDate: string | null;
  actualCompletionDate: string | null;
  notes: string | null;
  createdAt: string;
  client: ClientShort;
  workItems: WorkItem[];
  materialPurchases: MaterialPurchase[];
  payments: Payment[];
  labourCosts: LabourCost[];
  statusHistory: { id: string; previousStatus: string; newStatus: string; changedAt: string }[];
  activities: { id: string; activityType: string; description: string; createdAt: string }[];
  // Calculated dynamically
  receivedAmount: number;
  materialCost: number;
  labourCost: number;
  totalRevenue: number;
  profit: number;
  marginPercentage: number;
  pendingCollection: number;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details'); // details, work-items, materials, payments, labour

  // Edit details form states
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [status, setStatus] = useState('');
  const [quotedAmount, setQuotedAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [actualCompletionDate, setActualCompletionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);

  // Sub-forms states
  // 1. Work Item Form
  const [wiType, setWiType] = useState('');
  const [wiDesc, setWiDesc] = useState('');
  const [wiQty, setWiQty] = useState('1');
  const [wiPrice, setWiPrice] = useState('');
  const [wiSellingPrice, setWiSellingPrice] = useState('');
  const [wiStatus, setWiStatus] = useState('Pending');
  const [wiRemarks, setWiRemarks] = useState('');
  const [wiSubmitting, setWiSubmitting] = useState(false);

  // 2. Material Purchase Form (Quick Log)
  const [matDate, setMatDate] = useState(new Date().toISOString().split('T')[0]);
  const [matName, setMatName] = useState('');
  const [matVendor, setMatVendor] = useState('');
  const [matQty, setMatQty] = useState('1');
  const [matUnit, setMatUnit] = useState('piece');
  const [matAmount, setMatAmount] = useState('');
  const [matBill, setMatBill] = useState('');
  const [matRemarks, setMatRemarks] = useState('');
  const [matWorkItemId, setMatWorkItemId] = useState('');
  const [matSubmitting, setMatSubmitting] = useState(false);

  // 3. Payment Form (Quick Log)
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // 4. Labour Cost Form
  const [labName, setLabName] = useState('');
  const [labDesc, setLabDesc] = useState('');
  const [labAmount, setLabAmount] = useState('');
  const [labDate, setLabDate] = useState(new Date().toISOString().split('T')[0]);
  const [labRemarks, setLabRemarks] = useState('');
  const [labWorkItemId, setLabWorkItemId] = useState('');
  const [labSubmitting, setLabSubmitting] = useState(false);

  // Labour Master link lists
  const [labourersList, setLabourersList] = useState<any[]>([]);
  const [selectedLabourerId, setSelectedLabourerId] = useState('');
  const [showLabourerModal, setShowLabourerModal] = useState(false);

  // Labourer Modal registration form states
  const [newLabName, setNewLabName] = useState('');
  const [newLabPhone, setNewLabPhone] = useState('');
  const [newLabSkill, setNewLabSkill] = useState('Carpenter');
  const [newLabAddress, setNewLabAddress] = useState('');

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

  const projectTypes = [
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
    fetchProjectDetails();
    fetchLabourersList();
  }, [id]);

  const fetchLabourersList = async () => {
    try {
      const res = await fetch('/api/labourers');
      if (res.ok) {
        const data = await res.json();
        setLabourersList(data);
      }
    } catch (err) {
      console.error('Failed to load labourers dropdown list', err);
    }
  };

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Project profile not found');
        throw new Error('Failed to load project details');
      }
      const data = await res.json();
      setProject(data);

      // Populate edit states
      setProjectName(data.projectName || '');
      setProjectType(data.projectType || '');
      setProjectLocation(data.projectLocation || '');
      setStatus(data.status || 'Lead');
      setQuotedAmount(data.quotedAmount || '0');
      setStartDate(data.startDate ? data.startDate.split('T')[0] : '');
      setExpectedCompletionDate(data.expectedCompletionDate ? data.expectedCompletionDate.split('T')[0] : '');
      setActualCompletionDate(data.actualCompletionDate ? data.actualCompletionDate.split('T')[0] : '');
      setNotes(data.notes || '');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUpdatingDetails(true);
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          projectType: projectType || null,
          projectLocation: projectLocation || null,
          status,
          quotedAmount: Number(quotedAmount),
          startDate: startDate || null,
          expectedCompletionDate: expectedCompletionDate || null,
          actualCompletionDate: actualCompletionDate || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update project profile');
      alert('Project profile updated successfully!');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update details');
    } finally {
      setIsUpdatingDetails(false);
    }
  };

  const handleUpdateProjectStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          status: newStatus,
        }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      setStatus(newStatus);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleSaveNotes = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          notes: notes || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save project notes');
      alert('Project notes saved successfully.');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to save notes');
    }
  };

  // Add Work Item
  const handleAddWorkItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wiType) return;

    try {
      setWiSubmitting(true);
      const qty = Number(wiQty);
      const price = Number(wiPrice);
      const sellPrice = wiSellingPrice ? Number(wiSellingPrice) : qty * price;

      const res = await fetch(`/api/projects/${id}/work-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workType: wiType,
          description: wiDesc || null,
          quantity: qty,
          unitPrice: price,
          sellingPrice: sellPrice,
          status: wiStatus,
          remarks: wiRemarks || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to add work item');
      setWiType('');
      setWiDesc('');
      setWiQty('1');
      setWiPrice('');
      setWiSellingPrice('');
      setWiStatus('Pending');
      setWiRemarks('');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error adding work item');
    } finally {
      setWiSubmitting(false);
    }
  };

  // Update Work Item Status directly
  const handleUpdateWorkItemStatus = async (itemId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/work-items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error('Failed to update work item status');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Delete Work Item
  const handleDeleteWorkItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this work item?')) return;
    try {
      const res = await fetch(`/api/projects/${id}/work-items?itemId=${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete work item');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error deleting item');
    }
  };

  // Add Material Purchase (Quick Add: aiming < 10s)
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName || !matAmount) return;

    try {
      setMatSubmitting(true);
      const res = await fetch(`/api/projects/${id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseDate: matDate,
          materialName: matName.trim(),
          vendor: matVendor.trim() || null,
          quantity: Number(matQty),
          unit: matUnit || null,
          amount: Number(matAmount),
          billNumber: matBill.trim() || null,
          remarks: matRemarks.trim() || null,
          workItemId: matWorkItemId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to log material purchase');
      setMatName('');
      setMatVendor('');
      setMatQty('1');
      setMatAmount('');
      setMatBill('');
      setMatRemarks('');
      setMatWorkItemId('');
      // Pre-fill date again to today
      setMatDate(new Date().toISOString().split('T')[0]);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error logging material purchase');
    } finally {
      setMatSubmitting(false);
    }
  };

  // Delete Material Purchase
  const handleDeleteMaterial = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this material purchase record?')) return;
    try {
      const res = await fetch(`/api/projects/${id}/materials?itemId=${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete material purchase');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error deleting record');
    }
  };

  // Add Payment (Quick Add: aiming < 10s)
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || !payMode) return;

    try {
      setPaySubmitting(true);
      const res = await fetch(`/api/projects/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: payDate,
          amount: Number(payAmount),
          paymentMode: payMode,
          referenceNumber: payRef.trim() || null,
          remarks: payRemarks.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to record payment');
      setPayAmount('');
      setPayRef('');
      setPayRemarks('');
      setPayMode('UPI');
      setPayDate(new Date().toISOString().split('T')[0]);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error recording payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  // Delete Payment
  const handleDeletePayment = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    try {
      const res = await fetch(`/api/projects/${id}/payments?itemId=${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete payment');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error deleting record');
    }
  };

  // Add Labour Cost
  const handleAddLabour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labName || !labAmount) return;

    try {
      setLabSubmitting(true);
      const res = await fetch(`/api/projects/${id}/labour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labourerId: selectedLabourerId || null,
          carpenterName: labName.trim(),
          workDescription: labDesc.trim() || null,
          amount: Number(labAmount),
          paymentDate: labDate,
          remarks: labRemarks.trim() || null,
          workItemId: labWorkItemId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to log labour cost');
      setLabName('');
      setSelectedLabourerId('');
      setLabDesc('');
      setLabAmount('');
      setLabRemarks('');
      setLabWorkItemId('');
      setLabDate(new Date().toISOString().split('T')[0]);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error logging labour cost');
    } finally {
      setLabSubmitting(false);
    }
  };

  // Delete Labour Cost
  const handleDeleteLabour = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this labour cost entry?')) return;
    try {
      const res = await fetch(`/api/projects/${id}/labour?itemId=${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete labour cost');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error deleting record');
    }
  };

  const handleSoftDeleteProject = async () => {
    if (!confirm('Are you sure you want to archive/delete this project?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
      router.push('/projects');
    } catch (err: any) {
      alert(err.message || 'An error occurred');
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

  if (loading) {
    return <div className="empty-state"><p>Loading project workspace...</p></div>;
  }

  if (error || !project) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Project Not Found</h3>
        <p>{error || 'The requested project workspace is unavailable.'}</p>
        <Link href="/projects" className="btn btn-secondary btn-sm" style={{ marginTop: '12px', display: 'inline-flex' }}>
          ⬅️ Back to Projects List
        </Link>
      </div>
    );
  }

  const renderProgressFlow = (currentStatus: string) => {
    const steps = [
      'Lead',
      'Measurement Done',
      'Quotation Sent',
      'Advance Received',
      'Production',
      'Installation',
      'Completed',
    ];
    const currentIndex = steps.indexOf(currentStatus);
    
    return (
      <div className="progress-flow-container" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        alignItems: 'center',
        padding: '10px 14px',
        background: '#faf9f6',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        marginBottom: '20px'
      }}>
        {steps.map((step, idx) => {
          let statusStyle = { color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'white' };
          
          if (step === currentStatus) {
            statusStyle = { color: 'white', border: '1px solid var(--primary)', background: 'var(--primary)' };
          } else if (currentIndex !== -1 && idx < currentIndex) {
            statusStyle = { color: 'var(--success)', border: '1px solid var(--success)', background: '#eafbe7' };
          }
          
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '0.75rem',
                fontWeight: step === currentStatus ? 'bold' : '500',
                ...statusStyle
              }}>
                {currentIndex !== -1 && idx < currentIndex ? '✓ ' : ''}{step}
              </div>
              {idx < steps.length - 1 && <span style={{ color: 'var(--border)', fontSize: '0.8rem' }}>→</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderWorkItemProgress = (itemStatus: string) => {
    const stages = ['Pending', 'In Progress', 'Completed'];
    return (
      <div style={{ display: 'flex', gap: '4px', fontSize: '0.72rem', marginTop: '4px', color: 'var(--text-muted)' }}>
        {stages.map((s, idx) => {
          const active = s === itemStatus;
          return (
            <span key={s} style={{ 
              fontWeight: active ? 'bold' : 'normal',
              color: active ? 'var(--primary)' : 'var(--text-muted)'
            }}>
              {s}{idx < stages.length - 1 ? '➔' : ''}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <Link href="/projects" className="btn btn-secondary btn-sm">
          ⬅️ Back to Projects
        </Link>
      </div>

      {renderProgressFlow(project.status)}

      <div className="page-title-section">
        <div>
          <span className="badge badge-pending" style={{ marginBottom: '4px' }}>{project.projectCode}</span>
          <h1 className="page-title">{project.projectName}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>
            Client:{' '}
            <Link href={`/clients/${project.client.id}`} style={{ fontWeight: '600', color: 'var(--primary)' }}>
              {project.client.name}
            </Link>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="form-control"
            value={status}
            onChange={(e) => handleUpdateProjectStatus(e.target.value)}
            style={{ width: 'auto', minHeight: '38px', height: '38px', padding: '6px 24px 6px 12px', fontSize: '0.85rem' }}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={handleSoftDeleteProject} className="btn btn-danger btn-sm" style={{ minHeight: '38px', height: '38px' }}>
            🗑️ Archive
          </button>
        </div>
      </div>

      {/* Project Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value">{formatCurrency(project.totalRevenue)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Quoted: {formatCurrency(project.quotedAmount)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label">Payments Received</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(project.receivedAmount)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label">Pending Collection</div>
          <div className="stat-value" style={{ color: project.pendingCollection > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {formatCurrency(project.pendingCollection)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-label">Material Cost</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {formatCurrency(project.materialCost)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-label">Labour Cost</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {formatCurrency(project.labourCost)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--info)', background: 'var(--primary-light)' }}>
          <div className="stat-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Estimated Profit</div>
          <div className="stat-value" style={{ color: project.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatCurrency(project.profit)}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: project.profit >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '2px' }}>
            Margin: {project.marginPercentage.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="tabs-container">
        <button
          onClick={() => setActiveTab('details')}
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
        >
          📋 Scope & Edit
        </button>
        <button
          onClick={() => setActiveTab('work-items')}
          className={`tab-button ${activeTab === 'work-items' ? 'active' : ''}`}
        >
          🛠️ Work Items ({project.workItems.length})
        </button>
        <button
          onClick={() => setActiveTab('labour')}
          className={`tab-button ${activeTab === 'labour' ? 'active' : ''}`}
        >
          🪚 Labour ({project.labourCosts.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`tab-button ${activeTab === 'payments' ? 'active' : ''}`}
        >
          💳 Payments ({project.payments.length})
        </button>
        <button
          onClick={() => setActiveTab('materials')}
          className={`tab-button ${activeTab === 'materials' ? 'active' : ''}`}
        >
          🪵 Materials ({project.materialPurchases.length})
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="card" style={{ borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', marginTop: '-16px', padding: '20px' }}>
        
        {/* Tab 1: Scope & Edit Details */}
        {activeTab === 'details' && (
          <div>
            <form onSubmit={handleUpdateProjectDetails}>
              <h3 style={{ marginBottom: '16px' }}>Project Information</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Type</label>
                  <select
                    className="form-control"
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                  >
                    <option value="">-- Select Type --</option>
                    {projectTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Site/Installation Location</label>
                  <input
                    type="text"
                    className="form-control"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quoted Value (INR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={quotedAmount}
                    onChange={(e) => setQuotedAmount(e.target.value)}
                    required
                  />
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
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Completion Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={expectedCompletionDate}
                    onChange={(e) => setExpectedCompletionDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Actual Completion Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={actualCompletionDate}
                    onChange={(e) => setActualCompletionDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isUpdatingDetails}
                style={{ marginTop: '8px' }}
              >
                {isUpdatingDetails ? 'Saving Info...' : '💾 Save Profile Details'}
              </button>
            </form>

             {/* Scope Notes Log */}
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: '12px' }}>Project Notes Log</h3>
              <div className="form-group">
                <textarea
                  className="form-control"
                  style={{ minHeight: '140px', fontFamily: 'monospace', fontSize: '0.9rem' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record project details, customer measurements, changes in design, or timber instructions..."
                />
              </div>
              <button onClick={handleSaveNotes} className="btn btn-secondary">
                📝 Update Notes Log
              </button>
            </div>

            {/* Project Status History Audit Trail */}
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: '12px' }}>Project Status Change History (Audit Trail)</h3>
              {project.statusHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No status transitions logged yet.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date Changed</th>
                        <th>Previous Status</th>
                        <th>New Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.statusHistory.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.changedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span className="badge badge-cancelled" style={{ background: '#f5f5f5', color: '#666', border: '1px solid #ccc' }}>{h.previousStatus}</span></td>
                          <td><span className="badge badge-completed">{h.newStatus}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Project Activity Timeline */}
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: '16px' }}>Project Activity Timeline</h3>
              {project.activities.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No activities recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {project.activities.map((act) => {
                    let badgeColor = 'var(--text-muted)';
                    let badgeText = 'Event';

                    if (act.activityType === 'PROJECT_CREATED') { badgeColor = 'var(--primary)'; badgeText = 'Project Created'; }
                    else if (act.activityType === 'PROJECT_STATUS_CHANGED') { badgeColor = 'var(--success)'; badgeText = 'Status Changed'; }
                    else if (act.activityType === 'WORK_ITEM_ADDED') { badgeColor = 'var(--primary)'; badgeText = 'Scope Item Added'; }
                    else if (act.activityType === 'WORK_ITEM_STATUS_CHANGED') { badgeColor = 'var(--warning)'; badgeText = 'Item Status'; }
                    else if (act.activityType === 'WORK_ITEM_UPDATED') { badgeColor = '#666'; badgeText = 'Item Updated'; }
                    else if (act.activityType === 'MATERIAL_ADDED') { badgeColor = 'var(--danger)'; badgeText = 'Material Logged'; }
                    else if (act.activityType === 'LABOUR_ADDED') { badgeColor = 'var(--danger)'; badgeText = 'Labour Wage'; }
                    else if (act.activityType === 'PAYMENT_RECEIVED') { badgeColor = 'var(--success)'; badgeText = 'Payment Received'; }

                    return (
                      <div key={act.id} style={{
                        padding: '10px 14px',
                        background: '#faf9f6',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}>
                        <div>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            color: 'white',
                            backgroundColor: badgeColor,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginBottom: '4px'
                          }}>{badgeText}</span>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{act.description}</div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(act.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Work Items */}
        {activeTab === 'work-items' && (
          <div>
            <h3 style={{ marginBottom: '16px' }}>Add Work Item (Furniture/Scope)</h3>
            <form onSubmit={handleAddWorkItem} className="card" style={{ background: '#faf9f6', padding: '16px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Work Item / Type *</label>
                  <select
                    className="form-control"
                    value={wiType}
                    onChange={(e) => setWiType(e.target.value)}
                    required
                  >
                    <option value="">-- Select Scope Item --</option>
                    {projectTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={wiQty}
                    onChange={(e) => setWiQty(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price (INR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={wiPrice}
                    onChange={(e) => setWiPrice(e.target.value)}
                    placeholder="e.g. 12000"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (INR)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={wiSellingPrice}
                    onChange={(e) => setWiSellingPrice(e.target.value)}
                    placeholder="Default: Qty * Price"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group" style={{ flex: '2' }}>
                  <label className="form-label">Work Description / Details</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Dimensions, wood choices (Teak/Rosewood), polish details..."
                    value={wiDesc}
                    onChange={(e) => setWiDesc(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={wiStatus} onChange={(e) => setWiStatus(e.target.value)}>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={wiSubmitting}>
                {wiSubmitting ? 'Adding...' : '➕ Add Item to Scope'}
              </button>
            </form>

            <h3 style={{ margin: '24px 0 12px 0' }}>Scope of Work Items ({project.workItems.length})</h3>
            {project.workItems.length === 0 ? (
              <div className="empty-state"><p>No work items added yet. Define items like beds, wardrobes, or tables above.</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Work Type</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Selling Price</th>
                      <th>Material Cost</th>
                      <th>Labour Cost</th>
                      <th>Profit</th>
                      <th>Margin %</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.workItems.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.workCode}</strong></td>
                        <td>{item.workType}</td>
                        <td>{item.description || '—'}</td>
                        <td>{Number(item.quantity)}</td>
                        <td style={{ fontWeight: '600' }}>{formatCurrency(Number(item.sellingPrice))}</td>
                        <td style={{ color: 'var(--danger)' }}>{formatCurrency(Number(item.materialCost))}</td>
                        <td style={{ color: 'var(--danger)' }}>{formatCurrency(Number(item.labourCost))}</td>
                        <td style={{ color: item.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                          {formatCurrency(Number(item.profit))}
                        </td>
                        <td style={{ color: item.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                          {Number(item.marginPercentage).toFixed(1)}%
                        </td>
                        <td>
                          <select
                            value={item.status}
                            onChange={(e) => handleUpdateWorkItemStatus(item.id, e.target.value)}
                            className="form-control"
                            style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto', minHeight: '34px', height: '34px', marginBottom: '4px' }}
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                          {renderWorkItemProgress(item.status)}
                          {item.statusHistory && item.statusHistory.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', borderTop: '1px dashed var(--border)', paddingTop: '4px' }}>
                              <span style={{ fontWeight: '600' }}>Status History:</span>
                              {item.statusHistory.map((h) => (
                                <div key={h.id} style={{ whiteSpace: 'nowrap' }}>
                                  {new Date(h.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: {h.previousStatus} ➔ {h.newStatus}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleDeleteWorkItem(item.id)} className="btn btn-danger btn-sm">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Material Purchases (Quick Log) */}
        {activeTab === 'materials' && (
          <div>
            <h3 style={{ marginBottom: '16px' }}>Quick Log Material Purchase (Aims for &lt;10s)</h3>
            <form onSubmit={handleAddMaterial} className="card" style={{ background: '#faf9f6', padding: '16px' }}>
              <div className="form-row">
                <div className="form-group" style={{ flex: '2' }}>
                  <label className="form-label">Material Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 19mm Plywood, Fevicol, Brass Hinges"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: '1.5' }}>
                  <label className="form-label">Assign To Work Item</label>
                  <select
                    className="form-control"
                    value={matWorkItemId}
                    onChange={(e) => setMatWorkItemId(e.target.value)}
                  >
                    <option value="">Project Level Expense</option>
                    {project.workItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.workType} ({item.workCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: '2' }}>
                  <label className="form-label">Vendor / shop</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. National Hardware"
                    value={matVendor}
                    onChange={(e) => setMatVendor(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={matQty}
                    onChange={(e) => setMatQty(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. piece, kg, sheet, bag"
                    value={matUnit}
                    onChange={(e) => setMatUnit(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (INR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Total Paid"
                    value={matAmount}
                    onChange={(e) => setMatAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={matDate}
                    onChange={(e) => setMatDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bill Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Optional Invoice #"
                    value={matBill}
                    onChange={(e) => setMatBill(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Wood grade, quality remarks..."
                  value={matRemarks}
                  onChange={(e) => setMatRemarks(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={matSubmitting}>
                {matSubmitting ? 'Saving Receipt...' : '💾 Save Material Receipt'}
              </button>
            </form>

            <h3 style={{ margin: '24px 0 12px 0' }}>Material Purchases ({project.materialPurchases.length})</h3>
            {project.materialPurchases.length === 0 ? (
              <div className="empty-state"><p>No material purchases recorded for this project yet.</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Date</th>
                      <th>Item Name</th>
                      <th>Vendor</th>
                      <th>Qty/Unit</th>
                      <th>Bill #</th>
                      <th>Amount</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.materialPurchases.map((mat) => (
                      <tr key={mat.id}>
                        <td><strong>{mat.materialCode}</strong></td>
                        <td>{new Date(mat.purchaseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          {mat.materialName}
                          {mat.workItem && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 'bold' }}>
                              ➔ {mat.workItem.workType}
                            </span>
                          )}
                        </td>
                        <td>{mat.vendor || '—'}</td>
                        <td>{Number(mat.quantity)} {mat.unit || ''}</td>
                        <td>{mat.billNumber || '—'}</td>
                        <td style={{ fontWeight: '600', color: 'var(--danger)' }}>{formatCurrency(Number(mat.amount))}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleDeleteMaterial(mat.id)} className="btn btn-danger btn-sm">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Payments Received (Quick Log) */}
        {activeTab === 'payments' && (
          <div>
            <h3 style={{ marginBottom: '16px' }}>Record Project Payment Receipt (Aims for &lt;10s)</h3>
            <form onSubmit={handleAddPayment} className="card" style={{ background: '#faf9f6', padding: '16px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Received (INR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 50000"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode *</label>
                  <select
                    className="form-control"
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    required
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Reference Number (UPI Transaction / Cheque ID)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. UPI Ref # or Cheque #"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: '2' }}>
                  <label className="form-label">Payment Remarks</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Advance payment, Stage 2 Completion payment..."
                    value={payRemarks}
                    onChange={(e) => setPayRemarks(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={paySubmitting}>
                {paySubmitting ? 'Recording Receipt...' : '💵 Save Payment Receipt'}
              </button>
            </form>

            <h3 style={{ margin: '24px 0 12px 0' }}>Collections History ({project.payments.length})</h3>
            {project.payments.length === 0 ? (
              <div className="empty-state"><p>No payment entries logged for this project yet.</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Date</th>
                      <th>Mode</th>
                      <th>Ref Number</th>
                      <th>Remarks</th>
                      <th>Amount</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.payments.map((pay) => (
                      <tr key={pay.id}>
                        <td><strong>{pay.paymentCode}</strong></td>
                        <td>{new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <span className="badge badge-advance-received">{pay.paymentMode}</span>
                        </td>
                        <td>{pay.referenceNumber || '—'}</td>
                        <td>{pay.remarks || '—'}</td>
                        <td style={{ fontWeight: '600', color: 'var(--success)' }}>{formatCurrency(Number(pay.amount))}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleDeletePayment(pay.id)} className="btn btn-danger btn-sm">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Labour Costs */}
        {activeTab === 'labour' && (
          <div>
            <h3 style={{ marginBottom: '16px' }}>Log Labour Cost / Carpenter Pay</h3>
            <form onSubmit={handleAddLabour} className="card" style={{ background: '#faf9f6', padding: '16px' }}>
              <div className="form-row">
                <div className="form-group" style={{ flex: '1.5' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Labourer / Carpenter *</span>
                    <button
                      type="button"
                      onClick={() => setShowLabourerModal(true)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '2px 6px', height: 'auto', minHeight: 'auto' }}
                    >
                      ➕ Add New Labourer
                    </button>
                  </label>
                  <select
                    className="form-control"
                    value={selectedLabourerId}
                    onChange={(e) => {
                      setSelectedLabourerId(e.target.value);
                      const selected = labourersList.find(l => l.id === e.target.value);
                      setLabName(selected ? selected.name : '');
                    }}
                    required
                  >
                    <option value="">-- Select Labourer --</option>
                    {labourersList.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.labourCode} - {l.skillType})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Paid (INR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Wage Amount"
                    value={labAmount}
                    onChange={(e) => setLabAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={labDate}
                    onChange={(e) => setLabDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Work Description / Details</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Plywood cutting wage, Wardrobe polish wage..."
                    value={labDesc}
                    onChange={(e) => setLabDesc(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign To Work Item</label>
                  <select
                    className="form-control"
                    value={labWorkItemId}
                    onChange={(e) => setLabWorkItemId(e.target.value)}
                  >
                    <option value="">Project Level Expense</option>
                    {project.workItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.workType} ({item.workCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: '1.5' }}>
                  <label className="form-label">Remarks</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Additional logs..."
                    value={labRemarks}
                    onChange={(e) => setLabRemarks(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={labSubmitting}>
                {labSubmitting ? 'Logging Cost...' : '💾 Save Labour Cost Log'}
              </button>
            </form>

            <h3 style={{ margin: '24px 0 12px 0' }}>Labour Cost Sheet ({project.labourCosts.length})</h3>
            {project.labourCosts.length === 0 ? (
              <div className="empty-state"><p>No labour cost items recorded for this project yet.</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Date</th>
                      <th>Carpenter Name</th>
                      <th>Work Done</th>
                      <th>Remarks</th>
                      <th>Amount</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.labourCosts.map((lab) => (
                      <tr key={lab.id}>
                        <td><strong>{lab.labourCode}</strong></td>
                        <td>{new Date(lab.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          {lab.labourerId ? (
                            <Link href={`/labourers/${lab.labourerId}`} style={{ fontWeight: '600', color: 'var(--primary)' }}>
                              {lab.carpenterName}
                            </Link>
                          ) : (
                            lab.carpenterName
                          )}
                          {lab.workItem && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 'bold' }}>
                              ➔ {lab.workItem.workType}
                            </span>
                          )}
                        </td>
                        <td>{lab.workDescription || '—'}</td>
                        <td>{lab.remarks || '—'}</td>
                        <td style={{ fontWeight: '600', color: 'var(--danger)' }}>{formatCurrency(Number(lab.amount))}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleDeleteLabour(lab.id)} className="btn btn-danger btn-sm">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Labourer Registration dialog modal */}
      {showLabourerModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1100,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '400px',
            padding: '20px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginBottom: '16px' }}>Quick Add Labourer</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newLabName || !newLabPhone) return;
              try {
                const res = await fetch('/api/labourers', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: newLabName.trim(),
                    phone: newLabPhone.trim(),
                    skillType: newLabSkill,
                    address: newLabAddress.trim() || null,
                    joiningDate: new Date().toISOString().split('T')[0],
                    activeStatus: true
                  }),
                });
                if (!res.ok) throw new Error('Failed to register labourer');
                const data = await res.json();
                
                // Add to list and auto-select
                setLabourersList(prev => [data, ...prev]);
                setSelectedLabourerId(data.id);
                setLabName(data.name);

                // Reset modal states
                setNewLabName('');
                setNewLabPhone('');
                setNewLabSkill('Carpenter');
                setNewLabAddress('');
                setShowLabourerModal(false);
                alert(`Labourer registered and selected: ${data.name}`);
              } catch (err: any) {
                alert(err.message || 'Error registering labourer');
              }
            }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. Kannan Polisher"
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. 9988776655"
                  value={newLabPhone}
                  onChange={(e) => setNewLabPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Skill Type *</label>
                <select
                  className="form-control"
                  value={newLabSkill}
                  onChange={(e) => setNewLabSkill(e.target.value)}
                >
                  <option value="Carpenter">Carpenter</option>
                  <option value="Polisher">Polisher</option>
                  <option value="Painter">Painter</option>
                  <option value="Helper">Helper</option>
                  <option value="Installer">Installer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Optional address details..."
                  value={newLabAddress}
                  onChange={(e) => setNewLabAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowLabourerModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                >
                  Save Labourer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
