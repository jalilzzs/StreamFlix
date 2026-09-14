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

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Please choose a JPG, PNG, WEBP or GIF image.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('The image must be smaller than 5 MB.');
      event.target.value = '';
      return;
    }

    setUploadingAvatar(true);

    try {
      const extension =
        file.name.split('.').pop()?.toLowerCase() ||
        file.type.split('/')[1] ||
        'jpg';

      const filePath = `${user.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
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
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error('Could not create the avatar URL.');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Avatar upload error:', error);
      setAvatarError(
        error?.message || 'Could not upload the profile picture.'
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
      setNameError('Name must be 40 characters or less.');
      return;
    }

    setSavingName(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmedName })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setDisplayName(trimmedName);
      setNameMessage('Name updated successfully.');
    } catch (error) {
      console.error('Name update error:', error);
      setNameError(error?.message || 'Could not update your name.');
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
    <div className="container settings-wrap">
      <h1 className="settings-title">{t('settings_title')}</h1>
      <p className="settings-sub">{t('settings_subtitle')}</p>

      {authError && <div className="error-banner">{authError}</div>}

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {user ? profile?.display_name || user.email : 'Sign in'}
            </div>

            <div className="settings-desc">
              {user
                ? 'Connected via Google'
                : 'Connect your Google account to sync your watchlist and history.'}
            </div>
          </div>

          {user ? (
            <button className="btn btn-ghost" onClick={signOut}>
              {t('sign_out')}
            </button>
          ) : (
            <button className="google-btn" onClick={signInWithGoogle}>
              <svg width="16" height="16" viewBox="0 0 48 48">
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

        {!user && <div className="placeholder-note"></div>}
      </div>

      {user && (
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Profile picture</div>
              <div className="settings-desc">
                Upload or change your profile picture.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div
                onClick={handleAvatarClick}
                title="Change profile picture"
                style={{
                  width: '64px',
                  height: '64px',
                  minWidth: '64px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  cursor: uploadingAvatar ? 'wait' : 'pointer',
                  border: '2px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt="Profile"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: '24px',
                      opacity: 0.7,
                    }}
                  >
                    👤
                  </span>
                )}

                {uploadingAvatar && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.65)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                    }}
                  >
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
                {uploadingAvatar ? 'Uploading...' : 'Change picture'}
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
              <div className="settings-label">Display name</div>
              <div className="settings-desc">
                Change the name displayed on your StreamFlix profile.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
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
                style={{
                  width: '220px',
                  maxWidth: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'inherit',
                  outline: 'none',
                }}
              />

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleSaveName}
                disabled={savingName}
              >
                {savingName ? 'Saving...' : 'Save'}
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
            <div
              style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(52, 168, 83, 0.12)',
                color: '#34A853',
              }}
            >
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
            <div className="settings-label">Plan</div>

            <div className={`plan-pill ${isPremium ? 'vip' : ''}`}>
              {isPremium ? 'VIP' : 'Free'}
            </div>
          </div>
        </div>
      )}

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {t('settings_language')}
            </div>

            <div className="settings-desc">
              Choose your preferred display language.
            </div>
          </div>

          <select
            className="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">
              {t('settings_theme')}
            </div>

            <div className="settings-desc">
              Dark mode is the default cinematic experience.
            </div>
          </div>

          <div
            className={`switch ${theme === 'light' ? 'on' : ''}`}
            onClick={toggleTheme}
          />
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-label">
            {t('settings_about')}
          </div>

          <Link to="/about">View</Link>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            {t('settings_privacy')}
          </div>

          <Link to="/privacy">View</Link>
        </div>
      </div>
    </div>
  );
}
