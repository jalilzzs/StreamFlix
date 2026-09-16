import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from './SearchBar';
import Notifications from './Notifications';
import './Navbar.css';

export default function Navbar() {
  const { t } = useI18n();
  const { user, profile, isPremium } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const links = [
    { to: '/', label: t('nav_home') },
    { to: '/movies', label: t('nav_movies') },
    { to: '/series', label: t('nav_series') },
    { to: '/subscription', label: t('nav_subscription') },
    { to: '/support', label: t('nav_support') },
  ];

  return (
    <>
      <nav className="navbar">
        <button
          className={`hamburger ${drawerOpen ? 'open' : ''}`}
          aria-label="Menu"
          onClick={() => setDrawerOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <Link to="/" className="brand">
          <em>Stream</em>Flix
        </Link>

        <div className="nav-links">
          {links.map((l) => (
            <Link key={l.to} to={l.to}>
              {l.label}
            </Link>
          ))}
        </div>

        <SearchBar />

        <div className="nav-right">
          <Link
            to="/friends"
            className="icon-btn"
            title={t('nav_friends')}
            aria-label={t('nav_friends')}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </Link>

          <button
            className="icon-btn"
            onClick={() => navigate('/settings')}
            title={t('settings_title')}
            aria-label={t('settings_title')}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {user && <Notifications />}

          <button
            className={`avatar ${isPremium ? 'vip' : ''}`}
            onClick={() => navigate('/settings')}
            title={profile?.display_name || 'Profile'}
            aria-label="Profile"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
              />
            ) : (
              (
                profile?.display_name ||
                user?.email ||
                '?'
              )
                .slice(0, 2)
                .toUpperCase()
            )}
          </button>
        </div>
      </nav>

      <div className="filmstrip" />

      <div
        className={`drawer-backdrop ${
          drawerOpen ? 'show' : ''
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      <div
        className={`drawer ${
          drawerOpen ? 'show' : ''
        }`}
      >
        <button
          className="drawer-close"
          onClick={() => setDrawerOpen(false)}
        >
          &times;
        </button>

        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => setDrawerOpen(false)}
          >
            {l.label}
          </Link>
        ))}

        <Link
          to="/friends"
          onClick={() => setDrawerOpen(false)}
        >
          {t('nav_friends')}
        </Link>

        <Link
          to="/settings"
          onClick={() => setDrawerOpen(false)}
        >
          {t('settings_title')}
        </Link>
      </div>
    </>
  );
}
