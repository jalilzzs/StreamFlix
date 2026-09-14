import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '2026';
const TMDB_API_KEY = 'bb04576f643a69128d4924c5aea7c339';

export default function Admin() {
  const navigate = useNavigate();
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

  // الرسائل والحالات
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  // الاستيراد الجماعي
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStats, setBulkStats] = useState({ total: 0, added: 0, existing: 0, failed: 0 });
  const [currentPage, setCurrentPage] = useState(1); // يتزايد تلقائياً مع كل ضغطة

  // البيانات من Supabase
  const [stats, setStats] = useState({ totalTitles: 0, totalUsers: 0, bannedUsers: 0, hiddenTitles: 0 });
  const [settings, setSettings] = useState({
    maintenance_mode: false,
    diagnostics_enabled: false,
    announcement_bar: '',
  });
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [titles, setTitles] = useState([]);
  const [titleSearch, setTitleSearch] = useState('');
  const [systemLogs, setSystemLogs] = useState([]);

  // رابط التشغيل الاستعراضي
  const getStelarUrl = (tmdbId, mediaType) => {
    return mediaType === 'tv'
      ? `https://vidsrc.me/embed/tv?tmdb=${tmdbId}`
      : `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsAuthenticated(true);
      setMessage({ text: '', type: '' });
      fetchData();
    } else {
      setMessage({ text: '❌ رمز الـ PIN غير صحيح!', type: 'error' });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: settingsData } = await supabase.from('site_settings').select('*');
      if (settingsData) {
        const config = {};
        settingsData.forEach(item => { config[item.key] = item.value; });
        setSettings({
          maintenance_mode: config.maintenance_mode === 'true',
          diagnostics_enabled: config.diagnostics_enabled === 'true',
          announcement_bar: config.announcement_bar || '',
        });
      }

      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (usersData) setUsers(usersData);

      const { data: titlesData } = await supabase.from('titles').select('*').order('id', { ascending: false }).limit(100);
      if (titlesData) setTitles(titlesData);

      setStats({
        totalTitles: titlesData ? titlesData.length : 0,
        totalUsers: usersData ? usersData.length : 0,
        bannedUsers: usersData ? usersData.filter(u => u.is_banned).length : 0,
        hiddenTitles: titlesData ? titlesData.filter(t => t.is_hidden).length : 0,
      });

      addLog('تم تحديث البيانات بنجاح');
    } catch (err) {
      console.error('فشل جلب البيانات:', err);
    } finally {
      setLoading(false);
    }
  };

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString('ar-DZ');
    setSystemLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 19)]);
  };

  // 🚀 زر الاستيراد الجماعي الذكي (ينتقل تلقائياً للدفعة التالية)
  const handleBulkImport = async () => {
    if (bulkLoading) return;
    setBulkLoading(true);
    setMessage({ text: '', type: '' });
    setBulkStats({ total: 0, added: 0, existing: 0, failed: 0 });

    try {
      addLog(`جاري جلب الصفحة رقم ${currentPage} من TMDB...`);

      // 1. جلب البيانات من الصفحة الحالية
      const [mRes, tRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=ar-AR&page=${currentPage}`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=ar-AR&page=${currentPage}`).then(r => r.json())
      ]);

      const items = [
        ...(mRes.results || []).map(i => ({ ...i, media_type: 'movie' })),
        ...(tRes.results || []).map(i => ({ ...i, media_type: 'tv' }))
      ];

      // 2. التحقق من الأفلام المخزنة مسبقاً
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

      setMessage({
        text: `🎉 اكتمل استيراد الصفحة ${currentPage}! تم إضافة: ${added} جديد | مكرر: ${existingCount}`,
        type: 'success'
      });

      // 3. زيادة رقم الصفحة تلقائياً للضغطة القادمة
      setCurrentPage(prev => prev + 1);
      fetchData();
    } catch (err) {
      setMessage({ text: `فشل الاستيراد الجماعي: ${err.message}`, type: 'error' });
    } finally {
      setBulkLoading(false);
    }
  };

  // باقي الوظائف
  const toggleSetting = async (key, currentValue) => {
    const newValue = (!currentValue).toString();
    try {
      await supabase.from('site_settings').upsert({ key, value: newValue });
      setSettings(prev => ({ ...prev, [key]: !currentValue }));
      setMessage({ text: 'تم تحديث الإعدادات بنجاح ✅', type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const saveAnnouncement = async () => {
    try {
      await supabase.from('site_settings').upsert({ key: 'announcement_bar', value: settings.announcement_bar });
      setMessage({ text: 'تم حفظ الشريط الإعلاني بنجاح ✅', type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const toggleUserBan = async (userId, isBanned) => {
    try {
      await supabase.from('profiles').update({ is_banned: !isBanned }).eq('id', userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: !isBanned } : u));
      setMessage({ text: `تم ${!isBanned ? 'حظر' : 'فك حظر'} المستخدم 🔒`, type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const toggleUserVIP = async (userId, isVip) => {
    try {
      await supabase.from('profiles').update({ is_vip: !isVip }).eq('id', userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_vip: !isVip } : u));
      setMessage({ text: `تم تغيير حالة VIP ⭐`, type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const toggleTitleVisibility = async (titleId, isHidden) => {
    try {
      await supabase.from('titles').update({ is_hidden: !isHidden }).eq('id', titleId);
      setTitles(titles.map(t => t.id === titleId ? { ...t, is_hidden: !isHidden } : t));
      setMessage({ text: 'تم تغيير رؤية العنصر 👁️', type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const deleteTitle = async (titleId, titleName) => {
    if (!window.confirm(`حذف "${titleName}"؟`)) return;
    try {
      await supabase.from('titles').delete().eq('id', titleId);
      setTitles(titles.filter(t => t.id !== titleId));
      setMessage({ text: 'تم الحذف بنجاح 🗑️', type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const filteredUsers = users.filter(u =>
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredTitles = titles.filter(t =>
    (t.name || '').toLowerCase().includes(titleSearch.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', direction: 'rtl' }}>
        <form onSubmit={handlePinSubmit} style={{ background: '#141414', padding: '35px', borderRadius: '16px', border: '1px solid #282828', textAlign: 'center', width: '100%', maxWidth: '380px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
          <h2 style={{ fontSize: '22px', marginBottom: '8px', color: '#e50914' }}>لوحة التحكم</h2>
          <input
            type="password"
            maxLength={6}
            placeholder="****"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', background: '#222', color: '#fff', textAlign: 'center', fontSize: '24px', letterSpacing: '6px', marginBottom: '20px' }}
          />
          <button type="submit" style={{ width: '100%', padding: '14px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>دخول</button>
          {message.text && <p style={{ color: '#ff4d4d', marginTop: '15px' }}>{message.text}</p>}
        </form>
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', padding: '25px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
          <h1 style={{ color: '#e50914', fontSize: '26px', margin: 0 }}>⚡ لوحة تحكم StreamFlix</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/import')} style={{ background: '#0066cc', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📥 الاستيراد الفردي</button>
            <button onClick={() => setIsAuthenticated(false)} style={{ background: '#222', color: '#fff', border: '1px solid #333', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer' }}>🔒 قفل</button>
          </div>
        </div>

        {/* 📦 قسم الاستيراد الجماعي السريع */}
        <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center', marginBottom: '25px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#28a745' }}>🚀 الاستيراد الجماعي الأوتوماتيكي</h3>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '15px' }}>
            اضغط على الزر لجلب 40 فيلم ومسلسل. كل ضغطة ستجلب تلقائياً <b>الصفحة التالية ({currentPage})</b> بدون تكرار!
          </p>
          <button
            onClick={handleBulkImport}
            disabled={bulkLoading}
            style={{
              padding: '12px 30px',
              background: bulkLoading ? '#555' : '#e50914',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: bulkLoading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '15px'
            }}
          >
            {bulkLoading ? `⏳ جاري جلب الصفحة ${currentPage}...` : `📥 استيراد الدفعة التالية (صفحة ${currentPage})`}
          </button>

          {bulkStats.total > 0 && (
            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '13px', background: '#0a0a0a', padding: '10px', borderRadius: '8px' }}>
              <span>إجمالي الدفعة: {bulkStats.total}</span>
              <span style={{ color: '#4caf50', fontWeight: 'bold' }}>✅ مضاف: {bulkStats.added}</span>
              <span style={{ color: '#ffc107' }}>♻️ مكرر: {bulkStats.existing}</span>
            </div>
          )}
        </div>

        {/* التبويبات الرئيسية */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
          {[
            { id: 'stats', label: '📊 الإحصائيات' },
            { id: 'settings', label: '📢 الصيانة والإعلانات' },
            { id: 'users', label: '👥 حظر الأعضاء' },
            { id: 'content', label: '🎬 المحتوى' },
            { id: 'logs', label: '📋 السجلات' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 18px',
                background: activeTab === tab.id ? '#e50914' : '#141414',
                color: '#fff',
                border: '1px solid #282828',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {message.text && (
          <div style={{ background: message.type === 'error' ? '#2a1212' : '#122a18', color: message.type === 'error' ? '#ff6b6b' : '#6bff8d', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
            {message.text}
          </div>
        )}

        {/* 1. الإحصائيات */}
        {activeTab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
              <div style={{ fontSize: '30px', fontWeight: 'bold', color: '#e50914' }}>{stats.totalTitles}</div>
              <div style={{ color: '#888', fontSize: '13px' }}>إجمالي العناوين</div>
            </div>
            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
              <div style={{ fontSize: '30px', fontWeight: 'bold', color: '#0066cc' }}>{stats.totalUsers}</div>
              <div style={{ color: '#888', fontSize: '13px' }}>المستخدمين</div>
            </div>
            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
              <div style={{ fontSize: '30px', fontWeight: 'bold', color: '#d9534f' }}>{stats.bannedUsers}</div>
              <div style={{ color: '#888', fontSize: '13px' }}>المحظورين</div>
            </div>
          </div>
        )}

        {/* 2. الإعدادات */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gap: '15px' }}>
            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', color: '#ff4d4d' }}>🚧 وضع الصيانة</h3>
                <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>توجيه كافة الزوار لشاشة الصيانة المغلقة.</p>
              </div>
              <button onClick={() => toggleSetting('maintenance_mode', settings.maintenance_mode)} style={{ padding: '10px 20px', background: settings.maintenance_mode ? '#d9534f' : '#222', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {settings.maintenance_mode ? '🚨 مفعل' : '⚪ معطل'}
              </button>
            </div>

            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', color: '#28a745' }}>💻 لوحة التشخيص (Diagnostics)</h3>
                <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>إظهار مؤشر التشخيص السفلي للمطورين.</p>
              </div>
              <button onClick={() => toggleSetting('diagnostics_enabled', settings.diagnostics_enabled)} style={{ padding: '10px 20px', background: settings.diagnostics_enabled ? '#28a745' : '#222', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {settings.diagnostics_enabled ? '🟢 مفعلة' : '⚪ معطلة'}
              </button>
            </div>

            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>📢 الشريط الإعلاني</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="أدخل نص الإعلان..."
                  value={settings.announcement_bar}
                  onChange={(e) => setSettings({ ...settings, announcement_bar: e.target.value })}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff' }}
                />
                <button onClick={saveAnnouncement} style={{ padding: '10px 20px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ</button>
              </div>
            </div>
          </div>
        )}

        {/* 3. حظر المستخدمين */}
        {activeTab === 'users' && (
          <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <input
              type="text"
              placeholder="🔎 بحث عن مستخدم..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', marginBottom: '15px' }}
            />
            <div style={{ display: 'grid', gap: '10px' }}>
              {filteredUsers.map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1c1c1c', padding: '12px 15px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{u.email || u.username}</span>
                    {u.is_banned && <span style={{ color: '#ff4d4d', marginRight: '10px', fontSize: '12px' }}>(محظور)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => toggleUserVIP(u.id, u.is_vip)} style={{ padding: '6px 12px', background: '#ffc107', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>⭐ VIP</button>
                    <button onClick={() => toggleUserBan(u.id, u.is_banned)} style={{ padding: '6px 12px', background: u.is_banned ? '#28a745' : '#d9534f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      {u.is_banned ? 'فك الحظر' : 'حظر 🚫'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. المحتوى */}
        {activeTab === 'content' && (
          <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <input
              type="text"
              placeholder="🔎 بحث عن اسم فيلم..."
              value={titleSearch}
              onChange={(e) => setTitleSearch(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', marginBottom: '15px' }}
            />
            <div style={{ display: 'grid', gap: '10px' }}>
              {filteredTitles.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1c1c1c', padding: '10px 15px', borderRadius: '8px' }}>
                  <span>{t.name}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => toggleTitleVisibility(t.id, t.is_hidden)} style={{ padding: '6px 12px', background: '#444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      {t.is_hidden ? 'إظهار 👁️' : 'إخفاء 🙈'}
                    </button>
                    <button onClick={() => deleteTitle(t.id, t.name)} style={{ padding: '6px 12px', background: '#d9534f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>حذف 🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. السجلات */}
        {activeTab === 'logs' && (
          <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <div style={{ background: '#000', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', color: '#00ff00', fontSize: '13px' }}>
              {systemLogs.map((log, index) => <div key={index}>{log}</div>)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
