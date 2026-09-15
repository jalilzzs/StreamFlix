import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '0508';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 Minutes

const automaticBadgeForPlan = (plan) => {
  if (plan === 'month') return 'verification';
  if (plan === 'year') return 'official';
  return 'none';
};

const badgeFieldsForType = (type) => ({
  verification_badge: type === 'verification',
  official_badge: type === 'official',
  owner_badge: type === 'owner',
});

export default function Admin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [authStep, setAuthStep] = useState('login');
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [activeTab, setActiveTab] = useState('stats');

  const [message, setMessage] = useState({
    text: '',
    type: '',
  });

  const [loading, setLoading] = useState(false);

  // Security & Lockout State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(null);

  const [stats, setStats] = useState({
    totalTitles: 0,
    totalUsers: 0,
    bannedUsers: 0,
    vipUsers: 0,
    verifiedUsers: 0,
    officialUsers: 0,
    ownerUsers: 0,
    hiddenTitles: 0,
  });

  const [settings, setSettings] = useState({
    maintenance_mode: false,
    diagnostics_enabled: false,
    announcement_bar: '',
    vip_exclusive_content: true,
    vip_features_enabled: true,
    vip_media_messages: true,
    vip_voice_messages: true,
    vip_watch_party: true,
  });

  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  const [titles, setTitles] = useState([]);
  const [titleSearch, setTitleSearch] = useState('');

  const [systemLogs, setSystemLogs] = useState([]);

  // =========================================================
  // LOCKOUT UTILS
  // =========================================================

  const checkLockout = () => {
    if (lockoutTime) {
      const remainingTime = lockoutTime - Date.now();
      if (remainingTime > 0) {
        const remainingMinutes = Math.ceil(remainingTime / 60000);
        setMessage({
          text: `❌ الحساب معطل مؤقتاً لـ ${remainingMinutes} دقيقة بسبب المحاولات الخاطئة المتكررة. -active NORTON360-protect`,
          type: 'error',
        });
        return true;
      } else {
        setLockoutTime(null);
        setFailedAttempts(0);
      }
    }
    return false;
  };

  const registerFailedAttempt = () => {
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);
    if (newCount >= MAX_FAILED_ATTEMPTS) {
      setLockoutTime(Date.now() + LOCKOUT_DURATION_MS);
      setMessage({
        text: '❌ تم حظر المحاولات مؤقتاً لمدة 15 دقيقة لكثرة المحاولات الخاطئة. -active NORTON360-protect',
        type: 'error',
      });
    }
  };

  // =========================================================
  // AUTH STATE LISTENER & SESSION CHECK
  // =========================================================

  useEffect(() => {
    checkExistingSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsAuthenticated(false);
        setAuthStep('login');
        setPinInput('');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setAuthStep('login');
        return;
      }

      const isAdmin = await checkAdminRole(session.user.id);

      if (isAdmin) {
        setAuthStep('pin');
      } else {
        await handleUnauthorizedAccess();
      }
    } catch (err) {
      console.error(err);
      await handleUnauthorizedAccess();
    }
  };

  const handleUnauthorizedAccess = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setAuthStep('login');
    setPinInput('');
    setPassword('');
    setMessage({
      text: "you're haven't access to this page -active NORTON360-protect",
      type: 'error',
    });
  };

  // =========================================================
  // CHECK ADMIN ROLE & SENSITIVE OPERATIONS RE-VERIFICATION
  // =========================================================

  const checkAdminRole = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return false;
    }

    return data && (data.role === 'admin' || data.role === 'owner');
  };

  const verifyActiveAdminSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      await handleUnauthorizedAccess();
      return false;
    }

    const isAdmin = await checkAdminRole(session.user.id);
    if (!isAdmin) {
      await handleUnauthorizedAccess();
      return false;
    }

    return true;
  };

  // =========================================================
  // SUPABASE LOGIN
  // =========================================================

  const handleSupabaseLogin = async (e) => {
    e.preventDefault();

    if (checkLockout()) return;

    if (!email.trim() || !password) {
      setMessage({
        text: '❌ أدخل البريد الإلكتروني وكلمة المرور.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        registerFailedAttempt();
        throw error;
      }

      if (!data?.user) {
        registerFailedAttempt();
        throw new Error('لم يتم العثور على المستخدم.');
      }

      const isAdmin = await checkAdminRole(data.user.id);

      if (!isAdmin) {
        registerFailedAttempt();
        await handleUnauthorizedAccess();
        return;
      }

      setPassword('');
      setFailedAttempts(0);
      setMessage({
        text: 'تم التحقق من الحساب ✅ أدخل PIN المسؤول.',
        type: 'success',
      });

      setAuthStep('pin');
    } catch (err) {
      console.error(err);
      if (message.text !== "you're haven't access to this page -active NORTON360-protect") {
        setMessage({
          text: `❌ فشل تسجيل الدخول: ${err.message}`,
          type: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // PIN LOGIN
  // =========================================================

  const handlePinSubmit = async (e) => {
    e.preventDefault();

    if (checkLockout()) return;

    const isValidSession = await verifyActiveAdminSession();
    if (!isValidSession) return;

    if (pinInput === ADMIN_PIN) {
      setFailedAttempts(0);
      setIsAuthenticated(true);
      setMessage({ text: '', type: '' });
      fetchData();
    } else {
      registerFailedAttempt();
      setMessage({
        text: '❌ رمز الـ PIN غير صحيح!',
        type: 'error',
      });
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setAuthStep('login');
    setPinInput('');
    setPassword('');
    setMessage({ text: '', type: '' });
  };

  // =========================================================
  // LOGS
  // =========================================================

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString('ar-DZ');
    setSystemLogs((prev) => [`[${time}] ${text}`, ...prev.slice(0, 49)]);
  };

  // =========================================================
  // FETCH DATA
  // =========================================================

  const fetchData = async () => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    setLoading(true);

    try {
      // ---------------- SETTINGS ----------------
      const { data: settingsData, error: settingsError } = await supabase
        .from('site_settings')
        .select('*');

      if (settingsError) throw settingsError;

      const config = {};
      (settingsData || []).forEach((item) => {
        let value = item.value;
        if (typeof value === 'string' && (value === 'true' || value === 'false')) {
          value = value === 'true';
        }
        if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
          try {
            value = JSON.parse(value);
          } catch {
            // ignore
          }
        }
        config[item.key] = value;
      });

      setSettings({
        maintenance_mode: config.maintenance_mode === true,
        diagnostics_enabled: config.diagnostics_enabled === true,
        announcement_bar: typeof config.announcement_bar === 'string' ? config.announcement_bar : '',
        vip_exclusive_content: config.vip_exclusive_content !== false,
        vip_features_enabled: config.vip_features_enabled !== false,
        vip_media_messages: config.vip_media_messages !== false,
        vip_voice_messages: config.vip_voice_messages !== false,
        vip_watch_party: config.vip_watch_party !== false,
      });

      // ---------------- USERS ----------------
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          user_code,
          display_name,
          username,
          avatar_url,
          is_premium,
          is_vip,
          is_banned,
          role,
          verification_badge,
          official_badge,
          owner_badge,
          premium_plan,
          badge_type,
          badge_manual,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // ---------------- TITLES ----------------
      const { data: titlesData, error: titlesError } = await supabase
        .from('titles')
        .select('*')
        .order('id', { ascending: false })
        .limit(100);

      if (titlesError) throw titlesError;
      setTitles(titlesData || []);

      // ---------------- STATS ----------------
      const allUsers = usersData || [];
      const allTitles = titlesData || [];

      setStats({
        totalTitles: allTitles.length,
        totalUsers: allUsers.length,
        bannedUsers: allUsers.filter((u) => u.is_banned).length,
        vipUsers: allUsers.filter((u) => u.is_vip || u.is_premium).length,
        verifiedUsers: allUsers.filter((u) => u.verification_badge).length,
        officialUsers: allUsers.filter((u) => u.official_badge).length,
        ownerUsers: allUsers.filter((u) => u.owner_badge).length,
        hiddenTitles: allTitles.filter((t) => t.is_hidden).length,
      });

      addLog('تم جلب وتحديث بيانات لوحة التحكم بنجاح');
    } catch (err) {
      console.error(err);
      setMessage({
        text: `فشل جلب البيانات: ${err.message}`,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // SETTINGS
  // =========================================================

  const saveSetting = async (key, value) => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          {
            key,
            value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

      if (error) throw error;

      setSettings((prev) => ({ ...prev, [key]: value }));
      setMessage({ text: 'تم حفظ الإعداد بنجاح ✅', type: 'success' });
      addLog(`تغيير إعداد ${key} إلى ${String(value)}`);
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const toggleSetting = async (key) => {
    const newValue = !settings[key];
    await saveSetting(key, newValue);
  };

  const saveAnnouncement = async () => {
    await saveSetting('announcement_bar', settings.announcement_bar);
  };

  // =========================================================
  // VIP
  // =========================================================

  const setUserVIP = async (userId, currentUser, plan) => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    try {
      const isVip = plan !== 'none';
      const premiumPlan = isVip ? plan : 'none';

      const updateData = {
        is_vip: isVip,
        is_premium: isVip,
        premium_plan: premiumPlan,
        updated_at: new Date().toISOString(),
      };

      if (!currentUser.badge_manual) {
        const badgeType = automaticBadgeForPlan(premiumPlan);
        Object.assign(updateData, {
          badge_type: badgeType,
          ...badgeFieldsForType(badgeType),
        });
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...updateData } : u))
      );

      const wasVip = currentUser.is_vip || currentUser.is_premium;

      setStats((prev) => ({
        ...prev,
        vipUsers: prev.vipUsers + (isVip ? (wasVip ? 0 : 1) : wasVip ? -1 : 0),
      }));

      let planText = 'إلغاء VIP';
      if (plan === 'month') planText = 'VIP شهر';
      if (plan === 'year') planText = 'VIP عام';
      if (plan === 'manual') planText = 'VIP يدوي';

      setMessage({
        text: `تم تغيير اشتراك المستخدم إلى ${planText} ⭐`,
        type: 'success',
      });

      addLog(`تغيير VIP للمستخدم ${currentUser.user_code || userId} → ${planText}`);
    } catch (err) {
      console.error(err);
      setMessage({ text: `خطأ في VIP: ${err.message}`, type: 'error' });
    }
  };

  // =========================================================
  // BADGES
  // =========================================================

  const toggleBadge = async (userId, field, currentValue, badgeName) => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    try {
      const newValue = !currentValue;
      const typeMap = {
        verification_badge: 'verification',
        official_badge: 'official',
        owner_badge: 'owner',
      };
      const badgeType = typeMap[field];

      const updateData = {
        [field]: newValue,
        badge_manual: true,
        badge_type: newValue ? badgeType : 'none',
        updated_at: new Date().toISOString(),
      };

      if (!newValue) {
        const currentUser = users.find((u) => u.id === userId);
        if (currentUser) {
          let nextType = 'none';
          if (field !== 'verification_badge' && currentUser.verification_badge) {
            nextType = 'verification';
          } else if (field !== 'official_badge' && currentUser.official_badge) {
            nextType = 'official';
          } else if (field !== 'owner_badge' && currentUser.owner_badge) {
            nextType = 'owner';
          }
          updateData.badge_type = nextType;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...updateData } : u))
      );

      setStats((prev) => ({
        ...prev,
        verifiedUsers: field === 'verification_badge' ? prev.verifiedUsers + (newValue ? 1 : -1) : prev.verifiedUsers,
        officialUsers: field === 'official_badge' ? prev.officialUsers + (newValue ? 1 : -1) : prev.officialUsers,
        ownerUsers: field === 'owner_badge' ? prev.ownerUsers + (newValue ? 1 : -1) : prev.ownerUsers,
      }));

      setMessage({
        text: `${newValue ? 'تم إعطاء' : 'تم نزع'} ${badgeName} ${newValue ? '🏅' : '❌'}`,
        type: 'success',
      });

      addLog(`${newValue ? 'إعطاء' : 'نزع'} ${badgeName} للمستخدم ${userId}`);
    } catch (err) {
      console.error(err);
      setMessage({ text: `خطأ في البادج: ${err.message}`, type: 'error' });
    }
  };

  // =========================================================
  // CLEAR MANUAL BADGE
  // =========================================================

  const clearManualBadge = async (userId) => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    try {
      const currentUser = users.find((u) => u.id === userId);
      if (!currentUser) throw new Error('المستخدم غير موجود');

      const automaticType = automaticBadgeForPlan(currentUser.premium_plan);

      const updateData = {
        badge_manual: false,
        badge_type: automaticType,
        ...badgeFieldsForType(automaticType),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...updateData } : u))
      );

      setStats((prev) => {
        const oldVerification = currentUser.verification_badge;
        const oldOfficial = currentUser.official_badge;
        const oldOwner = currentUser.owner_badge;

        const newVerification = updateData.verification_badge;
        const newOfficial = updateData.official_badge;
        const newOwner = updateData.owner_badge;

        return {
          ...prev,
          verifiedUsers: prev.verifiedUsers + (newVerification ? 1 : 0) - (oldVerification ? 1 : 0),
          officialUsers: prev.officialUsers + (newOfficial ? 1 : 0) - (oldOfficial ? 1 : 0),
          ownerUsers: prev.ownerUsers + (newOwner ? 1 : 0) - (oldOwner ? 1 : 0),
        };
      });

      setMessage({
        text: 'تم إلغاء التحكم اليدوي وإرجاع البادج حسب VIP 🔄',
        type: 'success',
      });

      addLog(`إلغاء البادج اليدوي للمستخدم ${userId}`);
    } catch (err) {
      console.error(err);
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  // =========================================================
  // BAN
  // =========================================================

  const toggleUserBan = async (userId, isBanned) => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    try {
      const newValue = !isBanned;

      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: newValue } : u))
      );

      setStats((prev) => ({
        ...prev,
        bannedUsers: prev.bannedUsers + (newValue ? 1 : -1),
      }));

      setMessage({
        text: `تم ${newValue ? 'حظر' : 'فك حظر'} المستخدم بنجاح ${newValue ? '🚫' : '🔓'}`,
        type: 'success',
      });

      addLog(`${newValue ? 'حظر' : 'فك حظر'} المستخدم ${userId}`);
    } catch (err) {
      console.error(err);
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  // =========================================================
  // CONTENT
  // =========================================================

  const toggleTitleVisibility = async (titleId, isHidden) => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    try {
      const newValue = !isHidden;

      const { error } = await supabase
        .from('titles')
        .update({ is_hidden: newValue })
        .eq('id', titleId);

      if (error) throw error;

      setTitles((prev) =>
        prev.map((t) => (t.id === titleId ? { ...t, is_hidden: newValue } : t))
      );

      setStats((prev) => ({
        ...prev,
        hiddenTitles: prev.hiddenTitles + (newValue ? 1 : -1),
      }));

      setMessage({
        text: `تم ${newValue ? 'إخفاء' : 'إظهار'} العنوان 👁️`,
        type: 'success',
      });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const toggleTitlePremium = async (titleId, isPremium) => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    try {
      const newValue = !isPremium;

      const { error } = await supabase
        .from('titles')
        .update({ is_premium: newValue })
        .eq('id', titleId);

      if (error) throw error;

      setTitles((prev) =>
        prev.map((t) => (t.id === titleId ? { ...t, is_premium: newValue } : t))
      );

      setMessage({
        text: `تم تغيير حالة المحتوى إلى ${newValue ? 'VIP 🌟' : 'عادي'}`,
        type: 'success',
      });
    } catch (err) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    }
  };

  const deleteTitle = async (titleId, titleName) => {
    const isValid = await verifyActiveAdminSession();
    if (!isValid) return;

    if (!window.confirm(`هل أنت متأكد من حذف "${titleName}" نهائياً؟`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('titles')
        .delete()
        .eq('id', titleId);

      if (error) throw error;

      setTitles((prev) => prev.filter((t) => t.id !== titleId));

      setStats((prev) => ({
        ...prev,
        totalTitles: Math.max(0, prev.totalTitles - 1),
      }));

      setMessage({
        text: `تم حذف "${titleName}" بنجاح 🗑️`,
        type: 'success',
      });

      addLog(`حذف العنوان: ${titleName}`);
    } catch (err) {
      setMessage({ text: `خطأ في الحذف: ${err.message}`, type: 'error' });
    }
  };

  // =========================================================
  // FILTERS
  // =========================================================

  const searchValue = userSearch.toLowerCase();
  const filteredUsers = users.filter((u) => {
    return (
      (u.username || '').toLowerCase().includes(searchValue) ||
      (u.display_name || '').toLowerCase().includes(searchValue) ||
      (u.user_code || '').toLowerCase().includes(searchValue) ||
      (u.id || '').toLowerCase().includes(searchValue)
    );
  });

  const titleSearchValue = titleSearch.toLowerCase();
  const filteredTitles = titles.filter((t) => {
    return (
      (t.name || '').toLowerCase().includes(titleSearchValue) ||
      String(t.tmdb_id || '').toLowerCase().includes(titleSearchValue)
    );
  });

  // =========================================================
  // AUTH LOGIN SCREEN
  // =========================================================

  if (!isAuthenticated) {
    return (
      <div
        style={{
          background: '#0a0a0a',
          color: '#fff',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          direction: 'rtl',
          padding: '20px',
        }}
      >
        {authStep === 'login' && (
          <form
            onSubmit={handleSupabaseLogin}
            style={{
              background: '#141414',
              padding: '35px',
              borderRadius: '16px',
              border: '1px solid #282828',
              textAlign: 'center',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>

            <h2 style={{ fontSize: '22px', marginBottom: '8px', color: '#e50914' }}>
              دخول إدارة StreamFlix
            </h2>

            <p style={{ color: '#888', fontSize: '13px', marginBottom: '25px' }}>
              سجل الدخول بحساب Admin أو Owner
            </p>

            <input
              type="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '13px',
                borderRadius: '10px',
                border: '1px solid #333',
                background: '#222',
                color: '#fff',
                marginBottom: '12px',
                outline: 'none',
                direction: 'ltr',
                textAlign: 'left',
              }}
            />

            <input
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '13px',
                borderRadius: '10px',
                border: '1px solid #333',
                background: '#222',
                color: '#fff',
                marginBottom: '20px',
                outline: 'none',
                direction: 'ltr',
                textAlign: 'left',
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: '#e50914',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '15px',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? '⏳ جاري التحقق...' : 'تسجيل الدخول'}
            </button>

            {message.text && (
              <p
                style={{
                  color: message.type === 'success' ? '#6bff8d' : '#ff4d4d',
                  marginTop: '15px',
                  fontSize: '13px',
                }}
              >
                {message.text}
              </p>
            )}

            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                marginTop: '15px',
                background: 'transparent',
                color: '#777',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ← العودة للموقع
            </button>
          </form>
        )}

        {authStep === 'pin' && (
          <form
            onSubmit={handlePinSubmit}
            style={{
              background: '#141414',
              padding: '35px',
              borderRadius: '16px',
              border: '1px solid #282828',
              textAlign: 'center',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🛡️</div>

            <h2 style={{ fontSize: '22px', marginBottom: '8px', color: '#e50914' }}>
              لوحة تحكم StreamFlix
            </h2>

            <p style={{ color: '#888', fontSize: '13px', marginBottom: '25px' }}>
              الحساب مصادق عليه — أدخل رمز PIN المسؤول
            </p>

            <input
              type="password"
              maxLength={6}
              placeholder="****"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid #333',
                background: '#222',
                color: '#fff',
                textAlign: 'center',
                fontSize: '24px',
                letterSpacing: '6px',
                marginBottom: '20px',
                outline: 'none',
              }}
            />

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                background: '#e50914',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              فتح اللوحة
            </button>

            {message.text && (
              <p
                style={{
                  color: message.type === 'success' ? '#6bff8d' : '#ff4d4d',
                  marginTop: '15px',
                  fontSize: '13px',
                }}
              >
                {message.text}
              </p>
            )}

            <button
              type="button"
              onClick={handleLogout}
              style={{
                marginTop: '15px',
                background: 'transparent',
                color: '#777',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ← تسجيل الدخول بحساب آخر
            </button>
          </form>
        )}
      </div>
    );
  }

  // =========================================================
  // MAIN ADMIN
  // =========================================================

  return (
    <div
      style={{
        background: '#0a0a0a',
        color: '#fff',
        minHeight: '100vh',
        padding: '25px',
        direction: 'rtl',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1250px', margin: '0 auto' }}>
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px',
            borderBottom: '1px solid #222',
            paddingBottom: '15px',
            gap: '15px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                color: '#e50914',
                fontSize: '26px',
                margin: 0,
                fontWeight: '800',
              }}
            >
              ⚡ لوحة تحكم StreamFlix
            </h1>
            <span style={{ fontSize: '12px', color: '#666' }}>
              إدارة المستخدمين والـVIP والبادجات والمحتوى
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/import')}
              style={{
                background: '#0066cc',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              📥 الاستيراد
            </button>

            <button
              onClick={() => navigate('/')}
              style={{
                background: '#222',
                color: '#fff',
                border: '1px solid #333',
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              🏠 الموقع
            </button>

            <button
              onClick={handleLogout}
              style={{
                background: '#2a1212',
                color: '#ff5555',
                border: '1px solid #441a1a',
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🔒 خروج
            </button>
          </div>
        </div>

        {/* TABS */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '25px',
            overflowX: 'auto',
            paddingBottom: '5px',
          }}
        >
          {[
            { id: 'stats', label: '📊 الإحصائيات' },
            { id: 'settings', label: '⚙️ إعدادات VIP' },
            { id: 'users', label: '👥 المستخدمين والبادجات' },
            { id: 'content', label: '🎬 المحتوى' },
            { id: 'logs', label: '📋 السجلات' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setMessage({ text: '', type: '' });
              }}
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
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* MESSAGE */}
        {message.text && (
          <div
            style={{
              background: message.type === 'error' ? '#2a1212' : '#122a18',
              color: message.type === 'error' ? '#ff6b6b' : '#6bff8d',
              padding: '14px',
              borderRadius: '10px',
              marginBottom: '20px',
              border: '1px solid',
              borderColor: message.type === 'error' ? '#4a1e1e' : '#1e4a28',
              textAlign: 'center',
              fontWeight: 'bold',
            }}
          >
            {message.text}
          </div>
        )}

        {/* =====================================================
            STATS
        ===================================================== */}
        {activeTab === 'stats' && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                gap: '15px',
              }}
            >
              {[
                ['🎬', stats.totalTitles, 'الأفلام والمسلسلات'],
                ['👥', stats.totalUsers, 'المستخدمين'],
                ['⭐', stats.vipUsers, 'VIP'],
                ['🚫', stats.bannedUsers, 'محظورين'],
                ['✓', stats.verifiedUsers, 'Verified'],
                ['🔵', stats.officialUsers, 'Official'],
                ['👑', stats.ownerUsers, 'Owner'],
                ['🙈', stats.hiddenTitles, 'محتوى مخفي'],
              ].map(([icon, number, label]) => (
                <div
                  key={label}
                  style={{
                    background: '#141414',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #282828',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '30px', marginBottom: '5px' }}>{icon}</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{number}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>{label}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '20px',
                background: '#141414',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #282828',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 5px' }}>🔄 تحديث البيانات</h3>
                <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
                  إعادة جلب البيانات من Supabase
                </p>
              </div>

              <button
                onClick={fetchData}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {loading ? '⏳ جاري...' : '🔄 تحديث الآن'}
              </button>
            </div>
          </div>
        )}

        {/* =====================================================
            SETTINGS
        ===================================================== */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gap: '15px' }}>
            <div
              style={{
                background: '#181208',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #4a3610',
              }}
            >
              <h2 style={{ marginTop: 0, color: '#ffc107' }}>⭐ نظام VIP</h2>
              <p style={{ color: '#888', fontSize: '13px' }}>
                من هنا تتحكم في الميزات التي تحتاج VIP. إذا عطلت ميزة، المستخدم العادي لن يستطيع استعمالها وستظهر له ⭐.
              </p>
            </div>

            {[
              ['vip_features_enabled', '⭐ نظام ميزات VIP', 'تفعيل أو تعطيل نظام الميزات المدفوعة بالكامل'],
              ['vip_exclusive_content', '🎬 محتوى VIP', 'السماح بجعل الأفلام والمسلسلات حصرية لـVIP'],
              ['vip_media_messages', '📷 إرسال الصور والملفات', 'ميزة إرسال الصور والملفات في الرسائل'],
              ['vip_voice_messages', '🎙️ الرسائل الصوتية', 'ميزة إرسال Voice Messages'],
              ['vip_watch_party', '🎥 Watch Party', 'ميزة المشاهدة الجماعية مع الأصدقاء'],
              ['maintenance_mode', '🚧 وضع الصيانة', 'إيقاف الموقع مؤقتاً'],
              ['diagnostics_enabled', '🛠️ Diagnostics', 'إظهار معلومات التشخيص'],
            ].map(([key, title, description]) => (
              <div
                key={key}
                style={{
                  background: '#141414',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #282828',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 5px' }}>{title}</h3>
                  <p style={{ margin: 0, color: '#777', fontSize: '12px' }}>{description}</p>
                </div>

                <button
                  onClick={() => toggleSetting(key)}
                  style={{
                    minWidth: '120px',
                    padding: '11px 18px',
                    background: settings[key] ? '#28a745' : '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {settings[key] ? '🟢 مفعلة' : '⚪ معطلة'}
                </button>
              </div>
            ))}

            <div
              style={{
                background: '#141414',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #282828',
              }}
            >
              <h3 style={{ marginTop: 0 }}>📢 الشريط الإعلاني</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  value={settings.announcement_bar}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      announcement_bar: e.target.value,
                    }))
                  }
                  placeholder="اكتب الإعلان..."
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    background: '#222',
                    color: '#fff',
                  }}
                />

                <button
                  onClick={saveAnnouncement}
                  style={{
                    padding: '12px 20px',
                    background: '#0066cc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            USERS
        ===================================================== */}
        {activeTab === 'users' && (
          <div
            style={{
              background: '#141414',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #282828',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>👥 المستخدمين</h3>
                <span style={{ color: '#666', fontSize: '12px' }}>
                  {filteredUsers.length} مستخدم
                </span>
              </div>

              <input
                type="text"
                placeholder="🔎 username / الاسم / الكود / ID"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{
                  padding: '10px 15px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#222',
                  color: '#fff',
                  outline: 'none',
                  width: '300px',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              {filteredUsers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#777', padding: '30px' }}>
                  لا يوجد مستخدمين.
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      background: '#1c1c1c',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid #282828',
                    }}
                  >
                    {/* USER INFO */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '15px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '50%',
                              background: '#333',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '22px',
                            }}
                          >
                            👤
                          </div>
                        )}

                        <div>
                          <div
                            style={{
                              fontWeight: 'bold',
                              fontSize: '15px',
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            {u.display_name || u.username || u.user_code || 'مستخدم'}

                            {u.verification_badge && (
                              <span title="Verified" style={{ fontSize: '14px' }}>
                                ✓
                              </span>
                            )}

                            {u.official_badge && (
                              <span title="Official" style={{ fontSize: '14px' }}>
                                🔵
                              </span>
                            )}

                            {u.owner_badge && (
                              <span title="Owner" style={{ fontSize: '14px' }}>
                                👑
                              </span>
                            )}

                            {(u.is_vip || u.is_premium) && (
                              <span
                                style={{
                                  background: '#ffc107',
                                  color: '#000',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                }}
                              >
                                VIP ⭐
                              </span>
                            )}

                            {u.is_banned && (
                              <span
                                style={{
                                  background: '#d9534f',
                                  color: '#fff',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  fontSize: '10px',
                                }}
                              >
                                🚫 محظور
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>
                            @{u.username || 'no-username'} • {u.user_code || 'بدون كود'}
                          </div>
                        </div>
                      </div>

                      {/* BASIC ACTIONS */}
                      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => toggleUserBan(u.id, u.is_banned)}
                          style={{
                            padding: '8px 12px',
                            background: u.is_banned ? '#28a745' : '#d9534f',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        >
                          {u.is_banned ? '🔓 فك الحظر' : '🚫 حظر'}
                        </button>
                      </div>
                    </div>

                    {/* VIP */}
                    <div
                      style={{
                        marginTop: '15px',
                        paddingTop: '15px',
                        borderTop: '1px solid #292929',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#ffc107',
                          fontWeight: 'bold',
                          marginBottom: '8px',
                        }}
                      >
                        ⭐ إدارة VIP
                      </div>

                      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setUserVIP(u.id, u, 'none')}
                          style={{
                            padding: '8px 12px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          ❌ إزالة VIP
                        </button>

                        <button
                          onClick={() => setUserVIP(u.id, u, 'month')}
                          style={{
                            padding: '8px 12px',
                            background: '#ffc107',
                            color: '#000',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        >
                          ⭐ VIP شهر
                        </button>

                        <button
                          onClick={() => setUserVIP(u.id, u, 'year')}
                          style={{
                            padding: '8px 12px',
                            background: '#ff9800',
                            color: '#000',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        >
                          🏆 VIP عام
                        </button>

                        <button
                          onClick={() => setUserVIP(u.id, u, 'manual')}
                          style={{
                            padding: '8px 12px',
                            background: '#9c27b0',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        >
                          🛠️ VIP يدوي
                        </button>
                      </div>

                      <div style={{ marginTop: '8px', color: '#666', fontSize: '11px' }}>
                        الخطة الحالية:{' '}
                        <strong style={{ color: '#aaa' }}>{u.premium_plan || 'none'}</strong>
                      </div>
                    </div>

                    {/* BADGES */}
                    <div
                      style={{
                        marginTop: '15px',
                        paddingTop: '15px',
                        borderTop: '1px solid #292929',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#8ab4f8',
                          fontWeight: 'bold',
                          marginBottom: '8px',
                        }}
                      >
                        🏅 البادجات
                      </div>

                      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() =>
                            toggleBadge(
                              u.id,
                              'verification_badge',
                              u.verification_badge,
                              'Verification Badge'
                            )
                          }
                          style={{
                            padding: '8px 11px',
                            background: u.verification_badge ? '#155724' : '#222',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          {u.verification_badge ? '✓ Verified ON' : '✓ Verified OFF'}
                        </button>

                        <button
                          onClick={() =>
                            toggleBadge(
                              u.id,
                              'official_badge',
                              u.official_badge,
                              'Official Badge'
                            )
                          }
                          style={{
                            padding: '8px 11px',
                            background: u.official_badge ? '#123b69' : '#222',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          {u.official_badge ? '🔵 Official ON' : '🔵 Official OFF'}
                        </button>

                        <button
                          onClick={() =>
                            toggleBadge(
                              u.id,
                              'owner_badge',
                              u.owner_badge,
                              'Owner Badge'
                            )
                          }
                          style={{
                            padding: '8px 11px',
                            background: u.owner_badge ? '#4a3510' : '#222',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          {u.owner_badge ? '👑 Owner ON' : '👑 Owner OFF'}
                        </button>

                        {u.badge_manual && (
                          <button
                            onClick={() => clearManualBadge(u.id)}
                            style={{
                              padding: '8px 11px',
                              background: '#3b1b1b',
                              color: '#ff8a8a',
                              border: '1px solid #5a2929',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            🔄 إلغاء التحكم اليدوي
                          </button>
                        )}
                      </div>

                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                        البادج الحالي:{' '}
                        <strong style={{ color: '#aaa' }}>{u.badge_type || 'none'}</strong>
                        {u.badge_manual && ' • يدوي ✋'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =====================================================
            CONTENT
        ===================================================== */}
        {activeTab === 'content' && (
          <div
            style={{
              background: '#141414',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #282828',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <h3 style={{ margin: 0 }}>
                🎬 إدارة المحتوى ({filteredTitles.length})
              </h3>

              <input
                type="text"
                placeholder="🔎 اسم الفيلم / TMDB ID"
                value={titleSearch}
                onChange={(e) => setTitleSearch(e.target.value)}
                style={{
                  padding: '10px 15px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#222',
                  color: '#fff',
                  outline: 'none',
                  width: '280px',
                  maxWidth: '100%',
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredTitles.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#1c1c1c',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid #282828',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {item.poster_url ? (
                      <img
                        src={item.poster_url}
                        alt=""
                        style={{
                          width: '40px',
                          height: '55px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '55px',
                          background: '#333',
                          borderRadius: '6px',
                        }}
                      />
                    )}

                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {item.name}

                        {item.is_premium && (
                          <span style={{ color: '#ffc107', marginRight: '8px' }}>
                            ⭐ VIP
                          </span>
                        )}

                        {item.is_hidden && (
                          <span style={{ color: '#ff9800', marginRight: '8px', fontSize: '11px' }}>
                            مخفي
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '11px', color: '#777', marginTop: '3px' }}>
                        {item.type === 'series' ? 'مسلسل' : 'فيلم'} • TMDB:{' '}
                        {item.tmdb_id || 'غير مربوط'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => toggleTitlePremium(item.id, item.is_premium)}
                      style={{
                        padding: '7px 12px',
                        background: item.is_premium ? '#ff9800' : '#222',
                        color: '#fff',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      {item.is_premium ? '⭐ إزالة VIP' : '⭐ جعل VIP'}
                    </button>

                    <button
                      onClick={() => toggleTitleVisibility(item.id, item.is_hidden)}
                      style={{
                        padding: '7px 12px',
                        background: item.is_hidden ? '#28a745' : '#444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      {item.is_hidden ? '👁️ إظهار' : '🙈 إخفاء'}
                    </button>

                    <button
                      onClick={() => deleteTitle(item.id, item.name)}
                      style={{
                        padding: '7px 12px',
                        background: '#d9534f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                      }}
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =====================================================
            LOGS
        ===================================================== */}
        {activeTab === 'logs' && (
          <div
            style={{
              background: '#141414',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #282828',
            }}
          >
            <h3 style={{ margin: '0 0 15px' }}>📋 سجل العمليات</h3>

            <div
              style={{
                background: '#080808',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #222',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#00ff00',
                minHeight: '250px',
                overflow: 'auto',
              }}
            >
              {systemLogs.length === 0 ? (
                <div style={{ color: '#555' }}>لا توجد سجلات حالية.</div>
              ) : (
                systemLogs.map((log, index) => (
                  <div key={index} style={{ marginBottom: '8px' }}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
