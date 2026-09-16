import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '0508';
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

const BADGES = {
  verification: { label: 'Verified', icon: '✓' },
  official: { label: 'Official', icon: '🔵' },
  owner: { label: 'Owner', icon: '👑' },
};

const DEFAULT_SETTINGS = {
  maintenance_mode: false,
  diagnostics_enabled: false,
  announcement_bar: '',
  vip_exclusive_content: true,
  vip_features_enabled: true,
  vip_media_messages: true,
  vip_voice_messages: true,
  vip_watch_party: true,
};

const DEFAULT_STATS = {
  totalTitles: 0,
  totalUsers: 0,
  bannedUsers: 0,
  vipUsers: 0,
  verifiedUsers: 0,
  officialUsers: 0,
  ownerUsers: 0,
  hiddenTitles: 0,
};

function getFirstValue(obj, keys, fallback = '') {
  if (!obj || typeof obj !== 'object') return fallback;

  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(obj, key) &&
      obj[key] !== null &&
      obj[key] !== undefined &&
      obj[key] !== ''
    ) {
      return obj[key];
    }
  }

  return fallback;
}

function getUserName(user) {
  return getFirstValue(
    user,
    ['display_name', 'username', 'name', 'full_name', 'email'],
    'مستخدم'
  );
}

function getUserAvatar(user) {
  return getFirstValue(
    user,
    ['avatar_url', 'avatar', 'photo_url', 'picture'],
    ''
  );
}

