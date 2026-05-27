import type { AuthSession, User } from "@interfaces/app";

interface AboutProps {
  session: AuthSession<User> | null;
}

const highlights = [
  {
    title: "Accept high-signal pickups",
    description: "Review pending medicine deliveries, item counts, payout estimates, and rider notes in one place.",
  },
  {
    title: "Work with backend reality",
    description: "Pickup pharmacy details and delivery progression are clearly marked when the backend has not exposed them yet.",
  },
  {
    title: "Stay productive offline",
    description: "Recent delivery data is cached locally so detail pages remain useful even without a dedicated detail endpoint.",
  },
];

export function About({ session }: AboutProps) {
  return (
    <section className="about">
      <div className="about__hero">
        <div className="about__copy">
          <p className="about__eyebrow">Delivery rider workspace</p>
          <h2>
            Dispatch, accept, and track medicine deliveries without leaving the MedRush flow.
          </h2>
          <p className="about__summary">
            Agent Hub is wired to the current MedRush backend contract. It gives riders a sharp dashboard now,
            while keeping missing server capabilities visible instead of hiding them behind fake states.
          </p>
        </div>

        <div className="about__actions">
          <a className="about__button about__button--primary" href={session ? "/dashboard" : "/login"}>
            {session ? "Open dashboard" : "Sign in"}
          </a>
          <a className="about__button about__button--secondary" href={session ? "/deliveries" : "/register"}>
            {session ? "Browse deliveries" : "Create rider account"}
          </a>
        </div>
      </div>

      <div className="about__grid">
        {highlights.map((highlight) => (
          <article className="about__card" key={highlight.title}>
            <h3>{highlight.title}</h3>
            <p>{highlight.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

