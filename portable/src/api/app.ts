declare const process: {
  env: Record<string, string | undefined>;
};

import type {
  ApiError,
  AuthSession,
  Delivery,
  SessionActionResult,
  User,
} from "@interfaces/app";
import {
  toDelivery,
  toOrder,
  toSession,
} from "@transformers/app";

interface CredentialsInput {
  email: string;
  password: string;
}

export interface AgentRegistrationInput extends CredentialsInput {
  name: string;
  phone: string;
  age: number;
}

export interface AgentProfileUpdateInput {
  name: string;
  phone: string;
  age: number;
  password?: string;
}

interface RawSessionResponse {
  token: string;
  persona?: string;
  profile: Record<string, unknown>;
}

interface RawOrderResponse {
  order: Record<string, unknown>;
}

interface RawPendingResponse {
  orders: Array<Record<string, unknown>>;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  body?: unknown;
  token?: string;
}

const API_BASE_URL = (
  window.localStorage.getItem("medrush.apiBaseUrl")
  || process.env.API_BASE_URL
  || "http://localhost:8000"
).replace(/\/$/, "");

const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || "10000");
const API_AUTH_HEADER = process.env.API_AUTH_HEADER || "token";
const ENABLE_MOCK_DATA = (
  process.env.ENABLE_MOCK_DATA === "true"
  || process.env.ENABLE_MOCK_DATA === "1"
);

const STORAGE_KEYS = {
  session: "medrush.agenthub.session",
  deliveries: "medrush.agenthub.deliveries",
};

export const ENDPOINTS = {
  auth: {
    signup: "/api/v1/auth/signup",
    signin: "/api/v1/auth/signin",
  },
  agent: {
    account: "/api/v1/agent/account",
    pending: "/api/v1/agent/orders/pending",
    accept: (deliveryId: string) => `/api/v1/agent/orders/${deliveryId}/accept`,
  },
} as const;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createApiError(
  partial: Partial<ApiError> & { message: string },
): ApiError {
  return {
    code: partial.code || "api_error",
    message: partial.message,
    status: partial.status,
    hint: partial.hint,
    details: partial.details,
  };
}

