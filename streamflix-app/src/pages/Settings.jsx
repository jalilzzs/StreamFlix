import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Settings.css';

export default function Settings() {
  const {
    user,
    profile,
    isPremium,
    signInWithGoogle,
    signOut,
    authError,
  } = useAuth();

  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const fileInputRef = useRef(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  const [displayName, setDisplayName] = useState(
    profile?.display_name || ''
  );
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [nameError, setNameError] = useState('');

  /* =========================================================
     VIP LOCAL PREFERENCES
     ========================================================= */

  const [vipCinemaGlow, setVipCinemaGlow] = useState(
    () => localStorage.getItem('sf_vip_cinema_glow') !== 'false'
  );

  const [vipAutoPlay, setVipAutoPlay] = useState(
    () => localStorage.getItem('sf_vip_autoplay') !== 'false'
  );

  const [vipQuality, setVipQuality] = useState(
    () => localStorage.getItem('sf_vip_quality') || 'auto'
  );

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
    setAvatarUrl(profile?.avatar_url || '');
  }, [profile]);

  useEffect(() => {
    if (!isPremium) return;

    document.body.classList.toggle(
      'sf-vip-cinema-mode',
      vipCinemaGlow
    );

    return () => {
      document.body.classList.remove(
        'sf-vip-cinema-mode'
      );
    };
  }, [isPremium, vipCinemaGlow]);

  const updateVipPreference = (
    key,
    value,
    setter
  ) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  const handleAvatarClick = () => {
    if (!user || uploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file || !user) return;

    setAvatarError('');

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (!allowedTypes.includes(file.type)) {
      setAvatarError(
        'Please choose a JPG, PNG, WEBP or GIF image.'
      );
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(
        'The image must be smaller than 5 MB.'
      );
      event.target.value = '';
      return;
    }

    setUploadingAvatar(true);

    try {
      const extension =
        file.name.split('.').pop()?.toLowerCase() ||
        file.type.split('/')[1] ||
        'jpg';

      const filePath =
        `${user.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from('avatars')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error(
          'Could not create the avatar URL.'
        );
      }

      const { error: profileError } =
        await supabase
          .from('profiles')
          .update({
            avatar_url: publicUrl,
          })
          .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error(
        'Avatar upload error:',
        error
      );

      setAvatarError(
        error?.message ||
          'Could not upload the profile picture.'
      );
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
      setNameError('Please enter a name.');
      return;
    }

    if (trimmedName.length > 40) {
      setNameError(
        'Name must be 40 characters or less.'
      );
      return;
    }

    setSavingName(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: trimmedName,
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setDisplayName(trimmedName);
      setNameMessage(
        'Name updated successfully.'
      );
    } catch (error) {
      console.error(
        'Name update error:',
        error
      );

      setNameError(
        error?.message ||
          'Could not update your name.'
      );
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
    <div
      className={`container settings-wrap ${
        isPremium ? 'settings-vip' : ''
      }`}
    >
      {/* =====================================================
          VIP HERO
          ===================================================== */}

      {user && isPremium ? (
        <section className="vip-hero">
          <div className="vip-hero-glow" />

          <div className="vip-crown">
            👑
          </div>

          <div className="vip-hero-content">
            <div className="vip-eyebrow">
              STREAMFLIX VIP
            </div>

            <h1 className="vip-hero-title">
              Welcome back,{' '}
              <span>
                {profile?.display_name ||
                  user.email?.split('@')[0] ||
                  'VIP'}
              </span>
            </h1>

            <p className="vip-hero-sub">
              Your premium experience is active.
              Everything is ready for your next
              cinematic session.
            </p>

            <div className="vip-status-row">
              <span className="vip-status-pill">
                <span className="vip-status-dot" />
                VIP ACTIVE
              </span>

              <span className="vip-status-separator">
                •
              </span>

              <span className="vip-status-text">
                Premium member
              </span>
            </div>
          </div>

          <div className="vip-avatar-frame">
            <div className="vip-avatar-ring">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="Profile"
                />
              ) : (
                <span>
                  {(profile?.display_name ||
                    user.email ||
                    'VIP')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </div>

            <div className="vip-avatar-crown">
              ✦
            </div>
          </div>
        </section>
      ) : (
        <>
          <h1 className="settings-title">
            {t('settings_title')}
          </h1>

          <p className="settings-sub">
            {t('settings_subtitle')}
          </p>
        </>
      )}

      {authError && (
        <div className="error-banner">
          {authError}
        </div>
      )}

      {/* =====================================================
          ACCOUNT
          ===================================================== */}

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {user
                ? profile?.display_name ||
                  user.email
                : 'Sign in'}
            </div>

            <div className="settings-desc">
              {user
                ? 'Connected via Google'
                : 'Connect your Google account to sync your watchlist and history.'}
            </div>
          </div>

          {user ? (
            <button
              className="btn btn-ghost"
              onClick={signOut}
            >
              {t('sign_out')}
            </button>
          ) : (
            <button
              className="google-btn"
              onClick={signInWithGoogle}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 48 48"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.6-6.6C35.3 2.5 30 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.7 6C12.1 13.1 17.6 9.5 24 9.5z"
                />

                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.7-9.9 6.7-17.2z"
                />

                <path
                  fill="#FBBC05"
                  d="M10.3 19.2c-.5 1.5-.8 3.1-.8 4.8l-7.7 6C1 31.5 0 27.9 2.6 24z"
                />

                <path
                  fill="#34A853"
                  d="M24 48c6 0 11.3-2 15.1-5.4l-7.3-5.7c-2 1.4-4.6 2.2-7.8 2.2-6.4 0-11.9-3.6-13.7-8.7l-7.7 6C6.5 42.6 14.6 48 24 48z"
                />
              </svg>

              {t('sign_in_google')}
            </button>
          )}
        </div>

        {!user && (
          <div className="placeholder-note" />
        )}
      </div>

      {/* =====================================================
          VIP CONTROL CENTER
          ===================================================== */}

      {user && isPremium && (
        <section className="vip-control-card">
          <div className="vip-section-head">
            <div>
              <div className="vip-section-kicker">
                VIP EXCLUSIVE
              </div>

              <h2>
                VIP Control Center
              </h2>

              <p>
                Personalize your premium
                StreamFlix experience.
              </p>
            </div>

            <div className="vip-section-icon">
              ✦
            </div>
          </div>

          <div className="vip-controls">
            <div className="vip-control">
              <div className="vip-control-icon">
                ◉
              </div>

              <div className="vip-control-info">
                <strong>
                  Cinema Glow
                </strong>

                <span>
                  Add a subtle cinematic glow
                  around your StreamFlix
                  experience.
                </span>
              </div>

              <button
                type="button"
                className={`vip-switch ${
                  vipCinemaGlow ? 'active' : ''
                }`}
                onClick={() =>
                  updateVipPreference(
                    'sf_vip_cinema_glow',
                    !vipCinemaGlow,
                    setVipCinemaGlow
                  )
                }
                aria-label="Toggle Cinema Glow"
              >
                <span />
              </button>
            </div>

            <div className="vip-control">
              <div className="vip-control-icon">
                ▶
              </div>

              <div className="vip-control-info">
                <strong>
                  Smart Auto Play
                </strong>

                <span>
                  Keep playback preferences
                  ready for your next session.
                </span>
              </div>

              <button
                type="button"
                className={`vip-switch ${
                  vipAutoPlay ? 'active' : ''
                }`}
                onClick={() =>
                  updateVipPreference(
                    'sf_vip_autoplay',
                    !vipAutoPlay,
                    setVipAutoPlay
                  )
                }
                aria-label="Toggle Smart Auto Play"
              >
                <span />
              </button>
            </div>

            <div className="vip-control">
              <div className="vip-control-icon">
                HD
              </div>

              <div className="vip-control-info">
                <strong>
                  Preferred Quality
                </strong>

                <span>
                  Choose the quality preference
                  you want StreamFlix to remember.
                </span>
              </div>

              <select
                className="vip-quality-select"
                value={vipQuality}
                onChange={(e) =>
                  updateVipPreference(
                    'sf_vip_quality',
                    e.target.value,
                    setVipQuality
                  )
                }
              >
                <option value="auto">
                  Auto
                </option>
                <option value="1080p">
                  1080p
                </option>
                <option value="720p">
                  720p
                </option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          PROFILE
          ===================================================== */}

      {user && (
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">
                Profile picture
              </div>

              <div className="settings-desc">
                Upload or change your profile
                picture.
              </div>
            </div>

            <div className="profile-picture-actions">
              <div
                onClick={handleAvatarClick}
                title="Change profile picture"
                className="settings-avatar"
              >
                {currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt="Profile"
                  />
                ) : (
                  <span>👤</span>
                )}

                {uploadingAvatar && (
                  <div className="settings-avatar-loading">
                    ...
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar
                  ? 'Uploading...'
                  : 'Change picture'}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {avatarError && (
            <div
              className="error-banner"
              style={{ marginTop: '10px' }}
            >
              {avatarError}
            </div>
          )}

          <div className="settings-row">
            <div>
              <div className="settings-label">
                Display name
              </div>

              <div className="settings-desc">
                Change the name displayed on
                your StreamFlix profile.
              </div>
            </div>

            <div className="name-actions">
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setNameMessage('');
                  setNameError('');
                }}
                maxLength={40}
                placeholder="Your name"
                className="settings-name-input"
              />

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleSaveName}
                disabled={savingName}
              >
                {savingName
                  ? 'Saving...'
                  : 'Save'}
              </button>
            </div>
          </div>

          {nameError && (
            <div
              className="error-banner"
              style={{ marginTop: '10px' }}
            >
              {nameError}
            </div>
          )}

          {nameMessage && (
            <div className="success-message">
              {nameMessage}
            </div>
          )}

          <div className="settings-row">
            <div>
              <div className="settings-label">
                {t('settings_user_id')}
              </div>

              <div className="settings-desc">
                {t('settings_user_id_desc')}
              </div>
            </div>

            <div className="uid-box">
              {profile?.user_code || '—'}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              Plan
            </div>

            <div
              className={`plan-pill ${
                isPremium ? 'vip' : ''
              }`}
            >
              {isPremium ? 'VIP' : 'Free'}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          VIP BENEFITS
          ===================================================== */}

      {user && isPremium && (
        <section className="vip-benefits-card">
          <div className="vip-section-head compact">
            <div>
              <div className="vip-section-kicker">
                YOUR MEMBERSHIP
              </div>

              <h2>
                Included with VIP
              </h2>
            </div>

            <div className="vip-crown-small">
              👑
            </div>
          </div>

          <div className="vip-benefits-grid">
            <div className="vip-benefit">
              <span>✦</span>
              <div>
                <strong>
                  Premium identity
                </strong>
                <small>
                  VIP status across your profile.
                </small>
              </div>
            </div>

            <div className="vip-benefit">
              <span>◉</span>
              <div>
                <strong>
                  VIP appearance
                </strong>
                <small>
                  Exclusive cinematic interface.
                </small>
              </div>
            </div>

            <div className="vip-benefit">
              <span>▶</span>
              <div>
                <strong>
                  Playback preferences
                </strong>
                <small>
                  Keep your viewing preferences
                  ready.
                </small>
              </div>
            </div>

            <div className="vip-benefit">
              <span>♛</span>
              <div>
                <strong>
                  VIP profile badge
                </strong>
                <small>
                  A premium identity throughout
                  StreamFlix.
                </small>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          LANGUAGE / THEME
          ===================================================== */}

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {t('settings_language')}
            </div>

            <div className="settings-desc">
              Choose your preferred display
              language.
            </div>
          </div>

          <select
            className="lang-select"
            value={lang}
            onChange={(e) =>
              setLang(e.target.value)
            }
          >
            <option value="en">
              English
            </option>

            <option value="fr">
              Français
            </option>

            <option value="ar">
              العربية
            </option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">
              {t('settings_theme')}
            </div>

            <div className="settings-desc">
              Dark mode is the default cinematic
              experience.
            </div>
          </div>

          <div
            className={`switch ${
              theme === 'light' ? 'on' : ''
            }`}
            onClick={toggleTheme}
          />
        </div>
      </div>

      {/* =====================================================
          ABOUT / PRIVACY
          ===================================================== */}

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-label">
            {t('settings_about')}
          </div>

          <Link to="/about">
            View
          </Link>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            {t('settings_privacy')}
          </div>

          <Link to="/privacy">
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
