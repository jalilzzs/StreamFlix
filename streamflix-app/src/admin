'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // غير المسار حسب مشروعك
import { useRouter, useSearchParams } from 'next/navigation';

// كلمة المرور أو السيريال الخفي للدخول من الرابط (يمكنك تغييره)
const SECRET_ACCESS_KEY = 'StreamAdmin2026';

export default function SecretAdminDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [passKey, setPassKey] = useState('');
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'users' | 'stats'

  // حالة الإعدادات
  const [settings, setSettings] = useState({
    show_diagnostics: true,
    maintenance_mode: false,
    allow_registration: true,
    hero_banner_text: ''
  });

  // حالة المستخدمين
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // إحصائيات
  const [stats, setStats] = useState({ totalUsers: 0, vipUsers: 0, bannedUsers: 0 });

  // التحقق من مفتاح الدخول في الرابط (?key=StreamAdmin2026)
  useEffect(() => {
    const keyParam = searchParams.get('key');
    if (keyParam === SECRET_ACCESS_KEY) {
      setAuthorized(true);
      fetchSettings();
      fetchUsers();
    }
  }, [searchParams]);

  // جلب الإعدادات العامة
  const fetchSettings = async () => {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (!error && data) {
      const config = {};
      data.forEach(item => {
        config[item.key] = item.value;
      });
      setSettings(prev => ({ ...prev, ...config }));
    }
  };

  // جلب قائمة المستخدمين
  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data);
      setStats({
        totalUsers: data.length,
        vipUsers: data.filter(u => u.is_vip).length,
        bannedUsers: data.filter(u => u.is_banned).length
      });
    }
    setLoadingUsers(false);
  };

  // تحديث إعداد معين
  const toggleSetting = async (key, currentValue) => {
    const newValue = !currentValue;
    setSettings(prev => ({ ...prev, [key]: newValue }));

    await supabase
      .from('site_settings')
      .upsert({ key, value: newValue, updated_at: new Date() });
  };

  // تحديث النص (مثل البنر)
  const updateTextSetting = async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await supabase
      .from('site_settings')
      .upsert({ key, value, updated_at: new Date() });
  };

  // تغيير حالة VIP للمستخدم
  const toggleVipStatus = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('profiles')
      .update({ is_vip: newStatus })
      .eq('id', userId);

    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, is_vip: newStatus } : u));
      setStats(prev => ({
        ...prev,
        vipUsers: newStatus ? prev.vipUsers + 1 : prev.vipUsers - 1
      }));
    }
  };

  // حظر / إلغاء حظر مستخدم
  const toggleBanStatus = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: newStatus })
      .eq('id', userId);

    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: newStatus } : u));
      setStats(prev => ({
        ...prev,
        bannedUsers: newStatus ? prev.bannedUsers + 1 : prev.bannedUsers - 1
      }));
    }
  };

  // التحقق من الرمز يدوياً
  const handleManualLogin = (e) => {
    e.preventDefault();
    if (passKey === SECRET_ACCESS_KEY) {
      setAuthorized(true);
      fetchSettings();
      fetchUsers();
    } else {
      alert('رمز الدخول غير صحيح!');
    }
  };

  // شاشة حماية الدخول إذا كان الرابط بدون Key أو خاطئ
  if (!authorized) {
    return (
      <div style={{ background: '#0d0d0d', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleManualLogin} style={{ background: '#1a1a1a', padding: '30px', borderRadius: '12px', border: '1px solid #333', textAlign: 'center', width: '350px' }}>
          <h2>🔒 منطقة محمية</h2>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>أدخل رمز الوصول السري للدخول إلى لوحة التحكم</p>
          <input
            type="password"
            placeholder="أدخل المفتاح السري..."
            value={passKey}
            onChange={(e) => setPassKey(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #444', background: '#222', color: '#fff', marginBottom: '15px', outline: 'none' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            دخول
          </button>
        </form>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    (u.email || u.username || u.name || '').toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div style={{ background: '#0e0e10', color: '#fff', minHeight: '100vh', padding: '25px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* الهيدر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>⚙️ لوحة التحكم السرية للموقع</h1>
          <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '13px' }}>إدارة الشاشات، الميزات، المستخدمين والحظر</p>
        </div>
        <button onClick={() => setAuthorized(false)} style={{ background: '#333', color: '#ccc', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          خروج 🚪
        </button>
      </div>

      {/* بطاقات الإحصائيات السريعة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: '#16161a', padding: '20px', borderRadius: '10px', border: '1px solid #282830' }}>
          <span style={{ color: '#888', fontSize: '13px' }}>إجمالي المستخدمين</span>
          <h2 style={{ margin: '10px 0 0 0', color: '#00d2ff' }}>{stats.totalUsers}</h2>
        </div>
        <div style={{ background: '#16161a', padding: '20px', borderRadius: '10px', border: '1px solid #282830' }}>
          <span style={{ color: '#888', fontSize: '13px' }}>مشتركي VIP 👑</span>
          <h2 style={{ margin: '10px 0 0 0', color: '#ffb703' }}>{stats.vipUsers}</h2>
        </div>
        <div style={{ background: '#16161a', padding: '20px', borderRadius: '10px', border: '1px solid #282830' }}>
          <span style={{ color: '#888', fontSize: '13px' }}>المستخدِمين المحظورين 🚫</span>
          <h2 style={{ margin: '10px 0 0 0', color: '#ff4d4d' }}>{stats.bannedUsers}</h2>
        </div>
      </div>

      {/* تبويبات اللوحة */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #222' }}>
        <button
          onClick={() => setActiveTab('settings')}
          style={{ padding: '10px 20px', background: activeTab === 'settings' ? '#e50914' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontWeight: 'bold' }}>
          🎛️ التحكم في الميزات والواجهات
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{ padding: '10px 20px', background: activeTab === 'users' ? '#e50914' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontWeight: 'bold' }}>
          👥 إدارة المستخدمين (VIP والحظر)
        </button>
      </div>

      {/* التبويب 1: التحكم في الميزات والواجهة */}
      {activeTab === 'settings' && (
        <div style={{ background: '#16161a', padding: '25px', borderRadius: '12px', border: '1px solid #282830', maxWidth: '800px' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '10px' }}>إعدادات الظهور والميزات الحية</h3>
          
          {/* التحكم في لوحة التشخيص والتوصيات */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #222' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '16px' }}>إظهار لوحات التشخيص والتوصيات الشخصية</strong>
              <span style={{ color: '#888', fontSize: '13px' }}>تفعيل أو إخفاء قسم التوصيات والتشخيص المخصص لكل مستخدم في الصفحة الرئيسية</span>
            </div>
            <button
              onClick={() => toggleSetting('show_diagnostics', settings.show_diagnostics)}
              style={{ padding: '8px 20px', background: settings.show_diagnostics ? '#28a745' : '#dc3545', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
              {settings.show_diagnostics ? 'ظاهر (مفعّل) ✅' : 'مخفي (معطّل) ❌'}
            </button>
          </div>

          {/* وضع الصيانة */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #222' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '16px' }}>تفعيل وضع الصيانة (Maintenance Mode)</strong>
              <span style={{ color: '#888', fontSize: '13px' }}>إغلاق الموقع للزوار العاديين وإظهار رسالة صيانة</span>
            </div>
            <button
              onClick={() => toggleSetting('maintenance_mode', settings.maintenance_mode)}
              style={{ padding: '8px 20px', background: settings.maintenance_mode ? '#dc3545' : '#444', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
              {settings.maintenance_mode ? 'مفعّل (الموقع مغلق) 🛑' : 'معطّل (الموقع يعمل) 🟢'}
            </button>
          </div>

          {/* التسجيل الجديد */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #222' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '16px' }}>السماح بتسجيل حسابات جديدة</strong>
              <span style={{ color: '#888', fontSize: '13px' }}>توقيف أو إتاحة إنشاء حسابات جديدة في المنصة</span>
            </div>
            <button
              onClick={() => toggleSetting('allow_registration', settings.allow_registration)}
              style={{ padding: '8px 20px', background: settings.allow_registration ? '#28a745' : '#dc3545', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
              {settings.allow_registration ? 'متاح 🔓' : 'مغلق 🔒'}
            </button>
          </div>

          {/* نص الشريط العلوي الإعلاني */}
          <div style={{ padding: '15px 0' }}>
            <strong style={{ display: 'block', fontSize: '16px', marginBottom: '8px' }}>نص بنر الإعلانات أعلى الموقع:</strong>
            <input
              type="text"
              value={settings.hero_banner_text || ''}
              onChange={(e) => updateTextSetting('hero_banner_text', e.target.value)}
              placeholder="اكتب نصاً ليظهر كشريط تنبيه أعلى الموقع..."
              style={{ width: '100%', padding: '10px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px' }}
            />
          </div>
        </div>
      )}

      {/* التبويب 2: إدارة المستخدمين */}
      {activeTab === 'users' && (
        <div style={{ background: '#16161a', padding: '25px', borderRadius: '12px', border: '1px solid #282830' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>قائمة المستخدمين والتحكم بالحسابات</h3>
            <input
              type="text"
              placeholder="🔍 بحث بالبريد أو الاسم..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              style={{ padding: '8px 15px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', width: '250px' }}
            />
          </div>

          {loadingUsers ? (
            <p>جاري تحميل قائمة المستخدمين...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#222', color: '#aaa', borderBottom: '1px solid #333' }}>
                  <th style={{ padding: '12px' }}>المستخدم</th>
                  <th style={{ padding: '12px' }}>الرتبة</th>
                  <th style={{ padding: '12px' }}>حالة VIP</th>
                  <th style={{ padding: '12px' }}>حالة الحساب</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>الإجراءات والتعديل</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #26262d' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{u.name || u.username || 'مستخدم بدون اسم'}</div>
                      <div style={{ fontSize: '12px', color: '#777' }}>{u.email || u.id}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '3px 8px', background: u.role === 'admin' ? '#e50914' : '#333', borderRadius: '4px', fontSize: '12px' }}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {u.is_vip ? (
                        <span style={{ color: '#ffb703', fontWeight: 'bold' }}>👑 عضويّة VIP</span>
                      ) : (
                        <span style={{ color: '#777' }}>عادي</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {u.is_banned ? (
                        <span style={{ color: '#ff4d4d', fontWeight: 'bold' }}>🛑 محظور</span>
                      ) : (
                        <span style={{ color: '#28a745' }}>نشط 🟢</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleVipStatus(u.id, u.is_vip)}
                        style={{ padding: '6px 12px', background: u.is_vip ? '#444' : '#ffb703', color: u.is_vip ? '#fff' : '#000', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '8px' }}>
                        {u.is_vip ? 'إلغاء VIP' : 'ترقية لـ VIP 👑'}
                      </button>

                      <button
                        onClick={() => toggleBanStatus(u.id, u.is_banned)}
                        style={{ padding: '6px 12px', background: u.is_banned ? '#28a745' : '#dc3545', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                        {u.is_banned ? 'إلغاء الحظر 🔓' : 'حظر الحساب 🚫'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}
