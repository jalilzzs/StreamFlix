import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { fetchTitles } from '../lib/api';
import './SearchBar.css';

const GENRES = ['Action', 'Drama', 'Sci-Fi', 'Comedy', 'Horror', 'Romance', 'Documentary'];
const YEARS = Array.from({ length: 8 }, (_, i) => 2026 - i);

export default function SearchBar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async () => {
    if (!query && !genre && !year && !minRating) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchTitles({
        search: query || undefined,
        genre: genre || undefined,
        year: year ? Number(year) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
        limit: 8,
      });
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, genre, year, minRating]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSearch, 300);
    return () => clearTimeout(debounceRef.current);
  }, [runSearch]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowFilters(false);
        setResults([]);
      }
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search-box">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder={t('search_placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="filter-toggle" onClick={() => setShowFilters((s) => !s)} aria-label="Filters">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      {showFilters && (
        <div className="filters-panel show">
          <div className="filter-group">
            <label>{t('filter_genre')}</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">{t('filter_all')}</option>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>{t('filter_year')}</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">{t('filter_all')}</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>{t('filter_rating')}</label>
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              <option value="">{t('filter_all')}</option>
              <option value="9">9+</option>
              <option value="8">8+</option>
              <option value="7">7+</option>
            </select>
          </div>
        </div>
      )}

      {(query || genre || year || minRating) && (
        <div className="search-results">
          {loading && <div className="search-result-loading"><div className="spinner" /></div>}
          {!loading && results.length === 0 && <div className="search-result-empty">{t('no_results')}</div>}
          {!loading && results.map((r) => (
            <div
              key={r.id}
              className="search-result-item"
              onClick={() => { navigate(`/title/${r.id}`); setResults([]); setQuery(''); }}
            >
              <img src={r.poster_url || 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=100&auto=format&fit=crop'} alt="" />
              <div>
                <div className="sr-title">{r.name}</div>
                <div className="sr-meta">{r.release_year} &middot; ★ {r.rating_avg?.toFixed(1) || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
