import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '0508';
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

const BADGES = {
  verification: {
    label: 'Verified',
    icon: '✓',
  },
  official: {
    label: 'Official',
    icon: '🔵',
  },
  owner: {
    label: 'Owner',
    icon: '👑',
  },
};

const normalizeBadges = (badges) => {
  if (!Array.isArray(badges)) return [];

  return badges.filter(
    (x) =>
      typeof x === 'string' &&
      ['verification', 'official', 'owner'].includes(x)
  );
};

const hasBadge = (badges, type) =>
  normalizeBadges(badges).includes(type);

const toggleBadgeValue = (badges, type) => {
  const current = normalizeBadges(badges);

  if (current.includes(type)) {
    return current.filter((x) => x !== type);
  }

  return [...current, type];
};

export default function Admin() {
  const navigate = useNavigate();

  const [step, setStep] = useState('login');
  const [pin, setPin] = useState('');
  const [auth, setAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [failed, setFailed] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);

  const [msg, setMsg] = useState({
    text: '',
    type: '',
  });

  const [tab, setTab] = useState('stats');

  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [titles, setTitles] = useState([]);

  const [userSearch, setUserSearch] = useState('');
  const [titleSearch, setTitleSearch] = useState('');

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

  const log = useCallback((text) => {
    setLogs((previous) =>
      [
        `[${new Date().toLocaleTimeString('ar-DZ')}] ${text}`,
        ...previous,
      ].slice(0, 80)
    );
  }, []);

  /* =========================================================
     LOCK SYSTEM
  ========================================================= */

  const locked = () => {
    if (!lockUntil) return false;

    if (lockUntil > Date.now()) {
      setMsg({
        text: `❌ المحاولات مقفولة مؤقتاً. انتظر ${Math.ceil(
          (lockUntil - Date.now()) / 60000
        )} دقيقة.`,
        type: 'error',
      });

      return true;
    }

    setLockUntil(null);
    setFailed(0);

    return false;
  };

  const fail = () => {
    const next = failed + 1;

    setFailed(next);

    if (next >= MAX_FAILED) {
      setLockUntil(Date.now() + LOCK_MS);

      setMsg({
        text:
          '🔒 تم قفل المحاولات لمدة 15 دقيقة بسبب كثرة المحاولات الفاشلة.',
        type: 'error',
      });
    }
  };

  /* =========================================================
     ADMIN CHECK
  ========================================================= */

  const checkAdmin = useCallback(async (userId) => {
    if (!userId) {
      setIsAdmin(false);
      return false;
    }

    /*
      نستعمل is_admin() أولاً.
      هذه هي الطريقة الأنظف لأن الدالة عندنا
      SECURITY DEFINER ومصممة للتحقق من admin_users.
    */

    const { data: rpcData, error: rpcError } =
      await supabase.rpc('is_admin');

    if (!rpcError) {
      const allowed = rpcData === true;

      setIsAdmin(allowed);

      return allowed;
    }

    /*
      Fallback في حالة أن RPC غير متاح لأي سبب.
    */

    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Admin check error:', error);

      setIsAdmin(false);

      return false;
    }

    const allowed = !!data;

    setIsAdmin(allowed);

    return allowed;
  }, []);

  /* =========================================================
     VERIFY SESSION
  ========================================================= */

  const verifySession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      setAuth(false);
      setIsAdmin(false);
      setStep('login');

      return false;
    }

    const allowed = await checkAdmin(user.id);

    if (!allowed) {
      setAuth(false);
      setIsAdmin(false);
      setStep('login');

      return false;
    }

    return true;
  }, [checkAdmin]);

  /* =========================================================
     ACTION GUARD
  ========================================================= */

  const guardAction = useCallback(async () => {
    const allowed = await verifySession();

    if (!allowed) {
      setMsg({
        text: '❌ انتهت صلاحية جلسة الإدارة أو لا تملك الصلاحية.',
        type: 'error',
      });

      return false;
    }

    setIsAdmin(true);

    return true;
  }, [verifySession]);

  /* =========================================================
     INITIAL AUTH
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setCheckingAuth(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        setAuth(false);
        setIsAdmin(false);
        setStep('login');
        setCheckingAuth(false);
        return;
      }

      const allowed = await checkAdmin(session.user.id);

      if (!mounted) return;

      if (!allowed) {
        setAuth(false);
        setIsAdmin(false);
        setStep('login');

        setMsg({
          text: '❌ هذا الحساب لا يملك صلاحية Admin.',
          type: 'error',
        });
      } else {
        setStep('pin');
      }

      setCheckingAuth(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session?.user) {
          setAuth(false);
          setIsAdmin(false);
          setStep('login');
          setPin('');
          return;
        }

        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED'
        ) {
          const allowed = await checkAdmin(session.user.id);

          if (!mounted) return;

          if (!allowed) {
            setAuth(false);
            setIsAdmin(false);
            setStep('login');

            setMsg({
              text: '❌ هذا الحساب لا يملك صلاحية Admin.',
              type: 'error',
            });

            return;
          }

          setIsAdmin(true);

          if (!auth) {
            setStep('pin');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdmin, auth]);

  /* =========================================================
     GOOGLE LOGIN
  ========================================================= */

  const googleLogin = async () => {
    if (locked()) return;

    setLoading(true);

    setMsg({
      text: '',
      type: '',
    });

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      fail();

      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      setLoading(false);
    }
  };

  /* =========================================================
     FETCH SETTINGS
  ========================================================= */

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key,value');

    if (error) throw error;

    const result = {};

    (data || []).forEach((item) => {
      result[item.key] = item.value;
    });

    setSettings({
      maintenance_mode:
        result.maintenance_mode?.enabled === true ||
        result.maintenance_mode === true,

      diagnostics_enabled:
        result.diagnostics_enabled === true,

      announcement_bar:
        typeof result.announcement_bar === 'string'
          ? result.announcement_bar
          : '',

      vip_exclusive_content:
        result.vip_exclusive_content !== false,

      vip_features_enabled:
        result.vip_features_enabled !== false,

      vip_media_messages:
        result.vip_media_messages !== false,

      vip_voice_messages:
        result.vip_voice_messages !== false,

      vip_watch_party:
        result.vip_watch_party !== false,
    });
  };

  /* =========================================================
     FETCH DATA
  ========================================================= */

  const fetchData = useCallback(async () => {
    if (!(await guardAction())) return;

    setLoading(true);

    try {
      await fetchSettings();

      /*
        مهم جداً:
        نستعمل فقط الأعمدة التي أصبح النظام الجديد يعتمد عليها.
        badges الآن JSONB وليس verification_badge / official_badge...
      */

      const {
        data: u,
        error: ue,
      } = await supabase
        .from('profiles')
        .select(`
          id,
          user_code,
          display_name,
          avatar_url,
          wilaya,
          is_premium,
          badges,
          created_at,
          updated_at
        `)
        .order('created_at', {
          ascending: false,
        });

      if (ue) throw ue;

      const normalizedUsers = (u || []).map((user) => ({
        ...user,
        badges: normalizeBadges(user.badges),
        is_vip: user.is_premium === true,
        is_banned: false,
      }));

      setUsers(normalizedUsers);

      const {
        data: t,
        error: te,
      } = await supabase
        .from('titles')
        .select('*')
        .order('id', {
          ascending: false,
        })
        .limit(500);

      if (te) throw te;

      setTitles(t || []);

      const us = normalizedUsers;
      const ts = t || [];

      setStats({
        totalTitles: ts.length,
        totalUsers: us.length,

        /*
          الحظر غير مربوط حالياً بالـschema الجديد.
          نخليه 0 بدل ما نخلي fetch يطيح.
        */
        bannedUsers: 0,

        vipUsers: us.filter(
          (x) => x.is_premium === true
        ).length,

        verifiedUsers: us.filter((x) =>
          hasBadge(x.badges, 'verification')
        ).length,

        officialUsers: us.filter((x) =>
          hasBadge(x.badges, 'official')
        ).length,

        ownerUsers: us.filter((x) =>
          hasBadge(x.badges, 'owner')
        ).length,

        hiddenTitles: ts.filter(
          (x) => x.is_hidden === true
        ).length,
      });

      log('✅ تم تحديث بيانات لوحة الإدارة.');
    } catch (error) {
      console.error('Admin fetch error:', error);

      setMsg({
        text: `❌ ${error.message || 'حدث خطأ أثناء جلب البيانات.'}`,
        type: 'error',
      });

      log(`❌ فشل تحميل البيانات: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [guardAction, log]);

  /* =========================================================
     PIN
  ========================================================= */

  const submitPin = async (e) => {
    e.preventDefault();

    if (locked()) return;

    const allowed = await verifySession();

    if (!allowed) return;

    if (pin !== ADMIN_PIN) {
      fail();

      setMsg({
        text: '❌ رمز PIN غير صحيح.',
        type: 'error',
      });

      return;
    }

    setAuth(true);
    setIsAdmin(true);

    setMsg({
      text: '',
      type: '',
    });
  };

  /* =========================================================
     LOAD DATA AFTER AUTH
  ========================================================= */

  useEffect(() => {
    if (!auth || !isAdmin) return;

    fetchData();
  }, [auth, isAdmin, fetchData]);

  /* =========================================================
     LOGOUT
  ========================================================= */

  const logout = async () => {
    await supabase.auth.signOut();

    setAuth(false);
    setIsAdmin(false);
    setStep('login');
    setPin('');
    setUsers([]);
    setTitles([]);
  };

  /* =========================================================
     SETTINGS
  ========================================================= */

  const saveSetting = async (key, value) => {
    if (!(await guardAction())) return;

    let databaseValue = value;

    /*
      maintenance_mode عندنا مخزن JSON:
      {"enabled":true}
    */

    if (key === 'maintenance_mode') {
      databaseValue = {
        enabled: value === true,
      };
    }

    const { error } = await supabase
      .from('site_settings')
      .upsert(
        {
          key,
          value: databaseValue,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      );

    if (error) {
      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      return;
    }

    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));

    log(
      `⚙️ تم تغيير إعداد ${key} إلى ${
        value === true ? 'مفعل' : value === false ? 'معطل' : value
      }`
    );

    setMsg({
      text:
        key === 'maintenance_mode'
          ? value
            ? '🚧 تم تفعيل وضع الصيانة بنجاح.'
            : '✅ تم إيقاف وضع الصيانة.'
          : '✅ تم حفظ الإعداد.',
      type: 'success',
    });
  };

  /* =========================================================
     VIP
  ========================================================= */

  const vip = async (user, plan) => {
    if (!(await guardAction())) return;

    const isVip = plan !== 'none';

    const oldBadges = normalizeBadges(user.badges);

    let newBadges = oldBadges;

    /*
      VIP الشهري → Verified
      VIP السنوي → Official
      VIP اليدوي → ما نبدلوش البادجات
      إزالة VIP → نزيل فقط badge المرتبط تلقائياً
    */

    if (plan === 'month') {
      newBadges = oldBadges.includes('verification')
        ? oldBadges
        : [...oldBadges, 'verification'];
    }

    if (plan === 'year') {
      newBadges = oldBadges.includes('official')
        ? oldBadges
        : [...oldBadges, 'official'];
    }

    if (plan === 'none') {
      newBadges = oldBadges.filter(
        (badge) =>
          badge !== 'verification' &&
          badge !== 'official'
      );
    }

    const updateData = {
      is_premium: isVip,
      badges: newBadges,
      updated_at: new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select(`
        id,
        user_code,
        display_name,
        avatar_url,
        wilaya,
        is_premium,
        badges,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('VIP update error:', error);

      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      return;
    }

    const updatedUser = {
      ...data,
      badges: normalizeBadges(data.badges),
      is_vip: data.is_premium === true,
      is_banned: false,
    };

    setUsers((previous) =>
      previous.map((item) =>
        item.id === user.id
          ? updatedUser
          : item
      )
    );

    setStats((previous) => {
      const nextUsers = users.map((item) =>
        item.id === user.id
          ? updatedUser
          : item
      );

      return {
        ...previous,
        vipUsers: nextUsers.filter(
          (item) => item.is_premium === true
        ).length,
        verifiedUsers: nextUsers.filter((item) =>
          hasBadge(item.badges, 'verification')
        ).length,
        officialUsers: nextUsers.filter((item) =>
          hasBadge(item.badges, 'official')
        ).length,
        ownerUsers: nextUsers.filter((item) =>
          hasBadge(item.badges, 'owner')
        ).length,
      };
    });

    log(
      `⭐ تم ${
        isVip ? 'تفعيل' : 'إزالة'
      } VIP للمستخدم ${
        user.display_name || user.user_code || user.id
      }`
    );

    setMsg({
      text: isVip
        ? '⭐ تم تفعيل VIP وحفظه في الحساب بنجاح.'
        : '✅ تم إزالة VIP من الحساب.',
      type: 'success',
    });
  };

  /* =========================================================
     BADGES
  ========================================================= */

  const badge = async (user, type) => {
    if (!(await guardAction())) return;

    const current = normalizeBadges(user.badges);
    const next = toggleBadgeValue(current, type);

    const {
      data,
      error,
    } = await supabase
      .from('profiles')
      .update({
        badges: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select(`
        id,
        user_code,
        display_name,
        avatar_url,
        wilaya,
        is_premium,
        badges,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Badge update error:', error);

      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      return;
    }

    const updatedUser = {
      ...data,
      badges: normalizeBadges(data.badges),
      is_vip: data.is_premium === true,
      is_banned: false,
    };

    setUsers((previous) =>
      previous.map((item) =>
        item.id === user.id
          ? updatedUser
          : item
      )
    );

    setStats((previous) => {
      const nextUsers = users.map((item) =>
        item.id === user.id
          ? updatedUser
          : item
      );

      return {
        ...previous,
        verifiedUsers: nextUsers.filter((item) =>
          hasBadge(item.badges, 'verification')
        ).length,
        officialUsers: nextUsers.filter((item) =>
          hasBadge(item.badges, 'official')
        ).length,
        ownerUsers: nextUsers.filter((item) =>
          hasBadge(item.badges, 'owner')
        ).length,
      };
    });

    const enabled = next.includes(type);

    log(
      `${enabled ? '🏅 إعطاء' : '❌ نزع'} ${
        BADGES[type]?.label || type
      } من ${
        user.display_name || user.user_code || user.id
      }`
    );

    setMsg({
      text: `${enabled ? '🏅 تم إعطاء' : '❌ تم نزع'} ${
        BADGES[type]?.label || type
      } بنجاح.`,
      type: 'success',
    });
  };

  /* =========================================================
     BAN
  ========================================================= */

  const ban = async (user) => {
    if (!(await guardAction())) return;

    /*
      الحظر غير مربوط في SQL الجديد الذي طبقناه.
      لذلك لا ننفذ UPDATE على عمود غير مضمون وجوده.
    */

    setMsg({
      text:
        'ℹ️ نظام الحظر يحتاج ربط عمود is_banned في قاعدة البيانات أولاً.',
      type: 'error',
    });
  };

  /* =========================================================
     TITLE ACTION
  ========================================================= */

  const titleAction = async (
    id,
    field,
    value
  ) => {
    if (!(await guardAction())) return;

    const newValue = !value;

    const {
      error,
    } = await supabase
      .from('titles')
      .update({
        [field]: newValue,
      })
      .eq('id', id);

    if (error) {
      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      return;
    }

    setTitles((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: newValue,
            }
          : item
      )
    );

    log(
      `🎬 تم تحديث ${field} للمحتوى ${id}`
    );
  };

  /* =========================================================
     DELETE TITLE
  ========================================================= */

  const delTitle = async (id, name) => {
    if (!(await guardAction())) return;

    if (
      !window.confirm(
        `حذف "${name}" نهائياً؟`
      )
    ) {
      return;
    }

    const {
      error,
    } = await supabase
      .from('titles')
      .delete()
      .eq('id', id);

    if (error) {
      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      return;
    }

    setTitles((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );

    log(`🗑️ حذف ${name}`);

    setMsg({
      text: '🗑️ تم حذف المحتوى.',
      type: 'success',
    });
  };

  /* =========================================================
     LOADING AUTH
  ========================================================= */

  if (checkingAuth) {
    return (
      <div style={S.authPage}>
        <div style={S.authCard}>
          <div style={{ fontSize: 48 }}>
            🛡️
          </div>

          <div style={S.logo}>
            STREAM<span>FLIX</span>
          </div>

          <h2>جاري التحقق...</h2>

          <p style={S.muted}>
            التحقق من جلسة الإدارة والصلاحيات
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     LOGIN
  ========================================================= */

  if (!auth || !isAdmin) {
    return (
      <div style={S.authPage}>
        <div style={S.authCard}>
          <div style={{ fontSize: 48 }}>
            🛡️
          </div>

          <div style={S.logo}>
            STREAM<span>FLIX</span>
          </div>

          {step === 'login' ? (
            <>
              <h2>دخول لوحة الإدارة</h2>

              <p style={S.muted}>
                الدخول عبر حساب Google المصرح
                به في نظام Admin
              </p>

              <button
                onClick={googleLogin}
                disabled={loading}
                style={S.google}
              >
                G&nbsp;&nbsp;
                {loading
                  ? 'جاري فتح Google...'
                  : 'المتابعة باستخدام Google'}
              </button>

              <div style={S.note}>
                🔐 يتم التحقق من الحساب
                <br />
                <small>
                  يجب أن يكون حساب Google
                  موجوداً في جدول admin_users
                </small>
              </div>

              {msg.text && (
                <div style={S.error}>
                  {msg.text}
                </div>
              )}

              <button
                onClick={() => navigate('/')}
                style={S.link}
              >
                ← العودة للموقع
              </button>
            </>
          ) : (
            <>
              <h2>🛡️ التحقق النهائي</h2>

              <p style={S.muted}>
                تم التحقق من حساب Admin.
                أدخل PIN المسؤول.
              </p>

              <form onSubmit={submitPin}>
                <input
                  autoFocus
                  value={pin}
                  onChange={(e) =>
                    setPin(
                      e.target.value.replace(
                        /\D/g,
                        ''
                      )
                    )
                  }
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="••••"
                  style={S.pin}
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...S.red,
                    opacity: loading
                      ? 0.6
                      : 1,
                  }}
                >
                  {loading
                    ? '⏳ جاري التحقق...'
                    : 'فتح لوحة التحكم'}
                </button>
              </form>

              {msg.text && (
                <div style={S.error}>
                  {msg.text}
                </div>
              )}

              <button
                onClick={logout}
                style={S.link}
              >
                ← حساب Google آخر
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* =========================================================
     FILTERS
  ========================================================= */

  const searchUser = userSearch.toLowerCase();

  const fu = users.filter((user) =>
    [
      user.display_name,
      user.user_code,
      user.wilaya,
      user.id,
    ].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(searchUser)
    )
  );

  const searchTitle = titleSearch.toLowerCase();

  const ft = titles.filter((title) => {
    const name =
      title.title ||
      title.name ||
      '';

    return (
      name
        .toLowerCase()
        .includes(searchTitle) ||
      String(title.tmdb_id || '').includes(
        titleSearch
      )
    );
  });

  /* =========================================================
     ADMIN PANEL
  ========================================================= */

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <div>
            <div style={S.logo}>
              STREAM<span>FLIX</span>
            </div>

            <h1
              style={{
                color: '#e50914',
                margin: '5px 0',
              }}
            >
              ⚡ لوحة تحكم الإدارة
            </h1>

            <span style={S.muted}>
              المستخدمون • VIP • البادجات • المحتوى
            </span>
          </div>

          <div style={S.row}>
            <button
              onClick={async () => {
                if (await guardAction()) {
                  navigate('/import');
                }
              }}
              style={S.blue}
              disabled={!isAdmin}
            >
              📥 الاستيراد
            </button>

            <button
              onClick={() => navigate('/')}
              style={S.dark}
            >
              🏠 الموقع
            </button>

            <button
              onClick={logout}
              style={S.out}
            >
              🔒 خروج
            </button>
          </div>
        </header>

        <div style={S.tabs}>
          {[
            ['stats', '📊 الإحصائيات'],
            ['settings', '⚙️ إعدادات VIP'],
            ['users', '👥 المستخدمين'],
            ['content', '🎬 المحتوى'],
            ['logs', '📋 السجلات'],
          ].map((item) => (
            <button
              key={item[0]}
              onClick={() => {
                if (!isAdmin) return;

                setTab(item[0]);

                setMsg({
                  text: '',
                  type: '',
                });
              }}
              disabled={!isAdmin}
              style={{
                ...S.tab,
                ...(tab === item[0]
                  ? S.active
                  : {}),
              }}
            >
              {item[1]}
            </button>
          ))}
        </div>

        {msg.text && (
          <div
            style={
              msg.type === 'error'
                ? S.errorBanner
                : S.success
            }
          >
            {msg.text}
          </div>
        )}

        {/* =====================================================
            STATS
        ===================================================== */}

        {tab === 'stats' && (
          <>
            <div style={S.grid}>
              {[
                [
                  '🎬',
                  stats.totalTitles,
                  'المحتوى',
                ],
                [
                  '👥',
                  stats.totalUsers,
                  'المستخدمين',
                ],
                [
                  '⭐',
                  stats.vipUsers,
                  'VIP',
                ],
                [
                  '🚫',
                  stats.bannedUsers,
                  'محظورين',
                ],
                [
                  '✓',
                  stats.verifiedUsers,
                  'Verified',
                ],
                [
                  '🔵',
                  stats.officialUsers,
                  'Official',
                ],
                [
                  '👑',
                  stats.ownerUsers,
                  'Owner',
                ],
                [
                  '🙈',
                  stats.hiddenTitles,
                  'مخفي',
                ],
              ].map((item) => (
                <div
                  style={S.stat}
                  key={item[2]}
                >
                  <b style={{ fontSize: 28 }}>
                    {item[0]}
                  </b>

                  <strong>
                    {item[1]}
                  </strong>

                  <span>
                    {item[2]}
                  </span>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <button
                onClick={fetchData}
                disabled={
                  loading || !isAdmin
                }
                style={{
                  ...S.dark,
                  opacity:
                    loading || !isAdmin
                      ? 0.5
                      : 1,
                }}
              >
                {loading
                  ? '⏳ جاري...'
                  : '🔄 تحديث البيانات'}
              </button>
            </div>
          </>
        )}

        {/* =====================================================
            SETTINGS
        ===================================================== */}

        {tab === 'settings' && (
          <div style={S.stack}>
            {[
              [
                'vip_features_enabled',
                '⭐ نظام VIP',
              ],
              [
                'vip_exclusive_content',
                '🎬 محتوى VIP',
              ],
              [
                'vip_media_messages',
                '📷 الصور والملفات',
              ],
              [
                'vip_voice_messages',
                '🎙️ الرسائل الصوتية',
              ],
              [
                'vip_watch_party',
                '🎥 Watch Party',
              ],
              [
                'maintenance_mode',
                '🚧 وضع الصيانة',
              ],
              [
                'diagnostics_enabled',
                '🛠️ Diagnostics',
              ],
            ].map((item) => (
              <div
                style={S.setting}
                key={item[0]}
              >
                <b>{item[1]}</b>

                <button
                  onClick={() => {
                    if (!isAdmin) return;

                    saveSetting(
                      item[0],
                      !settings[item[0]]
                    );
                  }}
                  disabled={!isAdmin}
                  style={{
                    ...S.toggle,
                    background:
                      settings[item[0]]
                        ? '#28a745'
                        : '#333',
                    opacity:
                      !isAdmin ? 0.5 : 1,
                  }}
                >
                  {settings[item[0]]
                    ? '🟢 مفعلة'
                    : '⚪ معطلة'}
                </button>
              </div>
            ))}

            <div style={S.card}>
              <h3>
                📢 الشريط الإعلاني
              </h3>

              <div style={S.row}>
                <input
                  style={S.input}
                  value={
                    settings.announcement_bar
                  }
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setSettings((previous) => ({
                      ...previous,
                      announcement_bar:
                        e.target.value,
                    }))
                  }
                />

                <button
                  onClick={() => {
                    if (!isAdmin) return;

                    saveSetting(
                      'announcement_bar',
                      settings.announcement_bar
                    );
                  }}
                  disabled={!isAdmin}
                  style={{
                    ...S.blue,
                    opacity:
                      !isAdmin ? 0.5 : 1,
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

        {tab === 'users' && (
          <div style={S.card}>
            <div style={S.head}>
              <h3>
                👥 المستخدمين ({fu.length})
              </h3>

              <input
                style={S.search}
                placeholder="🔎 بحث بالاسم / الكود / الولاية..."
                value={userSearch}
                onChange={(e) =>
                  setUserSearch(
                    e.target.value
                  )
                }
              />
            </div>

            <div style={S.stack}>
              {fu.length === 0 ? (
                <div style={S.empty}>
                  لا يوجد مستخدمون مطابقون للبحث.
                </div>
              ) : (
                fu.map((user) => {
                  const userBadges =
                    normalizeBadges(
                      user.badges
                    );

                  return (
                    <div
                      style={S.user}
                      key={user.id}
                    >
                      <div
                        style={S.userTop}
                      >
                        <div
                          style={S.userInfo}
                        >
                          {user.avatar_url ? (
                            <img
                              src={
                                user.avatar_url
                              }
                              style={S.avatar}
                              alt=""
                            />
                          ) : (
                            <div
                              style={S.avatar}
                            >
                              👤
                            </div>
                          )}

                          <div>
                            <b
                              style={{
                                fontSize: 15,
                              }}
                            >
                              {user.display_name ||
                                user.user_code ||
                                'مستخدم'}

                              {user.is_premium && (
                                <span
                                  style={
                                    S.vipMini
                                  }
                                >
                                  ⭐ VIP
                                </span>
                              )}
                            </b>

                            <div
                              style={S.small}
                            >
                              {user.user_code ||
                                'بدون كود'}
                              {user.wilaya
                                ? ` • ${user.wilaya}`
                                : ''}
                            </div>

                            {userBadges.length >
                              0 && (
                              <div
                                style={
                                  S.badgesLine
                                }
                              >
                                {userBadges.map(
                                  (type) => (
                                    <span
                                      key={type}
                                      style={
                                        S.badgePill
                                      }
                                    >
                                      {
                                        BADGES[
                                          type
                                        ]?.icon
                                      }{' '}
                                      {
                                        BADGES[
                                          type
                                        ]?.label
                                      }
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={S.sub}>
                        <b>⭐ VIP</b>

                        <div style={S.row}>
                          <button
                            onClick={() =>
                              vip(
                                user,
                                'none'
                              )
                            }
                            disabled={!isAdmin}
                            style={{
                              ...S.smallBtn,
                              opacity:
                                !isAdmin
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            ❌ إزالة
                          </button>

                          <button
                            onClick={() =>
                              vip(
                                user,
                                'month'
                              )
                            }
                            disabled={!isAdmin}
                            style={{
                              ...S.gold,
                              opacity:
                                !isAdmin
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            ⭐ شهر
                          </button>

                          <button
                            onClick={() =>
                              vip(
                                user,
                                'year'
                              )
                            }
                            disabled={!isAdmin}
                            style={{
                              ...S.orange,
                              opacity:
                                !isAdmin
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            🏆 عام
                          </button>

                          <button
                            onClick={() =>
                              vip(
                                user,
                                'manual'
                              )
                            }
                            disabled={!isAdmin}
                            style={{
                              ...S.purple,
                              opacity:
                                !isAdmin
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            🛠️ يدوي
                          </button>
                        </div>
                      </div>

                      <div style={S.sub}>
                        <b>🏅 البادجات</b>

                        <div style={S.row}>
                          {[
                            [
                              'verification',
                              '✓ Verified',
                            ],
                            [
                              'official',
                              '🔵 Official',
                            ],
                            [
                              'owner',
                              '👑 Owner',
                            ],
                          ].map(
                            ([type, label]) => (
                              <button
                                key={type}
                                onClick={() =>
                                  badge(
                                    user,
                                    type
                                  )
                                }
                                disabled={
                                  !isAdmin
                                }
                                style={{
                                  ...S.smallBtn,
                                  ...(hasBadge(
                                    userBadges,
                                    type
                                  )
                                    ? S.badgeActive
                                    : {}),
                                  opacity:
                                    !isAdmin
                                      ? 0.5
                                      : 1,
                                }}
                              >
                                {hasBadge(
                                  userBadges,
                                  type
                                )
                                  ? `✅ ${label}`
                                  : label}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =====================================================
            CONTENT
        ===================================================== */}

        {tab === 'content' && (
          <div style={S.card}>
            <div style={S.head}>
              <h3>
                🎬 المحتوى ({ft.length})
              </h3>

              <input
                style={S.search}
                placeholder="🔎 الاسم / TMDB ID"
                value={titleSearch}
                onChange={(e) =>
                  setTitleSearch(
                    e.target.value
                  )
                }
              />
            </div>

            <div style={S.stack}>
              {ft.map((title) => (
                <div
                  style={S.titleCard}
                  key={title.id}
                >
                  <div
                    style={S.userInfo}
                  >
                    {(title.poster_path ||
                      title.poster_url) && (
                      <img
                        src={
                          title.poster_path ||
                          title.poster_url
                        }
                        style={S.poster}
                        alt=""
                      />
                    )}

                    <div>
                      <b>
                        {title.title ||
                          title.name}
                      </b>

                      <div
                        style={S.small}
                      >
                        {title.type ===
                          'series' ||
                        title.type === 'tv'
                          ? 'مسلسل'
                          : 'فيلم'}{' '}
                        • TMDB{' '}
                        {title.tmdb_id || '-'}
                      </div>
                    </div>
                  </div>

                  <div style={S.row}>
                    <button
                      onClick={() =>
                        titleAction(
                          title.id,
                          'is_premium',
                          title.is_premium
                        )
                      }
                      disabled={!isAdmin}
                      style={{
                        ...S.smallBtn,
                        opacity:
                          !isAdmin
                            ? 0.5
                            : 1,
                      }}
                    >
                      {title.is_premium
                        ? '⭐ إزالة VIP'
                        : '⭐ جعل VIP'}
                    </button>

                    <button
                      onClick={() =>
                        titleAction(
                          title.id,
                          'is_hidden',
                          title.is_hidden
                        )
                      }
                      disabled={!isAdmin}
                      style={{
                        ...S.smallBtn,
                        opacity:
                          !isAdmin
                            ? 0.5
                            : 1,
                      }}
                    >
                      {title.is_hidden
                        ? '👁️ إظهار'
                        : '🙈 إخفاء'}
                    </button>

                    <button
                      onClick={() =>
                        delTitle(
                          title.id,
                          title.title ||
                            title.name
                        )
                      }
                      disabled={!isAdmin}
                      style={{
                        ...S.delete,
                        opacity:
                          !isAdmin
                            ? 0.5
                            : 1,
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

        {tab === 'logs' && (
          <div style={S.card}>
            <h3>📋 السجلات</h3>

            <div style={S.logs}>
              {logs.length === 0 ? (
                <div>
                  لا توجد سجلات بعد.
                </div>
              ) : (
                logs.map((item, index) => (
                  <div key={index}>
                    {item}
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

/* =============================================================
   STYLES
============================================================= */

const S = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top,#181818,#050505 65%)',
    color: '#fff',
    padding: 22,
    direction: 'rtl',
    fontFamily:
      'system-ui,sans-serif',
  },

  container: {
    maxWidth: 1250,
    margin: 'auto',
  },

  authPage: {
    minHeight: '100vh',
    background: '#060606',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    color: '#fff',
    direction: 'rtl',
  },

  authCard: {
    width: '100%',
    maxWidth: 430,
    background: '#151515',
    border: '1px solid #2b2b2b',
    borderRadius: 22,
    padding: 30,
    textAlign: 'center',
    boxShadow: '0 25px 80px #000',
  },

  logo: {
    fontWeight: 900,
    fontSize: 24,
  },

  muted: {
    color: '#777',
    fontSize: 12,
  },

  google: {
    width: '100%',
    padding: 14,
    border: 0,
    borderRadius: 11,
    background: '#fff',
    color: '#111',
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 15,
  },

  note: {
    marginTop: 15,
    padding: 12,
    borderRadius: 10,
    background: '#0d0d0d',
    color: '#aaa',
    fontSize: 11,
    lineHeight: 1.8,
  },

  pin: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 14,
    background: '#222',
    border: '1px solid #444',
    borderRadius: 10,
    color: '#fff',
    textAlign: 'center',
    fontSize: 25,
    letterSpacing: 7,
    marginBottom: 12,
  },

  red: {
    width: '100%',
    padding: 13,
    border: 0,
    borderRadius: 10,
    background: '#e50914',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },

  link: {
    marginTop: 15,
    background: 'transparent',
    border: 0,
    color: '#777',
    cursor: 'pointer',
  },

  error: {
    marginTop: 14,
    padding: 11,
    borderRadius: 10,
    background: '#2a1212',
    color: '#ff7777',
    fontSize: 12,
  },

  errorBanner: {
    padding: 13,
    borderRadius: 11,
    background: '#2a1212',
    color: '#ff7777',
    marginBottom: 16,
    textAlign: 'center',
  },

  success: {
    padding: 13,
    borderRadius: 11,
    background: '#122a18',
    color: '#6bff8d',
    marginBottom: 16,
    textAlign: 'center',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 15,
    flexWrap: 'wrap',
    paddingBottom: 18,
    borderBottom: '1px solid #222',
  },

  row: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },

  blue: {
    padding: '10px 14px',
    background: '#0066cc',
    color: '#fff',
    border: 0,
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
  },

  dark: {
    padding: '10px 14px',
    background: '#222',
    color: '#fff',
    border: '1px solid #3a3a3a',
    borderRadius: 9,
    cursor: 'pointer',
  },

  out: {
    padding: '10px 14px',
    background: '#2a1212',
    color: '#ff7777',
    border: '1px solid #4b2020',
    borderRadius: 9,
    cursor: 'pointer',
  },

  tabs: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    margin: '20px 0',
  },

  tab: {
    padding: '11px 15px',
    background: '#141414',
    color: '#aaa',
    border: '1px solid #292929',
    borderRadius: 10,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: 700,
  },

  active: {
    background: '#e50914',
    color: '#fff',
    borderColor: '#e50914',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(150px,1fr))',
    gap: 12,
  },

  stat: {
    background: '#151515',
    border: '1px solid #292929',
    borderRadius: 15,
    padding: 18,
    textAlign: 'center',
    display: 'grid',
    gap: 5,
  },

  card: {
    background: '#141414',
    border: '1px solid #292929',
    borderRadius: 15,
    padding: 18,
    marginTop: 15,
  },

  stack: {
    display: 'grid',
    gap: 12,
  },

  setting: {
    background: '#141414',
    border: '1px solid #292929',
    borderRadius: 13,
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  toggle: {
    minWidth: 110,
    padding: 10,
    color: '#fff',
    border: 0,
    borderRadius: 8,
    fontWeight: 800,
    cursor: 'pointer',
  },

  input: {
    flex: 1,
    padding: 11,
    background: '#222',
    border: '1px solid #3a3a3a',
    borderRadius: 9,
    color: '#fff',
  },

  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 15,
  },

  search: {
    width: 290,
    maxWidth: '100%',
    padding: 10,
    background: '#222',
    border: '1px solid #3a3a3a',
    borderRadius: 9,
    color: '#fff',
  },

  user: {
    background:
      'linear-gradient(145deg,#1b1b1b,#111)',
    border: '1px solid #2b2b2b',
    borderRadius: 15,
    padding: 15,
  },

  userTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },

  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: '50%',
    objectFit: 'cover',
    background: '#333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  small: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },

  vipMini: {
    display: 'inline-block',
    marginRight: 7,
    padding: '3px 7px',
    borderRadius: 999,
    background:
      'linear-gradient(135deg,#ffc107,#ff9800)',
    color: '#000',
    fontSize: 10,
    fontWeight: 900,
    verticalAlign: 'middle',
  },

  badgesLine: {
    display: 'flex',
    gap: 5,
    flexWrap: 'wrap',
    marginTop: 7,
  },

  badgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '3px 7px',
    borderRadius: 999,
    background: '#252525',
    border: '1px solid #3b3b3b',
    color: '#ddd',
    fontSize: 9,
    fontWeight: 800,
  },

  badgeActive: {
    background: '#29200a',
    borderColor: '#ffc107',
    color: '#ffc107',
  },

  empty: {
    padding: 30,
    textAlign: 'center',
    color: '#777',
    background: '#111',
    borderRadius: 12,
  },

  smallBtn: {
    padding: '8px 11px',
    background: '#292929',
    color: '#fff',
    border: '1px solid #3b3b3b',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
  },

  sub: {
    borderTop: '1px solid #292929',
    marginTop: 13,
    paddingTop: 13,
    color: '#ffc107',
  },

  gold: {
    padding: '8px 11px',
    background: '#ffc107',
    color: '#000',
    border: 0,
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 800,
  },

  orange: {
    padding: '8px 11px',
    background: '#ff9800',
    color: '#000',
    border: 0,
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 800,
  },

  purple: {
    padding: '8px 11px',
    background: '#9c27b0',
    color: '#fff',
    border: 0,
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 800,
  },

  titleCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    background: '#1b1b1b',
    border: '1px solid #2b2b2b',
    borderRadius: 12,
    padding: 12,
  },

  poster: {
    width: 44,
    height: 60,
    objectFit: 'cover',
    borderRadius: 6,
  },

  delete: {
    padding: '8px 11px',
    background: '#d9534f',
    color: '#fff',
    border: 0,
    borderRadius: 7,
    cursor: 'pointer',
  },

  logs: {
    background: '#080808',
    padding: 14,
    borderRadius: 9,
    minHeight: 250,
    maxHeight: 400,
    overflow: 'auto',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#00ff00',
  },
};
