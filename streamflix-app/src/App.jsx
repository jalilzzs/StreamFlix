import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { useI18n } from './contexts/I18nContext';
import WatchParty from './pages/WatchParty';
// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';

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
    maintenance_mode: 'false',
    announcement_bar: '',
    diagnostics_enabled: 'false'
  });
  const [loading, setLoading] = useState(true);

  // جلب الإعدادات المباشرة من Supabase
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase.from('site_settings').select('*');
        if (data && !error) {
          const config = {};
          data.forEach(item => { config[item.key] = item.value; });
          setSettings(prev => ({ ...prev, ...config }));
        }
      } catch (err) {
        console.error('فشل جلب إعدادات الموقع:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [location.pathname]);

  // 🚨 1. وضع الصيانة (يُطبق على جميع الصفحات ويستثني صفحة /admin)
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isMaintenanceActive = settings.maintenance_mode === 'true' && !isAdminRoute;

  if (!loading && isMaintenanceActive) {
    return (
      <div style={{
        background: '#0d0d0d',
        color: '#fff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '20px',
        direction: 'rtl',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h1 style={{ fontSize: '36px', color: '#e50914', marginBottom: '10px' }}>🚧 الموقع في حالة صيانة مؤقتة</h1>
        <p style={{ color: '#aaa', fontSize: '18px', maxWidth: '500px', lineHeight: '1.6' }}>
          نحن نقوم بعمل بعض التحديثات والإصلاحات لتطوير الخدمة. سنعود للعمل قريباً جداً!
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* 📢 2. الشريط الإعلاني العلوي */}
      {settings.announcement_bar && settings.announcement_bar.trim() !== '' && (
        <div style={{
          background: '#e50914',
          color: '#fff',
          textAlign: 'center',
          padding: '10px 15px',
          fontWeight: 'bold',
          fontSize: '14px',
          position: 'relative',
          zIndex: 9999
        }}>
          📢 {settings.announcement_bar}
        </div>
      )}

      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Browse type="movie" />} />
        <Route path="/series" element={<Browse type="series" />} />
        <Route path="/title/:id" element={<TitleDetail />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/support" element={<StaticPage title={t('nav_support')} body={t('empty_support')} />} />
        <Route path="/privacy" element={<StaticPage title={t('settings_privacy')} body={t('empty_privacy')} />} />
        <Route path="/about" element={<StaticPage title={t('settings_about')} body={t('empty_about')} />} />
        <Route path="/import" element={<Import />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/watch-party/:id"element={<WatchParty />}/>
        <Route path="*" element={<StaticPage title="404" body="Page not found." />} />
      </Routes>

      <Footer />

      {/* 🛠️ 3. شاشة التشخيص السفليّة للمطور عند تفعيلها */}
      {settings.diagnostics_enabled === 'true' && (
        <div style={{
          position: 'fixed',
          bottom: '15px',
          left: '15px',
          background: 'rgba(0, 0, 0, 0.85)',
          border: '1px solid #00ff00',
          color: '#00ff00',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 99999,
          fontFamily: 'monospace',
          direction: 'ltr'
        }}>
          <div><strong>🟢 Diagnostics Active</strong></div>
          <div>Path: {location.pathname}</div>
          <div>Maint: {settings.maintenance_mode}</div>
        </div>
      )}
    </ErrorBoundary>
  );
}
