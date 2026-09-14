import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Settings.css';

export default function Settings() {
  const { user, profile, isPremium, signInWithGoogle, signOut, authError } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const fileInputRef = useRef(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
    setAvatarUrl(profile?.avatar_url || '');
  }, [profile]);

  const handleAvatarClick = () => {
    if (!user || uploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setAvatarError('');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (!allowedTypes.includes(file.type)) {
      setAvatarError('رجاءً اختر صورة بتنسيق JPG, PNG, WEBP أو GIF.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('يجب أن يكون حجم الصورة أقل من 5 ميغابايت.');
      event.target.value = '';
      return;
    }

    setUploadingAvatar(true);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (!publicUrl) throw new Error('تعذر إنشاء رابط الصورة.');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Avatar upload error:', error);
      setAvatarError(error?.message || 'تعذر رفع صورة الملف الشخصي.');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleSaveName = async () => {
    if (!user) return;
    const trimmedName = displayName.trim();

    setNameMessage('');
    setNameError('');

    if (!trimmedName) {
      setNameError('يرجى إدخال اسم صحيح.');
      return;
    }

    if (trimmedName.length > 40) {
      setNameError('الاسم يجب أن لا يتجاوز 40 حرفاً.');
      return;
    }

    setSavingName(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmedName })
        .eq('id', user.id);

      if (error) throw error;

      setDisplayName(trimmedName);
      setNameMessage('تم تحديث الاسم بنجاح ✨');
    } catch (error) {
      console.error('Name update error:', error);
      setNameError(error?.message || 'تعذر تحديث الاسم.');
    } finally {
      setSavingName(false);
    }
  };

  const currentAvatar =
    avatarUrl ||
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    '';

  return (
    <div className="settings-page">
      <div className="settings-container">
        
        {/* العنونة الرئيسية */}
        <header className="settings-header">
          <h1 className="settings-title">{t('settings_title') || 'الإعدادات'}</h1>
          <p className="settings-sub">{t('settings_subtitle') || 'إدارة حسابك وتفضيلات التطبيق بسهولة'}</p>
        </header>

        {authError && <div className="modern-alert error">{authError}</div>}

        {/* كارت البروفايل العلوي (في حال تسجيل الدخول) */}
        {user ? (
          <div className="profile-hero-card">
            <div className="profile-avatar-wrapper" onClick={handleAvatarClick} title="تغيير الصورة">
              <div className="avatar-ring">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Profile" className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder">👤</div>
                )}
                <div className="avatar-hover-overlay">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
              </div>
              {uploadingAvatar && <div className="avatar-loader-spinner" />}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>

            <div className="profile-info-block">
              <div className="profile-name-group">
                <h2 className="profile-display-name">{profile?.display_name || user.email?.split('@')[0]}</h2>
                <span className={`plan-badge ${isPremium ? 'vip' : 'free'}`}>
                  {isPremium ? '✨ VIP MEMBER' : 'FREE PLAN'}
                </span>
              </div>
              <p className="profile-email">{user.email}</p>
              <p className="profile-code">معرف المستخدم: <span>#{profile?.user_code || '---'}</span></p>
            </div>

            <button className="btn-signout" onClick={signOut}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {t('sign_out') || 'تسجيل الخروج'}
            </button>
          </div>
        ) : (
          /* كارت تسجيل الدخول إذا لم يكن مسجلاً */
          <div className="modern-card login-card">
            <div className="card-info">
              <h3>تسجيل الدخول إلى StreamFlix</h3>
              <p>قم بربط حسابك لحفظ قائمة المتابعة وسجل المشاهدة عبر جميع أجهزتك.</p>
            </div>
            <button className="google-signin-btn" onClick={signInWithGoogle}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.6-6.6C35.3 2.5 30 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.7 6C12.1 13.1 17.6 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.7-9.9 6.7-17.2z"/>
                <path fill="#FBBC05" d="M10.3 19.2c-.5 1.5-.8 3.1-.8 4.8l-7.7 6C1 31.5 0 27.9 2.6 24z"/>
                <path fill="#34A853" d="M24 48c6 0 11.3-2 15.1-5.4l-7.3-5.7c-2 1.4-4.6 2.2-7.8 2.2-6.4 0-11.9-3.6-13.7-8.7l-7.7 6C6.5 42.6 14.6 48 24 48z"/>
              </svg>
              {t('sign_in_google') || 'تسجيل الدخول عبر جوجل'}
            </button>
          </div>
        )}

        {/* قسم تعديل معلومات الحساب */}
        {user && (
          <section className="settings-section">
            <h3 className="section-label">👤 الحساب والملف الشخصي</h3>
            
            <div className="modern-card">
              {/* تعديل الاسم */}
              <div className="setting-item">
                <div className="item-text">
                  <span className="item-title">اسم العرض (Display Name)</span>
                  <span className="item-desc">الاسم الذي يظهر لأصدقائك في المنصة.</span>
                </div>
                <div className="input-group">
                  <input
                    type="text"
                    className="modern-input"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setNameMessage('');
                      setNameError('');
                    }}
                    maxLength={40}
                    placeholder="أدخل اسمك..."
                  />
                  <button
                    type="button"
                    className="btn-save"
                    onClick={handleSaveName}
                    disabled={savingName}
                  >
                    {savingName ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                </div>
              </div>

              {nameError && <div className="modern-alert error">{nameError}</div>}
              {nameMessage && <div className="modern-alert success">{nameMessage}</div>}

              {/* الصورة الشخصية */}
              <div className="setting-item">
                <div className="item-text">
                  <span className="item-title">الصورة الشخصية</span>
                  <span className="item-desc">تدعم صيغ JPG, PNG, WEBP وبحجم أقل من 5 ميغابايت.</span>
                </div>
                <button
                  type="button"
                  className="btn-glass"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? 'جاري الرفع...' : 'تغيير الصورة'}
                </button>
              </div>

              {avatarError && <div className="modern-alert error">{avatarError}</div>}
            </div>
          </section>
        )}

        {/* قسم التفضيلات والمظهر */}
        <section className="settings-section">
          <h3 className="section-label">⚙️ تفضيلات التطبيق</h3>
          
          <div className="modern-card">
            {/* لغة التطبيق */}
            <div className="setting-item">
              <div className="item-text">
                <span className="item-title">{t('settings_language') || 'لغة العرض'}</span>
                <span className="item-desc">اختر اللغة المفضلة لواجهة الموقع.</span>
              </div>
              <div className="custom-select-wrapper">
                <select
                  className="modern-select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                >
                  <option value="ar">العربية (Arabic)</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>

            {/* وضع المظهر الداكن */}
            <div className="setting-item">
              <div className="item-text">
                <span className="item-title">{t('settings_theme') || 'الوضع الداكن'}</span>
                <span className="item-desc">النمط السينمائي المظلم مصمم لتوفير راحة العينين.</span>
              </div>
              <label className="modern-switch">
                <input
                  type="checkbox"
                  checked={theme === 'dark'}
                  onChange={toggleTheme}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>
        </section>

        {/* قسم حول والخصوصية */}
        <section className="settings-section">
          <h3 className="section-label">📄 معلومات وقوانين</h3>
          
          <div className="modern-card">
            <Link to="/about" className="setting-link-item">
              <div className="item-text">
                <span className="item-title">{t('settings_about') || 'عن المنصة'}</span>
                <span className="item-desc">تعرف على StreamFlix وإصدار المنصة.</span>
              </div>
              <span className="link-arrow">‹</span>
            </Link>

            <div className="item-divider" />

            <Link to="/privacy" className="setting-link-item">
              <div className="item-text">
                <span className="item-title">{t('settings_privacy') || 'سياسة الخصوصية'}</span>
                <span className="item-desc">كيف نحمي بياناتك ومعلوماتك الشخصية.</span>
              </div>
              <span className="link-arrow">‹</span>
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