function getUserBadges(user) {
  const badges = user?.badges;

  if (Array.isArray(badges)) return badges;

  if (typeof badges === 'string') {
    try {
      const parsed = JSON.parse(badges);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function isUserVip(user) {
  return Boolean(
    user?.is_premium ??
      user?.is_vip ??
      user?.vip ??
      user?.premium
  );
}

function isUserBanned(user) {
  return Boolean(
    user?.is_banned ??
      user?.banned ??
      user?.ban ??
      false
  );
}

function isTitleVip(title) {
  return Boolean(
    title?.is_vip ??
      title?.vip ??
      title?.vip_only ??
      title?.premium_only ??
      title?.is_premium ??
      false
  );
}

function isTitleHidden(title) {
  return Boolean(
    title?.is_hidden ??
      title?.hidden ??
      title?.hide ??
      false
  );
}

function getTitleName(title) {
  return getFirstValue(
    title,
    ['title', 'name', 'original_title', 'title_name'],
    `#${title?.id ?? '---'}`
  );
}

function getTitlePoster(title) {
  return getFirstValue(
    title,
    ['poster_url', 'poster', 'backdrop_url', 'image_url', 'image'],
    ''
  );
}

function getLocation(user) {
  return getFirstValue(
    user,
    ['location', 'city', 'address', 'country'],
    ''
  );
}

function formatDate(value) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleDateString('fr-FR');
  } catch {
    return '—';
  }
}

function calculateStats(users, titles) {
  let verifiedUsers = 0;
  let officialUsers = 0;
  let ownerUsers = 0;

  users.forEach((user) => {
    const badges = getUserBadges(user);

    if (
      badges.includes('verification') ||
      badges.includes('verified') ||
      badges.includes('✓')
    ) {
      verifiedUsers++;
    }

    if (
      badges.includes('official') ||
      badges.includes('🔵')
    ) {
      officialUsers++;
    }

    if (
      badges.includes('owner') ||
      badges.includes('👑')
    ) {
      ownerUsers++;
    }
  });

  return {
    totalTitles: titles.length,
    totalUsers: users.length,
    bannedUsers: users.filter(isUserBanned).length,
    vipUsers: users.filter(isUserVip).length,
    verifiedUsers,
    officialUsers,
    ownerUsers,
    hiddenTitles: titles.filter(isTitleHidden).length,
  };
}

export default function Admin() {
  const navigate = useNavigate();

  const [step, setStep] = useState('login');
  const [pin, setPin] = useState('');
  const [auth, setAuth] = useState(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);

  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [tab, setTab] = useState('stats');

  const [users, setUsers] = useState([]);
  const [titles, setTitles] = useState([]);

  const [userSearch, setUserSearch] = useState('');
  const [titleSearch, setTitleSearch] = useState('');

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [stats, setStats] = useState(DEFAULT_STATS);

  const [logs, setLogs] = useState([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [saving, setSaving] = useState(false);

  const addLog = useCallback((text, type = 'info') => {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        text,
        type,
        date: new Date().toLocaleString('fr-FR'),
      },
      ...prev,
    ].slice(0, 100));
  }, []);

  const checkAdmin = useCallback(async (userId) => {
    if (!userId) {
      setIsAdmin(false);
      return false;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('is_admin');

      if (rpcError) {
        console.error('is_admin RPC error:', rpcError);
        setIsAdmin(false);
        setError(`خطأ التحقق من Admin: ${rpcError.message}`);
        return false;
      }

      const result = data === true;

      setIsAdmin(result);

      if (!result) {
        setError('هذا الحساب ليس Admin.');
      }

      return result;
    } catch (err) {
      console.error(err);
      setIsAdmin(false);
      setError(err?.message || 'فشل التحقق من صلاحيات Admin.');
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setCheckingAuth(true);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!mounted) return;

        if (!session?.user) {
          setAuth(null);
          setIsAdmin(false);
          setStep('login');
          setCheckingAuth(false);
          return;
        }

        setAuth(session);

        const admin = await checkAdmin(session.user.id);

        if (!mounted) return;

        if (admin) {
          setStep('pin');
        } else {
          setStep('login');
        }
      } catch (err) {
        console.error(err);

        if (mounted) {
          setError(err?.message || 'تعذر التحقق من الحساب.');
          setAuth(null);
          setIsAdmin(false);
          setStep('login');
        }
      } finally {
        if (mounted) {
          setCheckingAuth(false);
        }
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      setAuth(session);

      if (!session?.user) {
        setIsAdmin(false);
        setStep('login');
        return;
      }

      const admin = await checkAdmin(session.user.id);

      if (!mounted) return;

      if (admin) {
        setStep('pin');
      } else {
        setStep('login');
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [checkAdmin]);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error: settingsError } = await supabase
        .from('site_settings')
        .select('*');

      if (settingsError) {
        console.error('settings error:', settingsError);
        addLog(
          `فشل تحميل الإعدادات: ${settingsError.message}`,
          'error'
        );
        return;
      }

      const next = { ...DEFAULT_SETTINGS };

      (data || []).forEach((row) => {
        if (!row?.key) return;

        let value = row.value;

        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch {
            // keep string
          }
        }

        if (row.key === 'maintenance_mode') {
          next.maintenance_mode =
            typeof value === 'object'
              ? Boolean(value?.enabled)
              : Boolean(value);
          return;
        }

        if (Object.prototype.hasOwnProperty.call(next, row.key)) {
          next[row.key] = value;
        }
      });

      setSettings(next);
    } catch (err) {
      console.error(err);
      addLog(
        `خطأ أثناء تحميل الإعدادات: ${err?.message || err}`,
        'error'
      );
    }
  }, [addLog]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);

    try {
      /*
       * مهم جداً:
       * لا نحدد أعمدة مثل wilaya هنا.
       * نستعمل * حتى Admin يخدم مهما كان مخطط profiles الحالي.
       */
      const { data, error: usersError } = await supabase
        .from('profiles')
        .select('*');

      if (usersError) {
        console.error('profiles error:', usersError);

        setUsers([]);
        addLog(
          `فشل تحميل المستخدمين: ${usersError.message}`,
          'error'
        );

        setError(`المستخدمين: ${usersError.message}`);
        return [];
      }

      const list = Array.isArray(data) ? data : [];

      setUsers(list);

      return list;
    } catch (err) {
      console.error(err);

      setUsers([]);

      addLog(
        `خطأ profiles: ${err?.message || err}`,
        'error'
      );

      setError(`المستخدمين: ${err?.message || err}`);

      return [];
    } finally {
      setLoadingUsers(false);
    }
  }, [addLog]);

  const fetchTitles = useCallback(async () => {
    setLoadingTitles(true);

    try {
      /*
       * نفس الفكرة مع titles:
       * لا نفترض أسماء أعمدة غير مؤكدة.
       * نجيب كل الأعمدة الموجودة فعلياً.
       */
      const { data, error: titlesError } = await supabase
        .from('titles')
        .select('*');

      if (titlesError) {
        console.error('titles error:', titlesError);

        setTitles([]);

        addLog(
          `فشل تحميل المحتوى: ${titlesError.message}`,
          'error'
        );

        setError(`المحتوى: ${titlesError.message}`);

        return [];
      }

      const list = Array.isArray(data) ? data : [];

      setTitles(list);

      return list;
    } catch (err) {
      console.error(err);

      setTitles([]);

      addLog(
        `خطأ titles: ${err?.message || err}`,
        'error'
      );

      setError(`المحتوى: ${err?.message || err}`);

      return [];
    } finally {
      setLoadingTitles(false);
    }
  }, [addLog]);

  const fetchData = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError('');
    setMsg('');

    try {
      const [loadedUsers, loadedTitles] = await Promise.all([
        fetchUsers(),
        fetchTitles(),
      ]);

      await fetchSettings();

      const nextStats = calculateStats(
        loadedUsers,
        loadedTitles
      );

      setStats(nextStats);

      addLog(
        `تم تحميل ${loadedUsers.length} مستخدم و ${loadedTitles.length} عنوان`,
        'success'
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'حدث خطأ غير معروف أثناء تحميل بيانات Admin.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    isAdmin,
    fetchUsers,
    fetchTitles,
    fetchSettings,
    addLog,
  ]);

  useEffect(() => {
    if (step === 'dashboard' && isAdmin) {
      fetchData();
    }
  }, [step, isAdmin, fetchData]);

  async function loginGoogle() {
    setError('');
    setMsg('');

    try {
      const { error: loginError } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.href,
          },
        });

      if (loginError) {
        throw loginError;
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || 'فشل تسجيل الدخول بواسطة Google.');
    }
  }

  function submitPin(e) {
    e.preventDefault();

    setError('');
    setMsg('');

    if (!auth?.user) {
      setError('سجل الدخول أولاً.');
      return;
    }

    if (!isAdmin) {
      setError('هذا الحساب ليس Admin.');
      return;
    }

    const now = Date.now();

    if (lockUntil && now < lockUntil) {
      const remaining = Math.ceil(
        (lockUntil - now) / 1000
      );

      setError(
        `محاولات كثيرة. حاول بعد ${Math.ceil(
          remaining / 60
        )} دقيقة.`
      );

      return;
    }

    if (pin !== ADMIN_PIN) {
      const nextFailed = failedAttempts + 1;

      setFailedAttempts(nextFailed);
      setPin('');

      if (nextFailed >= MAX_FAILED) {
        const until = Date.now() + LOCK_MS;

        setLockUntil(until);

        setError(
          'تم قفل لوحة Admin لمدة 15 دقيقة بسبب كثرة المحاولات.'
        );
      } else {
        setError(
          `PIN خاطئ. تبقى ${
            MAX_FAILED - nextFailed
          } محاولات.`
        );
      }

      return;
    }

    setFailedAttempts(0);
    setLockUntil(null);
    setPin('');
    setStep('dashboard');
    setMsg('تم فتح لوحة التحكم بنجاح.');
    addLog('تم فتح لوحة Admin', 'success');
  }

  async function logout() {
    await supabase.auth.signOut();

    setAuth(null);
    setIsAdmin(false);
    setStep('login');
    setPin('');
    setUsers([]);
    setTitles([]);
    setStats(DEFAULT_STATS);
  }

  async function saveSetting(key, value) {
    if (!isAdmin) {
      setError('غير مصرح.');
      return;
    }

    setSaving(true);
    setError('');
    setMsg('');

    try {
      let storedValue = value;

      if (key === 'maintenance_mode') {
        storedValue = {
          enabled: Boolean(value),
        };
      }

      const { error: saveError } = await supabase
        .from('site_settings')
        .upsert(
          {
            key,
            value: storedValue,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'key',
          }
        );

      if (saveError) {
        throw saveError;
      }

      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));

      setMsg('تم حفظ الإعداد بنجاح.');
      addLog(`تم تعديل الإعداد: ${key}`, 'success');
    } catch (err) {
      console.error(err);

      setError(
        `فشل حفظ الإعداد: ${
          err?.message || err
        }`
      );

      addLog(
        `فشل تعديل ${key}: ${err?.message || err}`,
        'error'
      );
    } finally {
      setSaving(false);
    }
  }

  function getProfileUpdateValue(profile, field, value) {
    if (!profile) return null;

    if (Object.prototype.hasOwnProperty.call(profile, field)) {
      return {
        [field]: value,
      };
    }

    return null;
  }

  async function setVip(user, mode) {
    if (!user?.id) return;

    setSaving(true);
    setError('');
    setMsg('');

    try {
      const value = mode !== 'none';

      const updateValue =
        getProfileUpdateValue(
          user,
          'is_premium',
          value
        ) ||
        getProfileUpdateValue(
          user,
          'is_vip',
          value
        );

      if (!updateValue) {
        throw new Error(
          'لم نجد عمود VIP/ Premium في profiles.'
        );
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateValue)
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      const nextUsers = users.map((item) =>
        item.id === user.id
          ? {
              ...item,
              ...updateValue,
            }
          : item
      );

      setUsers(nextUsers);
      setStats(calculateStats(nextUsers, titles));

      setMsg(
        value
          ? `تم تفعيل VIP لـ ${getUserName(user)}`
          : `تم إلغاء VIP لـ ${getUserName(user)}`
      );

      addLog(
        `${value ? 'تفعيل' : 'إلغاء'} VIP للمستخدم ${getUserName(
          user
        )}`,
        'success'
      );
    } catch (err) {
      console.error(err);

      setError(
        `فشل تعديل VIP: ${
          err?.message || err
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function setBadge(user, badgeKey) {
    if (!user?.id) return;

    setSaving(true);
    setError('');
    setMsg('');

    try {
      const current = getUserBadges(user);

      const exists = current.includes(badgeKey);

      const nextBadges = exists
        ? current.filter((x) => x !== badgeKey)
        : [...current, badgeKey];

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          badges: nextBadges,
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      const nextUsers = users.map((item) =>
        item.id === user.id
          ? {
              ...item,
              badges: nextBadges,
            }
          : item
      );

      setUsers(nextUsers);
      setStats(calculateStats(nextUsers, titles));

      setMsg(
        exists
          ? `تم حذف شارة ${BADGES[badgeKey]?.label}`
          : `تمت إضافة شارة ${BADGES[badgeKey]?.label}`
      );

      addLog(
        `${exists ? 'حذف' : 'إضافة'} badge ${badgeKey} للمستخدم ${getUserName(
          user
        )}`,
        'success'
      );
    } catch (err) {
      console.error(err);

      setError(
        `فشل تعديل الشارة: ${
          err?.message || err
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateTitleBoolean(title, value, candidates) {
    if (!title?.id) return;

    const field = candidates.find((key) =>
      Object.prototype.hasOwnProperty.call(title, key)
    );

    if (!field) {
      throw new Error(
        `لم نجد العمود المطلوب في titles. الأعمدة الموجودة: ${Object.keys(
          title
        ).join(', ')}`
      );
    }

    const { error: updateError } = await supabase
      .from('titles')
      .update({
        [field]: value,
      })
      .eq('id', title.id);

    if (updateError) {
      throw updateError;
    }

    const nextTitles = titles.map((item) =>
      item.id === title.id
        ? {
            ...item,
            [field]: value,
          }
        : item
    );

    setTitles(nextTitles);
    setStats(calculateStats(users, nextTitles));

    return nextTitles;
  }

  async function toggleTitleVip(title) {
    setSaving(true);
    setError('');
    setMsg('');

    try {
      await updateTitleBoolean(
        title,
        !isTitleVip(title),
        [
          'is_vip',
          'vip',
          'vip_only',
          'premium_only',
          'is_premium',
        ]
      );

      setMsg('تم تعديل حالة VIP للمحتوى.');
      addLog(
        `تم تعديل VIP للمحتوى: ${getTitleName(title)}`,
        'success'
      );
    } catch (err) {
      console.error(err);

      setError(
        `فشل تعديل VIP للمحتوى: ${
          err?.message || err
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleTitleHidden(title) {
    setSaving(true);
    setError('');
    setMsg('');

    try {
      await updateTitleBoolean(
        title,
        !isTitleHidden(title),
        [
          'is_hidden',
          'hidden',
          'hide',
        ]
      );

      setMsg('تم تعديل حالة إخفاء المحتوى.');
      addLog(
        `تم تعديل إخفاء المحتوى: ${getTitleName(title)}`,
        'success'
      );
    } catch (err) {
      console.error(err);

      setError(
        `فشل إخفاء المحتوى: ${
          err?.message || err
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTitle(title) {
    if (!title?.id) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف "${getTitleName(title)}"؟`
    );

    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMsg('');

    try {
      const { error: deleteError } = await supabase
        .from('titles')
        .delete()
        .eq('id', title.id);

      if (deleteError) {
        throw deleteError;
      }

      const nextTitles = titles.filter(
        (item) => item.id !== title.id
      );

      setTitles(nextTitles);
      setStats(calculateStats(users, nextTitles));

      setMsg('تم حذف المحتوى.');
      addLog(
        `تم حذف المحتوى: ${getTitleName(title)}`,
        'success'
      );
    } catch (err) {
      console.error(err);

      setError(
        `فشل حذف المحتوى: ${
          err?.message || err
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    const q = userSearch.trim().toLowerCase();

    if (!q) return true;

    const searchable = [
      user?.id,
      user?.email,
      user?.display_name,
      user?.username,
      user?.name,
      user?.full_name,
      user?.location,
      user?.city,
      user?.country,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(q);
  });

  const filteredTitles = titles.filter((title) => {
    const q = titleSearch.trim().toLowerCase();

    if (!q) return true;

    return [
      title?.id,
      title?.title,
      title?.name,
      title?.original_title,
      title?.title_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  if (checkingAuth) {
    return (
      <div style={S.page}>
        <div style={S.centerCard}>
          <div style={S.spinner}>⏳</div>
          <h2>جاري التحقق...</h2>
        </div>
      </div>
    );
  }

  if (!auth?.user) {
    return (
      <div style={S.page}>
        <div style={S.centerCard}>
          <div style={S.logo}>SF</div>

          <h1 style={S.title}>StreamFlix Admin</h1>

          <p style={S.muted}>
            يجب تسجيل الدخول بحساب Admin.
          </p>

          {error && (
            <div style={S.errorBox}>
              {error}
            </div>
          )}

          <button
            style={S.primaryButton}
            onClick={loginGoogle}
          >
            تسجيل الدخول بواسطة Google
          </button>

          <button
            style={S.secondaryButton}
            onClick={() => navigate('/')}
          >
            العودة للموقع
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={S.page}>
        <div style={S.centerCard}>
          <div style={S.dangerIcon}>!</div>

          <h1 style={S.title}>
            لا توجد صلاحيات Admin
          </h1>

          <p style={S.muted}>
            الحساب الحالي:
          </p>

          <div style={S.email}>
            {auth.user.email}
          </div>

          {error && (
            <div style={S.errorBox}>
              {error}
            </div>
          )}

          <button
            style={S.secondaryButton}
            onClick={logout}
          >
            تسجيل الخروج
          </button>

          <button
            style={S.primaryButton}
            onClick={() => navigate('/')}
          >
            العودة للموقع
          </button>
        </div>
      </div>
    );
  }

  if (step === 'pin') {
    return (
      <div style={S.page}>
        <div style={S.centerCard}>
          <div style={S.logo}>SF</div>

          <h1 style={S.title}>
            StreamFlix Admin
          </h1>

          <p style={S.muted}>
            أدخل رمز الحماية للوصول إلى لوحة التحكم
          </p>

          <div style={S.email}>
            {auth.user.email}
          </div>

          {error && (
            <div style={S.errorBox}>
              {error}
            </div>
          )}

          <form onSubmit={submitPin}>
            <input
              type="password"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value)
              }
              placeholder="PIN"
              maxLength={10}
              style={S.pinInput}
              autoFocus
            />

            <button
              type="submit"
              style={S.primaryButton}
            >
              دخول لوحة التحكم
            </button>
          </form>

          <button
            style={S.secondaryButton}
            onClick={logout}
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.dashboard}>
      <header style={S.header}>
        <div>
          <div style={S.brand}>
            <span style={S.logoSmall}>SF</span>
            <span>StreamFlix Admin</span>
          </div>

          <div style={S.headerSub}>
            {auth.user.email}
          </div>
        </div>

        <div style={S.headerActions}>
          <button
            style={S.secondaryButtonSmall}
            onClick={fetchData}
            disabled={loading || saving}
          >
            🔄 تحديث
          </button>

          <button
            style={S.secondaryButtonSmall}
            onClick={() => navigate('/')}
          >
            الموقع
          </button>

          <button
            style={S.dangerButtonSmall}
            onClick={logout}
          >
            خروج
          </button>
        </div>
      </header>

      <div style={S.layout}>
        <aside style={S.sidebar}>
          {[
            ['stats', '📊', 'الإحصائيات'],
            ['settings', '⚙️', 'الإعدادات'],
            ['users', '👥', 'المستخدمون'],
            ['content', '🎬', 'المحتوى'],
            ['logs', '📋', 'السجل'],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                ...S.sideButton,
                ...(tab === key
                  ? S.sideButtonActive
                  : {}),
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </aside>

        <main style={S.main}>
          {msg && (
            <div style={S.successBox}>
              ✓ {msg}
            </div>
          )}

          {error && (
            <div style={S.errorBox}>
              <strong>خطأ:</strong> {error}
            </div>
          )}

          {tab === 'stats' && (
            <section>
              <div style={S.sectionHeader}>
                <div>
                  <h1 style={S.sectionTitle}>
                    الإحصائيات
                  </h1>

                  <p style={S.muted}>
                    بيانات حقيقية مباشرة من Supabase
                  </p>
                </div>

                <button
                  style={S.primaryButtonSmall}
                  onClick={fetchData}
                  disabled={loading}
                >
                  {loading
                    ? 'جاري التحميل...'
                    : 'تحديث البيانات'}
                </button>
              </div>

              <div style={S.statsGrid}>
                <StatCard
                  icon="🎬"
                  label="إجمالي المحتوى"
                  value={stats.totalTitles}
                />

                <StatCard
                  icon="👥"
                  label="إجمالي المستخدمين"
                  value={stats.totalUsers}
                />

                <StatCard
                  icon="⭐"
                  label="مستخدمو VIP"
                  value={stats.vipUsers}
                />

                <StatCard
                  icon="🚫"
                  label="المحظورون"
                  value={stats.bannedUsers}
                />

                <StatCard
                  icon="✓"
                  label="Verified"
                  value={stats.verifiedUsers}
                />

                <StatCard
                  icon="🔵"
                  label="Official"
                  value={stats.officialUsers}
                />

                <StatCard
                  icon="👑"
                  label="Owner"
                  value={stats.ownerUsers}
                />

                <StatCard
                  icon="🙈"
                  label="محتوى مخفي"
                  value={stats.hiddenTitles}
                />
              </div>

              <div style={S.infoCard}>
                <h3 style={S.cardTitle}>
                  حالة الاتصال
                </h3>

                <div style={S.connectionRow}>
                  <span style={S.onlineDot} />
                  <span>
                    Supabase متصل
                  </span>
                </div>

                <div style={S.dataRow}>
                  <span>Users المحملة</span>
                  <strong>
                    {users.length}
                  </strong>
                </div>

                <div style={S.dataRow}>
                  <span>Titles المحملة</span>
                  <strong>
                    {titles.length}
                  </strong>
                </div>
              </div>
            </section>
          )}

          {tab === 'settings' && (
            <section>
              <div style={S.sectionHeader}>
                <div>
                  <h1 style={S.sectionTitle}>
                    إعدادات الموقع
                  </h1>

                  <p style={S.muted}>
                    تحكم في وظائف StreamFlix
                  </p>
                </div>
              </div>

              <div style={S.settingsGrid}>
                <SettingToggle
                  label="وضع الصيانة"
                  description="يعرض نافذة صيانة فقط، ولا يعطل الموقع."
                  value={settings.maintenance_mode}
                  disabled={saving}
                  onChange={(value) =>
                    saveSetting(
                      'maintenance_mode',
                      value
                    )
                  }
                />

                <SettingToggle
                  label="التشخيص"
                  description="تفعيل أدوات التشخيص."
                  value={settings.diagnostics_enabled}
                  disabled={saving}
                  onChange={(value) =>
                    saveSetting(
                      'diagnostics_enabled',
                      value
                    )
                  }
                />

                <SettingToggle
                  label="محتوى VIP"
                  description="تفعيل المحتوى الحصري لـ VIP."
                  value={settings.vip_exclusive_content}
                  disabled={saving}
                  onChange={(value) =>
                    saveSetting(
                      'vip_exclusive_content',
                      value
                    )
                  }
                />

                <SettingToggle
                  label="ميزات VIP"
                  description="تفعيل ميزات VIP."
                  value={settings.vip_features_enabled}
                  disabled={saving}
                  onChange={(value) =>
                    saveSetting(
                      'vip_features_enabled',
                      value
                    )
                  }
                />

                <SettingToggle
                  label="رسائل الصور لـ VIP"
                  description="السماح لميزات الوسائط."
                  value={settings.vip_media_messages}
                  disabled={saving}
                  onChange={(value) =>
                    saveSetting(
                      'vip_media_messages',
                      value
                    )
                  }
                />

                <SettingToggle
                  label="الرسائل الصوتية لـ VIP"
                  description="السماح بالرسائل الصوتية."
                  value={settings.vip_voice_messages}
                  disabled={saving}
                  onChange={(value) =>
                    saveSetting(
                      'vip_voice_messages',
                      value
                    )
                  }
                />

                <SettingToggle
                  label="Watch Party"
                  description="تفعيل المشاهدة الجماعية."
                  value={settings.vip_watch_party}
                  disabled={saving}
                  onChange={(value) =>
                    saveSetting(
                      'vip_watch_party',
                      value
                    )
                  }
                />
              </div>

              <div style={S.infoCard}>
                <h3 style={S.cardTitle}>
                  📢 شريط الإعلان
                </h3>

                <textarea
                  value={settings.announcement_bar || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      announcement_bar:
                        e.target.value,
                    }))
                  }
                  placeholder="اكتب إعلان الموقع..."
                  style={S.textarea}
                />

                <button
                  style={S.primaryButtonSmall}
                  disabled={saving}
                  onClick={() =>
                    saveSetting(
                      'announcement_bar',
                      settings.announcement_bar || ''
                    )
                  }
                >
                  حفظ الإعلان
                </button>
              </div>

              <div style={S.maintenanceInfo}>
                <div style={S.maintenanceIcon}>
                  🛠️
                </div>

                <div>
                  <strong>
                    وضع الصيانة في StreamFlix
                  </strong>

                  <p>
                    عند تفعيله سيظهر للمستخدمين
                    Popup تنبيه بالصيانة فقط.
                    الموقع لا يتم حجبه ولا يتم
                    تعطيل الصفحات.
                  </p>
                </div>
              </div>
            </section>
          )}

          {tab === 'users' && (
            <section>
              <div style={S.sectionHeader}>
                <div>
                  <h1 style={S.sectionTitle}>
                    المستخدمون
                  </h1>

                  <p style={S.muted}>
                    {users.length} مستخدم محمل من قاعدة البيانات
                  </p>
                </div>

                <input
                  value={userSearch}
                  onChange={(e) =>
                    setUserSearch(e.target.value)
                  }
                  placeholder="بحث عن مستخدم..."
                  style={S.search}
                />
              </div>

              {loadingUsers ? (
                <EmptyState text="جاري تحميل المستخدمين..." />
              ) : users.length === 0 ? (
                <EmptyState text="لم يتم تحميل أي مستخدم من قاعدة البيانات." />
              ) : filteredUsers.length === 0 ? (
                <EmptyState text="لا توجد نتائج مطابقة للبحث." />
              ) : (
                <div style={S.usersGrid}>
                  {filteredUsers.map((user) => {
                    const badges =
                      getUserBadges(user);

                    const vip =
                      isUserVip(user);

                    return (
                      <div
                        key={user.id}
                        style={S.userCard}
                      >
                        <div style={S.userTop}>
                          {getUserAvatar(user) ? (
                            <img
                              src={getUserAvatar(user)}
                              alt=""
                              style={S.avatar}
                            />
                          ) : (
                            <div style={S.avatarFallback}>
                              {getUserName(user)
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}

                          <div style={{ minWidth: 0 }}>
                            <div style={S.userName}>
                              {getUserName(user)}
                            </div>

                            <div style={S.userEmail}>
                              {user.email || '—'}
                            </div>
                          </div>
                        </div>

                        <div style={S.userMeta}>
                          <span>
                            ID: {user.id || '—'}
                          </span>

                          <span>
                            الموقع:{' '}
                            {getLocation(user) || '—'}
                          </span>

                          <span>
                            التسجيل:{' '}
                            {formatDate(
                              user.created_at
                            )}
                          </span>
                        </div>

                        <div style={S.badgesRow}>
                          {vip && (
                            <span style={S.vipBadge}>
                              ⭐ VIP
                            </span>
                          )}

                          {badges.map((badge) => (
                            <span
                              key={badge}
                              style={S.smallBadge}
                            >
                              {BADGES[badge]?.icon ||
                                badge}
                            </span>
                          ))}
                        </div>

                        <div style={S.actions}>
                          <button
                            style={
                              vip
                                ? S.warningButton
                                : S.primaryButtonSmall
                            }
                            disabled={saving}
                            onClick={() =>
                              setVip(
                                user,
                                vip ? 'none' : 'manual'
                              )
                            }
                          >
                            {vip
                              ? 'إلغاء VIP'
                              : 'إعطاء VIP'}
                          </button>

                          {Object.keys(BADGES).map(
                            (badgeKey) => {
                              const active =
                                badges.includes(
                                  badgeKey
                                );

                              return (
                                <button
                                  key={badgeKey}
                                  style={
                                    active
                                      ? S.badgeActiveButton
                                      : S.secondaryButtonSmall
                                  }
                                  disabled={saving}
                                  onClick={() =>
                                    setBadge(
                                      user,
                                      badgeKey
                                    )
                                  }
                                >
                                  {
                                    BADGES[badgeKey]
                                      .icon
                                  }{' '}
                                  {
                                    BADGES[badgeKey]
                                      .label
                                  }
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === 'content' && (
            <section>
              <div style={S.sectionHeader}>
                <div>
                  <h1 style={S.sectionTitle}>
                    المحتوى
                  </h1>

                  <p style={S.muted}>
                    {titles.length} عنوان محمل من قاعدة البيانات
                  </p>
                </div>

                <input
                  value={titleSearch}
                  onChange={(e) =>
                    setTitleSearch(e.target.value)
                  }
                  placeholder="بحث عن فيلم أو مسلسل..."
                  style={S.search}
                />
              </div>

              {loadingTitles ? (
                <EmptyState text="جاري تحميل المحتوى..." />
              ) : titles.length === 0 ? (
                <EmptyState text="لم يتم تحميل أي محتوى من قاعدة البيانات." />
              ) : filteredTitles.length === 0 ? (
                <EmptyState text="لا توجد نتائج مطابقة للبحث." />
              ) : (
                <div style={S.contentGrid}>
                  {filteredTitles.map((title) => {
                    const vip =
                      isTitleVip(title);

                    const hidden =
                      isTitleHidden(title);

                    return (
                      <div
                        key={title.id}
                        style={S.contentCard}
                      >
                        {getTitlePoster(title) ? (
                          <img
                            src={getTitlePoster(title)}
                            alt=""
                            style={S.poster}
                          />
                        ) : (
                          <div style={S.posterFallback}>
                            🎬
                          </div>
                        )}

                        <div style={S.contentInfo}>
                          <div style={S.contentTitle}>
                            {getTitleName(title)}
                          </div>

                          <div style={S.contentId}>
                            ID: {title.id}
                          </div>

                          <div style={S.contentBadges}>
                            {vip && (
                              <span style={S.vipBadge}>
                                ⭐ VIP
                              </span>
                            )}

                            {hidden && (
                              <span style={S.hiddenBadge}>
                                🙈 مخفي
                              </span>
                            )}
                          </div>

                          <div style={S.actions}>
                            <button
                              style={
                                vip
                                  ? S.warningButton
                                  : S.primaryButtonSmall
                              }
                              disabled={saving}
                              onClick={() =>
                                toggleTitleVip(title)
                              }
                            >
                              {vip
                                ? 'إلغاء VIP'
                                : 'VIP'}
                            </button>

                            <button
                              style={
                                hidden
                                  ? S.warningButton
                                  : S.secondaryButtonSmall
                              }
                              disabled={saving}
                              onClick={() =>
                                toggleTitleHidden(title)
                              }
                            >
                              {hidden
                                ? 'إظهار'
                                : 'إخفاء'}
                            </button>

                            <button
                              style={S.dangerButtonSmall}
                              disabled={saving}
                              onClick={() =>
                                deleteTitle(title)
                              }
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === 'logs' && (
            <section>
              <div style={S.sectionHeader}>
                <div>
                  <h1 style={S.sectionTitle}>
                    سجل العمليات
                  </h1>

                  <p style={S.muted}>
                    آخر عمليات لوحة التحكم
                  </p>
                </div>

                <button
                  style={S.secondaryButtonSmall}
                  onClick={() => setLogs([])}
                >
                  مسح السجل
                </button>
              </div>

              {logs.length === 0 ? (
                <EmptyState text="لا توجد عمليات مسجلة بعد." />
              ) : (
                <div style={S.logs}>
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        ...S.log,
                        borderLeft:
                          log.type === 'error'
                            ? '3px solid #ef4444'
                            : log.type === 'success'
                            ? '3px solid #22c55e'
                            : '3px solid #64748b',
                      }}
                    >
                      <div>
                        {log.text}
                      </div>

                      <small>
                        {log.date}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={S.statCard}>
      <div style={S.statIcon}>
        {icon}
      </div>

      <div>
        <div style={S.statValue}>
          {value}
        </div>

        <div style={S.statLabel}>
          {label}
        </div>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  value,
  onChange,
  disabled,
}) {
  return (
    <div style={S.settingCard}>
      <div style={{ flex: 1 }}>
        <div style={S.settingTitle}>
          {label}
        </div>

        <div style={S.settingDescription}>
          {description}
        </div>
      </div>

      <button
        disabled={disabled}
        onClick={() => onChange(!value)}
        style={{
          ...S.toggle,
          background: value
            ? '#22c55e'
            : '#334155',
        }}
      >
        <span
          style={{
            ...S.toggleCircle,
            transform: value
              ? 'translateX(22px)'
              : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={S.empty}>
      <div style={S.emptyIcon}>📭</div>
      <div>{text}</div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(135deg,#020617,#0f172a,#111827)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    boxSizing: 'border-box',
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  centerCard: {
    width: '100%',
    maxWidth: 430,
    background: 'rgba(15,23,42,.95)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 24,
    padding: 30,
    boxSizing: 'border-box',
    textAlign: 'center',
    boxShadow:
      '0 30px 80px rgba(0,0,0,.45)',
  },

  logo: {
    width: 68,
    height: 68,
    borderRadius: 20,
    margin: '0 auto 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 25,
    background:
      'linear-gradient(135deg,#e50914,#ff4050)',
    boxShadow:
      '0 15px 40px rgba(229,9,20,.35)',
  },

  logoSmall: {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    background:
      'linear-gradient(135deg,#e50914,#ff4050)',
  },

  title: {
    fontSize: 25,
    margin: '0 0 10px',
  },

  muted: {
    color: '#94a3b8',
    lineHeight: 1.6,
  },

  email: {
    margin: '12px 0 20px',
    padding: '10px 14px',
    borderRadius: 12,
    background: '#020617',
    color: '#cbd5e1',
    wordBreak: 'break-all',
  },

  errorBox: {
    background: 'rgba(239,68,68,.12)',
    border: '1px solid rgba(239,68,68,.3)',
    color: '#fecaca',
    padding: 13,
    borderRadius: 12,
    marginBottom: 15,
    lineHeight: 1.5,
    textAlign: 'left',
  },

  successBox: {
    background: 'rgba(34,197,94,.12)',
    border: '1px solid rgba(34,197,94,.3)',
    color: '#bbf7d0',
    padding: 13,
    borderRadius: 12,
    marginBottom: 15,
  },

  primaryButton: {
    width: '100%',
    border: 0,
    borderRadius: 13,
    padding: '13px 16px',
    background:
      'linear-gradient(135deg,#e50914,#ff4050)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
    marginBottom: 10,
  },

  secondaryButton: {
    width: '100%',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 13,
    padding: '13px 16px',
    background: '#1e293b',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 10,
  },

  pinInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 14,
    borderRadius: 13,
    border: '1px solid #334155',
    background: '#020617',
    color: '#fff',
    outline: 'none',
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 8,
    marginBottom: 12,
  },

  dangerIcon: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    margin: '0 auto 15px',
    background: '#450a0a',
    color: '#f87171',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 30,
    fontWeight: 900,
  },

  dashboard: {
    minHeight: '100vh',
    background: '#020617',
    color: '#fff',
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  header: {
    minHeight: 76,
    padding: '14px 22px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontWeight: 900,
    fontSize: 18,
  },

  headerSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },

  headerActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },

  layout: {
    display: 'grid',
    gridTemplateColumns: '220px minmax(0,1fr)',
    minHeight: 'calc(100vh - 76px)',
  },

  sidebar: {
    background: '#0f172a',
    borderRight: '1px solid #1e293b',
    padding: 14,
  },

  sideButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: 0,
    borderRadius: 12,
    padding: '12px 14px',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    marginBottom: 5,
    textAlign: 'left',
    fontWeight: 700,
  },

  sideButtonActive: {
    background:
      'linear-gradient(135deg,rgba(229,9,20,.2),rgba(255,64,80,.08))',
    color: '#fff',
    border:
      '1px solid rgba(229,9,20,.25)',
  },

  main: {
    minWidth: 0,
    padding: 24,
    overflow: 'auto',
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    marginBottom: 22,
    flexWrap: 'wrap',
  },

  sectionTitle: {
    margin: 0,
    fontSize: 28,
  },

  search: {
    width: 280,
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#fff',
    outline: 'none',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(180px,1fr))',
    gap: 14,
    marginBottom: 22,
  },

  statCard: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 18,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 15,
  },

  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
  },

  statValue: {
    fontSize: 25,
    fontWeight: 900,
  },

  statLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
  },

  infoCard: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 18,
    padding: 20,
    marginTop: 18,
  },

  cardTitle: {
    marginTop: 0,
  },

  connectionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },

  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow:
      '0 0 12px rgba(34,197,94,.7)',
  },

  dataRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderTop: '1px solid #1e293b',
    color: '#94a3b8',
  },

  settingsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(300px,1fr))',
    gap: 14,
  },

  settingCard: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 18,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 15,
  },

  settingTitle: {
    fontWeight: 800,
    marginBottom: 5,
  },

  settingDescription: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 1.5,
  },

  toggle: {
    width: 50,
    height: 28,
    border: 0,
    borderRadius: 20,
    padding: 3,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background .2s',
  },

  toggleCircle: {
    display: 'block',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform .2s',
  },

  textarea: {
    width: '100%',
    minHeight: 110,
    boxSizing: 'border-box',
    background: '#020617',
    color: '#fff',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: 13,
    resize: 'vertical',
    outline: 'none',
    marginBottom: 10,
  },

  maintenanceInfo: {
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    background:
      'linear-gradient(135deg,rgba(245,158,11,.1),rgba(15,23,42,.8))',
    border:
      '1px solid rgba(245,158,11,.25)',
    display: 'flex',
    gap: 15,
    alignItems: 'flex-start',
  },

  maintenanceIcon: {
    fontSize: 28,
  },

  usersGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill,minmax(310px,1fr))',
    gap: 14,
  },

  userCard: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 18,
    padding: 17,
    minWidth: 0,
  },

  userTop: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },

  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background:
      'linear-gradient(135deg,#334155,#475569)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 900,
    flexShrink: 0,
  },

  userName: {
    fontWeight: 900,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  userEmail: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  userMeta: {
    display: 'grid',
    gap: 5,
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12,
  },

  badgesRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },

  vipBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 20,
    background:
      'rgba(250,204,21,.12)',
    border:
      '1px solid rgba(250,204,21,.3)',
    color: '#fde047',
    fontSize: 11,
    fontWeight: 800,
  },

  smallBadge: {
    padding: '4px 8px',
    borderRadius: 20,
    background: '#1e293b',
    fontSize: 12,
  },

  actions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },

  primaryButtonSmall: {
    border: 0,
    borderRadius: 9,
    padding: '8px 11px',
    background:
      'linear-gradient(135deg,#e50914,#ff4050)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
  },

  secondaryButtonSmall: {
    border: '1px solid #334155',
    borderRadius: 9,
    padding: '8px 11px',
    background: '#1e293b',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
  },

  warningButton: {
    border: '1px solid rgba(245,158,11,.3)',
    borderRadius: 9,
    padding: '8px 11px',
    background: 'rgba(245,158,11,.1)',
    color: '#fbbf24',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
  },

  dangerButtonSmall: {
    border: '1px solid rgba(239,68,68,.3)',
    borderRadius: 9,
    padding: '8px 11px',
    background: 'rgba(239,68,68,.1)',
    color: '#f87171',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
  },

  badgeActiveButton: {
    border: '1px solid rgba(34,197,94,.3)',
    borderRadius: 9,
    padding: '8px 11px',
    background: 'rgba(34,197,94,.1)',
    color: '#86efac',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
  },

  contentGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill,minmax(280px,1fr))',
    gap: 14,
  },

  contentCard: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 18,
    overflow: 'hidden',
  },

  poster: {
    width: '100%',
    height: 230,
    objectFit: 'cover',
    display: 'block',
  },

  posterFallback: {
    width: '100%',
    height: 230,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1e293b',
    fontSize: 45,
  },

  contentInfo: {
    padding: 15,
  },

  contentTitle: {
    fontWeight: 900,
    fontSize: 16,
    marginBottom: 5,
  },

  contentId: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 10,
  },

  contentBadges: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },

  hiddenBadge: {
    padding: '4px 8px',
    borderRadius: 20,
    background: 'rgba(148,163,184,.1)',
    color: '#cbd5e1',
    fontSize: 11,
  },

  empty: {
    minHeight: 240,
    border: '1px dashed #334155',
    borderRadius: 18,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    textAlign: 'center',
    padding: 20,
  },

  emptyIcon: {
    fontSize: 38,
    marginBottom: 12,
  },

  logs: {
    display: 'grid',
    gap: 8,
  },

  log: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 10,
    padding: 12,
    color: '#cbd5e1',
  },

  spinner: {
    fontSize: 40,
    marginBottom: 15,
  },
};
