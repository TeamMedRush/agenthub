import {
  acceptDelivery,
  getCachedDelivery,
  listPendingDeliveries,
  normalizeApiError,
  type AgentProfileUpdateInput,
  type AgentRegistrationInput,
} from "@api/app";
import { About } from "@components/block/about";
import { AppShell } from "@components/kit/app-shell";
import { StatePanel } from "@components/kit/state-panel";
import { useAuth } from "@contexts/auth-context";
import type { ApiError, Delivery, User } from "@interfaces/app";
import {
  formatAddress,
  formatCurrency,
} from "@transformers/app";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

export interface AgentRouteState {
  page:
    | "home"
    | "login"
    | "register"
    | "dashboard"
    | "deliveries"
    | "delivery-detail"
    | "active"
    | "profile"
    | "not-found";
  path: string;
  deliveryId?: string;
}

interface HomeViewProps {
  route: AgentRouteState;
}

interface DeliverySourceState {
  loading: boolean;
  error: ApiError | null;
  deliveries: Delivery[];
  acceptingId: string | null;
  refresh: () => Promise<void>;
  accept: (deliveryId: string) => Promise<void>;
}

function useDeliveriesSource(token: string | undefined): DeliverySourceState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>(() => {
    return token ? [] : [];
  });

  const refresh = useCallback(async () => {
    if (!token) {
      setDeliveries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextDeliveries = await listPendingDeliveries(token);
      setDeliveries(nextDeliveries);
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const accept = useCallback(async (deliveryId: string) => {
    if (!token) {
      return;
    }

    setAcceptingId(deliveryId);
    setError(null);

    try {
      const accepted = await acceptDelivery(token, deliveryId);
      setDeliveries((current) => current.map((delivery) =>
        delivery.id === accepted.id ? accepted : delivery
      ));
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setAcceptingId(null);
    }
  }, [token]);

  return {
    loading,
    error,
    deliveries,
    acceptingId,
    refresh,
    accept,
  };
}

function metricValue(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) {
    return "Pending";
  }

  return `${value}${suffix}`;
}

function SectionHeader(
  { title, summary, actionLabel, actionHref, onAction }:
  {
    title: string;
    summary: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
  },
) {
  return (
    <div className="view-section__header">
      <div>
        <p className="view-section__eyebrow">MedRush Agent Flow</p>
        <h2>{title}</h2>
        <p>{summary}</p>
      </div>

      {actionLabel && actionHref ? (
        <a className="view-button view-button--secondary" href={actionHref}>
          {actionLabel}
        </a>
      ) : null}

      {actionLabel && onAction ? (
        <button
          className="view-button view-button--secondary"
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function DeliveryCard(
  {
    delivery,
    busy,
    onAccept,
  }:
  {
    delivery: Delivery;
    busy: boolean;
    onAccept: (deliveryId: string) => void;
  },
) {
  return (
    <article className="delivery-card">
      <div className="delivery-card__topline">
        <span className={`delivery-card__status delivery-card__status--${delivery.status}`}>
          {delivery.status.replaceAll("_", " ")}
        </span>
        <strong>{formatCurrency(delivery.payout || 0)}</strong>
      </div>

      <h3>{delivery.pickupShopName || "Pickup shop pending assignment"}</h3>

      <p className="delivery-card__note">
        Pickup: {delivery.pickupAddress ? formatAddress(delivery.pickupAddress) : "Backend has not exposed pickup address yet."}
      </p>
      <p className="delivery-card__note">
        Drop: {formatAddress(delivery.dropAddress)}
      </p>

      <div className="delivery-card__stats">
        <div>
          <span>Distance</span>
          <strong>{metricValue(delivery.distanceKm, " km")}</strong>
        </div>
        <div>
          <span>ETA</span>
          <strong>{metricValue(delivery.estimatedMinutes, " min")}</strong>
        </div>
        <div>
          <span>Items</span>
          <strong>{delivery.itemCount}</strong>
        </div>
      </div>

      <div className="delivery-card__actions">
        <a className="view-button view-button--ghost" href={`/deliveries/${delivery.id}`}>
          View details
        </a>
        {delivery.status !== "accepted" ? (
          <button
            className="view-button view-button--primary"
            type="button"
            disabled={busy}
            onClick={() => onAccept(delivery.id)}
          >
            {busy ? "Accepting..." : "Accept delivery"}
          </button>
        ) : (
          <a className="view-button view-button--primary" href="/active">
            View active run
          </a>
        )}
      </div>
    </article>
  );
}

function LoginPage() {
  const { signIn, busy, error, clearError } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  async function onSubmit(event: Event) {
    event.preventDefault();
    clearError();
    const result = await signIn(form);

    if (result.ok) {
      window.location.href = "/dashboard";
    }
  }

  return (
    <section className="view-form-panel">
      <SectionHeader
        title="Rider sign in"
        summary="Use the MedRush agent persona so your session maps to the rider routes that already exist on the backend."
      />

      <form className="view-form" onSubmit={onSubmit}>
        <label>
          <span>Email</span>
          <input
            required
            type="email"
            value={form.email}
            onInput={(event) => setForm((current) => ({
              ...current,
              email: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <label>
          <span>Password</span>
          <input
            required
            type="password"
            value={form.password}
            onInput={(event) => setForm((current) => ({
              ...current,
              password: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        {error ? (
          <div className="view-error-banner">
            <strong>{error.message}</strong>
            {error.hint ? <span>{error.hint}</span> : null}
          </div>
        ) : null}

        <div className="view-form__actions">
          <button className="view-button view-button--primary" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <a className="view-button view-button--ghost" href="/register">
            Create agent account
          </a>
        </div>
      </form>
    </section>
  );
}

function RegisterPage() {
  const { register, busy, error, clearError } = useAuth();
  const [form, setForm] = useState<AgentRegistrationInput>({
    name: "",
    email: "",
    password: "",
    phone: "",
    age: 21,
  });

  async function onSubmit(event: Event) {
    event.preventDefault();
    clearError();
    const result = await register(form);

    if (result.ok) {
      window.location.href = "/dashboard";
    }
  }

  return (
    <section className="view-form-panel">
      <SectionHeader
        title="Register a MedRush rider"
        summary="Agent registration is already supported by the backend, so this form writes directly to the live auth and agent account routes."
      />

      <form className="view-form" onSubmit={onSubmit}>
        <label>
          <span>Full name</span>
          <input
            required
            type="text"
            value={form.name}
            onInput={(event) => setForm((current) => ({
              ...current,
              name: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <div className="view-form__grid">
          <label>
            <span>Email</span>
            <input
              required
              type="email"
              value={form.email}
              onInput={(event) => setForm((current) => ({
                ...current,
                email: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>Phone</span>
            <input
              required
              type="tel"
              value={form.phone}
              onInput={(event) => setForm((current) => ({
                ...current,
                phone: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>
        </div>

        <div className="view-form__grid">
          <label>
            <span>Age</span>
            <input
              required
              min="18"
              type="number"
              value={String(form.age)}
              onInput={(event) => setForm((current) => ({
                ...current,
                age: Number((event.currentTarget as HTMLInputElement).value || "0"),
              }))}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              required
              type="password"
              value={form.password}
              onInput={(event) => setForm((current) => ({
                ...current,
                password: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>
        </div>

        {error ? (
          <div className="view-error-banner">
            <strong>{error.message}</strong>
            {error.hint ? <span>{error.hint}</span> : null}
          </div>
        ) : null}

        <div className="view-form__actions">
          <button className="view-button view-button--primary" type="submit" disabled={busy}>
            {busy ? "Creating account..." : "Create rider account"}
          </button>
          <a className="view-button view-button--ghost" href="/login">
            Back to login
          </a>
        </div>
      </form>
    </section>
  );
}

function DashboardPage(
  {
    deliveries,
    loading,
    error,
    onRefresh,
  }:
  {
    deliveries: Delivery[];
    loading: boolean;
    error: ApiError | null;
    onRefresh: () => void;
  },
) {
  const pendingCount = deliveries.filter((delivery) =>
    delivery.status !== "accepted"
  ).length;
  const acceptedCount = deliveries.filter((delivery) =>
    delivery.status === "accepted"
  ).length;
  const projectedEarnings = deliveries
    .filter((delivery) => delivery.status === "accepted")
    .reduce((sum, delivery) => sum + (delivery.payout || 0), 0);

  return (
    <section className="view-stack">
      <SectionHeader
        title="Delivery dashboard"
        summary="Keep one eye on what is ready to accept now and another on the backend capabilities that are still on the roadmap."
        actionLabel="Refresh deliveries"
        onAction={onRefresh}
      />

      <div className="metric-grid">
        <article className="metric-card">
          <span>Pending pool</span>
          <strong>{pendingCount}</strong>
          <p>Orders still waiting for a rider.</p>
        </article>
        <article className="metric-card">
          <span>Accepted locally</span>
          <strong>{acceptedCount}</strong>
          <p>Tracked from the current browser session cache.</p>
        </article>
        <article className="metric-card">
          <span>Projected payout</span>
          <strong>{formatCurrency(projectedEarnings)}</strong>
          <p>Frontend estimate based on accepted delivery totals.</p>
        </article>
      </div>

      {loading ? (
        <StatePanel
          title="Refreshing pending deliveries"
          message="The rider dashboard is syncing with the current MedRush agent endpoints."
        />
      ) : null}

      {error ? (
        <StatePanel
          title="Delivery feed unavailable"
          message={`${error.message}${error.hint ? ` ${error.hint}` : ""}`}
          tone="danger"
        />
      ) : null}

      <div className="feature-grid">
        {deliveries.slice(0, 3).map((delivery) => (
          <DeliveryCard
            key={delivery.id}
            delivery={delivery}
            busy={false}
            onAccept={() => undefined}
          />
        ))}
      </div>
    </section>
  );
}

function DeliveriesPage(
  {
    deliveries,
    loading,
    error,
    acceptingId,
    onRefresh,
    onAccept,
  }:
  {
    deliveries: Delivery[];
    loading: boolean;
    error: ApiError | null;
    acceptingId: string | null;
    onRefresh: () => void;
    onAccept: (deliveryId: string) => void;
  },
) {
  return (
    <section className="view-stack">
      <SectionHeader
        title="Pending deliveries"
        summary="The backend currently exposes unassigned orders only, so this screen is optimized for fast scanning and one-click acceptance."
        actionLabel="Refresh"
        onAction={onRefresh}
      />

      {loading ? (
        <StatePanel
          title="Loading delivery pool"
          message="Fetching pending orders from GET /api/v1/agent/orders/pending."
        />
      ) : null}

      {error ? (
        <StatePanel
          title="We could not load deliveries"
          message={`${error.message}${error.hint ? ` ${error.hint}` : ""}`}
          tone="danger"
        />
      ) : null}

      {!loading && deliveries.length === 0 ? (
        <StatePanel
          title="No pending deliveries right now"
          message="When the backend has orders in pending_assignment status, they will appear here."
        />
      ) : (
        <div className="feature-grid">
          {deliveries.map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              busy={acceptingId === delivery.id}
              onAccept={onAccept}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DeliveryDetailPage(
  {
    route,
    deliveries,
    acceptingId,
    onAccept,
  }:
  {
    route: AgentRouteState;
    deliveries: Delivery[];
    acceptingId: string | null;
    onAccept: (deliveryId: string) => void;
  },
) {
  const delivery = useMemo(() => {
    if (!route.deliveryId) {
      return null;
    }

    return deliveries.find((item) => item.id === route.deliveryId)
      || getCachedDelivery(route.deliveryId);
  }, [deliveries, route.deliveryId]);

  if (!delivery) {
    return (
      <StatePanel
        title="Delivery detail unavailable"
        message="The backend does not expose a single-delivery endpoint yet, so this page depends on cached list data from the pending deliveries feed."
        tone="warning"
        actionLabel="Return to deliveries"
        actionHref="/deliveries"
      />
    );
  }

  return (
    <section className="view-stack">
      <SectionHeader
        title={`Delivery ${delivery.orderId}`}
        summary="This detail view combines backend order data with local estimates for payout and route span."
        actionLabel="Back to deliveries"
        actionHref="/deliveries"
      />

      <div className="detail-grid">
        <article className="detail-card">
          <span className="detail-card__eyebrow">Pickup</span>
          <h3>{delivery.pickupShopName || "Partner assignment pending"}</h3>
          <p>{delivery.pickupAddress ? formatAddress(delivery.pickupAddress) : "TODO(server): partner pickup address is missing from the current order payload."}</p>
        </article>

        <article className="detail-card">
          <span className="detail-card__eyebrow">Drop</span>
          <h3>Customer delivery address</h3>
          <p>{formatAddress(delivery.dropAddress)}</p>
        </article>

        <article className="detail-card">
          <span className="detail-card__eyebrow">Route estimate</span>
          <h3>{metricValue(delivery.distanceKm, " km")} / {metricValue(delivery.estimatedMinutes, " min")}</h3>
          <p>Estimated locally from the drop coordinates because the backend does not yet expose route geometry.</p>
        </article>

        <article className="detail-card">
          <span className="detail-card__eyebrow">Payout</span>
          <h3>{formatCurrency(delivery.payout || 0)}</h3>
          <p>Frontend estimate until a rider earnings endpoint is available.</p>
        </article>
      </div>

      <article className="detail-card detail-card--wide">
        <span className="detail-card__eyebrow">Order contents</span>
        <h3>{delivery.itemCount} line items</h3>
        <ul className="detail-list">
          {delivery.items.map((item) => (
            <li key={`${item.medicineId}-${item.name}`}>
              <strong>{item.name}</strong>
              <span>{item.quantity} units</span>
              <span>{formatCurrency(item.price)}</span>
            </li>
          ))}
        </ul>
      </article>

      <StatePanel
        title="Delivery lifecycle is intentionally partial"
        message="The current backend only supports accepting deliveries. Picked-up, in-transit, delivered, and failed-delivery actions are still TODOs on the server roadmap."
        tone="warning"
      />

      {delivery.status !== "accepted" ? (
        <button
          className="view-button view-button--primary"
          type="button"
          disabled={acceptingId === delivery.id}
          onClick={() => onAccept(delivery.id)}
        >
          {acceptingId === delivery.id ? "Accepting delivery..." : "Accept delivery"}
        </button>
      ) : null}
    </section>
  );
}

function ActivePage({ deliveries }: { deliveries: Delivery[] }) {
  const activeDeliveries = deliveries.filter((delivery) =>
    delivery.status === "accepted"
  );

  if (activeDeliveries.length === 0) {
    return (
      <StatePanel
        title="No active delivery in this browser session"
        message="Accepted deliveries are cached locally because the backend does not yet expose an assigned-orders endpoint."
        tone="warning"
      />
    );
  }

  return (
    <section className="view-stack">
      <SectionHeader
        title="Active runs"
        summary="Accepted deliveries remain visible here even though the backend currently lacks an agent-assigned delivery endpoint."
      />

      <div className="feature-grid">
        {activeDeliveries.map((delivery) => (
          <DeliveryCard
            key={delivery.id}
            delivery={delivery}
            busy={false}
            onAccept={() => undefined}
          />
        ))}
      </div>
    </section>
  );
}

function ProfilePage({ session }: { session: User }) {
  const { updateProfile, busy, error, clearError } = useAuth();
  const [saved, setSaved] = useState<string | null>(null);
  const [form, setForm] = useState<AgentProfileUpdateInput>({
    name: session.name,
    phone: session.phone,
    age: session.age || 18,
    password: "",
  });

  async function onSubmit(event: Event) {
    event.preventDefault();
    clearError();
    setSaved(null);
    const result = await updateProfile(form);

    if (result.ok) {
      setSaved("Profile updated against PATCH /api/v1/agent/account.");
      setForm((current) => ({ ...current, password: "" }));
    }
  }

  return (
    <section className="view-form-panel">
      <SectionHeader
        title="Rider profile"
        summary="Because the backend has no profile-read endpoint yet, this screen starts from the auth session payload stored locally after login or register."
      />

      <form className="view-form" onSubmit={onSubmit}>
        <label>
          <span>Name</span>
          <input
            required
            type="text"
            value={form.name}
            onInput={(event) => setForm((current) => ({
              ...current,
              name: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <div className="view-form__grid">
          <label>
            <span>Phone</span>
            <input
              required
              type="tel"
              value={form.phone}
              onInput={(event) => setForm((current) => ({
                ...current,
                phone: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>Age</span>
            <input
              required
              min="18"
              type="number"
              value={String(form.age)}
              onInput={(event) => setForm((current) => ({
                ...current,
                age: Number((event.currentTarget as HTMLInputElement).value || "0"),
              }))}
            />
          </label>
        </div>

        <label>
          <span>New password</span>
          <input
            type="password"
            value={form.password || ""}
            placeholder="Leave blank to keep the current password"
            onInput={(event) => setForm((current) => ({
              ...current,
              password: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        {error ? (
          <div className="view-error-banner">
            <strong>{error.message}</strong>
            {error.hint ? <span>{error.hint}</span> : null}
          </div>
        ) : null}

        {saved ? (
          <div className="view-success-banner">
            {saved}
          </div>
        ) : null}

        <div className="view-form__actions">
          <button className="view-button view-button--primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}

function NotFoundPage() {
  return (
    <StatePanel
      title="Route not found"
      message="This rider route does not exist yet. Use the main navigation to return to the supported MedRush Agent Hub flows."
      tone="warning"
      actionLabel="Go to dashboard"
      actionHref="/dashboard"
    />
  );
}

function RequireSession({ session }: { session: User | null }) {
  if (session) {
    return null;
  }

  return (
    <StatePanel
      title="Sign in required"
      message="The rider dashboard, active deliveries, and profile pages rely on an agent auth session stored in localStorage."
      tone="warning"
      actionLabel="Go to login"
      actionHref="/login"
    />
  );
}

export function HomeView({ route }: HomeViewProps) {
  const { session, logout } = useAuth();
  const deliveriesState = useDeliveriesSource(session?.token);
  const refreshDeliveries = deliveriesState.refresh;

  useEffect(() => {
    if (
      session
      && ["dashboard", "deliveries", "delivery-detail", "active"].includes(route.page)
    ) {
      refreshDeliveries();
    }
  }, [refreshDeliveries, route.page, session]);

  const navigation = session
    ? [
      { label: "Home", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Deliveries", href: "/deliveries" },
      { label: "Active", href: "/active" },
      { label: "Profile", href: "/profile" },
    ]
    : [
      { label: "Home", href: "/" },
      { label: "Login", href: "/login" },
      { label: "Register", href: "/register" },
    ];

  let content = <NotFoundPage />;

  if (route.page === "home") {
    content = <About session={session} />;
  }

  if (route.page === "login") {
    content = <LoginPage />;
  }

  if (route.page === "register") {
    content = <RegisterPage />;
  }

  if (route.page === "dashboard") {
    content = session ? (
      <DashboardPage
        deliveries={deliveriesState.deliveries}
        loading={deliveriesState.loading}
        error={deliveriesState.error}
        onRefresh={deliveriesState.refresh}
      />
    ) : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "deliveries") {
    content = session ? (
      <DeliveriesPage
        deliveries={deliveriesState.deliveries}
        loading={deliveriesState.loading}
        error={deliveriesState.error}
        acceptingId={deliveriesState.acceptingId}
        onRefresh={deliveriesState.refresh}
        onAccept={deliveriesState.accept}
      />
    ) : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "delivery-detail") {
    content = session ? (
      <DeliveryDetailPage
        route={route}
        deliveries={deliveriesState.deliveries}
        acceptingId={deliveriesState.acceptingId}
        onAccept={deliveriesState.accept}
      />
    ) : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "active") {
    content = session ? (
      <ActivePage deliveries={deliveriesState.deliveries} />
    ) : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "profile") {
    content = session ? (
      <ProfilePage session={session.profile} />
    ) : <RequireSession session={session?.profile || null} />;
  }

  return (
    <AppShell
      appName="Agent Hub"
      strapline="Delivery rider workspace"
      navItems={navigation}
      currentPath={route.path}
      session={session}
      onLogout={() => {
        logout();
        window.location.href = "/";
      }}
    >
      {content}
    </AppShell>
  );
}

