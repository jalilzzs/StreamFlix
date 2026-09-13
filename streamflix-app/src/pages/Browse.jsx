import { useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { MovieCard } from '../components/ContentRail';
import { fetchTitles } from '../lib/api';
import './Browse.css';

const GENRES = ['Action', 'Drama', 'Sci-Fi', 'Comedy', 'Horror', 'Romance', 'Documentary'];
const YEARS = Array.from({ length: 8 }, (_, i) => 2026 - i);

// type: 'movie' | 'series'
export default function Browse({ type }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTitles({
      type,
      genre: genre || undefined,
      year: year ? Number(year) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
      limit: 60,
    })
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { console.error(err); if (!cancelled) setError(t('error_generic')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type, genre, year, minRating, t]);

  return (
    <div className="container browse-page">
      <h1 className="browse-title">{type === 'movie' ? t('nav_movies') : t('nav_series')}</h1>

      <div className="browse-filters">
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">{t('filter_genre')}: {t('filter_all')}</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">{t('filter_year')}: {t('filter_all')}</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
          <option value="">{t('filter_rating')}: {t('filter_all')}</option>
          <option value="9">9+</option>
          <option value="8">8+</option>
          <option value="7">7+</option>
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="spinner" />}
      {!loading && items.length === 0 && (
        <div className="empty-state">
          <h2>{t('no_results')}</h2>
          <p>Add {type === 'movie' ? 'movies' : 'series'} to the Supabase "titles" table to see them here.</p>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="browse-grid">
          {items.map((item) => <MovieCard key={item.id} title={item} />)}
        </div>
      )}
    </div>
  );
}
