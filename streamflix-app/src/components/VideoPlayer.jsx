import { useState } from 'react';

export default function VideoPlayer({ tmdbId, type = 'movie', title }) {
  const [selectedServer, setSelectedServer] = useState(0); // 0 = سيرفر 1, 1 = سيرفر 2

  const realTmdb = tmdbId || title?.tmdb_id || title?.tmdbId;
  const contentType = type === 'series' || title?.type === 'series' ? 'tv' : 'movie';

  // 1. سيرفر 1 (الرئيسي)
  const server1Url = contentType === 'movie' 
    ? `https://vidsrc.me/embed/movie?tmdb=${realTmdb}`
    : `https://vidsrc.me/embed/tv?tmdb=${realTmdb}&season=1&episode=1`;

  // 2. سيرفر 2 (سيرفر 4 السابق)
  const server2Url = contentType === 'movie'
    ? `https://vidsrc.cc/v2/embed/movie/${realTmdb}`
    : `https://vidsrc.cc/v2/embed/tv/${realTmdb}/1/1`;

  const servers = [
    { id: 0, name: 'سيرفر 1', url: server1Url },
    { id: 1, name: 'سيرفر 2', url: server2Url }
  ];

  const currentServerObj = servers[selectedServer];

  return (
    <div style={{ width: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden', color: '#fff', direction: 'rtl' }}>
      
      {/* مشغل الفيديو الشاشة الكاملة */}
      <div style={{ position: 'relative', width: '100%', minHeight: '400px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <iframe
          key={selectedServer}
          src={currentServerObj.url}
          style={{ width: '100%', height: '420px', border: 'none', background: '#000' }}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          title="Video Player"
        />
      </div>

      {/* شريط اختيار السيرفرات فقط */}
      <div style={{ padding: '12px 15px', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: '#aaa' }}>السيرفرات:</span>
        {servers.map((srv) => (
          <button
            key={srv.id}
            onClick={() => setSelectedServer(srv.id)}
            style={{
              padding: '7px 18px',
              background: selectedServer === srv.id ? '#e50914' : '#222',
              color: '#fff',
              border: '1px solid ' + (selectedServer === srv.id ? '#e50914' : '#444'),
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            {srv.name}
          </button>
        ))}
      </div>

    </div>
  );
}
