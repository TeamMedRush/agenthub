export type Persona = "user" | "partner" | "agent";

export interface Address {
  label?: string;
  latitude?: number;
  longitude?: number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface ApiError {
  status?: number;
  message: string;
  code: string;
  hint?: string;
  details?: unknown;
}

export interface User {
  id: string;
  persona: Persona;
  name: string;
  email: string;
  phone: string;
  age?: number;
  latitude?: number;
  longitude?: number;
  homeLatitude?: number;
  homeLongitude?: number;
  address?: Address;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession<TProfile extends User = User> {
  token: string;
  persona: Persona;
  profile: TProfile;
  source: "remote" | "cached";
}

export interface Product {
  id: string;
  medicineId: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  stockQuantity: number;
  prescriptionRequired: boolean;
  partnerName?: string | null;
  partnerId?: string | null;
  imageUrl?: string;
  availabilityText: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  medicineId: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  stockQuantity: number;
  expiryDate?: string;
  prescriptionRequired: boolean;
  imageUrl?: string;
  partnerId?: string;
  status: "active" | "low" | "unavailable";
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  medicineId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId?: string;
  partnerId?: string | null;
  agentId?: string | null;
  status: string;
  items: OrderItem[];
  deliveryAddress: Address;
  total: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Delivery {
  id: string;
  orderId: string;
  pickupShopName?: string | null;
  pickupAddress?: Address | null;
  dropAddress: Address;
  distanceKm?: number | null;
  estimatedMinutes?: number | null;
  payout?: number | null;
  status: string;
  itemCount: number;
  total: number;
  notes?: string;
  items: OrderItem[];
}

export interface SessionActionResult<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}
