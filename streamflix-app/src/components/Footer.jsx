import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      padding: '30px 40px', borderTop: '1px solid var(--border)', display: 'flex',
      justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, color: 'var(--muted)', fontSize: 13,
    }}>
      <span>© 2026 StreamFlix</span>
      <span>
        <Link to="/privacy" style={{ color: 'var(--muted)' }}>Privacy &amp; Policy</Link>
        {' · '}
        <Link to="/settings" style={{ color: 'var(--muted)' }}>Settings</Link>
      </span>
    </footer>
  );
}
