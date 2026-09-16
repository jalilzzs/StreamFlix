import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { useI18n } from './contexts/I18nContext';

import WatchParty from './pages/WatchParty';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import Notifications from './components/Notifications';

// Pages
import Home from './pages/Home';
import Browse from './pages/Browse';
import TitleDetail from './pages/TitleDetail';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import Friends from './pages/Friends';
import StaticPage from './pages/StaticPage';
import Import from './pages/Import';
import Admin from './pages/Admin';

export default function App() {
  const { t } = useI18n();
  const location = useLocation();

  const [settings, setSettings] = useState({
    maintenance_mode: false,
    announcement_bar: '',
    diagnostics_enabled: false,
  });

  const [loading, setLoading] = useState(true);

  const [showMaintenance, setShowMaintenance] =
    useState(false);

  /*
   * تحويل أي قيمة جاية من Supabase إلى Boolean
   *
   * Admin.jsx يخزن maintenance_mode هكذا:
   * { enabled: true }
   *
   * لكن نخلي App يفهم أيضاً:
   * true
   * "true"
   * "false"
   * { enabled: false }
   */
  const parseBooleanSetting = (value) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          value,
          'enabled'
        )
      ) {
        return Boolean(value.enabled);
      }

      return false;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value
        .trim()
        .toLowerCase();

      if (
        normalized === 'true' ||
        normalized === '1' ||
        normalized === 'yes'
      ) {
        return true;
      }

      return false;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    return false;
  };

  /*
   * جلب إعدادات الموقع
   */
  useEffect(() => {
    let mounted = true;

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('*');

        if (error) {
          console.error(
            'فشل جلب إعدادات الموقع:',
            error
          );

          return;
        }

        if (!mounted) return;

        const config = {};

        (data || []).forEach((item) => {
          if (!item?.key) return;

          let value = item.value;

          /*
           * Supabase قد يرجع JSON كـ string
           * لذلك نحاول نفك JSON إذا كان String.
           */
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch {
              // نخليها String عادي
            }
          }

          if (item.key === 'maintenance_mode') {
            config.maintenance_mode =
              parseBooleanSetting(value);

            return;
          }

          if (
            item.key === 'diagnostics_enabled'
          ) {
            config.diagnostics_enabled =
              parseBooleanSetting(value);

            return;
          }

          if (item.key === 'announcement_bar') {
            config.announcement_bar =
              typeof value === 'string'
                ? value
                : '';

            return;
          }

          config[item.key] = value;
        });

        setSettings((prev) => ({
          ...prev,
          ...config,
        }));

        /*
         * إذا كانت الصيانة مفعلة:
         * نظهر الـPopup.
         *
         * Admin لا يتم تعطيله.
         */
        const maintenanceActive =
          Boolean(config.maintenance_mode);

        if (
          maintenanceActive &&
          !location.pathname.startsWith('/admin')
        ) {
          setShowMaintenance(true);
        } else {
          setShowMaintenance(false);
        }
      } catch (err) {
        console.error(
          'فشل جلب إعدادات الموقع:',
          err
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSettings();

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  /*
   * إذا دخل المستخدم Admin:
   * ما نظهروش Popup الصيانة فوق لوحة التحكم.
   */
  useEffect(() => {
    if (
      location.pathname.startsWith('/admin')
    ) {
      setShowMaintenance(false);
      return;
    }

    if (settings.maintenance_mode) {
      setShowMaintenance(true);
    }
  }, [
    location.pathname,
    settings.maintenance_mode,
  ]);

  const isAdminRoute =
    location.pathname.startsWith('/admin');

  return (
    <ErrorBoundary>
      {/* =========================
          ANNOUNCEMENT BAR
      ========================== */}
      {settings.announcement_bar &&
        settings.announcement_bar.trim() !== '' && (
          <div
            style={{
              background: '#e50914',
              color: '#fff',
              textAlign: 'center',
              padding: '10px 15px',
              fontWeight: 'bold',
              fontSize: '14px',
              position: 'relative',
              zIndex: 9999,
            }}
          >
            📢 {settings.announcement_bar}
          </div>
        )}

      {/* =========================
          NAVBAR
      ========================== */}
      <Navbar />

      {/* =========================
          ROUTES
      ========================== */}
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/movies"
          element={<Browse type="movie" />}
        />

        <Route
          path="/series"
          element={<Browse type="series" />}
        />

        <Route
          path="/title/:id"
          element={<TitleDetail />}
        />

        <Route
          path="/subscription"
          element={<Subscription />}
        />

        <Route
          path="/friends"
          element={<Friends />}
        />

        <Route
          path="/settings"
          element={<Settings />}
        />

        <Route
          path="/support"
          element={
            <StaticPage
              title={t('nav_support')}
              body={t('empty_support')}
            />
          }
        />

        <Route
          path="/privacy"
          element={
            <StaticPage
              title={t('settings_privacy')}
              body={t('empty_privacy')}
            />
          }
        />

        <Route
          path="/about"
          element={
            <StaticPage
              title={t('settings_about')}
              body={t('empty_about')}
            />
          }
        />

        <Route
          path="/import"
          element={<Import />}
        />

        <Route
          path="/admin"
          element={<Admin />}
        />

        <Route
          path="/watch-party/:id"
          element={<WatchParty />}
        />

        <Route
          path="*"
          element={
            <StaticPage
              title="404"
              body="Page not found."
            />
          }
        />
      </Routes>

      {/* =========================
          FOOTER
      ========================== */}
      <Footer />

      {/* =========================
          NOTIFICATIONS
      ========================== */}
      <Notifications />

      {/* =========================
          MAINTENANCE POPUP
      ========================== */}
      {showMaintenance && !isAdminRoute && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background:
              'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter:
              'blur(8px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background:
                'linear-gradient(145deg,#111827,#0b0f19)',
              border:
                '1px solid rgba(228,200,138,0.25)',
              borderRadius: '22px',
              padding: '30px 24px',
              textAlign: 'center',
              color: '#fff',
              boxShadow:
                '0 30px 100px rgba(0,0,0,.65), 0 0 50px rgba(228,200,138,.08)',
              animation:
                'sfMaintenancePop .3s ease-out',
            }}
          >
            <div
              style={{
                width: '70px',
                height: '70px',
                margin: '0 auto 18px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '34px',
                background:
                  'linear-gradient(135deg,#e4c88a,#b79a5e)',
                color: '#18140b',
                boxShadow:
                  '0 12px 35px rgba(228,200,138,.22)',
              }}
            >
              🛠️
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '6px 12px',
                marginBottom: '13px',
                borderRadius: '999px',
                background:
                  'rgba(228,200,138,.08)',
                border:
                  '1px solid rgba(228,200,138,.2)',
                color: '#e4c88a',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '.5px',
              }}
            >
              ● MAINTENANCE MODE
            </div>

            <h2
              style={{
                margin: '0 0 10px',
                fontSize: '25px',
                fontWeight: 800,
              }}
            >
              الموقع في صيانة مؤقتة
            </h2>

            <p
              style={{
                margin: '0 auto',
                maxWidth: '370px',
                color: '#9ca3af',
                fontSize: '14px',
                lineHeight: 1.7,
              }}
            >
              نقوم حالياً ببعض التحديثات
              والتحسينات على StreamFlix.
              يمكنك الاستمرار في استعمال الموقع،
              وقد تكون بعض الميزات مؤقتاً غير
              متاحة.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowMaintenance(false)
              }
              style={{
                marginTop: '22px',
                border: '1px solid rgba(228,200,138,.25)',
                borderRadius: '12px',
                padding: '11px 22px',
                background:
                  'rgba(228,200,138,.08)',
                color: '#e4c88a',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              فهمت، متابعة الموقع
            </button>
          </div>

          <style>
            {`
              @keyframes sfMaintenancePop {
                from {
                  opacity: 0;
                  transform: translateY(12px) scale(.97);
                }

                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            `}
          </style>
        </div>
      )}

      {/* =========================
          DIAGNOSTICS
      ========================== */}
      {settings.diagnostics_enabled ===
        true && (
        <div
          style={{
            position: 'fixed',
            bottom: '15px',
            left: '15px',
            background:
              'rgba(0, 0, 0, 0.85)',
            border:
              '1px solid #00ff00',
            color: '#00ff00',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            zIndex: 99999,
            fontFamily: 'monospace',
            direction: 'ltr',
          }}
        >
          <div>
            <strong>
              🟢 Diagnostics Active
            </strong>
          </div>

          <div>
            Path: {location.pathname}
          </div>

          <div>
            Maint:{' '}
            {String(
              settings.maintenance_mode
            )}
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
