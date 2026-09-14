import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '2026';
const TMDB_API_KEY = 'bb04576f643a69128d4924c5aea7c339';

export default function Admin() {
  const navigate = useNavigate();
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('stats'); // stats, settings, users, content, logs

  // الرسائل والحالات
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

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

  // التحقق من رمز PIN
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

  // جلب كافة البيانات
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. الإعدادات
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

      // 2. المستخدمين
      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (usersData) setUsers(usersData);

      // 3. المحتوى
      const { data: titlesData } = await supabase.from('titles').select('*').order('id', { ascending: false }).limit(100);
      if (titlesData) setTitles(titlesData);

      // 4. الإحصائيات
      setStats({
        totalTitles: titlesData ? titlesData.length : 0,
        totalUsers: usersData ? usersData.length : 0,
        bannedUsers: usersData ? usersData.filter(u => u.is_banned).length : 0,
        hiddenTitles: titlesData ? titlesData.filter(t => t.is_hidden).length : 0,
      });

      addLog('تم جلب وتحديث بيانات لوحة التحكم بنجاح');
    } catch (err) {
      console.error('فشل جلب البيانات:', err);
      setMessage({ text: `فشل جلب البيانات: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString('ar-DZ');
    setSystemLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 19)]);
  };

  // ------------------ 1. إدارة الإعدادات والصيانة ------------------
  const toggleSetting = async (key, currentValue) => {
    const newValue = (!currentValue).toString();
    try {
      await supabase.from('site_settings').upsert({ key, value: newValue });
      setSettings(prev => ({
        ...prev,
        [key]: !currentValue
      }));
      const label = key === 'maintenance_mode' ? 'وضع الصيانة' : 'لوحة التشخيص';
      setMessage({ text: `تم ${!currentValue ? 'تفعيل' : 'تعطيل'} ${label} بنجاح ✅`, type: 'success' });
      addLog(`تغيير حالة ${label} إلى ${!currentValue}`);
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const saveAnnouncement = async () => {
    try {
      await supabase.from('site_settings').upsert({ key: 'announcement_bar', value: settings.announcement_bar });
      setMessage({ text: 'تم حفظ الشريط الإعلاني بنجاح ✅', type: 'success' });
      addLog(`تحديث الشريط الإعلاني: "${settings.announcement_bar}"`);
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  // ------------------ 2. إدارة وحظر المستخدمين ------------------
  const toggleUserBan = async (userId, isBanned) => {
    try {
      await supabase.from('profiles').update({ is_banned: !isBanned }).eq('id', userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: !isBanned } : u));
      const actionText = !isBanned ? 'حظر' : 'فك حظر';
      setMessage({ text: `تم ${actionText} المستخدم بنجاح 🔒`, type: 'success' });
      addLog(`تم ${actionText} المستخدم ذو الرمز: ${userId}`);
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const toggleUserVIP = async (userId, isVip) => {
    try {
      await supabase.from('profiles').update({ is_vip: !isVip }).eq('id', userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_vip: !isVip } : u));
      setMessage({ text: `تم ${!isVip ? 'ترقية' : 'إلغاء ترقية'} المستخدم إلى VIP ⭐`, type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  // ------------------ 3. إدارة المحتوى والأفلام ------------------
  const toggleTitleVisibility = async (titleId, isHidden) => {
    try {
      await supabase.from('titles').update({ is_hidden: !isHidden }).eq('id', titleId);
      setTitles(titles.map(t => t.id === titleId ? { ...t, is_hidden: !isHidden } : t));
      setMessage({ text: `تم ${!isHidden ? 'إخفاء' : 'إظهار'} العنوان 👁️`, type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const toggleTitlePremium = async (titleId, isPremium) => {
    try {
      await supabase.from('titles').update({ is_premium: !isPremium }).eq('id', titleId);
      setTitles(titles.map(t => t.id === titleId ? { ...t, is_premium: !isPremium } : t));
      setMessage({ text: `تم تغيير حالة VIP للعنوان 🌟`, type: 'success' });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const deleteTitle = async (titleId, titleName) => {
    if (!window.confirm(`هل أنت تأكد من حذف "${titleName}" نهائياً؟`)) return;
    try {
      await supabase.from('titles').delete().eq('id', titleId);
      setTitles(titles.filter(t => t.id !== titleId));
      setMessage({ text: `تم حذف "${titleName}" بنجاح 🗑️`, type: 'success' });
      addLog(`حذف العنوان: ${titleName}`);
    } catch (err) {
      setMessage({ text: `خطأ في الحذف: ${err.message}`, type: 'error' });
    }
  };

  // تصفية العناصر
  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.id || '').includes(userSearch)
  );

  const filteredTitles = titles.filter(t => 
    (t.name || '').toLowerCase().includes(titleSearch.toLowerCase()) ||
    (t.tmdb_id || '').includes(titleSearch)
  );

  // ================= شاشة الدخول المعتمدة على PIN =================
  if (!isAuthenticated) {
    return (
      <div style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', direction: 'rtl' }}>
        <form onSubmit={handlePinSubmit} style={{ background: '#141414', padding: '35px', borderRadius: '16px', border: '1px solid #282828', textAlign: 'center', width: '100%', maxWidth: '380px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
          <h2 style={{ fontSize: '22px', marginBottom: '8px', color: '#e50914' }}>لوحة التحكم الفائقة</h2>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '25px' }}>أدخل رمز PIN المسؤول للوصول للإعدادات</p>
          <input
            type="password"
            maxLength={6}
            placeholder="****"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', background: '#222', color: '#fff', textAlign: 'center', fontSize: '24px', letterSpacing: '6px', marginBottom: '20px', outline: 'none' }}
          />
          <button type="submit" style={{ width: '100%', padding: '14px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
            فتح اللوحة
          </button>
          {message.text && <p style={{ color: '#ff4d4d', marginTop: '15px', fontSize: '13px' }}>{message.text}</p>}
        </form>
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', padding: '25px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* الهيدر العلوي */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
          <div>
            <h1 style={{ color: '#e50914', fontSize: '26px', margin: 0, fontWeight: '800' }}>⚡ لوحة تحكم StreamFlix</h1>
            <span style={{ fontSize: '12px', color: '#666' }}>الإصدار المتقدم 2.5</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/import')} style={{ background: '#0066cc', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>📥 صفحة الاستيراد</button>
            <button onClick={() => navigate('/')} style={{ background: '#222', color: '#fff', border: '1px solid #333', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>🏠 الموقع</button>
            <button onClick={() => setIsAuthenticated(false)} style={{ background: '#2a1212', color: '#ff5555', border: '1px solid #441a1a', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>🔒 قفل</button>
          </div>
        </div>

        {/* التبويبات الرئيسيّة */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
          {[
            { id: 'stats', label: '📊 الإحصائيات' },
            { id: 'settings', label: '📢 الصيانة والإعلانات' },
            { id: 'users', label: '👥 حظر وإدارة المستخدمين' },
            { id: 'content', label: '🎬 إدار المحتوى والأفلام' },
            { id: 'logs', label: '📋 السجلات والمراقبة' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMessage({ text: '', type: '' }); }}
              style={{
                padding: '12px 20px',
                background: activeTab === tab.id ? '#e50914' : '#141414',
                color: '#fff',
                border: '1px solid',
                borderColor: activeTab === tab.id ? '#e50914' : '#282828',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                transition: '0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* تنبيهات الحالة */}
        {message.text && (
          <div style={{ background: message.type === 'error' ? '#2a1212' : '#122a18', color: message.type === 'error' ? '#ff6b6b' : '#6bff8d', padding: '14px', borderRadius: '10px', marginBottom: '20px', border: '1px solid', borderColor: message.type === 'error' ? '#4a1e1e' : '#1e4a28', textAlign: 'center', fontWeight: 'bold' }}>
            {message.text}
          </div>
        )}

        {/* 1. تبويب الإحصائيات */}
        {activeTab === 'stats' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
              <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#e50914' }}>{stats.totalTitles}</div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '5px' }}>إجمالي الأفلام والمسلسلات</div>
              </div>
              <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0066cc' }}>{stats.totalUsers}</div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '5px' }}>المستخدمين المسجلين</div>
              </div>
              <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#d9534f' }}>{stats.bannedUsers}</div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '5px' }}>المستخدمين المحظورين</div>
              </div>
              <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f0ad4e' }}>{stats.hiddenTitles}</div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '5px' }}>عناصر مخفية من العرض</div>
              </div>
            </div>

            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>مؤشر تحديث البيانات</h3>
                <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>إعادة جلب ومزامنة أحدث البيانات المباشرة من Supabase</p>
              </div>
              <button onClick={fetchData} disabled={loading} style={{ padding: '10px 20px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {loading ? '⏳ جاري التحديث...' : '🔄 تحديث الآن'}
              </button>
            </div>
          </div>
        )}

        {/* 2. تبويب الصيانة والإعلانات والدياقنوستيك */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', color: '#ff4d4d' }}>🚧 وضع الصيانة الكامل (Maintenance Mode)</h3>
                <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>توجيه جميع الزوار إلى شاشة الصيانة المغلقة ويمنع تصفح المحتوى.</p>
              </div>
              <button onClick={() => toggleSetting('maintenance_mode', settings.maintenance_mode)} style={{ padding: '12px 24px', background: settings.maintenance_mode ? '#d9534f' : '#222', color: '#fff', border: settings.maintenance_mode ? 'none' : '1px solid #444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {settings.maintenance_mode ? '🚨 مفعل حالياً' : '⚪ معطل'}
              </button>
            </div>

            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', color: '#28a745' }}>💻 لوحة التشخيص والأخطاء (Diagnostics)</h3>
                <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>إظهار نافذة صغيرة في زاوية الشاشة لتتبع المسارات وحالة السيرفر.</p>
              </div>
              <button onClick={() => toggleSetting('diagnostics_enabled', settings.diagnostics_enabled)} style={{ padding: '12px 24px', background: settings.diagnostics_enabled ? '#28a745' : '#222', color: '#fff', border: settings.diagnostics_enabled ? 'none' : '1px solid #444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {settings.diagnostics_enabled ? '🟢 مفعلة' : '⚪ معطلة'}
              </button>
            </div>

            <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>📢 الشريط الإعلاني العلوي</h3>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '15px' }}>يظهر هذا الشريط في أعلى كامل صفحات الموقع لجميع الزوار.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="مثال: مرحباً بكم في StreamFlix! تم إضافة أحدث أفلام 2026..."
                  value={settings.announcement_bar}
                  onChange={(e) => setSettings({ ...settings, announcement_bar: e.target.value })}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', outline: 'none' }}
                />
                <button onClick={saveAnnouncement} style={{ padding: '12px 24px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  حفظ الشريط
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. تبويب إدارة وحظر المستخدمين */}
        {activeTab === 'users' && (
          <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0 }}>إدارة وحظر الأعضاء ({filteredUsers.length})</h3>
              <input
                type="text"
                placeholder="🔎 بحث عن مستخدم بالإيميل أو ID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', outline: 'none', width: '280px' }}
              />
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredUsers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#777', padding: '20px' }}>لا يوجد مستخدمين مطابقين للبحث.</div>
              ) : (
                filteredUsers.map(u => (
                  <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1c1c1c', padding: '14px 18px', borderRadius: '10px', border: '1px solid #282828', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {u.email || u.username || 'مستخدم بدون اسم'}
                        {u.is_vip && <span style={{ background: '#ffc107', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>VIP ⭐</span>}
                        {u.is_banned && <span style={{ background: '#d9534f', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>محظور 🚫</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>ID: {u.id}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => toggleUserVIP(u.id, u.is_vip)}
                        style={{ padding: '8px 14px', background: u.is_vip ? '#333' : '#ffc107', color: u.is_vip ? '#fff' : '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        {u.is_vip ? 'إلغاء VIP' : 'ترقية VIP ⭐'}
                      </button>
                      <button
                        onClick={() => toggleUserBan(u.id, u.is_banned)}
                        style={{ padding: '8px 14px', background: u.is_banned ? '#28a745' : '#d9534f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        {u.is_banned ? 'فك الحظر 🔓' : 'حظر المستخدم 🚫'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. تبويب إدارة المحتوى والأفلام */}
        {activeTab === 'content' && (
          <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0 }}>إدارة وتعديل المحتوى ({filteredTitles.length})</h3>
              <input
                type="text"
                placeholder="🔎 بحث عن اسم فيلم أو مسلسل..."
                value={titleSearch}
                onChange={(e) => setTitleSearch(e.target.value)}
                style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', outline: 'none', width: '280px' }}
              />
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredTitles.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1c1c1c', padding: '12px 16px', borderRadius: '10px', border: '1px solid #282828', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {item.poster_url ? (
                      <img src={item.poster_url} alt="" style={{ width: '40px', height: '55px', objectFit: 'cover', borderRadius: '6px' }} />
                    ) : (
                      <div style={{ width: '40px', height: '55px', background: '#333', borderRadius: '6px' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {item.name}
                        {item.is_hidden && <span style={{ color: '#ff9800', fontSize: '12px', marginRight: '8px' }}>(مخفي)</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#777', marginTop: '3px' }}>
                        النوع: {item.type === 'series' ? 'مسلسل' : 'فيلم'} | TMDB ID: {item.tmdb_id || 'غير مربط'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => toggleTitlePremium(item.id, item.is_premium)}
                      style={{ padding: '7px 12px', background: item.is_premium ? '#ff9800' : '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      {item.is_premium ? 'حصري VIP 🌟' : 'عادي'}
                    </button>
                    <button
                      onClick={() => toggleTitleVisibility(item.id, item.is_hidden)}
                      style={{ padding: '7px 12px', background: item.is_hidden ? '#28a745' : '#444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      {item.is_hidden ? 'إظهار 👁️' : 'إخفاء 🙈'}
                    </button>
                    <button
                      onClick={() => deleteTitle(item.id, item.name)}
                      style={{ padding: '7px 12px', background: '#d9534f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      حذف 🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. تبويب السجلات والمراقبة */}
        {activeTab === 'logs' && (
          <div style={{ background: '#141414', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>📋 سجل الأنشطة والعمليات الأخيرة</h3>
            <div style={{ background: '#080808', padding: '15px', borderRadius: '8px', border: '1px solid #222', fontFamily: 'monospace', fontSize: '13px', color: '#00ff00', minHeight: '200px' }}>
              {systemLogs.length === 0 ? (
                <div style={{ color: '#555' }}>لا توجد سجلات حالية.</div>
              ) : (
                systemLogs.map((log, index) => (
                  <div key={index} style={{ marginBottom: '8px' }}>{log}</div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
