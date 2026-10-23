export type PropertyType = 'flat' | 'house' | 'pg' | 'land';
export type TransactionType = 'rent' | 'lease' | 'purchase';

export interface TenantDetails {
  name: string;
  age: number;
  dateOfBirth: string;
  familyMembers: number;
  religion: string;
  occupation: string;
  aadharNumber: string;
}

export interface LandDimensions {
  ab?: number;
  bc?: number;
  cd?: number;
  da?: number;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface Property {
  id: string;
  title: string;
  propertyType: string;
  location: string;
  price: number;
  transactionType: TransactionType;
  images?: string[];
  status?: string;
  owner?: string;
  description?: string;
  amenities?: string[];
  totalArea?: number;
  cent?: number;
  landDimensions?: LandDimensions;
  bedrooms?: number;
  facing?: string;
  geoLocation?: GeoLocation | null;
  geoLocatedImage?: string | null;
  tenant?: string | {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    aadhar?: string;
    gender?: string;
    age?: number;
    dateOfBirth?: string;
    familyMembers?: number;
    religion?: string;
    occupation?: string;
    companyName?: string;
    monthlyIncome?: number;
    maritalStatus?: string;
    idType?: string;
    idNumber?: string;
    idProofImage?: string;
  }; // ID or populated object
  tenantDetails?: TenantDetails; // Detailed tenant information
  buyer?: any;
  previousOwner?: any;
  saleStatus?: 'available' | 'under_contract' | 'sold';
  soldDate?: string;
  finalPrice?: number;
}

export type RequestStatus =
  | 'pending'
  | 'counteroffer'
  | 'accepted'
  | 'approved'
  | 'terms_confirmed'
  | 'payment_pending'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface PaymentDetails {
  amount?: number;
  mode?: string;
  transactionId?: string;
  screenshot?: string;
  receiptNumber?: string;
  submittedAt?: string;
  verifiedAt?: string;
  status?: 'unpaid' | 'submitted' | 'verified' | 'rejected';
}

export interface PropertyRequest {
  _id: string;
  property: Property; // Populated property
  owner: any;
  agreement?: any;
  tenant: { // Populated tenant/buyer
    _id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    idType?: string;
    idNumber?: string;
  };
  tenantDetails?: TenantDetails; // Collected tenant details
  status: RequestStatus;
  type: 'rent' | 'buy';
  message?: string;
  offerAmount?: number;
  counterOfferAmount?: number;
  counterOfferNote?: string;
  agreedAmount?: number;
  terms?: string;
  termsConfirmedByBuyer?: boolean;
  termsConfirmedByOwner?: boolean;
  paymentDetails?: PaymentDetails;
  rejectionReason?: string;
  cancelledReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AppNotification {
  _id: string;
  recipient: string;
  sender: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  type: string;
  title: string;
  message: string;
  property?: Property;
  request?: PropertyRequest;
  transactionType: 'rent' | 'buy';
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface PropertyInput {
  title: string;
  propertyType: string; // Changed from type to propertyType to match usage
  location: string;
  price: number;
  transactionType: TransactionType;
  description?: string;
  amenities?: string[];
  totalArea?: number;
  cent?: number;
  landDimensions?: LandDimensions;
  bedrooms?: number;
  facing?: string;
  geoLocation?: GeoLocation | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  properties?: Property[];
}

export type SystemRole = 'admin' | 'user';

export type RegistrationPurpose = 'Owner' | 'Builder' | 'Dealer' | 'Customer';

export enum TamilRole {
  owners = 'owners',
  brokersBuilders = 'brokersBuilders',
  customers = 'customers',
  admin = 'admin'
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: SystemRole | TamilRole | string;
  registrationPurpose?: RegistrationPurpose | string;
  approved: boolean;
  internalRole?: 'admin' | 'user' | string;
  blocked?: boolean;
  walletAddress?: string; // Keeping for compatibility if needed
  phone?: string;
  address?: string;
  aadhar?: string;
  // Tenant Details
  gender?: string;
  age?: number;
  dateOfBirth?: string;
  familyMembers?: number;
  religion?: string;
  occupation?: string;
  companyName?: string;
  monthlyIncome?: number;
  maritalStatus?: string;
  idType?: string;
  idNumber?: string;
  idProofImage?: string;
  notificationsEnabled?: boolean;
  profileCompletion?: number;
}

export enum PropertyStatus {
  pending = 'pending',
  approved = 'approved',
  rejected = 'rejected'
}

export interface ExternalBlob {
  blob: Blob;
  name: string;
  contentType: string;
}

export interface Announcement {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  createdBy?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
  creatorName?: string;
}

export interface AdminAnnouncementsResponse {
  announcements: Announcement[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

