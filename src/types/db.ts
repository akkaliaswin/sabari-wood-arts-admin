export interface Client {
  id: string;
  clientCode: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  location: string | null;
  address: string | null;
  referredBy: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Project {
  id: string;
  projectCode: string;
  clientId: string;
  projectName: string;
  projectType: string | null;
  projectLocation: string | null;
  status: string;
  quotedAmount: any;
  startDate: Date | null;
  expectedCompletionDate: Date | null;
  actualCompletionDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface WorkItem {
  id: string;
  workCode: string;
  projectId: string;
  workType: string;
  description: string | null;
  quantity: any;
  unitPrice: any;
  totalPrice: any;
  sellingPrice: any;
  actualCost: any;
  status: string;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialPurchase {
  id: string;
  materialCode: string;
  projectId: string;
  workItemId: string | null;
  purchaseDate: Date;
  materialName: string;
  vendor: string | null;
  quantity: any;
  unit: string | null;
  amount: any;
  billNumber: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  paymentCode: string;
  projectId: string;
  paymentDate: Date;
  amount: any;
  paymentMode: string;
  referenceNumber: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabourCost {
  id: string;
  labourCode: string;
  projectId: string;
  labourerId: string | null;
  workItemId: string | null;
  carpenterName: string;
  workDescription: string | null;
  amount: any;
  paymentDate: Date;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Labourer {
  id: string;
  labourCode: string;
  name: string;
  phone: string;
  address: string | null;
  skillType: string;
  joiningDate: Date;
  activeStatus: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectStatusHistory {
  id: string;
  projectId: string;
  previousStatus: string;
  newStatus: string;
  changedAt: Date;
}

export interface WorkItemStatusHistory {
  id: string;
  workItemId: string;
  previousStatus: string;
  newStatus: string;
  updatedAt: Date;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  activityType: string;
  description: string;
  createdAt: Date;
}

export interface ProjectWithRelations extends Project {
  workItems: WorkItem[];
  payments: Payment[];
  materialPurchases: MaterialPurchase[];
  labourCosts: LabourCost[];
}

export interface ProjectWithPayments extends Project {
  payments: { amount: any }[];
  client: {
    id: string;
    name: string;
    clientCode: string;
    phone: string;
  };
}

export interface ProjectReportPayload extends Project {
  client: {
    id: string;
    name: string;
    clientCode: string;
  };
  workItems: WorkItem[];
  materialPurchases: MaterialPurchase[];
  labourCosts: LabourCost[];
}
