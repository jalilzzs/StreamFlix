import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { updateProfile, uploadProfileAvatar } from '../lib/api';
import { Link } from 'react-router-dom';
import './Settings.css';

export default function Settings() {
  const {
    user,
    profile,
    isPremium,
    signInWithGoogle,
    signOut,
    authError,
    setProfile,
  } = useAuth();

  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const fileInputRef = useRef(null);

  const [displayName, setDisplayName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
    setPreviewUrl(profile?.avatar_url || '');
  }, [profile]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleAvatarClick = () => {
    if (!user || saving) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSaveError('');
    setSaveMessage('');

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (!allowedTypes.includes(file.type)) {
      setSaveError('Please select a JPG, PNG, WEBP or GIF image.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image must be smaller than 5 MB.');
      event.target.value = '';
      return;
    }

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const newPreview = URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(newPreview);
  };

  const handleSaveChanges = async () => {
    if (!user || saving) return;

    setSaving(true);
    setSaveError('');
    setSaveMessage('');

    try {
      let updatedProfile = profile;

      const trimmedName = displayName.trim();

      if (!trimmedName) {
        throw new Error('Display name cannot be empty.');
      }

      if (trimmedName.length > 50) {
        throw new Error('Display name must be 50 characters or less.');
      }

      if (selectedFile) {
        updatedProfile = await uploadProfileAvatar(
          user.id,
          selectedFile
        );

        setSelectedFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

      if (trimmedName !== profile?.display_name) {
        updatedProfile = await updateProfile(user.id, {
          display_name: trimmedName,
        });
      }

      setProfile(updatedProfile);

      if (updatedProfile?.avatar_url) {
        setPreviewUrl(updatedProfile.avatar_url);
      }

      setSaveMessage('Changes saved successfully.');
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveError(
        error?.message || 'Failed to save your changes.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container settings-wrap">
      <h1 className="settings-title">
        {t('settings_title')}
      </h1>

      <p className="settings-sub">
        {t('settings_subtitle')}
      </p>

      {authError && (
        <div className="error-banner">
          {authError}
        </div>
      )}

      {saveError && (
        <div className="error-banner">
          {saveError}
        </div>
      )}

      {saveMessage && (
        <div className="success-banner">
          {saveMessage}
        </div>
      )}

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {user
                ? profile?.display_name ||
                  user.email ||
                  'User'
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
              disabled={saving}
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
                  d="M10.3 19.2c-.5 1.5-.8 3.1-.8 4.8s.3 3.3.8 4.8l-7.7 6C1 31.5 0 27.9 0 24s1-7.5 2.6-10.8l7.7 6z"
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
      </div>

      {user && (
        <>
          <div className="settings-card">
            <div className="settings-row">
              <div>
                <div className="settings-label">
                  Profile
                </div>

                <div className="settings-desc">
                  Change your profile picture and display name.
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '18px',
                padding: '20px 0 10px',
              }}
            >
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={saving}
                aria-label="Change profile picture"
                style={{
                  width: '110px',
                  height: '110px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid var(--border)',
                  background: 'var(--panel-raised)',
                  padding: 0,
                  cursor: saving ? 'default' : 'pointer',
                  position: 'relative',
                }}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: '38px',
                      fontWeight: '600',
                      color: 'var(--gold)',
                    }}
                  >
                    {(displayName ||
                      user.email ||
                      'U')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleAvatarClick}
                disabled={saving}
              >
                Change photo
              </button>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">
                  Display name
                </div>

                <div className="settings-desc">
                  This name will be shown to other users.
                </div>
              </div>

              <input
                type="text"
                value={displayName}
                onChange={(e) =>
                  setDisplayName(e.target.value)
                }
                maxLength={50}
                disabled={saving}
                style={{
                  background: 'var(--panel-raised)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  width: '220px',
                  maxWidth: '100%',
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                paddingTop: '18px',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={handleSaveChanges}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="settings-card">
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
        </>
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
            onChange={(e) =>
              setLang(e.target.value)
            }
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
            className={`switch ${
              theme === 'light' ? 'on' : ''
            }`}
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
