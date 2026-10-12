import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark">◈</span>
      <span>
        FARLANDS<small>VISHWAKARMA / REVIEW PORTAL</small>
      </span>
    </Link>
  );
}
export function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <nav>
        <Link href="/submit">Submit project</Link>
        <Link href="/judge/login" className="button secondary">
          Judge sign in ↗
        </Link>
      </nav>
    </header>
  );
}
