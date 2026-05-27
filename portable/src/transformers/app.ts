import type {
  Address,
  AuthSession,
  Delivery,
  Order,
  OrderItem,
  Persona,
  User,
} from "@interfaces/app";

interface RawRecord {
  [key: string]: unknown;
}

interface RawSessionResponse {
  token: string;
  persona?: string;
  profile: RawRecord;
}

interface RawOrderItem extends RawRecord {
  medicine_id?: string;
  name?: string;
  quantity?: number;
  price?: number;
}

interface RawOrder extends RawRecord {
  id?: string;
  user_id?: string;
  partner_id?: string;
  agent_id?: string;
  status?: string;
  items?: RawOrderItem[];
  delivery_address?: RawRecord;
  total?: number;
  created_at?: string;
  updated_at?: string;
}

const BENGALURU_HUB = {
  latitude: 12.9716,
  longitude: 77.5946,
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function toAddress(record: RawRecord | undefined): Address {
  if (!record) {
    return {};
  }

  return {
    label: typeof record.name === "string" ? record.name : undefined,
    latitude: asNumber(record.home_lat ?? record.lat ?? record.latitude),
    longitude: asNumber(record.home_long ?? record.long ?? record.longitude),
    addressLine1: typeof record.address_line_1 === "string"
      ? record.address_line_1
      : undefined,
    addressLine2: typeof record.address_line_2 === "string"
      ? record.address_line_2
      : undefined,
    city: typeof record.city === "string" ? record.city : undefined,
    state: typeof record.state === "string" ? record.state : undefined,
    pincode: typeof record.pincode === "string" ? record.pincode : undefined,
    country: typeof record.country === "string" ? record.country : undefined,
  };
}

export function toUser(
  record: RawRecord,
  persona: Persona,
): User {
  return {
    id: typeof record.id === "string" ? record.id : "",
    persona,
    name: typeof record.name === "string" ? record.name : "MedRush User",
    email: typeof record.email === "string" ? record.email : "",
    phone: typeof record.phone === "string" ? record.phone : "",
    age: asNumber(record.age),
    latitude: asNumber(record.lat),
    longitude: asNumber(record.long),
    homeLatitude: asNumber(record.home_lat),
    homeLongitude: asNumber(record.home_long),
    address: toAddress(record),
    createdAt: typeof record.created_at === "string"
      ? record.created_at
      : undefined,
    updatedAt: typeof record.updated_at === "string"
      ? record.updated_at
      : undefined,
  };
}

export function toSession(
  payload: RawSessionResponse,
  persona: Persona,
): AuthSession<User> {
  return {
    token: payload.token,
    persona,
    profile: toUser(payload.profile, persona),
    source: "remote",
  };
}

export function toOrder(raw: RawOrder): Order {
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  return {
    id: typeof raw.id === "string" ? raw.id : "",
    userId: typeof raw.user_id === "string" ? raw.user_id : undefined,
    partnerId: typeof raw.partner_id === "string" ? raw.partner_id : null,
    agentId: typeof raw.agent_id === "string" ? raw.agent_id : null,
    status: typeof raw.status === "string" ? raw.status : "pending_assignment",
    items: rawItems.map<OrderItem>((item) => ({
      medicineId: typeof item.medicine_id === "string" ? item.medicine_id : "",
      name: typeof item.name === "string" ? item.name : "Medicine",
      quantity: asNumber(item.quantity) ?? 0,
      price: asNumber(item.price) ?? 0,
    })),
    deliveryAddress: toAddress(raw.delivery_address),
    total: asNumber(raw.total) ?? 0,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function estimateDistanceKm(address: Address): number | null {
  if (
    typeof address.latitude !== "number"
    || typeof address.longitude !== "number"
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const latDistance = degToRad(address.latitude - BENGALURU_HUB.latitude);
  const longDistance = degToRad(address.longitude - BENGALURU_HUB.longitude);
  const a = (
    Math.sin(latDistance / 2) ** 2
    + Math.cos(degToRad(BENGALURU_HUB.latitude))
    * Math.cos(degToRad(address.latitude))
    * Math.sin(longDistance / 2) ** 2
  );

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusKm * c * 10) / 10;
}

export function toDelivery(order: Order): Delivery {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const distanceKm = estimateDistanceKm(order.deliveryAddress);
  const estimatedMinutes = distanceKm === null
    ? Math.max(18, itemCount * 8 + 10)
    : Math.max(16, Math.round(distanceKm * 6.5));

  return {
    id: order.id,
    orderId: order.id,
    pickupShopName: order.partnerId
      ? `Partner ${order.partnerId.slice(0, 6)}`
      : null,
    pickupAddress: null,
    dropAddress: order.deliveryAddress,
    distanceKm,
    estimatedMinutes,
    payout: Math.max(35, Math.round(order.total * 0.18 + itemCount * 5)),
    status: order.status,
    itemCount,
    total: order.total,
    items: order.items,
    notes: order.partnerId
      ? "Pickup shop is inferred from the assigned partner id."
      : "TODO(server): pickup pharmacy details are not exposed by the backend yet.",
  };
}

export function formatAddress(address?: Address | null): string {
  if (!address) {
    return "Not available yet";
  }

  const parts = [
    address.label,
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.pincode,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Not available yet";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
