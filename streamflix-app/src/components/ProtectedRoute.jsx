import { useAuth } from '../contexts/AuthContext';

// Wraps features that need a signed-in user (friends, chat, watchlist actions).
// Rather than redirecting away, we show an inline sign-in prompt so the rest
// of the app (browsing, previews) stays public.
export default function ProtectedRoute({ children }) {
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="empty-state">
        <h2>Sign in required</h2>
        <p style={{ marginBottom: 18 }}>Sign in to continue.</p>
        <button className="btn btn-primary" onClick={signInWithGoogle}>Sign in with Google</button>
      </div>
    );
  }

  return children;
}
