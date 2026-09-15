import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ADMIN_PIN = '2026';

export default function Admin() {
  const navigate = useNavigate();

  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

  const [message, setMessage] = useState({
    text: '',
    type: ''
  });

  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    totalTitles: 0,
    totalUsers: 0,
    bannedUsers: 0,
    hiddenTitles: 0,
    premiumUsers: 0,
    vipUsers: 0,
    officialUsers: 0,
    owners: 0
  });

  const [settings, setSettings] = useState({
    maintenance_mode: false,
    diagnostics_enabled: false,
    announcement_bar: '',
    vip_features_enabled: true
  });

  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  const [titles, setTitles] = useState([]);
  const [titleSearch, setTitleSearch] = useState('');

  const [systemLogs, setSystemLogs] = useState([]);

  // =========================================================
  // PIN
  // =========================================================

  const handlePinSubmit = (e) => {
    e.preventDefault();

    if (pinInput === ADMIN_PIN) {
      setIsAuthenticated(true);
      setMessage({
        text: '',
        type: ''
      });

      fetchData();
    } else {
      setMessage({
        text: '❌ رمز الـ PIN غير صحيح!',
        type: 'error'
      });
    }
  };

  // =========================================================
  // LOGS
  // =========================================================

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString('ar-DZ');

    setSystemLogs(prev => [
      `[${time}] ${text}`,
      ...prev.slice(0, 19)
    ]);
  };

  // =========================================================
  // FETCH DATA
  // =========================================================

  const fetchData = async () => {
    setLoading(true);

    try {
      // -------------------------
      // SETTINGS
      // -------------------------

      const {
        data: settingsData,
        error: settingsError
      } = await supabase
        .from('site_settings')
        .select('*');

      if (settingsError) {
        throw settingsError;
      }

      const config = {};

      (settingsData || []).forEach(item => {
        config[item.key] = item.value;
      });

      setSettings({
        maintenance_mode:
          config.maintenance_mode === 'true',

        diagnostics_enabled:
          config.diagnostics_enabled === 'true',

        announcement_bar:
          config.announcement_bar || '',

        vip_features_enabled:
          config.vip_features_enabled !== 'false'
      });


      // -------------------------
      // USERS
      // -------------------------

      const {
        data: usersData,
        error: usersError
      } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', {
          ascending: false
        });

      if (usersError) {
        throw usersError;
      }

      const loadedUsers = usersData || [];

      setUsers(loadedUsers);


      // -------------------------
      // TITLES
      // -------------------------

      const {
        data: titlesData,
        error: titlesError
      } = await supabase
        .from('titles')
        .select('*')
        .order('id', {
          ascending: false
        })
        .limit(100);

      if (titlesError) {
        throw titlesError;
      }

      const loadedTitles = titlesData || [];

      setTitles(loadedTitles);


      // -------------------------
      // STATS
      // -------------------------

      setStats({
        totalTitles: loadedTitles.length,

        totalUsers: loadedUsers.length,

        bannedUsers:
          loadedUsers.filter(
            u => u.is_banned
          ).length,

        hiddenTitles:
          loadedTitles.filter(
            t => t.is_hidden
          ).length,

        premiumUsers:
          loadedUsers.filter(
            u => u.is_premium
          ).length,

        vipUsers:
          loadedUsers.filter(
            u =>
              u.manual_badge === 'vip' ||
              (
                u.is_premium &&
                u.premium_plan === 'monthly'
              )
          ).length,

        officialUsers:
          loadedUsers.filter(
            u =>
              u.manual_badge === 'official' ||
              (
                u.is_premium &&
                u.premium_plan === 'yearly'
              )
          ).length,

        owners:
          loadedUsers.filter(
            u =>
              u.is_owner === true ||
              u.manual_badge === 'owner'
          ).length
      });

      addLog('تم جلب وتحديث بيانات لوحة التحكم بنجاح');

    } catch (err) {
      console.error('فشل جلب البيانات:', err);

      setMessage({
        text: `فشل جلب البيانات: ${err.message}`,
        type: 'error'
      });

    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // SETTINGS
  // =========================================================

  const toggleSetting = async (
    key,
    currentValue
  ) => {

    const newValue = !currentValue;

    try {

      const {
        error
      } = await supabase
        .from('site_settings')
        .upsert({
          key,
          value: newValue.toString()
        });

      if (error) {
        throw error;
      }

      setSettings(prev => ({
        ...prev,
        [key]: newValue
      }));

      let label = key;

      if (key === 'maintenance_mode') {
        label = 'وضع الصيانة';
      }

      if (key === 'diagnostics_enabled') {
        label = 'لوحة التشخيص';
      }

      if (key === 'vip_features_enabled') {
        label = 'ميزات VIP';
      }

      setMessage({
        text:
          `تم ${newValue ? 'تفعيل' : 'تعطيل'} ${label} بنجاح ✅`,
        type: 'success'
      });

      addLog(
        `${newValue ? 'تفعيل' : 'تعطيل'} ${label}`
      );

    } catch (err) {

      setMessage({
        text: `خطأ: ${err.message}`,
        type: 'error'
      });
    }
  };


  const saveAnnouncement = async () => {

    try {

      const {
        error
      } = await supabase
        .from('site_settings')
        .upsert({
          key: 'announcement_bar',
          value: settings.announcement_bar
        });

      if (error) {
        throw error;
      }

      setMessage({
        text: 'تم حفظ الشريط الإعلاني بنجاح ✅',
        type: 'success'
      });

      addLog(
        `تحديث الشريط الإعلاني`
      );

    } catch (err) {

      setMessage({
        text: `خطأ: ${err.message}`,
        type: 'error'
      });
    }
  };


  // =========================================================
  // BAN USER
  // =========================================================

  const toggleUserBan = async (
    userId,
    isBanned
  ) => {

    try {

      const newValue = !isBanned;

      const {
        error
      } = await supabase
        .from('profiles')
        .update({
          is_banned: newValue
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
                ...u,
                is_banned: newValue
              }
            : u
        )
      );

      const actionText =
        newValue
          ? 'حظر'
          : 'فك حظر';

      setMessage({
        text:
          `تم ${actionText} المستخدم بنجاح ${newValue ? '🔒' : '🔓'}`,
        type: 'success'
      });

      addLog(
        `تم ${actionText} المستخدم: ${userId}`
      );

    } catch (err) {

      setMessage({
        text: `خطأ: ${err.message}`,
        type: 'error'
      });
    }
  };


  // =========================================================
  // PREMIUM
  // =========================================================

  const togglePremium = async (
    userId,
    isPremium,
    plan = 'monthly'
  ) => {

    try {

      const newPremium = !isPremium;

      const updateData = {
        is_premium: newPremium
      };

      if (newPremium) {

        updateData.premium_plan = plan;

        const expires = new Date();

        if (plan === 'yearly') {
          expires.setFullYear(
            expires.getFullYear() + 1
          );
        } else {
          expires.setMonth(
            expires.getMonth() + 1
          );
        }

        updateData.premium_expires_at =
          expires.toISOString();

      } else {

        updateData.premium_plan = 'none';

        updateData.premium_expires_at = null;
      }

      const {
        error
      } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
                ...u,
                ...updateData
              }
            : u
        )
      );

      setMessage({
        text:
          newPremium
            ? `تم تفعيل Premium ${plan === 'yearly' ? 'السنوي 🔵' : 'الشهري ⭐'} بنجاح`
            : 'تم إلغاء Premium بنجاح',
        type: 'success'
      });

      addLog(
        `${newPremium ? 'تفعيل' : 'إلغاء'} Premium للمستخدم ${userId}`
      );

    } catch (err) {

      setMessage({
        text: `خطأ: ${err.message}`,
        type: 'error'
      });
    }
  };


  // =========================================================
  // MANUAL BADGE
  // =========================================================

  const setManualBadge = async (
    userId,
    badge
  ) => {

    try {

      const updateData = {
        manual_badge: badge,
        is_owner:
          badge === 'owner'
            ? true
            : undefined
      };

      if (badge !== 'owner') {
        updateData.is_owner = false;
      }

      const {
        error
      } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
                ...u,
                ...updateData
              }
            : u
        )
      );

      const names = {
        none: 'بدون Badge',
        vip: 'VIP ⭐',
        official: 'Official 🔵',
        owner: 'Owner 👑'
      };

      setMessage({
        text:
          `تم تعيين ${names[badge]} للمستخدم بنجاح ✅`,
        type: 'success'
      });

      addLog(
        `تغيير Badge للمستخدم ${userId} إلى ${names[badge]}`
      );

    } catch (err) {

      setMessage({
        text: `خطأ: ${err.message}`,
        type: 'error'
      });
    }
  };


  // =========================================================
  // CONTENT
  // =========================================================

  const toggleTitleVisibility = async (
    titleId,
    isHidden
  ) => {

    try {

      const newValue = !isHidden;

      const {
        error
      } = await supabase
        .from('titles')
        .update({
          is_hidden: newValue
        })
        .eq('id', titleId);

      if (error) {
        throw error;
      }

      setTitles(prev =>
        prev.map(t =>
          t.id === titleId
            ? {
                ...t,
                is_hidden: newValue
              }
            : t
        )
      );

      setMessage({
        text:
          `تم ${newValue ? 'إخفاء' : 'إظهار'} العنوان 👁️`,
        type: 'success'
      });

    } catch (err) {

      setMessage({
        text: `خطأ: ${err.message}`,
        type: 'error'
      });
    }
  };


  const toggleTitlePremium = async (
    titleId,
    isPremium
  ) => {

    try {

      const newValue = !isPremium;

      const {
        error
      } = await supabase
        .from('titles')
        .update({
          is_premium: newValue
        })
        .eq('id', titleId);

      if (error) {
        throw error;
      }

      setTitles(prev =>
        prev.map(t =>
          t.id === titleId
            ? {
                ...t,
                is_premium: newValue
              }
            : t
        )
      );

      setMessage({
        text:
          `تم تغيير حالة VIP للعنوان 🌟`,
        type: 'success'
      });

    } catch (err) {

      setMessage({
        text: `خطأ: ${err.message}`,
        type: 'error'
      });
    }
  };


  const deleteTitle = async (
    titleId,
    titleName
  ) => {

    if (
      !window.confirm(
        `هل أنت متأكد من حذف "${titleName}" نهائياً؟`
      )
    ) {
      return;
    }

    try {

      const {
        error
      } = await supabase
        .from('titles')
        .delete()
        .eq('id', titleId);

      if (error) {
        throw error;
      }

      setTitles(prev =>
        prev.filter(
          t => t.id !== titleId
        )
      );

      setMessage({
        text:
          `تم حذف "${titleName}" بنجاح 🗑️`,
        type: 'success'
      });

      addLog(
        `حذف العنوان: ${titleName}`
      );

    } catch (err) {

      setMessage({
        text:
          `خطأ في الحذف: ${err.message}`,
        type: 'error'
      });
    }
  };


  // =========================================================
  // FILTERS
  // =========================================================

  const filteredUsers =
    users.filter(u => {

      const query =
        userSearch.toLowerCase();

      return (
        (u.email || '')
          .toLowerCase()
          .includes(query) ||

        (u.username || '')
          .toLowerCase()
          .includes(query) ||

        (u.id || '')
          .includes(userSearch)
      );
    });


  const filteredTitles =
    titles.filter(t => {

      const query =
        titleSearch.toLowerCase();

      return (
        (t.name || '')
          .toLowerCase()
          .includes(query) ||

        String(t.tmdb_id || '')
          .includes(titleSearch)
      );
    });


  // =========================================================
  // BADGE DISPLAY
  // =========================================================

  const getBadge = (user) => {

    if (
      user.is_owner === true ||
      user.manual_badge === 'owner'
    ) {
      return {
        label: 'OWNER 👑',
        background: '#8e44ad',
        color: '#fff'
      };
    }

    if (
      user.manual_badge === 'official'
    ) {
      return {
        label: 'OFFICIAL 🔵',
        background: '#1976d2',
        color: '#fff'
      };
    }

    if (
      user.manual_badge === 'vip'
    ) {
      return {
        label: 'VIP ⭐',
        background: '#ffc107',
        color: '#000'
      };
    }

    if (
      user.is_premium &&
      user.premium_plan === 'yearly'
    ) {
      return {
        label: 'OFFICIAL 🔵',
        background: '#1976d2',
        color: '#fff'
      };
    }

    if (
      user.is_premium &&
      user.premium_plan === 'monthly'
    ) {
      return {
        label: 'VIP ⭐',
        background: '#ffc107',
        color: '#000'
      };
    }

    return null;
  };


  // =========================================================
  // LOGIN SCREEN
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
          padding: '20px'
        }}
      >

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
            boxShadow:
              '0 10px 30px rgba(0,0,0,0.5)'
          }}
        >

          <div
            style={{
              fontSize: '40px',
              marginBottom: '10px'
            }}
          >
            🔐
          </div>

          <h2
            style={{
              fontSize: '22px',
              marginBottom: '8px',
              color: '#e50914'
            }}
          >
            لوحة تحكم StreamFlix
          </h2>

          <p
            style={{
              color: '#888',
              fontSize: '13px',
              marginBottom: '25px'
            }}
          >
            أدخل رمز PIN المسؤول
          </p>

          <input
            type="password"
            maxLength={6}
            placeholder="****"
            value={pinInput}
            onChange={e =>
              setPinInput(e.target.value)
            }
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
              outline: 'none'
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
              cursor: 'pointer'
            }}
          >
            فتح اللوحة
          </button>

          {message.text && (
            <p
              style={{
                color: '#ff4d4d',
                marginTop: '15px',
                fontSize: '13px'
              }}
            >
              {message.text}
            </p>
          )}

        </form>

      </div>
    );
  }


  // =========================================================
  // ADMIN
  // =========================================================

  return (
    <div
      style={{
        background: '#0a0a0a',
        color: '#fff',
        minHeight: '100vh',
        padding: '25px',
        direction: 'rtl',
        fontFamily: 'system-ui, sans-serif'
      }}
    >

      <div
        style={{
          maxWidth: '1250px',
          margin: '0 auto'
        }}
      >

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
            flexWrap: 'wrap'
          }}
        >

          <div>

            <h1
              style={{
                color: '#e50914',
                fontSize: '26px',
                margin: 0,
                fontWeight: '800'
              }}
            >
              ⚡ لوحة تحكم StreamFlix
            </h1>

            <span
              style={{
                fontSize: '12px',
                color: '#666'
              }}
            >
              إدارة المستخدمين · Premium · Badges · المحتوى
            </span>

          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >

            <button
              onClick={() =>
                navigate('/import')
              }
              style={{
                background: '#0066cc',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              📥 صفحة الاستيراد
            </button>

            <button
              onClick={() =>
                navigate('/')
              }
              style={{
                background: '#222',
                color: '#fff',
                border: '1px solid #333',
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              🏠 الموقع
            </button>

            <button
              onClick={() =>
                setIsAuthenticated(false)
              }
              style={{
                background: '#2a1212',
                color: '#ff5555',
                border: '1px solid #441a1a',
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔒 قفل
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
            paddingBottom: '5px'
          }}
        >

          {[
            {
              id: 'stats',
              label: '📊 الإحصائيات'
            },
            {
              id: 'settings',
              label: '⚙️ الإعدادات'
            },
            {
              id: 'users',
              label: '👥 المستخدمين'
            },
            {
              id: 'content',
              label: '🎬 المحتوى'
            },
            {
              id: 'logs',
              label: '📋 السجلات'
            }
          ].map(tab => (

            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);

                setMessage({
                  text: '',
                  type: ''
                });
              }}
              style={{
                padding: '12px 20px',
                background:
                  activeTab === tab.id
                    ? '#e50914'
                    : '#141414',
                color: '#fff',
                border: '1px solid',
                borderColor:
                  activeTab === tab.id
                    ? '#e50914'
                    : '#282828',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
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
              background:
                message.type === 'error'
                  ? '#2a1212'
                  : '#122a18',
              color:
                message.type === 'error'
                  ? '#ff6b6b'
                  : '#6bff8d',
              padding: '14px',
              borderRadius: '10px',
              marginBottom: '20px',
              border: '1px solid',
              borderColor:
                message.type === 'error'
                  ? '#4a1e1e'
                  : '#1e4a28',
              textAlign: 'center',
              fontWeight: 'bold'
            }}
          >
            {message.text}
          </div>

        )}


        {/* ===================================================
            STATS
        =================================================== */}

        {activeTab === 'stats' && (

          <div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(180px,1fr))',
                gap: '15px',
                marginBottom: '25px'
              }}
            >

              {[
                [
                  stats.totalTitles,
                  '🎬 إجمالي المحتوى'
                ],
                [
                  stats.totalUsers,
                  '👥 المستخدمين'
                ],
                [
                  stats.premiumUsers,
                  '💎 Premium'
                ],
                [
                  stats.vipUsers,
                  '⭐ VIP'
                ],
                [
                  stats.officialUsers,
                  '🔵 Official'
                ],
                [
                  stats.owners,
                  '👑 Owners'
                ],
                [
                  stats.bannedUsers,
                  '🚫 محظورين'
                ],
                [
                  stats.hiddenTitles,
                  '🙈 محتوى مخفي'
                ]
              ].map(
                ([number, label], index) => (

                  <div
                    key={index}
                    style={{
                      background: '#141414',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #282828',
                      textAlign: 'center'
                    }}
                  >

                    <div
                      style={{
                        fontSize: '30px',
                        fontWeight: 'bold',
                        color: '#e50914'
                      }}
                    >
                      {number}
                    </div>

                    <div
                      style={{
                        color: '#888',
                        fontSize: '13px',
                        marginTop: '5px'
                      }}
                    >
                      {label}
                    </div>

                  </div>

                )
              )}

            </div>


            <div
              style={{
                background: '#141414',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #282828',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap'
              }}
            >

              <div>

                <h3
                  style={{
                    margin: '0 0 5px'
                  }}
                >
                  🔄 تحديث البيانات
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: '#888',
                    fontSize: '13px'
                  }}
                >
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
                  fontWeight: 'bold'
                }}
              >
                {loading
                  ? '⏳ جاري التحديث...'
                  : '🔄 تحديث الآن'}
              </button>

            </div>

          </div>

        )}


        {/* ===================================================
            SETTINGS
        =================================================== */}

        {activeTab === 'settings' && (

          <div
            style={{
              display: 'grid',
              gap: '20px'
            }}
          >

            {/* MAINTENANCE */}

            <div
              style={cardStyle}
            >

              <div>

                <h3
                  style={{
                    margin: '0 0 5px',
                    color: '#ff4d4d'
                  }}
                >
                  🚧 وضع الصيانة
                </h3>

                <p
                  style={descStyle}
                >
                  إيقاف الموقع مؤقتاً وإظهار شاشة الصيانة.
                </p>

              </div>

              <ToggleButton
                active={
                  settings.maintenance_mode
                }
                onClick={() =>
                  toggleSetting(
                    'maintenance_mode',
                    settings.maintenance_mode
                  )
                }
                activeText="🚨 مفعل"
                inactiveText="⚪ معطل"
              />

            </div>


            {/* DIAGNOSTICS */}

            <div
              style={cardStyle}
            >

              <div>

                <h3
                  style={{
                    margin: '0 0 5px',
                    color: '#28a745'
                  }}
                >
                  💻 Diagnostics
                </h3>

                <p
                  style={descStyle}
                >
                  إظهار أدوات التشخيص وتتبع الأخطاء.
                </p>

              </div>

              <ToggleButton
                active={
                  settings.diagnostics_enabled
                }
                onClick={() =>
                  toggleSetting(
                    'diagnostics_enabled',
                    settings.diagnostics_enabled
                  )
                }
                activeText="🟢 مفعلة"
                inactiveText="⚪ معطلة"
              />

            </div>


            {/* VIP FEATURES */}

            <div
              style={cardStyle}
            >

              <div>

                <h3
                  style={{
                    margin: '0 0 5px',
                    color: '#ffc107'
                  }}
                >
                  ⭐ ميزات VIP
                </h3>

                <p
                  style={descStyle}
                >
                  عند تعطيلها، جميع ميزات VIP تصبح مقفولة وتظهر
                  علامة ⭐ للمستخدمين العاديين.
                </p>

              </div>

              <ToggleButton
                active={
                  settings.vip_features_enabled
                }
                onClick={() =>
                  toggleSetting(
                    'vip_features_enabled',
                    settings.vip_features_enabled
                  )
                }
                activeText="⭐ مفعلة"
                inactiveText="🔒 معطلة"
              />

            </div>


            {/* ANNOUNCEMENT */}

            <div
              style={{
                background: '#141414',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #282828'
              }}
            >

              <h3
                style={{
                  margin: '0 0 10px',
                  color: '#0066cc'
                }}
              >
                📢 الشريط الإعلاني
              </h3>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >

                <input
                  type="text"
                  placeholder="اكتب الإعلان..."
                  value={
                    settings.announcement_bar
                  }
                  onChange={e =>
                    setSettings({
                      ...settings,
                      announcement_bar:
                        e.target.value
                    })
                  }
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    background: '#222',
                    color: '#fff',
                    outline: 'none'
                  }}
                />

                <button
                  onClick={
                    saveAnnouncement
                  }
                  style={{
                    padding: '12px 24px',
                    background: '#0066cc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  حفظ
                </button>

              </div>

            </div>

          </div>

        )}


        {/* ===================================================
            USERS
        =================================================== */}

        {activeTab === 'users' && (

          <div
            style={{
              background: '#141414',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #282828'
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >

              <h3
                style={{
                  margin: 0
                }}
              >
                👥 إدارة المستخدمين ({filteredUsers.length})
              </h3>

              <input
                type="text"
                placeholder="🔎 بحث بالإيميل أو الاسم أو ID..."
                value={userSearch}
                onChange={e =>
                  setUserSearch(e.target.value)
                }
                style={{
                  padding: '10px 15px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#222',
                  color: '#fff',
                  outline: 'none',
                  width: '280px',
                  maxWidth: '100%'
                }}
              />

            </div>


            <div
              style={{
                display: 'grid',
                gap: '14px'
              }}
            >

              {filteredUsers.length === 0 ? (

                <div
                  style={{
                    textAlign: 'center',
                    color: '#777',
                    padding: '30px'
                  }}
                >
                  لا يوجد مستخدمين.
                </div>

              ) : (

                filteredUsers.map(user => {

                  const badge =
                    getBadge(user);

                  return (

                    <div
                      key={user.id}
                      style={{
                        background: '#1c1c1c',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid #282828'
                      }}
                    >

                      {/* USER INFO */}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '15px',
                          flexWrap: 'wrap'
                        }}
                      >

                        <div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              flexWrap: 'wrap',
                              fontWeight: 'bold'
                            }}
                          >

                            <span>
                              {user.username ||
                                user.email ||
                                'مستخدم'}
                            </span>

                            {badge && (

                              <span
                                style={{
                                  background:
                                    badge.background,
                                  color:
                                    badge.color,
                                  padding:
                                    '3px 8px',
                                  borderRadius:
                                    '5px',
                                  fontSize:
                                    '10px',
                                  fontWeight:
                                    '900'
                                }}
                              >
                                {badge.label}
                              </span>

                            )}

                            {user.is_banned && (

                              <span
                                style={{
                                  background:
                                    '#d9534f',
                                  color: '#fff',
                                  padding:
                                    '3px 8px',
                                  borderRadius:
                                    '5px',
                                  fontSize:
                                    '10px'
                                }}
                              >
                                محظور 🚫
                              </span>

                            )}

                          </div>

                          <div
                            style={{
                              color: '#777',
                              fontSize: '11px',
                              marginTop: '5px'
                            }}
                          >
                            {user.email || ''}
                          </div>

                          <div
                            style={{
                              color: '#555',
                              fontSize: '10px',
                              marginTop: '3px'
                            }}
                          >
                            ID: {user.id}
                          </div>

                          <div
                            style={{
                              color: '#888',
                              fontSize: '11px',
                              marginTop: '6px'
                            }}
                          >
                            Premium:{' '}
                            {user.is_premium
                              ? user.premium_plan === 'yearly'
                                ? 'سنوي 🔵'
                                : 'شهري ⭐'
                              : 'Free'}
                          </div>

                        </div>


                        {/* BUTTONS */}

                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            alignItems: 'flex-start'
                          }}
                        >

                          {/* PREMIUM */}

                          <button
                            onClick={() =>
                              togglePremium(
                                user.id,
                                user.is_premium,
                                'monthly'
                              )
                            }
                            style={{
                              ...smallButton,
                              background:
                                user.is_premium
                                  ? '#333'
                                  : '#ffc107',
                              color:
                                user.is_premium
                                  ? '#fff'
                                  : '#000'
                            }}
                          >
                            {user.is_premium
                              ? 'إلغاء Premium'
                              : 'VIP شهري ⭐'}
                          </button>


                          {!user.is_premium && (

                            <button
                              onClick={() =>
                                togglePremium(
                                  user.id,
                                  false,
                                  'yearly'
                                )
                              }
                              style={{
                                ...smallButton,
                                background:
                                  '#1976d2',
                                color: '#fff'
                              }}
                            >
                              VIP سنوي 🔵
                            </button>

                          )}


                          {/* BADGE DROPDOWN */}

                          <select
                            value={
                              user.manual_badge ||
                              'none'
                            }
                            onChange={e =>
                              setManualBadge(
                                user.id,
                                e.target.value
                              )
                            }
                            style={{
                              padding:
                                '8px 10px',
                              background:
                                '#222',
                              color:
                                '#fff',
                              border:
                                '1px solid #444',
                              borderRadius:
                                '6px',
                              cursor:
                                'pointer',
                              fontSize:
                                '12px'
                            }}
                          >

                            <option value="none">
                              بدون Badge
                            </option>

                            <option value="vip">
                              ⭐ VIP Badge
                            </option>

                            <option value="official">
                              🔵 Official Badge
                            </option>

                            <option value="owner">
                              👑 Owner Badge
                            </option>

                          </select>


                          {/* BAN */}

                          <button
                            onClick={() =>
                              toggleUserBan(
                                user.id,
                                user.is_banned
                              )
                            }
                            style={{
                              ...smallButton,
                              background:
                                user.is_banned
                                  ? '#28a745'
                                  : '#d9534f',
                              color: '#fff'
                            }}
                          >
                            {user.is_banned
                              ? 'فك الحظر 🔓'
                              : 'حظر 🚫'}
                          </button>

                        </div>

                      </div>

                    </div>

                  );
                })

              )}

            </div>

          </div>

        )}


        {/* ===================================================
            CONTENT
        =================================================== */}

        {activeTab === 'content' && (

          <div
            style={{
              background: '#141414',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #282828'
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >

              <h3
                style={{
                  margin: 0
                }}
              >
                🎬 إدارة المحتوى ({filteredTitles.length})
              </h3>

              <input
                type="text"
                placeholder="🔎 بحث عن فيلم أو مسلسل..."
                value={titleSearch}
                onChange={e =>
                  setTitleSearch(e.target.value)
                }
                style={{
                  padding: '10px 15px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#222',
                  color: '#fff',
                  outline: 'none',
                  width: '280px',
                  maxWidth: '100%'
                }}
              />

            </div>


            <div
              style={{
                display: 'grid',
                gap: '12px'
              }}
            >

              {filteredTitles.map(item => (

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
                    gap: '10px'
                  }}
                >

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >

                    {item.poster_url ? (

                      <img
                        src={item.poster_url}
                        alt=""
                        style={{
                          width: '40px',
                          height: '55px',
                          objectFit: 'cover',
                          borderRadius: '6px'
                        }}
                      />

                    ) : (

                      <div
                        style={{
                          width: '40px',
                          height: '55px',
                          background: '#333',
                          borderRadius: '6px'
                        }}
                      />

                    )}

                    <div>

                      <div
                        style={{
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}
                      >

                        {item.name}

                        {item.is_hidden && (

                          <span
                            style={{
                              color: '#ff9800',
                              fontSize: '12px',
                              marginRight: '8px'
                            }}
                          >
                            (مخفي)
                          </span>

                        )}

                      </div>

                      <div
                        style={{
                          fontSize: '11px',
                          color: '#777',
                          marginTop: '3px'
                        }}
                      >
                        النوع:{' '}
                        {item.type === 'series'
                          ? 'مسلسل'
                          : 'فيلم'}
                        {' | '}
                        TMDB:{' '}
                        {item.tmdb_id || 'غير مربوط'}
                      </div>

                    </div>

                  </div>


                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}
                  >

                    <button
                      onClick={() =>
                        toggleTitlePremium(
                          item.id,
                          item.is_premium
                        )
                      }
                      style={{
                        ...smallButton,
                        background:
                          item.is_premium
                            ? '#ff9800'
                            : '#222',
                        color: '#fff'
                      }}
                    >
                      {item.is_premium
                        ? 'حصري VIP 🌟'
                        : 'عادي'}
                    </button>

                    <button
                      onClick={() =>
                        toggleTitleVisibility(
                          item.id,
                          item.is_hidden
                        )
                      }
                      style={{
                        ...smallButton,
                        background:
                          item.is_hidden
                            ? '#28a745'
                            : '#444',
                        color: '#fff'
                      }}
                    >
                      {item.is_hidden
                        ? 'إظهار 👁️'
                        : 'إخفاء 🙈'}
                    </button>

                    <button
                      onClick={() =>
                        deleteTitle(
                          item.id,
                          item.name
                        )
                      }
                      style={{
                        ...smallButton,
                        background: '#d9534f',
                        color: '#fff'
                      }}
                    >
                      حذف 🗑️
                    </button>

                  </div>

                </div>

              ))}

            </div>

          </div>

        )}


        {/* ===================================================
            LOGS
        =================================================== */}

        {activeTab === 'logs' && (

          <div
            style={{
              background: '#141414',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #282828'
            }}
          >

            <h3
              style={{
                margin: '0 0 15px'
              }}
            >
              📋 سجل الأنشطة
            </h3>

            <div
              style={{
                background: '#080808',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #222',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#00ff00',
                minHeight: '200px'
              }}
            >

              {systemLogs.length === 0 ? (

                <div
                  style={{
                    color: '#555'
                  }}
                >
                  لا توجد سجلات حالية.
                </div>

              ) : (

                systemLogs.map(
                  (log, index) => (

                    <div
                      key={index}
                      style={{
                        marginBottom: '8px'
                      }}
                    >
                      {log}
                    </div>

                  )
                )

              )}

            </div>

          </div>

        )}

      </div>

    </div>
  );
}


// =========================================================
// STYLES
// =========================================================

const cardStyle = {
  background: '#141414',
  padding: '20px',
  borderRadius: '12px',
  border: '1px solid #282828',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '20px',
  flexWrap: 'wrap'
};

const descStyle = {
  color: '#888',
  fontSize: '13px',
  margin: 0
};

const smallButton = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 'bold'
};


function ToggleButton({
  active,
  onClick,
  activeText,
  inactiveText
}) {

  return (
    <button
      onClick={onClick}
      style={{
        padding: '11px 20px',
        background:
          active
            ? '#28a745'
            : '#222',
        color: '#fff',
        border:
          active
            ? 'none'
            : '1px solid #444',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        whiteSpace: 'nowrap'
      }}
    >
      {active
        ? activeText
        : inactiveText}
    </button>
  );
}
