import { Routes, Route } from 'react-router-dom';
import { useI18n } from './contexts/I18nContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Browse from './pages/Browse';
import TitleDetail from './pages/TitleDetail';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import Friends from './pages/Friends';
import StaticPage from './pages/StaticPage';

export default function App() {
  const { t } = useI18n();

  return (
    <ErrorBoundary>
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
        <Route path="*" element={<StaticPage title="404" body="Page not found." />} />
      </Routes>
      <Footer />
    </ErrorBoundary>
  );
}
