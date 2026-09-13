import { useNavigate } from 'react-router-dom';

const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400&auto=format&fit=crop';

export function MovieCard({ title, progressPct, locked }) {
  const navigate = useNavigate();
  if (!title) return null;
  return (
    <div className="card" style={{ position: 'relative' }} onClick={() => navigate(`/title/${title.id}`)}>
      {locked && <div className="lock-badge">🔒 VIP</div>}
      <img src={title.poster_url || FALLBACK_POSTER} alt={title.name} loading="lazy" />
      {progressPct != null && (
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
      )}
      <div className="card-body">
        <div className="card-title">{title.name}</div>
        <div className="card-meta">
          <span>{title.release_year || '—'}</span>
          <span>&middot;</span>
          <span className="rating-pill">★ {title.rating_avg ? title.rating_avg.toFixed(1) : '—'}</span>
        </div>
      </div>
    </div>
  );
}

export default function ContentRail({ title, items, loading, emptyText, renderExtra }) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="section-title">{title}</span>
      </div>
      {loading && <div className="spinner" />}
      {!loading && items.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{emptyText}</div>}
      {!loading && items.length > 0 && (
        <div className="rail">
          {items.map((item, i) => (renderExtra ? renderExtra(item, i) : <MovieCard key={item.id} title={item} />))}
        </div>
      )}
    </section>
  );
}
