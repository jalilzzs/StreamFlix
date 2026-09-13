export default function StaticPage({ title, body }) {
  return (
    <div className="container" style={{ paddingTop: 50, paddingBottom: 60, maxWidth: 720 }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, marginBottom: 16 }}>{title}</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7 }}>{body}</p>
    </div>
  );
}
