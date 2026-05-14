import { LogOut } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { clearAuthTokens } from '../../config/api';

interface TopNavProps {
  /** Optional right-side slot — usually a primary CTA like "+ New Dashboard". */
  right?: React.ReactNode;
}

const NAV_ITEMS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/',          label: 'Dashboards', end: true },
  { to: '/templates', label: 'Templates' },
  { to: '/resources', label: 'Resources' },
  { to: '/new',       label: '✨ Generate' },
];

/**
 * Shared header with brand wordmark + nav links. Mounted on every engineer-
 * facing page so jumping between sections is one click.
 */
export default function TopNav({ right }: TopNavProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuthTokens();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topnav">
      <div className="topnav__left">
        <Link to="/" className="topnav__brand" aria-label="Home">BobTheBuilder</Link>
        <nav className="topnav__links" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `topnav__link${isActive ? ' topnav__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="topnav__right">
        {right}
        <button className="btn-topbar" onClick={handleLogout} title="Sign out" type="button">
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
