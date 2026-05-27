import { type AgentRouteState, HomeView } from "@components/view/home-view";
import { useForwarded } from "@utils/path";

function resolveRoute(forwarded: string[]): AgentRouteState {
  const path = `/${forwarded.join("/")}`;

  if (forwarded.length === 0) {
    return { page: "home", path: "/" };
  }

  if (forwarded.length === 1) {
    const segment = forwarded[0];

    if (segment === "login") {
      return { page: "login", path };
    }

    if (segment === "register") {
      return { page: "register", path };
    }

    if (segment === "dashboard") {
      return { page: "dashboard", path };
    }

    if (segment === "deliveries") {
      return { page: "deliveries", path };
    }

    if (segment === "active") {
      return { page: "active", path };
    }

    if (segment === "profile") {
      return { page: "profile", path };
    }
  }

  if (forwarded.length === 2 && forwarded[0] === "deliveries") {
    return {
      page: "delivery-detail",
      path,
      deliveryId: forwarded[1],
    };
  }

  return { page: "not-found", path };
}

export function HomePage() {
  const forwarded = useForwarded();
  return <HomeView route={resolveRoute(forwarded)} />;
}

