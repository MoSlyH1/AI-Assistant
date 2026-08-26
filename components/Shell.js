'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Assistant', ico: '◈' },
  { href: '/tasks', label: 'Tasks', ico: '✓' },
  { href: '/notes', label: 'Notes', ico: '▤' },
  { href: '/schedule', label: 'Schedule', ico: '▦' },
  { href: '/clock', label: 'Clock', ico: '◷' },
];

export default function Shell({ tz, children }) {
  const path = usePathname();
  const isActive = (href) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="shell">
      <nav className="side">
        <div className="brand"><span className="brand-dot" />Nimbus</div>
        <div className="brand-sub">Personal operations</div>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`navlink${isActive(n.href) ? ' on' : ''}`}>
            <span className="ico">{n.ico}</span>{n.label}
          </Link>
        ))}
        <div className="side-foot">
          <div className="who">{tz}</div>
        </div>
      </nav>

      <main className="main">{children}</main>

      <nav className="tabbar">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''}>
            <span className="ico">{n.ico}</span>{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