export function normalizeApiError(error: unknown): ApiError {
  if (
    typeof error === "object"
    && error !== null
    && "message" in error
    && "code" in error
  ) {
    return error as ApiError;
  }

  if (error instanceof Error) {
    return createApiError({
      code: "runtime_error",
      message: error.message,
    });
  }

  return createApiError({
    code: "unknown_error",
    message: "Something went wrong while contacting MedRush.",
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const method = options.method || "GET";
  const headers = new Headers();

  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set(API_AUTH_HEADER, options.token);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const apiMessage = (
        typeof payload === "object"
        && payload !== null
        && "error" in payload
      )
        ? String(payload.error)
        : `Request failed with status ${response.status}`;

      throw createApiError({
        status: response.status,
        code: "request_failed",
        message: apiMessage,
        details: payload,
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw createApiError({
        code: "timeout",
        message: "The MedRush server took too long to respond.",
        hint: "Check that the backend is running on http://localhost:8000.",
      });
    }

    if (error instanceof TypeError) {
      throw createApiError({
        code: "network_error",
        message: "The MedRush server could not be reached from the browser.",
        hint: "This usually means the backend is offline or CORS is blocking requests on a different port.",
      });
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mockDeliveries(): Delivery[] {
  return [
    {
      id: "mock-delivery-1",
      orderId: "mock-delivery-1",
      pickupShopName: "CityCare Pharmacy",
      pickupAddress: {
        label: "CityCare Pharmacy",
        addressLine1: "12 Residency Road",
        city: "Bengaluru",
      },
      dropAddress: {
        label: "Customer drop",
        addressLine1: "21 Indiranagar 100 Ft Road",
        city: "Bengaluru",
        latitude: 12.9784,
        longitude: 77.6408,
      },
      distanceKm: 6.2,
      estimatedMinutes: 32,
      payout: 74,
      status: "pending_assignment",
      itemCount: 3,
      total: 420,
      notes: "Mock fallback enabled for UI development.",
      items: [
        {
          medicineId: "mock-medicine-1",
          name: "Paracetamol",
          quantity: 2,
          price: 80,
        },
        {
          medicineId: "mock-medicine-2",
          name: "Vitamin C",
          quantity: 1,
          price: 260,
        },
      ],
    },
  ];
}

export function loadCachedSession(): AuthSession<User> | null {
  return readStorage<AuthSession<User> | null>(STORAGE_KEYS.session, null);
}

export function saveCachedSession(session: AuthSession<User> | null) {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEYS.session);
    return;
  }

  writeStorage(STORAGE_KEYS.session, session);
}

export function loadCachedDeliveries(): Delivery[] {
  return readStorage<Delivery[]>(STORAGE_KEYS.deliveries, []);
}

function saveCachedDeliveries(deliveries: Delivery[]) {
  writeStorage(STORAGE_KEYS.deliveries, deliveries);
}

function mergeDeliveries(remoteDeliveries: Delivery[]): Delivery[] {
  const cachedAccepted = loadCachedDeliveries().filter((delivery) =>
    delivery.status === "accepted"
  );
  const registry = new Map<string, Delivery>();

  for (const delivery of [...remoteDeliveries, ...cachedAccepted]) {
    registry.set(delivery.id, delivery);
  }

  const merged = Array.from(registry.values()).sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  saveCachedDeliveries(merged);
  return merged;
}

export function getCachedDelivery(deliveryId: string): Delivery | null {
  const delivery = loadCachedDeliveries().find((item) => item.id === deliveryId);
  return delivery || null;
}

export async function signInAgent(
  input: CredentialsInput,
): Promise<AuthSession<User>> {
  const payload = await request<RawSessionResponse>(ENDPOINTS.auth.signin, {
    method: "POST",
    body: {
      persona: "agent",
      email: input.email,
      password: input.password,
    },
  });

  const session = toSession(payload, "agent");
  saveCachedSession(session);
  return session;
}

export async function registerAgent(
  input: AgentRegistrationInput,
): Promise<AuthSession<User>> {
  const payload = await request<RawSessionResponse>(ENDPOINTS.auth.signup, {
    method: "POST",
    body: {
      persona: "agent",
      name: input.name,
      email: input.email,
      password: input.password,
      phone: input.phone,
      age: input.age,
    },
  });

  const session = toSession(payload, "agent");
  saveCachedSession(session);
  return session;
}

export async function updateAgentProfile(
  token: string,
  input: AgentProfileUpdateInput,
): Promise<User> {
  const payload = await request<{ profile: Record<string, unknown> }>(
    ENDPOINTS.agent.account,
    {
      method: "PATCH",
      token,
      body: input,
    },
  );

  const session = loadCachedSession();
  const nextProfile = toSession(
    { token, profile: payload.profile, persona: "agent" },
    "agent",
  ).profile;

  if (session) {
    saveCachedSession({
      ...session,
      profile: nextProfile,
      source: "cached",
    });
  }

  return nextProfile;
}

export async function listPendingDeliveries(
  token: string,
): Promise<Delivery[]> {
  try {
    const payload = await request<RawPendingResponse>(ENDPOINTS.agent.pending, {
      method: "GET",
      token,
    });

    const deliveries = payload.orders
      .map((order) => toDelivery(toOrder(order)))
      .filter((delivery) => !!delivery.id);

    return mergeDeliveries(deliveries);
  } catch (error) {
    if (ENABLE_MOCK_DATA) {
      const mockData = mockDeliveries();
      saveCachedDeliveries(mockData);
      return mockData;
    }

    throw error;
  }
}

export async function acceptDelivery(
  token: string,
  deliveryId: string,
): Promise<Delivery> {
  const payload = await request<RawOrderResponse>(ENDPOINTS.agent.accept(deliveryId), {
    method: "POST",
    token,
    body: {},
  });

  const acceptedDelivery = toDelivery(toOrder(payload.order));
  const updated = loadCachedDeliveries().map((delivery) =>
    delivery.id === acceptedDelivery.id ? acceptedDelivery : delivery
  );

  if (!updated.some((delivery) => delivery.id === acceptedDelivery.id)) {
    updated.push(acceptedDelivery);
  }

  saveCachedDeliveries(updated);
  return acceptedDelivery;
}

export function logoutAgent(): SessionActionResult<null> {
  window.localStorage.removeItem(STORAGE_KEYS.session);
  return { ok: true, data: null };
}

// TODO(server): replace cache lookups with a dedicated GET /api/v1/agent/orders/:id
// endpoint when the backend exposes delivery detail and richer pickup data.
