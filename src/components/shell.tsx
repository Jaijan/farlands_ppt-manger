import Link from "next/link";
import {
  LayoutDashboard,
  Files,
  Users,
  GitBranch,
  MessageSquare,
  Settings,
  ArrowUpRight,
  LockKeyhole,
} from "lucide-react";
import { Brand } from "./brand";
import { ActionForm } from "./action-form";
export function Shell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: { role: string; full_name: string; email: string };
}) {
  const admin = profile.role === "admin";
  const links = admin
    ? ([
        ["dashboard", "Overview", LayoutDashboard],
        ["submissions", "Submissions", Files],
        ["judges", "Judges", Users],
        ["assignments", "Assignments", GitBranch],
        ["feedback", "Feedback & delivery", MessageSquare],
        ["settings", "Event settings", Settings],
      ] as const)
    : ([
        ["dashboard", "My dashboard", LayoutDashboard],
        ["account", "My account", Settings],
      ] as const);
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <nav>
          <p className="nav-label">
            {admin ? "EVENT MANAGEMENT" : "JUDGING WORKSPACE"}
          </p>
          {links.map(([slug, label, Icon]) => (
            <Link key={slug} href={`/${profile.role}/${slug}`}>
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>
            <span className="avatar">{profile.full_name.slice(0, 1)}</span>
            {profile.full_name}
          </p>
          <p className="muted" style={{ fontSize: 11 }}>
            {admin ? "Event administrator" : "FARLANDS judge"}
          </p>
          <ActionForm endpoint="/api/auth" action="logout">
            <button className="secondary">Sign out</button>
          </ActionForm>
        </div>
      </aside>
      <div>
        <header className="topbar">
          <span>
            Workspace <span style={{ margin: "0 12px" }}> / </span>{" "}
            {admin ? "Administration" : "Presentation review"}
          </span>
          <span className="private-badge">
            <LockKeyhole
              size={11}
              style={{ display: "inline", marginRight: 6 }}
            />
            Private & secure
          </span>
          <Link href="/submit">
            Submission portal{" "}
            <ArrowUpRight size={12} style={{ display: "inline" }} />
          </Link>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
