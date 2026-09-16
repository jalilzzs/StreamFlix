import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import VideoPlayer from '../components/VideoPlayer';

export default function TitleDetail() {
  const { id } = useParams();

  const [title, setTitle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTitle() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('titles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        setTitle(data);
      } catch (error) {
        console.error('خطأ في جلب بيانات العمل:', error);
        setTitle(null);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchTitle();
    }
  }, [id]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#111',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl',
        }}
      >
        جاري التحميل...
      </div>
    );
  }

  if (!title) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#111',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl',
        }}
      >
        العمل غير موجود.
      </div>
    );
  }

  const tmdbId =
    title.tmdb_id ||
    title.tmdbId ||
    title.tmdb ||
    null;

  const type =
    title.type === 'series' ||
    title.type === 'tv'
      ? 'tv'
      : 'movie';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111',
        color: '#fff',
        padding: '20px',
        direction: 'rtl',
      }}
    >
      <h1
        style={{
          fontSize: '24px',
          marginBottom: '15px',
          textAlign: 'center',
        }}
      >
        {title.name || title.title || 'بدون عنوان'}
      </h1>

      <div
        style={{
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
          background: '#000',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        }}
      >
        <VideoPlayer
          tmdbId={tmdbId}
          type={type}
          title={title}
        />
      </div>

      <div
        style={{
          maxWidth: '900px',
          margin: '20px auto',
          background: '#1a1a1a',
          padding: '15px',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {title.is_premium && (
            <span
              style={{
                background: '#e50914',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              بريميوم ⭐
            </span>
          )}

          <span
            style={{
              background: '#333',
              color: '#fff',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            {type === 'tv' ? 'مسلسل' : 'فيلم'}
          </span>
        </div>

        <p
          style={{
            color: '#ccc',
            lineHeight: '1.7',
            marginBottom: '15px',
          }}
        >
          {title.synopsis ||
            title.description ||
            'لا يوجد وصف متاح.'}
        </p>

        <div
          style={{
            fontSize: '14px',
            color: '#888',
            display: 'flex',
            gap: '15px',
            flexWrap: 'wrap',
          }}
        >
          {title.release_year && (
            <span>
              سنة الإصدار: {title.release_year}
            </span>
          )}

          <span>
            التقييم: ⭐{' '}
            {Number(title.rating_avg || 0).toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
