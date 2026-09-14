import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// مفتاح TMDB (استبدله بالمفتاح الخاص بك إذا كان مختلفاً)
const TMDB_API_KEY = '826b5838634812328768a35607b22a01'; 
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export default function Import() {
  // حالة البحث الفردي
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('movie'); // 'movie' or 'tv'
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // حالة الاستيراد الجماعي و Trending
  const [pageCount, setPageCount] = useState(5); // عدد الصفحات (كل صفحة 20 عنصر)
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  // إضافة نص للسجل
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [`[${time}] ${msg}`, ...prev]);
  };

  // -------------------------------------------------------------
  // 1. البحث الفردي (Single Search)
  // -------------------------------------------------------------
  const handleSingleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    addLog(`🔍 جاري البحث الفردي عن: "${searchQuery}" (${searchType === 'movie' ? 'فيلم' : 'مسلسل'})...`);

    try {
      // إذا كان البحث عبارة عن رقم TMDB ID مباشر
      if (!isNaN(searchQuery)) {
        const res = await fetch(`${TMDB_BASE_URL}/${searchType}/${searchQuery}?api_key=${TMDB_API_KEY}&language=ar-SA`);
        if (res.ok) {
          const item = await res.json();
          setSearchResults([item]);
          addLog(`✅ تم العثور على العمل بواسطة المعرف ID: ${item.title || item.name}`);
        } else {
          addLog(`❌ لم يتم العثور على عمل بهذا الـ ID`);
        }
      } else {
        // البحث بالاسم
        const res = await fetch(`${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}&language=ar-SA`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          setSearchResults(data.results);
          addLog(`✅ تم العثور على ${data.results.length} نتيجة`);
        } else {
          addLog(`⚠️ لم يتم العثور على نتائج لهذا البحث`);
        }
      }
    } catch (err) {
      addLog(`❌ خطأ أثناء البحث: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // استيراد عمل فردي واحد
  const importSingleItem = async (item) => {
    try {
      addLog(`⏳ جاري استيراد: ${item.title || item.name}...`);
      
      const formattedItem = {
        tmdb_id: item.id,
        title: item.title || item.name || 'بدون عنوان',
        type: searchType,
        synopsis: item.overview || 'لا يوجد وصف متاح.',
        poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop_path: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        release_year: item.release_date ? parseInt(item.release_date.split('-')[0]) : item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : new Date().getFullYear(),
        rating_avg: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 0,
        is_premium: false
      };

      const { error } = await supabase
        .from('titles')
        .upsert([formattedItem], { onConflict: 'tmdb_id' });

      if (error) {
        addLog(`❌ خطأ في حفظ ${formattedItem.title}: ${error.message}`);
      } else {
        addLog(`🎉 تم استيراد/تحديث "${formattedItem.title}" بنجاح!`);
      }
    } catch (err) {
      addLog(`❌ خطأ غير متوقع: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // 2. دالة مساعدة لتشغيل استيراد الصفحات الجماعية
  // -------------------------------------------------------------
  const fetchAndImportPages = async (endpointBuilder, categoryName) => {
    setIsBulkLoading(true);
    addLog(`🚀 بدء استيراد ${categoryName} عبر ${pageCount} صفحة/صفحات...`);
    let totalImported = 0;

    try {
      for (let p = 1; p <= pageCount; p++) {
        addLog(`📥 جاري جلب الصفحة ${p} من ${pageCount}...`);
        
        // جلب الأفلام
        const movieRes = await fetch(endpointBuilder('movie', p));
        const movieData = await movieRes.json();
        
        // جلب المسلسلات
        const tvRes = await fetch(endpointBuilder('tv', p));
        const tvData = await tvRes.json();

        const moviesList = movieData.results || [];
        const tvList = tvData.results || [];

        // تنسيق العناصر
        const itemsToInsert = [
          ...moviesList.map(m => ({
            tmdb_id: m.id,
            title: m.title || 'بدون عنوان',
            type: 'movie',
            synopsis: m.overview || 'لا يوجد وصف.',
            poster_path: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
            backdrop_path: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
            release_year: m.release_date ? parseInt(m.release_date.split('-')[0]) : new Date().getFullYear(),
            rating_avg: m.vote_average ? parseFloat(m.vote_average.toFixed(1)) : 0,
            is_premium: false
          })),
          ...tvList.map(t => ({
            tmdb_id: t.id,
            title: t.name || 'بدون عنوان',
            type: 'series',
            synopsis: t.overview || 'لا يوجد وصف.',
            poster_path: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : null,
            backdrop_path: t.backdrop_path ? `https://image.tmdb.org/t/p/w1280${t.backdrop_path}` : null,
            release_year: t.first_air_date ? parseInt(t.first_air_date.split('-')[0]) : new Date().getFullYear(),
            rating_avg: t.vote_average ? parseFloat(t.vote_average.toFixed(1)) : 0,
            is_premium: false
          }))
        ];

        if (itemsToInsert.length > 0) {
          // إدخال أو تحديث البيانات في Supabase
          const { error } = await supabase
            .from('titles')
            .upsert(itemsToInsert, { onConflict: 'tmdb_id' });

          if (error) {
            addLog(`❌ خطأ أثناء حفظ الصفحة ${p}: ${error.message}`);
          } else {
            totalImported += itemsToInsert.length;
            addLog(`✅ تم حفظ الصفحة ${p} بنجاح (${itemsToInsert.length} عنصر). المجموع الحالي: ${totalImported}`);
          }
        }
      }

      addLog(`✨ اكتملت العملية! تم استيراد/تحديث إجمالي ${totalImported} من الأفلام والمسلسلات بنجاح.`);
    } catch (err) {
      addLog(`❌ حدث خطأ أثناء الاستيراد الجماعي: ${err.message}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  // 3. الاستيراد الجماعي الشامل (Popular)
  const handleBulkPopularImport = () => {
    fetchAndImportPages(
      (type, page) => `${TMDB_BASE_URL}/${type === 'movie' ? 'movie' : 'tv'}/popular?api_key=${TMDB_API_KEY}&language=ar-SA&page=${page}`,
      'الأعمال الشائعة (Popular Movies & Series)'
    );
  };

  // 4. استيراد الأعمال الأكثر تداولاً (Trending)
  const handleTrendingImport = () => {
    fetchAndImportPages(
      (type, page) => `${TMDB_BASE_URL}/trending/${type === 'movie' ? 'movie' : 'tv'}/week?api_key=${TMDB_API_KEY}&language=ar-SA&page=${page}`,
      'الأعمال الأكثر تداولاً (Trending Movies & Series)'
    );
  };

  // -------------------------------------------------------------
  // 5. زر إصلاح روابط الـ URL
  // -------------------------------------------------------------
  const handleFixUrls = async () => {
    setIsBulkLoading(true);
    addLog('🛠️ جاري فحص وإصلاح روابط الـ URL والعناوين في قاعدة البيانات...');
    try {
      const { data, error } = await supabase.from('titles').select('*');
      if (error) throw error;

      addLog(`📊 تم العثور على ${data.length} سجل في قاعدة البيانات.`);
      let fixedCount = 0;

      for (const item of data) {
        // التأكد من ضبط أنواع الميديا بشكل سليم
        let correctType = item.type;
        if (item.type === 'tv') correctType = 'series';

        if (correctType !== item.type) {
          await supabase.from('titles').update({ type: correctType }).eq('id', item.id);
          fixedCount++;
        }
      }

      addLog(`✅ تم إصلاح وتدقيق ${fixedCount} سجل بنجاح.`);
    } catch (err) {
      addLog(`❌ خطأ أثناء الإصلاح: ${err.message}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', color: '#fff', direction: 'rtl', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '25px', color: '#e50914' }}>🎬 لوحة استيراد الأفلام والمسلسلات (TMDB)</h1>

      {/* --- قسم البحث والاستيراد الفردي --- */}
      <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #333' }}>
        <h3 style={{ marginTop: 0, color: '#46d369' }}>🔍 البحث والاستيراد الفردي</h3>
        <form onSubmit={handleSingleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="أدخل اسم الفيلم/المسلسل أو رقم TMDB ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: '220px', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff' }}
          />
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff' }}
          >
            <option value="movie">فيلم (Movie)</option>
            <option value="tv">مسلسل (TV Series)</option>
          </select>
          <button
            type="submit"
            disabled={isSearching}
            style={{ padding: '10px 20px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isSearching ? 'جاري البحث...' : 'بحث'}
          </button>
        </form>

        {/* نتائج البحث الفردي */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
            {searchResults.map((item) => (
              <div key={item.id} style={{ background: '#252525', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                <img
                  src={item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://via.placeholder.com/200x300?text=No+Poster'}
                  alt={item.title || item.name}
                  style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '4px', marginBottom: '8px' }}
                />
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', height: '36px', overflow: 'hidden' }}>
                  {item.title || item.name}
                </div>
                <button
                  onClick={() => importSingleItem(item)}
                  style={{ width: '100%', padding: '6px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  ➕ استيراد هذا العمل
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- قسم الاستيراد الجماعي والأدوات --- */}
      <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #333' }}>
        <h3 style={{ marginTop: 0, color: '#007bff' }}>⚡ أدوات الاستيراد الجماعي والإصلاح</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '14px', color: '#ccc' }}>
            عدد الصفحات للاستيراد (كل صفحة تحتوي 20 فيلم + 20 مسلسل):
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value={pageCount}
            onChange={(e) => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: '80px', padding: '6px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff', textAlign: 'center' }}
          />
          <span style={{ fontSize: '12px', color: '#888' }}>
            (الإجمالي: {pageCount * 40} عمل تقريباً)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleBulkPopularImport}
            disabled={isBulkLoading}
            style={{ padding: '12px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            📦 استيراد جماعي (الأكثر شعبية)
          </button>

          <button
            onClick={handleTrendingImport}
            disabled={isBulkLoading}
            style={{ padding: '12px 20px', background: '#ff9900', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🔥 استيراد Trending (الأكثر تداولاً)
          </button>

          <button
            onClick={handleFixUrls}
            disabled={isBulkLoading}
            style={{ padding: '12px 20px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🛠️ إصلاح عناوين URL والبيانات
          </button>
        </div>
      </div>

      {/* --- قسم سجل العمليات (Logs) --- */}
      <div style={{ background: '#0a0a0a', padding: '15px', borderRadius: '8px', border: '1px solid #222' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0, color: '#aaa', fontFamily: 'monospace' }}>📋 سجل العمليات (Logs):</h4>
          <button
            onClick={() => setLogs([])}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
          >
            مسح السجل
          </button>
        </div>
        <div style={{ maxHeight: '250px', overflowY: 'auto', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #222', fontFamily: 'monospace', fontSize: '12px' }}>
          {logs.length === 0 ? (
            <span style={{ color: '#555' }}>لا توجد عمليات قائمة حالياً...</span>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} style={{ marginBottom: '4px', color: log.includes('❌') ? '#ff4d4d' : log.includes('✅') || log.includes('🎉') ? '#46d369' : '#ccc' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
