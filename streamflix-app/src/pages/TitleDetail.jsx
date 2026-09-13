import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import VideoPlayer from '../components/VideoPlayer';
import { MovieCard } from '../components/ContentRail';
import {
  fetchTitleById, fetchEpisodes, fetchRecommendations, rateTitle, getUserRating,
  addToWatchlist, removeFromWatchlist, isInWatchlist, saveProgress, fetchWatchedEpisodeIds,
  createWatchParty,
} from '../lib/api';
import './TitleDetail.css';

export default function TitleDetail() {
  const { id } = useParams();
  const { user, isPremium } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [titleData, setTitleData] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [activeSeason, setActiveSeason] = useState(1);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [watchedIds, setWatchedIds] = useState(new Set());
  const [recommendations, setRecommendations] = useState([]);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchTitleById(id);
        if (cancelled) return;
        setTitleData(data);

        const eps = await fetchEpisodes(id);
        if (cancelled) return;
        setEpisodes(eps);
        if (eps.length) {
          setActiveSeason(eps[0].season);
          setActiveEpisode(eps[0]);
        }

        const recs = await fetchRecommendations(data.genres, id);
        if (!cancelled) setRecommendations(recs);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(t('error_generic'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, t]);

  useEffect(() => {
    if (!user || !titleData) return;
    isInWatchlist(user.id, titleData.id).then(setInWatchlist).catch(console.error);
    getUserRating(user.id, titleData.id).then(setUserRating).catch(console.error);
    fetchWatchedEpisodeIds(user.id, titleData.id).then(setWatchedIds).catch(console.error);
  }, [user, titleData]);

  const seasons = useMemo(() => [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b), [episodes]);
  const seasonEpisodes = useMemo(() => episodes.filter((e) => e.season === activeSeason), [episodes, activeSeason]);

  const handleToggleWatchlist = useCallback(async () => {
    if (!user) return navigate('/settings');
    setBusy(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(user.id, titleData.id);
        setInWatchlist(false);
      } else {
        await addToWatchlist(user.id, titleData.id);
        setInWatchlist(true);
      }
    } catch (err) {
      console.error(err);
      setError(t('error_generic'));
    } finally {
      setBusy(false);
    }
  }, [user, inWatchlist, titleData, navigate, t]);

  const handleRate = useCallback(async (score) => {
    if (!user) return navigate('/settings');
    setUserRating(score);
    try {
      const avg = await rateTitle(user.id, titleData.id, score);
      setTitleData((prev) => ({ ...prev, rating_avg: avg }));
    } catch (err) {
      console.error(err);
      setError(t('error_generic'));
    }
  }, [user, titleData, navigate, t]);

  const handleProgress = useCallback((currentTime, duration) => {
    if (!user || !activeEpisode) return;
    const completed = duration > 0 && currentTime / duration > 0.92;
    saveProgress(user.id, activeEpisode.id, currentTime, completed).catch(console.error);
    if (completed) setWatchedIds((prev) => new Set(prev).add(activeEpisode.id));
  }, [user, activeEpisode]);

  const handleStartWatchParty = useCallback(async () => {
    if (!user) return navigate('/settings');
    try {
      await createWatchParty({ hostId: user.id, titleId: titleData.id, episodeId: activeEpisode?.id });
      alert('Watch Party created. Invite a friend from the Friends page to sync playback.');
    } catch (err) {
      console.error(err);
      setError(t('error_generic'));
    }
  }, [user, titleData, activeEpisode, navigate, t]);

  if (loading) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (error && !titleData) return <div className="container"><div className="error-banner">{error}</div></div>;
  if (!titleData) return <div className="empty-state"><h2>{t('no_results')}</h2></div>;

  const isSeries = titleData.type === 'series';
  const isLockedForUser = titleData.is_premium && !isPremium;

  return (
    <div>
      <section
        className="title-hero"
        style={{ '--hero-image': `url('${titleData.poster_url || ''}')` }}
      >
        <div className="title-flex">
          <div className="poster"><img src={titleData.poster_url || ''} alt={titleData.name} /></div>
          <div className="title-info">
            <h1 className="title-name">{titleData.name}</h1>
            <div className="meta-row">
              <span className="rating-badge">★ {titleData.rating_avg ? titleData.rating_avg.toFixed(1) : '—'}</span>
              <span>{titleData.release_year}</span>
              {isSeries && <span>{seasons.length} {t('seasons')}</span>}
              {titleData.is_premium && <span className="genre-tag" style={{ color: 'var(--gold)', borderColor: 'var(--gold-dim)' }}>🔒 {t('vip_only')}</span>}
            </div>
            <div className="genre-tags">
              {(titleData.genres || []).map((g) => <span key={g} className="genre-tag">{g}</span>)}
            </div>
            <p className="synopsis">{titleData.synopsis || 'No synopsis yet.'}</p>
            <div className="action-row">
              <button className="btn btn-primary" disabled={isLockedForUser}>▶ {t('play')}</button>
              <button className="btn btn-ghost active" disabled={busy} onClick={handleToggleWatchlist}>
                {inWatchlist ? `✓ ${t('my_list_added')}` : `＋ ${t('my_list_add')}`}
              </button>
              <button className="btn btn-ghost icon-only" title={t('download')}>⬇</button>
              <button className="btn btn-ghost icon-only" title={t('watch_party')} onClick={handleStartWatchParty}>👥</button>
              <div className="user-rate">
                <span className="rate-label">{t('your_rating')}</span>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <span key={v} className={`star ${v <= userRating ? 'filled' : ''}`} onClick={() => handleRate(v)}>★</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="main-grid">
        <div className="player-col">
          <div className="ad-slot-top">AD SLOT — 728×60 banner (above player)</div>

          {isLockedForUser ? (
            <div className="player-container">
              <div className="player-placeholder">
                <div className="play-icon">🔒</div>
                This title requires VIP. <a href="/subscription" style={{ color: 'var(--gold)' }}>Upgrade</a> to watch.
              </div>
            </div>
          ) : (
            <VideoPlayer episode={activeEpisode} onProgress={handleProgress} />
          )}

          <div className="ad-slot-bottom">AD SLOT — timer-based ad / native banner (below player)</div>

          {isSeries && (
            <div className="episodes-block">
              <div className="tabs">
                {seasons.map((s) => (
                  <button key={s} className={`tab ${activeSeason === s ? 'active' : ''}`} onClick={() => setActiveSeason(s)}>
                    Season {s}
                  </button>
                ))}
              </div>
              <div className="episode-list">
                {seasonEpisodes.length === 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: 13, padding: '10px 0' }}>No episodes added yet.</div>
                )}
                {seasonEpisodes.map((ep) => (
                  <div key={ep.id} className="episode-row" onClick={() => setActiveEpisode(ep)}>
                    <div className="episode-num">{ep.episode_number}</div>
                    <div className="episode-info">
                      <div className="episode-title">{ep.name || `Episode ${ep.episode_number}`}</div>
                      <div className="episode-duration">
                        {ep.duration_seconds ? `${Math.round(ep.duration_seconds / 60)} min` : '—'}
                      </div>
                    </div>
                    <div className={`watched-check ${watchedIds.has(ep.id) ? 'done' : ''}`}>
                      {watchedIds.has(ep.id) ? '✓' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div className="ad-slot-side">AD SLOT<br />300×250<br />sidebar unit</div>
          <div className="side-card">
            <h4>{t('details')}</h4>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>
              Type: {titleData.type}<br />
              Added: {new Date(titleData.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-title">{t('recommended')}</div>
        <div className="rail">
          {recommendations.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No similar titles yet.</div>}
          {recommendations.map((r) => (
            <MovieCard key={r.id} title={r} locked={r.is_premium && !isPremium} />
          ))}
        </div>
      </section>
    </div>
  );
}
