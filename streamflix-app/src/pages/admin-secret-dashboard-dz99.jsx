import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '2026'; // رمز الـ PIN السري لفتح لوحة التحكم
const TMDB_API_KEY = 'bb04576f643a69128d4924c5aea7c339';

export default function Admin() {
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('settings'); // settings, users, content, import
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // حالة إعدادات الموقع العامة
  const [settings, setSettings] = useState({
    diagnosticsEnabled: false,
    maintenanceMode: false,
    announcementBar: '',
  });

  // قوائم البيانات
  const [users, setUsers] = useState([]);
  const [titles, setTitles] = useState([]);
  
  // حالات الاستيراد
  const [bulkLoading, setBulkLoading] = useState(false);
  const [fillLoading, setFillLoading] = useState(false);

  // التحقق من رمز الـ PIN
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsAuthenticated(true);
      setMessage('');
      fetchAdminData();
    } else {
      setMessage('❌ رمز الـ PIN غير صحيح!');
    }
  };

  // جلب كافة بيانات اللوحة عند تسجيل الدخول
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. جلب إعدادات الموقع
      const { data: settingsData } = await supabase.from('site_settings').select('*');
      if (settingsData) {
        const settingsObj = {};
        settingsData.forEach(item => {
          settingsObj[item.key] = item.value;
        });
        setSettings({
          diagnosticsEnabled: settingsObj.diagnostics_enabled === 'true',
          maintenanceMode: settingsObj.maintenance_mode === 'true',
          announcementBar: settingsObj.announcement_bar || '',
        });
      }

      // 2. جلب قائمة المستخدمين
      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (usersData) setUsers(usersData);

      // 3. جلب قائمة الأفلام والمسلسلات للإشراف
      const { data: titlesData } = await supabase.from('titles').select('id, name, type, is_hidden, url, tmdb_id').order('id', { ascending: false }).limit(50);
      if (titlesData) setTitles(titlesData);

    } catch (err) {
      console.error('فشل جلب البيانات:', err);
    } finally {
      setLoading(false);
    }
  };

  // ------------------ 1. تحديث إعدادات الموقع والتشخيص ------------------
  const toggleSetting = async (key, currentValue) => {
    const newValue = (!currentValue).toString();
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key, value: newValue });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key === 'diagnostics_enabled' ? 'diagnosticsEnabled' : 'maintenanceMode']: !currentValue }));
      setMessage(`تم تحديث حالة ${key === 'diagnostics_enabled' ? 'شاشة التشخيص' : 'وضع الصيانة'} بنجاح ✅`);
    } catch (err) {
      setMessage(`خطأ أثناء التحديث: ${err.message}`);
    }
  };

  const saveAnnouncement = async () => {
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'announcement_bar', value: settings.announcementBar });

      if (error) throw error;
      setMessage('تم حفظ شريط الإعلانات بنجاح ✅');
    } catch (err) {
      setMessage(`خطأ في الحفظ: ${err.message}`);
    }
  };

  // ------------------ 2. إشراف وحظر المستخدمين ------------------
  const toggleUserBan = async (userId, isBanned) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: !isBanned })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: !isBanned } : u));
      setMessage(`تم ${!isBanned ? 'حظر' : 'إلغاء حظر'} المستخدم بنجاح 🔒`);
    } catch (err) {
      setMessage(`فشل تعديل حالة الحظر: ${err.message}`);
    }
  };

  // ------------------ 3. إخفاء وإظهار المحتوى ------------------
  const toggleTitleVisibility = async (titleId, isHidden) => {
    try {
      const { error } = await supabase
        .from('titles')
        .update({ is_hidden: !isHidden })
        .eq('id', titleId);

      if (error) throw error;

      setTitles(titles.map(t => t.id === titleId ? { ...t, is_hidden: !isHidden } : t));
      setMessage(`تم ${!isHidden ? 'إخفاء' : 'إظهار'} المحتوى بنجاح 👁️`);
    } catch (err) {
      setMessage(`فشل تغيير الرؤية: ${err.message}`);
    }
  };

  // ------------------ 4. أداة Stelar وتوليد الروابط تلقائياً ------------------
  const getStelarUrl = (tmdbId, type = 'movie') => {
    if (!tmdbId) return '';
    return (type === 'series' || type === 'tv')
      ? `https://stelar.rip/embed/tv/${tmdbId}/1/1`
      : `https://stelar.rip/embed/movie/${tmdbId}`;
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
      let filled = 0;

      for (const row of rows) {
        if (!row.tmdb_id) continue;
        const generatedUrl = getStelarUrl(row.tmdb_id, row.type);
        const { error: updateError } = await supabase
          .from('titles')
          .update({ url: generatedUrl })
          .eq('id', row.id);

        if (!updateError) filled++;
      }

      setMessage(`تم ملء ${filled} رابط فارغ بـ Stelar بنجاح! 🔗`);
      fetchAdminData();
    } catch (err) {
      setMessage(`فشل عملية ملء الروابط: ${err.message}`);
    } finally {
      setFillLoading(false);
    }
  };

  // ================= شاشة حماية رمز الـ PIN السرية =================
  if (!isAuthenticated) {
    return (
      <div style={{ background: '#0d0d0d', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', direction: 'rtl' }}>
        <form onSubmit={handlePinSubmit} style={{ background: '#181818', padding: '30px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center', width: '100%', maxWidth: '360px' }}>
          <h2 style={{ fontSize: '22px', marginBottom: '10px', color: '#e50914' }}>🔒 منطقة محمية</h2>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>أدخل رمز ה-PIN للوصول إلى لوحة الشرف والإدارة</p>
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

  // ================= لوحة التحكم الرئيسية =================
  return (
    <div style={{ background: '#0d0d0d', color: '#fff', minHeight: '100vh', padding: '25px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* الهيدر وعناصر التنقل */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '25px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
          <h1 style={{ color: '#e50914', fontSize: '24px', margin: 0 }}>⚙️ لوحة الإدارة العامة (StreamFlix)</h1>
          <button onClick={() => setIsAuthenticated(false)} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
            🔒 قفل اللوحة
          </button>
        </div>

        {/* أزرار التبويبات */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
          {[
            { id: 'settings', label: '🛠️ إعدادات الموقع والتشخيص' },
            { id: 'users', label: '👥 حظر وإدارة المستخدمين' },
            { id: 'content', label: '🎬 إخفاء وإظهار المحتوى' },
            { id: 'import', label: '🔗 الاستيراد والروابط' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
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

        {/* رسائل التنبيه */}
        {message && (
          <div style={{ background: '#18331e', color: '#77ff94', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #28422e', textAlign: 'center', fontWeight: 'bold' }}>
            {message}
          </div>
        )}

        {/* 1. تبويب إعدادات الموقع والتشخيص */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>🖥️ شاشة التشخيص (Diagnostics Mode)</h3>
                <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>تفعيل إظهار تفاصيل الـ API والأخطاء الفنية للمطورين على الشاشة.</p>
              </div>
              <button
                onClick={() => toggleSetting('diagnostics_enabled', settings.diagnosticsEnabled)}
                style={{ padding: '10px 20px', background: settings.diagnosticsEnabled ? '#28a745' : '#444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {settings.diagnosticsEnabled ? 'مفعلة ✅' : 'معطلة ❌'}
              </button>
            </div>

            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>🚧 وضع الصيانة (Maintenance Mode)</h3>
                <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>إغلاق الموقع مؤقتاً أمام الزوار وإظهار شاشة الصيانة.</p>
              </div>
              <button
                onClick={() => toggleSetting('maintenance_mode', settings.maintenanceMode)}
                style={{ padding: '10px 20px', background: settings.maintenanceMode ? '#d9534f' : '#444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {settings.maintenanceMode ? 'مفعل 🚨' : 'معطل 🟢'}
              </button>
            </div>

            <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>📢 شريط الإعلانات أعلى الموقع</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="اكتب رسالة الإعلان هنا..."
                  value={settings.announcementBar}
                  onChange={(e) => setSettings({ ...settings, announcementBar: e.target.value })}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', outline: 'none' }}
                />
                <button onClick={saveAnnouncement} style={{ padding: '10px 20px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. تبويب حظر وإدارة المستخدمين */}
        {activeTab === 'users' && (
          <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>قائمة الأعضاء والمستخدمين</h3>
            {users.length === 0 ? (
              <p style={{ color: '#888' }}>لا يوجد مستخدمون مسجلون حالياً أو متعذر جلبهم.</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {users.map(u => (
                  <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', padding: '12px', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{u.email || u.username || 'مستخدم بدون اسم'}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>ID: {u.id}</div>
                    </div>
                    <button
                      onClick={() => toggleUserBan(u.id, u.is_banned)}
                      style={{ padding: '6px 14px', background: u.is_banned ? '#28a745' : '#d9534f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      {u.is_banned ? 'إلغاء الحظر 🔓' : 'حظر 🚫'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. تبويب إخفاء وإظهار المحتوى */}
        {activeTab === 'content' && (
          <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>التحكم برؤية الأفلام والمسلسلات</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {titles.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                    <span style={{ fontSize: '12px', color: '#aaa', marginRight: '10px' }}>({item.type === 'series' ? 'مسلسل' : 'فيلم'})</span>
                  </div>
                  <button
                    onClick={() => toggleTitleVisibility(item.id, item.is_hidden)}
                    style={{ padding: '6px 14px', background: item.is_hidden ? '#28a745' : '#ff9800', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                  >
                    {item.is_hidden ? 'إظهار 👁️' : 'إخفاء 🙈'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. تبويب الاستيراد والروابط بـ Stelar */}
        {activeTab === 'import' && (
          <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>🔗 ملء الروابط الفارغة عبر Stelar</h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              فحص قاعدة البيانات وتوليد رابط `stelar.rip` بناءً على `tmdb_id` لكل عنوان بدون رابط.
            </p>
            <button
              onClick={handleFillEmptyUrls}
              disabled={fillLoading}
              style={{ padding: '12px 30px', background: fillLoading ? '#555' : '#8e44ad', color: '#fff', border: 'none', borderRadius: '8px', cursor: fillLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}
            >
              {fillLoading ? '⏳ جاري التحديث...' : '🔗 تشغيل ملء الروابط تلقائياً'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
