import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '0508';
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

const badgeFields = (type) => ({
  verification_badge: type === 'verification',
  official_badge: type === 'official',
  owner_badge: type === 'owner',
});

const autoBadge = (plan) =>
  plan === 'month'
    ? 'verification'
    : plan === 'year'
      ? 'official'
      : 'none';

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

  const log = useCallback((x) => {
    setLogs((p) =>
      [`[${new Date().toLocaleTimeString('ar-DZ')}] ${x}`, ...p].slice(
        0,
        80
      )
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
    const n = failed + 1;

    setFailed(n);

    if (n >= MAX_FAILED) {
      setLockUntil(Date.now() + LOCK_MS);

      setMsg({
        text: '🔒 تم قفل المحاولات لمدة 15 دقيقة بسبب كثرة المحاولات الفاشلة.',
        type: 'error',
      });
    }
  };

  /* =========================================================
     ADMIN AUTHORIZATION
     IMPORTANT:
     صلاحية Admin تأتي من admin_users فقط
     وليس profiles.role ولا is_owner_shop
  ========================================================= */

  const checkAdmin = useCallback(async (userId) => {
    if (!userId) {
      setIsAdmin(false);
      return false;
    }

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
     VERIFY ACTIVE SESSION + ADMIN
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

      await supabase.auth.signOut();

      setMsg({
        text: '❌ هذا الحساب لا يملك صلاحية Admin.',
        type: 'error',
      });

      return false;
    }

    return true;
  }, [checkAdmin]);

  /* =========================================================
     ACTION GUARD
     أي عملية إدارية لازم تمر من هنا
  ========================================================= */

  const guardAction = useCallback(
    async () => {
      if (!isAdmin) {
        const allowed = await verifySession();

        if (!allowed) {
          setMsg({
            text: '❌ ليس لديك صلاحية لتنفيذ هذه العملية.',
            type: 'error',
          });

          return false;
        }
      }

      const allowed = await verifySession();

      if (!allowed) {
        setMsg({
          text: '❌ انتهت صلاحية جلسة الإدارة.',
          type: 'error',
        });

        return false;
      }

      return true;
    },
    [isAdmin, verifySession]
  );

  /* =========================================================
     INITIAL AUTH CHECK
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

        await supabase.auth.signOut();

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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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

          await supabase.auth.signOut();

          setMsg({
            text: '❌ هذا الحساب لا يملك صلاحية Admin.',
            type: 'error',
          });

          return;
        }

        if (!auth) {
          setStep('pin');
        }
      }
    });

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
     FETCH DATA
  ========================================================= */

  const fetchData = useCallback(async () => {
    if (!(await guardAction())) return;

    setLoading(true);

    try {
      const {
        data: s,
        error: se,
      } = await supabase
        .from('site_settings')
        .select('*');

      if (se) throw se;

      const c = {};

      (s || []).forEach((x) => {
        let v = x.value;

        if (v === 'true' || v === 'false') {
          v = v === 'true';
        }

        c[x.key] = v;
      });

      setSettings({
        maintenance_mode: c.maintenance_mode === true,
        diagnostics_enabled: c.diagnostics_enabled === true,

        announcement_bar:
          typeof c.announcement_bar === 'string'
            ? c.announcement_bar
            : '',

        vip_exclusive_content:
          c.vip_exclusive_content !== false,

        vip_features_enabled:
          c.vip_features_enabled !== false,

        vip_media_messages:
          c.vip_media_messages !== false,

        vip_voice_messages:
          c.vip_voice_messages !== false,

        vip_watch_party:
          c.vip_watch_party !== false,
      });

      const {
        data: u,
        error: ue,
      } = await supabase
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
        .order('created_at', {
          ascending: false,
        });

      if (ue) throw ue;

      setUsers(u || []);

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

      const us = u || [];
      const ts = t || [];

      setStats({
        totalTitles: ts.length,
        totalUsers: us.length,

        bannedUsers: us.filter(
          (x) => x.is_banned
        ).length,

        vipUsers: us.filter(
          (x) => x.is_vip || x.is_premium
        ).length,

        verifiedUsers: us.filter(
          (x) => x.verification_badge
        ).length,

        officialUsers: us.filter(
          (x) => x.official_badge
        ).length,

        ownerUsers: us.filter(
          (x) => x.owner_badge
        ).length,

        hiddenTitles: ts.filter(
          (x) => x.is_hidden
        ).length,
      });

      log('✅ تم تحديث بيانات لوحة الإدارة.');
    } catch (e) {
      setMsg({
        text: `❌ ${e.message}`,
        type: 'error',
      });
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

    await fetchData();
  };

  /* =========================================================
     LOGOUT
  ========================================================= */

  const logout = async () => {
    await supabase.auth.signOut();

    setAuth(false);
    setIsAdmin(false);
    setStep('login');
    setPin('');
  };

  /* =========================================================
     SETTINGS
  ========================================================= */

  const saveSetting = async (key, value) => {
    if (!(await guardAction())) return;

    const { error } = await supabase
      .from('site_settings')
      .upsert(
        {
          key,
          value,
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

    setSettings((p) => ({
      ...p,
      [key]: value,
    }));

    setMsg({
      text: 'تم الحفظ ✅',
      type: 'success',
    });
  };

  /* =========================================================
     VIP
  ========================================================= */

  const vip = async (u, plan) => {
    if (!(await guardAction())) return;

    const on = plan !== 'none';

    const premiumPlan = on
      ? plan
      : 'none';

    const d = {
      is_vip: on,
      is_premium: on,
      premium_plan: premiumPlan,
      updated_at: new Date().toISOString(),
    };

    if (!u.badge_manual) {
      const b = autoBadge(premiumPlan);

      Object.assign(d, {
        badge_type: b,
        ...badgeFields(b),
      });
    }

    const {
      error,
    } = await supabase
      .from('profiles')
      .update(d)
      .eq('id', u.id);

    if (error) {
      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      return;
    }

    setUsers((p) =>
      p.map((x) =>
        x.id === u.id
          ? {
              ...x,
              ...d,
            }
          : x
      )
    );

    setMsg({
      text: 'تم تحديث VIP ⭐',
      type: 'success',
    });
  };

  /* =========================================================
     BADGES
  ========================================================= */

  const badge = async (u, field, label) => {
    if (!(await guardAction())) return;

    const on = !u[field];

    const type =
      field === 'verification_badge'
        ? 'verification'
        : field === 'official_badge'
          ? 'official'
          : 'owner';

    const d = {
      [field]: on,
      badge_manual: true,
      badge_type: on ? type : 'none',
      updated_at: new Date().toISOString(),
    };

    const {
      error,
    } = await supabase
      .from('profiles')
      .update(d)
      .eq('id', u.id);

    if (error) {
      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      return;
    }

    setUsers((p) =>
      p.map((x) =>
        x.id === u.id
          ? {
              ...x,
              ...d,
            }
          : x
      )
    );

    setMsg({
      text: `${
        on ? 'تم إعطاء' : 'تم نزع'
      } ${label} ${on ? '🏅' : '❌'}`,
      type: 'success',
    });
  };

  /* =========================================================
     BAN
  ========================================================= */

  const ban = async (u) => {
    if (!(await guardAction())) return;

    const d = {
      is_banned: !u.is_banned,
      updated_at: new Date().toISOString(),
    };

    const {
      error,
    } = await supabase
      .from('profiles')
      .update(d)
      .eq('id', u.id);

    if (error) {
      setMsg({
        text: `❌ ${error.message}`,
        type: 'error',
      });

      return;
    }

    setUsers((p) =>
      p.map((x) =>
        x.id === u.id
          ? {
              ...x,
              ...d,
            }
          : x
      )
    );
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

    setTitles((p) =>
      p.map((x) =>
        x.id === id
          ? {
              ...x,
              [field]: newValue,
            }
          : x
      )
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

    setTitles((p) =>
      p.filter((x) => x.id !== id)
    );

    log(`🗑️ حذف ${name}`);
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

          <h2>
            جاري التحقق...
          </h2>

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
              <h2>
                دخول لوحة الإدارة
              </h2>

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
              <h2>
                🛡️ التحقق النهائي
              </h2>

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

  const fu = users.filter((u) =>
    [
      u.username,
      u.display_name,
      u.user_code,
      u.id,
    ].some((v) =>
      (v || '')
        .toLowerCase()
        .includes(
          userSearch.toLowerCase()
        )
    )
  );

  const ft = titles.filter(
    (t) =>
      (
        t.title ||
        t.name ||
        ''
      )
        .toLowerCase()
        .includes(
          titleSearch.toLowerCase()
        ) ||
      String(
        t.tmdb_id || ''
      ).includes(titleSearch)
  );

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
            [
              'stats',
              '📊 الإحصائيات',
            ],
            [
              'settings',
              '⚙️ إعدادات VIP',
            ],
            [
              'users',
              '👥 المستخدمين',
            ],
            [
              'content',
              '🎬 المحتوى',
            ],
            [
              'logs',
              '📋 السجلات',
            ],
          ].map((x) => (
            <button
              key={x[0]}
              onClick={() => {
                if (!isAdmin) return;

                setTab(x[0]);

                setMsg({
                  text: '',
                  type: '',
                });
              }}
              disabled={!isAdmin}
              style={{
                ...S.tab,
                ...(tab === x[0]
                  ? S.active
                  : {}),
              }}
            >
              {x[1]}
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
              ].map((x) => (
                <div
                  style={S.stat}
                  key={x[2]}
                >
                  <b
                    style={{
                      fontSize: 28,
                    }}
                  >
                    {x[0]}
                  </b>

                  <strong>
                    {x[1]}
                  </strong>

                  <span>
                    {x[2]}
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
            ].map((x) => (
              <div
                style={S.setting}
                key={x[0]}
              >
                <b>
                  {x[1]}
                </b>

                <button
                  onClick={() => {
                    if (!isAdmin) return;

                    saveSetting(
                      x[0],
                      !settings[x[0]]
                    );
                  }}
                  disabled={!isAdmin}
                  style={{
                    ...S.toggle,
                    background:
                      settings[x[0]]
                        ? '#28a745'
                        : '#333',
                    opacity:
                      !isAdmin ? 0.5 : 1,
                  }}
                >
                  {settings[x[0]]
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
                    setSettings((p) => ({
                      ...p,
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
                placeholder="🔎 بحث..."
                value={userSearch}
                onChange={(e) =>
                  setUserSearch(
                    e.target.value
                  )
                }
              />
            </div>

            <div style={S.stack}>
              {fu.map((u) => (
                <div
                  style={S.user}
                  key={u.id}
                >
                  <div
                    style={S.userTop}
                  >
                    <div
                      style={S.userInfo}
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
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
                        <b>
                          {u.display_name ||
                            u.username ||
                            u.user_code ||
                            'مستخدم'}
                        </b>

                        <div
                          style={S.small}
                        >
                          @
                          {u.username ||
                            'no-username'}{' '}
                          •{' '}
                          {u.user_code ||
                            'بدون كود'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!isAdmin)
                          return;

                        ban(u);
                      }}
                      disabled={!isAdmin}
                      style={{
                        ...S.smallBtn,
                        background:
                          u.is_banned
                            ? '#28a745'
                            : '#d9534f',
                        opacity:
                          !isAdmin ? 0.5 : 1,
                      }}
                    >
                      {u.is_banned
                        ? '🔓 فك الحظر'
                        : '🚫 حظر'}
                    </button>
                  </div>

                  <div style={S.sub}>
                    <b>⭐ VIP</b>

                    <div style={S.row}>
                      <button
                        onClick={() => {
                          if (!isAdmin)
                            return;

                          vip(u, 'none');
                        }}
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
                        onClick={() => {
                          if (!isAdmin)
                            return;

                          vip(u, 'month');
                        }}
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
                        onClick={() => {
                          if (!isAdmin)
                            return;

                          vip(u, 'year');
                        }}
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
                        onClick={() => {
                          if (!isAdmin)
                            return;

                          vip(u, 'manual');
                        }}
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
                      <button
                        onClick={() => {
                          if (!isAdmin)
                            return;

                          badge(
                            u,
                            'verification_badge',
                            'Verified'
                          );
                        }}
                        disabled={!isAdmin}
                        style={{
                          ...S.smallBtn,
                          opacity:
                            !isAdmin
                              ? 0.5
                              : 1,
                        }}
                      >
                        ✓ Verified
                      </button>

                      <button
                        onClick={() => {
                          if (!isAdmin)
                            return;

                          badge(
                            u,
                            'official_badge',
                            'Official'
                          );
                        }}
                        disabled={!isAdmin}
                        style={{
                          ...S.smallBtn,
                          opacity:
                            !isAdmin
                              ? 0.5
                              : 1,
                        }}
                      >
                        🔵 Official
                      </button>

                      <button
                        onClick={() => {
                          if (!isAdmin)
                            return;

                          badge(
                            u,
                            'owner_badge',
                            'Owner'
                          );
                        }}
                        disabled={!isAdmin}
                        style={{
                          ...S.smallBtn,
                          opacity:
                            !isAdmin
                              ? 0.5
                              : 1,
                        }}
                      >
                        👑 Owner
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
              {ft.map((t) => (
                <div
                  style={S.titleCard}
                  key={t.id}
                >
                  <div
                    style={S.userInfo}
                  >
                    {(t.poster_path ||
                      t.poster_url) && (
                      <img
                        src={
                          t.poster_path ||
                          t.poster_url
                        }
                        style={S.poster}
                        alt=""
                      />
                    )}

                    <div>
                      <b>
                        {t.title ||
                          t.name}
                      </b>

                      <div
                        style={S.small}
                      >
                        {t.type ===
                          'series' ||
                        t.type === 'tv'
                          ? 'مسلسل'
                          : 'فيلم'}{' '}
                        • TMDB{' '}
                        {t.tmdb_id || '-'}
                      </div>
                    </div>
                  </div>

                  <div style={S.row}>
                    <button
                      onClick={() => {
                        if (!isAdmin)
                          return;

                        titleAction(
                          t.id,
                          'is_premium',
                          t.is_premium
                        );
                      }}
                      disabled={!isAdmin}
                      style={{
                        ...S.smallBtn,
                        opacity:
                          !isAdmin
                            ? 0.5
                            : 1,
                      }}
                    >
                      {t.is_premium
                        ? '⭐ إزالة VIP'
                        : '⭐ جعل VIP'}
                    </button>

                    <button
                      onClick={() => {
                        if (!isAdmin)
                          return;

                        titleAction(
                          t.id,
                          'is_hidden',
                          t.is_hidden
                        );
                      }}
                      disabled={!isAdmin}
                      style={{
                        ...S.smallBtn,
                        opacity:
                          !isAdmin
                            ? 0.5
                            : 1,
                      }}
                    >
                      {t.is_hidden
                        ? '👁️ إظهار'
                        : '🙈 إخفاء'}
                    </button>

                    <button
                      onClick={() => {
                        if (!isAdmin)
                          return;

                        delTitle(
                          t.id,
                          t.title ||
                            t.name
                        );
                      }}
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
            <h3>
              📋 السجلات
            </h3>

            <div style={S.logs}>
              {logs.map((x, i) => (
                <div key={i}>
                  {x}
                </div>
              ))}
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
    background: '#1b1b1b',
    border: '1px solid #2b2b2b',
    borderRadius: 13,
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
    width: 46,
    height: 46,
    borderRadius: '50%',
    objectFit: 'cover',
    background: '#333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  small: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
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
