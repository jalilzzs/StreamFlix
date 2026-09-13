import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import ContentRail, { MovieCard } from '../components/ContentRail';
import { fetchTitles, fetchContinueWatching } from '../lib/api';
import './Home.css';

export default function Home() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [featured, setFeatured] = useState(null);
  const [trending, setTrending] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingContinue, setLoadingContinue] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const titles = await fetchTitles({ limit: 12 });
        setTrending(titles);
        setFeatured(titles[0] || null);
        setRecommended([...titles].reverse());
      } catch (err) {
        console.error(err);
        setError(t('error_generic'));
      } finally {
        setLoadingTrending(false);
      }
    })();
  }, [t]);

  useEffect(() => {
    if (!user) {
      setLoadingContinue(false);
      return;
    }
    (async () => {
      try {
        const data = await fetchContinueWatching(user.id);
        setContinueWatching(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingContinue(false);
      }
    })();
  }, [user]);

  return (
    <div>
      {error && <div className="container"><div className="error-banner">{error}</div></div>}

      <section
        className="hero"
        style={{
          '--hero-image': `url('${featured?.poster_url || 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1600&auto=format&fit=crop'}')`,
        }}
      >
        <div className="hero-content">
          {featured ? (
            <>
              <div className="hero-eyebrow">Featured</div>
              <h1 className="hero-title">{featured.name}</h1>
              <p className="hero-desc">{featured.synopsis || 'Synopsis coming soon.'}</p>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={() => navigate(`/title/${featured.id}`)}>▶ {t('play')}</button>
                <button className="btn btn-ghost" onClick={() => navigate(`/title/${featured.id}`)}>＋ {t('my_list_add')}</button>
              </div>
            </>
          ) : (
            <>
              <div className="hero-eyebrow">StreamFlix</div>
              <h1 className="hero-title">Your titles will appear here</h1>
              <p className="hero-desc">Once you add rows to the Supabase "titles" table, they'll show up across this page automatically.</p>
            </>
          )}
        </div>
      </section>

      {user && (
        <ContentRail
          title={t('continue_watching')}
          loading={loadingContinue}
          items={continueWatching}
          emptyText="Nothing in progress yet — start watching something!"
          renderExtra={(row) => {
            const ep = row.episodes;
            const ti = ep?.titles;
            if (!ti) return null;
            const pct = ep?.duration_seconds ? Math.min(100, (row.progress_seconds / ep.duration_seconds) * 100) : 0;
            return <MovieCard key={ep.id} title={ti} progressPct={pct} />;
          }}
        />
      )}

      <ContentRail title={t('trending_now')} loading={loadingTrending} items={trending} emptyText="No titles yet — add some in Supabase." />
      <ContentRail title={t('recommended')} loading={loadingTrending} items={recommended} emptyText="No titles yet." />
    </div>
  );
}
