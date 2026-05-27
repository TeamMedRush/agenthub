import { useAsset } from "@assets";
import type { AuthSession, User } from "@interfaces/app";
import { ComponentChildren } from "preact";

interface NavItem {
  label: string;
  href: string;
}

interface AppShellProps {
  appName: string;
  strapline: string;
  navItems: NavItem[];
  currentPath: string;
  session: AuthSession<User> | null;
  onLogout: () => void;
  children: ComponentChildren;
}

function isActivePath(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AppShell({
  appName,
  strapline,
  navItems,
  currentPath,
  session,
  onLogout,
  children,
}: AppShellProps) {
  const logo = useAsset("logo.png");

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <img className="app-shell__logo" src={logo} alt="MedRush logo" />
          <div>
            <p className="app-shell__eyebrow">MedRush</p>
            <h1 className="app-shell__title">{appName}</h1>
            <p className="app-shell__strapline">{strapline}</p>
          </div>
        </div>

        <div className="app-shell__session">
          {session ? (
            <>
              <div className="app-shell__profile">
                <span className="app-shell__profile-label">Signed in as</span>
                <strong>{session.profile.name}</strong>
                <span>{session.profile.email}</span>
              </div>
              <button
                className="app-shell__ghost-button"
                type="button"
                onClick={onLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <div className="app-shell__profile">
              <span className="app-shell__profile-label">Guest mode</span>
              <strong>Explore the MedRush workspace</strong>
              <span>Sign in to unlock live app actions.</span>
            </div>
          )}
        </div>
      </header>

      <nav className="app-shell__nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <a
            key={item.href}
            className={`app-shell__nav-link${isActivePath(currentPath, item.href) ? " app-shell__nav-link--active" : ""}`}
            href={item.href}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <main className="app-shell__main">
        {children}
      </main>
    </div>
  );
}
