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

  // الحالات الأساسية (State)
  const [featured, setFeatured] = useState(null);
  const [trending, setTrending] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  
  // حالات الكتالوج الكامل والصفحات (Pagination)
  const [catalog, setCatalog] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // حالات التحميل
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingContinue, setLoadingContinue] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState(null);

  const ITEMS_PER_PAGE = 24; // عدد العناوين في الصفحة الواحدة

  // 1. جلب بيانات التريند والأعمال المميزة
  useEffect(() => {
    (async () => {
      try {
        const titles = await fetchTitles({ limit: 15 });
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

  // 2. جلب بيانات "متابعة المشاهدة" للمستخدم المسجل
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

  // 3. جلب جميع عناوين المكتبة مقسمة على صفحات (Pagination)
  useEffect(() => {
    (async () => {
      setLoadingCatalog(true);
      try {
        const res = await fetchTitles({ limit: ITEMS_PER_PAGE, page: currentPage });
        
        if (Array.isArray(res)) {
          setCatalog(res);
          // استخراج العدد الإجمالي من الخصائص المرفقة بالمصفوفة
          setTotalCount(res.count || res.length);
        } else if (res?.data) {
          setCatalog(res.data);
          setTotalCount(res.count || res.data.length);
        }
      } catch (err) {
        console.error('خطأ في جلب الكتالوج:', err);
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  return (
    <div className="home-page" style={{ direction: 'rtl' }}>
      {error && <div className="container"><div className="error-banner">{error}</div></div>}

      {/* --- الهيدر السينمائي (Hero Banner) --- */}
      <section
        className="hero"
        style={{
          '--hero-image': `url('${featured?.poster_url || featured?.poster_path || 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1600&auto=format&fit=crop'}')`,
        }}
      >
        <div className="hero-content">
          {featured ? (
            <>
              <div className="hero-eyebrow">🔥 الأكثر شعبية اليوم</div>
              <h1 className="hero-title">{featured.name || featured.title}</h1>
              <p className="hero-desc">{featured.synopsis || featured.description || 'لا يوجد وصف متاح لهذا العمل حالياً.'}</p>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={() => navigate(`/title/${featured.id}`)}>
                   {t('play')}
                </button>
                <button className="btn btn-ghost" onClick={() => navigate(`/title/${featured.id}`)}>
                  ＋ {t('my_list_add')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="hero-eyebrow">StreamFlix</div>
              <h1 className="hero-title">أهلاً بك في منصتك السينمائية</h1>
              <p className="hero-desc">استمتع بمشاهدة أحدث الأفلام والمسلسلات بجودة عالية.</p>
            </>
          )}
        </div>
      </section>

      {/* --- شريط متابعة المشاهدة (Continue Watching) --- */}
      {user && (
        <ContentRail
          title={t('continue_watching')}
          loading={loadingContinue}
          items={continueWatching}
          emptyText="لا توجد أعمال قيد المشاهدة حالياً."
          renderExtra={(row) => {
            const ep = row.episodes;
            const ti = ep?.titles;
            if (!ti) return null;
            const pct = ep?.duration_seconds ? Math.min(100, (row.progress_seconds / ep.duration_seconds) * 100) : 0;
            return <MovieCard key={ep.id} title={ti} progressPct={pct} />;
          }}
        />
      )}

      {/* --- شريط الأكثر تداولاً (Trending Now) --- */}
      <ContentRail 
        title={t('trending_now')} 
        loading={loadingTrending} 
        items={trending} 
        emptyText="لا توجد عناوين متاحة." 
      />

      {/* --- شريط المقترحات (Recommended) --- */}
      <ContentRail 
        title={t('recommended')} 
        loading={loadingTrending} 
        items={recommended} 
        emptyText="لا توجد مقترحات." 
      />

      {/* --- شبكة الكتالوج الشامل لجميع العناوين مع الصفحات --- */}
      <section className="catalog-section" style={{ padding: '30px 4%', background: '#0d0d0d', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
          <h2 style={{ fontSize: '20px', margin: 0, color: '#fff', fontWeight: 'bold' }}>
            🎬 المكتبة الشاملة ({totalCount})
          </h2>
          <span style={{ fontSize: '13px', color: '#888' }}>
            الصفحة {currentPage} من {totalPages}
          </span>
        </div>

        {loadingCatalog ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: '#888' }}>
            ⏳ جاري تحميل الكتالوج...
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '16px',
              marginBottom: '30px'
            }}>
              {catalog.map((item) => (
                <MovieCard key={item.id} title={item} />
              ))}
            </div>

            {/* أزرار التنقل بين الصفحات (Pagination Controls) */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '30px 0' }}>
              <button
                onClick={() => {
                  setCurrentPage(1);
                  window.scrollTo({ top: 600, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                style={navBtnStyle(currentPage === 1)}
              >
                « الأولى
              </button>

              <button
                onClick={() => {
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                  window.scrollTo({ top: 600, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                style={navBtnStyle(currentPage === 1)}
              >
                السابق
              </button>

              <span style={{ color: '#fff', fontSize: '14px', padding: '0 10px', fontWeight: 'bold' }}>
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => {
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                  window.scrollTo({ top: 600, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                style={navBtnStyle(currentPage === totalPages)}
              >
                التالي
              </button>

              <button
                onClick={() => {
                  setCurrentPage(totalPages);
                  window.scrollTo({ top: 600, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                style={navBtnStyle(currentPage === totalPages)}
              >
                الأخيرة »
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// تنسيق أزرار الترقيم
const navBtnStyle = (disabled) => ({
  padding: '8px 16px',
  borderRadius: '6px',
  border: '1px solid #333',
  background: disabled ? '#181818' : '#e50914',
  color: disabled ? '#555' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '13px',
  fontWeight: 'bold',
  transition: 'all 0.2s ease'
});
