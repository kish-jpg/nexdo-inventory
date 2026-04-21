'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/components/AuthProvider';
import ChatPanel from '@/app/components/ChatPanel';

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
);

const PackageIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const LaundryIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="12" cy="13" r="4"/>
    <line x1="8" y1="7" x2="8.01" y2="7"/>
    <line x1="11" y1="7" x2="13" y2="7"/>
  </svg>
);

const HskIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18"/>
    <path d="M5 21V7l7-4 7 4v14"/>
    <path d="M9 21v-8h6v8"/>
    <circle cx="12" cy="10" r="1.2" fill="currentColor" stroke="none"/>
  </svg>
);

const NexDoIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>
);

const ReportsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

const ProjectsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <path d="M8 12h8"/>
    <path d="M8 16h5"/>
  </svg>
);

const HotelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

// ─── Nav Items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',  href: '/',          Icon: DashboardIcon },
  { id: 'inventory', label: 'Inventory',  href: '/inventory', Icon: PackageIcon   },
  { id: 'projects',  label: 'Projects',   href: '/projects',  Icon: ProjectsIcon  },
  { id: 'laundry',   label: 'Laundry',    href: '/laundry',   Icon: LaundryIcon   },
  { id: 'hsk',       label: 'Housekeeping', href: '/hsk',     Icon: HskIcon       },
  { id: 'nexdo',     label: 'NexDo',      href: '/nexdo',     Icon: NexDoIcon     },
  { id: 'reports',   label: 'Reports',    href: '/reports',   Icon: ReportsIcon   },
];

// ─── AppShell Component ───────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, canSeeNexDo, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Hydrate theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('nexdo-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
    setMounted(true);
  }, []);

  // Apply theme to html element
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
    localStorage.setItem('nexdo-theme', theme);
  }, [theme, mounted]);

  // Don't show the shell on the login page
  if (pathname === '/login') return <>{children}</>;

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const sidebarWidth = collapsed ? 64 : 232;

  // Determine active nav
  const activePage = pathname === '/' ? 'dashboard'
    : pathname.startsWith('/projects') ? 'projects'
    : pathname.startsWith('/laundry')  ? 'laundry'
    : pathname.startsWith('/hsk')      ? 'hsk'
    : pathname.startsWith('/nexdo')    ? 'nexdo'
    : pathname.startsWith('/reports')  ? 'reports'
    : 'inventory';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside
        className="sidebar"
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      >
        {/* Logo */}
        <div className="sidebar-logo" style={{ justifyContent: collapsed ? 'center' : undefined }}>
          <div className="sidebar-logo-icon">
            <HotelIcon />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div className="sidebar-logo-text">NexDo</div>
              <div className="sidebar-logo-sub">Radisson RED</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.filter(({ id }) => id !== 'nexdo' || canSeeNexDo).map(({ id, label, href, Icon }) => (
            <Link
              key={id}
              href={href}
              className={`sidebar-nav-item${activePage === id ? ' active' : ''}`}
              style={{ justifyContent: collapsed ? 'center' : undefined }}
              aria-current={activePage === id ? 'page' : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon />
              {!collapsed && <span className="sidebar-nav-label">{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Footer: AI chat + theme toggle + logout */}
        <div className="sidebar-footer">
          {/* AI Chat toggle */}
          <button
            className="sidebar-nav-item"
            onClick={() => setChatOpen(o => !o)}
            aria-pressed={chatOpen}
            aria-label="Toggle Inventory AI Assistant"
            style={{
              justifyContent: collapsed ? 'center' : undefined,
              color: chatOpen ? 'var(--red)' : undefined,
              background: chatOpen ? 'var(--red-soft)' : undefined,
            }}
            title="Inventory AI Assistant"
          >
            <ChatIcon />
            {!collapsed && (
              <span className="sidebar-nav-label" style={{ fontSize: '12px' }}>
                AI Assistant
              </span>
            )}
            {!collapsed && chatOpen && (
              <span style={{
                marginLeft: 'auto',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--red)',
                flexShrink: 0,
              }} />
            )}
          </button>

          <button
            className="sidebar-nav-item"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ justifyContent: collapsed ? 'center' : undefined }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            {!collapsed && (
              <span className="sidebar-nav-label" style={{ fontSize: '12px' }}>
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            )}
          </button>
          {role && (
            <button
              className="sidebar-nav-item"
              onClick={logout}
              aria-label="Sign out"
              style={{ justifyContent: collapsed ? 'center' : undefined, color: 'var(--text-muted)' }}
              title="Sign out"
            >
              <LogoutIcon />
              {!collapsed && (
                <span className="sidebar-nav-label" style={{ fontSize: '12px' }}>
                  Sign Out
                </span>
              )}
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      {/* AI Chat Panel — floats over all pages */}
      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
