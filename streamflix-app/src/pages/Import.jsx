import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '2026';
const TMDB_API_KEY = 'bb04576f643a69128d4924c5aea7c339';

export default function Admin() {
  const navigate = useNavigate();
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('import'); // import, fix, settings, users, content

  // حالات العام والرسائل
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  // حالات البحث والاستيراد
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStats, setBulkStats] = useState(null);

  // حالات الإصلاح والروابط
  const [fillLoading, setFillLoading] = useState(false);
  const [fillStats, setFillStats] = useState(null);
  const [fixLoading, setFixLoading] = useState(false);

  // حالات الإعدادات والمستخدمين والمحتوى
  const [settings, setSettings] = useState({
    diagnosticsEnabled: false,
    maintenanceMode: false,
    announcementBar: '',
  });
  const [users, setUsers] = useState([]);
  const [titles, setTitles] = useState([]);

  // دالة توليد رابط Stelar المضمّن تلقائياً بناءً على tmdb_id والنوع
  const getStelarUrl = (tmdbId, type = 'movie') => {
    if (!tmdbId) return '';
    const isTv = type === 'series' || type === 'tv';
    return isTv
      ? `https://stelar.rip/embed/tv/${tmdbId}/1/1`
      : `https://stelar.rip/embed/movie/${tmdbId}`;
  };

  // التحقق من رمز PIN
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsAuthenticated(true);
      setMessage('');
      fetchData();
    } else {
      setMessage('❌ رمز الـ PIN غير صحيح!');
    }
  };

  // جلب البيانات من Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. إعدادات الموقع
      const { data: settingsData } = await supabase.from('site_settings').select('*');
      if (settingsData) {
        const obj = {};
        settingsData.forEach(item => { obj[item.key] = item.value; });
        setSettings({
          diagnosticsEnabled: obj.diagnostics_enabled === 'true',
          maintenanceMode: obj.maintenance_mode === 'true',
          announcementBar: obj.announcement_bar || '',
        });
      }

      // 2. المستخدمين
      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (usersData) setUsers(usersData);

      // 3. المحتوى
      const { data: titlesData } = await supabase.from('titles').select('id, name, type, is_hidden, url, tmdb_id').order('id', { ascending: false }).limit(60);
      if (titlesData) setTitles(titlesData);

    } catch (err) {
      console.error('فشل جلب البيانات:', err);
    } finally {
      setLoading(false);
    }
  };

  // ------------------ 1. البحث والاستيراد الفردي والجماعي ------------------
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setMessage('');
    setSearchResults([]);

    try {
      const movieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ar-AR`;
      const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ar-AR`;

      const [movieRes, tvRes] = await Promise.all([fetch(movieUrl), fetch(tvUrl)]);
      const movieData = await movieRes.json();
      const tvData = await tvRes.json();

      const combined = [
        ...(movieData.results || []).map(i => ({ ...i, media_type: 'movie' })),
        ...(tvData.results || []).map(i => ({ ...i, media_type: 'tv' }))
      ].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

      setSearchResults(combined.slice(0, 30));
      if (combined.length === 0) setMessage('لم يتم العثور على أي نتائج.');
    } catch (err) {
      setMessage(`خطأ في البحث: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSingle = async (item) => {
    setMessage('');
    try {
      const isTv = item.media_type === 'tv';
      const year = (item.release_date || item.first_air_date || '').split('-')[0];

      const titleData = {
        name: item.title || item.name || 'بدون اسم',
        synopsis: item.overview || 'لا يوجد وصف.',
        release_year: year ? parseInt(year) : 2026,
        rating_avg: Number(item.vote_average) || 0,
        type: isTv ? 'series' : 'movie',
        is_premium: false,
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
        url: getStelarUrl(item.id, item.media_type),
        tmdb_id: item.id.toString()
      };

      const { data: existing } = await supabase.from('titles').select('id').eq('tmdb_id', titleData.tmdb_id).maybeSingle();
      if (existing) {
        setMessage(`"${titleData.name}" موجود مسبقاً!`);
        return;
      }

      const { error } = await supabase.from('titles').insert([titleData]);
      if (error) throw error;

      setMessage(`تم استيراد "${titleData.name}" بنجاح وربطه بـ Stelar ✅`);
      fetchData();
    } catch (err) {
      setMessage(`خطأ الاستيراد: ${err.message}`);
    }
  };

  const handleBulkImport = async () => {
    if (bulkLoading) return;
    setBulkLoading(true);
    setMessage('');
    setBulkStats({ total: 0, added: 0, existing: 0, failed: 0 });

    try {
      const [mRes, tRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=ar-AR&page=1`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=ar-AR&page=1`).then(r => r.json())
      ]);

      const items = [
        ...(mRes.results || []).map(i => ({ ...i, media_type: 'movie' })),
        ...(tRes.results || []).map(i => ({ ...i, media_type: 'tv' }))
      ].slice(0, 40);

      const { data: existingRows } = await supabase.from('titles').select('tmdb_id');
      const existingSet = new Set((existingRows || []).map(r => r.tmdb_id?.toString()));

      let added = 0, existingCount = 0, failed = 0;

      for (const item of items) {
        if (existingSet.has(item.id.toString())) {
          existingCount++;
        } else {
          const isTv = item.media_type === 'tv';
          const year = (item.release_date || item.first_air_date || '').split('-')[0];

          const payload = {
            name: item.title || item.name || 'بدون اسم',
            synopsis: item.overview || 'لا يوجد وصف.',
            release_year: year ? parseInt(year) : 2026,
            rating_avg: Number(item.vote_average) || 0,
            type: isTv ? 'series' : 'movie',
            poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
            url: getStelarUrl(item.id, item.media_type),
            tmdb_id: item.id.toString()
          };

          const { error } = await supabase.from('titles').insert([payload]);
          if (!error) {
            added++;
            existingSet.add(item.id.toString());
          } else {
            failed++;
          }
        }
        setBulkStats({ total: items.length, added, existing: existingCount, failed });
      }

      setMessage(`اكتمل الاستيراد الجماعي! تم إضافة: ${added} | موجود: ${existingCount} | أخطاء: ${failed}`);
      fetchData();
    } catch (err) {
      setMessage(`فشل الاستيراد الجماعي: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // ------------------ 2. إصلاح TMDB ID المفقود + ملء الروابط الفارغة ------------------
  const handleAutoFixMissingTmdbIds = async () => {
    if (fixLoading) return;
    setFixLoading(true);
    setMessage('');

    try {
      const { data: nullTitles, error: fetchError } = await supabase
        .from('titles')
        .select('id, name, type')
        .is('tmdb_id', null);

      if (fetchError) throw fetchError;
      const rows = nullTitles || [];

      if (rows.length === 0) {
        setMessage('جميع العناوين تحتوي على tmdb_id مسبقاً! لا يوجد شيء لإصلاحه.');
        setFixLoading(false);
        return;
      }

      let fixed = 0, failed = 0;

      for (const row of rows) {
        try {
          if (!row.name) continue;
          const mediaType = (row.type === 'series' || row.type === 'tv') ? 'tv' : 'movie';
          const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(row.name)}&language=ar-AR`;

          const res = await fetch(searchUrl);
          const data = await res.json();

          if (data.results && data.results.length > 0) {
            const bestMatch = data.results[0];
            const foundTmdbId = bestMatch.id.toString();
            const stelarUrl = getStelarUrl(foundTmdbId, row.type);

            const { error: updateError } = await supabase
              .from('titles')
              .update({ tmdb_id: foundTmdbId, url: stelarUrl })
              .eq('id', row.id);

            if (!updateError) fixed++;
            else failed++;
          } else {
            failed++;
          }
        } catch (err) {
          failed++;
        }
      }

      setMessage(`🎉 تم ربط ${fixed} عنصر بـ TMDB وتوليد روابط Stelar بنجاح! | تعذر العثور: ${failed}`);
      fetchData();
    } catch (err) {
      setMessage(`حدث خطأ أثناء الإصلاح: ${err.message}`);
    } finally {
      setFixLoading(false);
    }
  };

  const handleFillEmptyUrls = async () => {
    if (fillLoading) return;
    setFillLoading(true);
    setMessage('');

    try {
      const { data: emptyTitles, error: fetchError } = await supabase
        .from('titles')
        .select('id, name, tmdb_id, type, url')
        .or('url.is.null,url.eq.');

      if (fetchError) throw fetchError;
      const rows = emptyTitles || [];
      let filled = 0, skipped = 0;

      for (const row of rows) {
        if (!row.tmdb_id) {
          skipped++;
          continue;
        }

        const generatedUrl = getStelarUrl(row.tmdb_id, row.type);
        const { error: updateError } = await supabase
          .from('titles')
          .update({ url: generatedUrl })
          .eq('id', row.id);

        if (!updateError) filled++;
      }

      if (skipped > 0 && filled === 0) {
        setMessage(`⚠️ تم تخطي ${skipped} عنصر لأن tmdb_id فارغ! استخدم زر "الإصلاح التلقائي" أولاً.`);
      } else {
        setMessage(`تم ملء الروابط بـ Stelar بنجاح! تم التعديل: ${filled} | تم تخطي: ${skipped}`);
      }
      fetchData();
    } catch (err) {
      setMessage(`فشل ملء الروابط: ${err.message}`);
    } finally {
      setFillLoading(false);
    }
  };

  // ------------------ 3. الإعدادات، المستخدمين والمحتوى ------------------
  const toggleSetting = async (key, currentValue) => {
    const newValue = (!currentValue).toString();
    try {
      await supabase.from('site_settings').upsert({ key, value: newValue });
      setSettings(prev => ({ ...prev, [key === 'diagnostics_enabled' ? 'diagnosticsEnabled' : 'maintenanceMode']: !currentValue }));
      setMessage('تم التحديث بنجاح ✅');
    } catch (err) {
      setMessage(`خطأ: ${err.message}`);
    }
  };

  const saveAnnouncement = async () => {
    try {
      await supabase.from('site_settings').upsert({ key: 'announcement_bar', value: settings.announcementBar });
      setMessage('تم حفظ الشريط الإعلاني ✅');
    } catch (err) {
      setMessage(`خطأ: ${err.message}`);
    }
  };

  const toggleUserBan = async (userId, isBanned) => {
    try {
      await supabase.from('profiles').update({ is_banned: !isBanned }).eq('id', userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: !isBanned } : u));
      setMessage(`تم ${!isBanned ? 'حظر' : 'إلغاء حظر'} المستخدم بنجاح 🔒`);
    } catch (err) {
      setMessage(`خطأ: ${err.message}`);
    }
  };

  const toggleTitleVisibility = async (titleId, isHidden) => {
    try {
      await supabase.from('titles').update({ is_hidden: !isHidden }).eq('id', titleId);
      setTitles(titles.map(t => t.id === titleId ? { ...t, is_hidden: !isHidden } : t));
      setMessage(`تم ${!isHidden ? 'إخفاء' : 'إظهار'} العنوان بنجاح 👁️`);
    } catch (err) {
      setMessage(`خطأ: ${err.message}`);
    }
  };

  // ================= شاشة قفل الـ PIN =================
  if (!isAuthenticated) {
    return (
      <div style={{ background: '#0d0d0d', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', direction: 'rtl' }}>
        <form onSubmit={handlePinSubmit} style={{ background: '#181818', padding: '30px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center', width: '100%', maxWidth: '360px' }}>
          <h2 style={{ fontSize: '22px', marginBottom: '10px', color: '#e50914' }}>🔒 لوحة الإدارة العامة</h2>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>أدخل رمز الـ PIN المكون من 4 أرقام</p>
          <input
            type="password"
            maxLength={6}
            placeholder="****"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', textAlign: 'center', fontSize: '20px', letterSpacing: '5px', marginBottom: '15px', outline: 'none' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            تأكيد الدخول
          </button>
          {message && <p style={{ color: '#ff5555', marginTop: '15px', fontSize: '14px' }}>{message}</p>}
        </form>
      </div>
    );
  }

  // ================= الواجهة الرئيسية اللوحة =================
  return (
    <div style={{ background: '#0d0d0d', color: '#fff', minHeight: '100vh', padding: '25px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* الهيدر وزر الخروج */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
          <h1 style={{ color: '#e50914', fontSize: '24px', margin: 0 }}>⚙️ لوحة تحكم StreamFlix</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/')} style={{ background: '#222', color: '#fff', border: '1px solid #333', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>🏠 الرئيسية</button>
            <button onClick={() => setIsAuthenticated(false)} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>🔒 قفل اللوحة</button>
          </div>
        </div>

        {/* أزرار التنقل بين التبويبات */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
          {[
            { id: 'import', label: '🚀 الاستيراد من TMDB' },
            { id: 'fix', label: '🪄 إصلاح TMDB وملء Stelar' },
            { id: 'settings', label: '🛠️ إعدادات الموقع والتشخيص' },
            { id: 'users', label: '👥 حظر المستخدمين' },
            { id: 'content', label: '🎬 إخفاء وإظهار المحتوى' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMessage(''); }}
              style={{
                padding: '10px 18px',
                background: activeTab === tab.id ? '#e50914' : '#181818',
                color: '#fff',
                border: '1px solid #282828',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* تنبيهات الحالة */}
        {message && (
          <div style={{ background: message.includes('خطأ') || message.includes('⚠️') ? '#331818' : '#18331e', color: message.includes('خطأ') || message.includes('⚠️') ? '#ff7777' : '#77ff94', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #444', textAlign: 'center', fontWeight: 'bold' }}>
            {message}
          </div>
        )}

        {/* 1. تبويب الاستيراد من TMDB */}
        {activeTab === 'import' && (
          <div>
            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>🚀 استيراد جماعي (أعلى 40 فيلم ومسلسل)</h3>
              <button onClick={handleBulkImport} disabled={bulkLoading} style={{ padding: '12px 30px', background: bulkLoading ? '#555' : '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: bulkLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {bulkLoading ? '⏳ جاري الاستيراد...' : '🚀 تنفيذ الاستيراد الجماعي'}
              </button>
              {bulkStats && (
                <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-around', background: '#222', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
                  <span>📦 الإجمالي: {bulkStats.total}</span>
                  <span style={{ color: '#4caf50' }}>✅ مضاف: {bulkStats.added}</span>
                  <span style={{ color: '#ffc107' }}>♻️ مكرر: {bulkStats.existing}</span>
                </div>
              )}
            </div>

            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', marginBottom: '20px' }}>
              <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>🔎 البحث الفردي والاستيراد المباشر</h3>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <input type="text" placeholder="اسم الفيلم أو المسلسل..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, maxWidth: '500px', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', outline: 'none' }} />
                <button type="submit" style={{ padding: '12px 24px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {loading ? 'جاري البحث...' : 'بحث'}
                </button>
              </form>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
              {searchResults.map(item => (
                <div key={`${item.media_type}-${item.id}`} style={{ background: '#181818', padding: '10px', borderRadius: '8px', border: '1px solid #282828', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {item.poster_path ? <img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} alt="" style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '6px' }} /> : <div style={{ height: '220px', background: '#222', borderRadius: '6px' }} />}
                  <h4 style={{ fontSize: '14px', margin: '10px 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.name}</h4>
                  <button onClick={() => handleImportSingle(item)} style={{ padding: '8px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                    📥 استيراد وربط بـ Stelar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. تبويب الإصلاح التلقائي وملء الروابط */}
        {activeTab === 'fix' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
              <h3 style={{ color: '#3498db', margin: '0 0 10px 0' }}>🪄 إصلاح العناوين المفقودة (Auto-Fix NULL TMDB IDs)</h3>
              <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
                يقوم بالبحث التلقائي في TMDB عن طريق الأسماء المخزنة، واستخراج الرقم وتخزينه مع رابط Stelar.
              </p>
              <button onClick={handleAutoFixMissingTmdbIds} disabled={fixLoading} style={{ padding: '12px 25px', background: fixLoading ? '#555' : '#0066cc', color: '#fff', border: 'none', borderRadius: '8px', cursor: fixLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {fixLoading ? '⏳ جاري البحث والربط في TMDB...' : '🪄 ابدأ الإصلاح التلقائي الآن'}
              </button>
            </div>

            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
              <h3 style={{ color: '#9b59b6', margin: '0 0 10px 0' }}>🔗 ملء الروابط الفارغة بـ Stelar</h3>
              <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
                إنشاء رابط Stelar المباشر لكل فيلم يحتوي على tmdb_id ولكن خانة الرابط لديه فارغة.
              </p>
              <button onClick={handleFillEmptyUrls} disabled={fillLoading} style={{ padding: '12px 25px', background: fillLoading ? '#555' : '#8e44ad', color: '#fff', border: 'none', borderRadius: '8px', cursor: fillLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {fillLoading ? '⏳ جاري التحديث...' : '🔗 ملء جميع الروابط بـ Stelar'}
              </button>
            </div>
          </div>
        )}

        {/* 3. تبويب إعدادات الموقع والتشخيص */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>🖥️ شاشة التشخيص (Diagnostics)</h3>
                <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>تفعيل إظهار تفاصيل الأخطاء والـ API على الشاشة للمطور.</p>
              </div>
              <button onClick={() => toggleSetting('diagnostics_enabled', settings.diagnosticsEnabled)} style={{ padding: '10px 20px', background: settings.diagnosticsEnabled ? '#28a745' : '#444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {settings.diagnosticsEnabled ? 'مفعلة ✅' : 'معطلة ❌'}
              </button>
            </div>

            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>🚧 وضع الصيانة (Maintenance Mode)</h3>
                <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>إغلاق الموقع وتوجيه الزوار لشاشة الصيانة.</p>
              </div>
              <button onClick={() => toggleSetting('maintenance_mode', settings.maintenanceMode)} style={{ padding: '10px 20px', background: settings.maintenanceMode ? '#d9534f' : '#444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {settings.maintenanceMode ? 'مفعل 🚨' : 'معطل 🟢'}
              </button>
            </div>

            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>📢 الشريط الإعلاني العلوي</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="اكتب النص الإعلاني..." value={settings.announcementBar} onChange={(e) => setSettings({ ...settings, announcementBar: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', outline: 'none' }} />
                <button onClick={saveAnnouncement} style={{ padding: '10px 20px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ</button>
              </div>
            </div>
          </div>
        )}

        {/* 4. تبويب إدارة وحظر المستخدمين */}
        {activeTab === 'users' && (
          <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>قائمة الأعضاء المسجلين</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {users.map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{u.email || u.username || 'مستخدم بدون إيميل'}</div>
                    <div style={{ fontSize: '11px', color: '#777' }}>ID: {u.id}</div>
                  </div>
                  <button onClick={() => toggleUserBan(u.id, u.is_banned)} style={{ padding: '6px 14px', background: u.is_banned ? '#28a745' : '#d9534f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    {u.is_banned ? 'فك الحظر 🔓' : 'حظر المستخدم 🚫'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. تبويب إخفاء وإظهار المحتوى */}
        {activeTab === 'content' && (
          <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>إدارة رؤية الأفلام والمسلسلات</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {titles.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                    <span style={{ fontSize: '12px', color: '#888', marginRight: '8px' }}>({item.type === 'series' ? 'مسلسل' : 'فيلم'})</span>
                  </div>
                  <button onClick={() => toggleTitleVisibility(item.id, item.is_hidden)} style={{ padding: '6px 14px', background: item.is_hidden ? '#28a745' : '#ff9800', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    {item.is_hidden ? 'إظهار 👁️' : 'إخفاء 🙈'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
