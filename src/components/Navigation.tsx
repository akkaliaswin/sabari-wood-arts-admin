'use16 client'; // Next 16 client directive (usually 'use client' is sufficient)
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: '📊' },
    { name: 'Clients', href: '/clients', icon: '👥' },
    { name: 'Projects', href: '/projects', icon: '🪵' },
    { name: 'Labourers', href: '/labourers', icon: '🪚' },
    { name: 'Reports', href: '/reports', icon: '📋' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="logo-container">
          <h2>Sabari Wood Arts</h2>
          <div className="logo-subtitle">Admin Panel</div>
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${isActive(item.href) ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
