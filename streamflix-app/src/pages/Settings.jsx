import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { updateProfile } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
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
  const [avatarPreview, setAvatarPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarPreview(profile.avatar_url || '');
    }
  }, [profile]);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSaveError('Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image must be smaller than 5 MB.');
      return;
    }

    setSaveError('');
    setSaveMessage('');
    setSelectedFile(file);

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    setSaveMessage('');
    setSaveError('');

    try {
      let avatarUrl = profile?.avatar_url || null;

      if (selectedFile) {
        const extension =
          selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg';

        const filePath = `${user.id}/avatar.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: selectedFile.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      }

      const updatedProfile = await updateProfile(user.id, {
        display_name:
          displayName.trim() ||
          user.email?.split('@')[0] ||
          'New user',
        avatar_url: avatarUrl,
      });

      setProfile(updatedProfile);
      setSelectedFile(null);
      setSaveMessage('Profile updated successfully.');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setSaveError(error.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container settings-wrap">
      <h1 className="settings-title">{t('settings_title')}</h1>
      <p className="settings-sub">{t('settings_subtitle')}</p>

      {authError && <div className="error-banner">{authError}</div>}

      {user && (
        <div className="settings-card profile-card">
          <div className="profile-header">
            <div className="profile-avatar-section">
              <button
                type="button"
                className="profile-avatar-button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change profile picture"
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile"
                    className="profile-avatar"
                  />
                ) : (
                  <div className="profile-avatar profile-avatar-placeholder">
                    {(displayName || user.email || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <span className="avatar-edit-badge">✎</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                hidden
              />

              <div className="profile-avatar-hint">
                Click the image to change it
              </div>
            </div>

            <div className="profile-fields">
              <label className="profile-field">
                <span className="settings-label">Display name</span>

                <input
                  className="profile-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setSaveMessage('');
                    setSaveError('');
                  }}
                  maxLength={50}
                  placeholder="Your name"
                />
              </label>

              <div className="profile-email">
                <span className="settings-label">Email</span>
                <span className="settings-desc">{user.email}</span>
              </div>

              <button
                type="button"
                className="btn profile-save-btn"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>

              {saveMessage && (
                <div className="profile-success">
                  {saveMessage}
                </div>
              )}

              {saveError && (
                <div className="profile-error">
                  {saveError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {user
                ? profile?.display_name || user.email
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
            <div className="settings-label">Plan</div>

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
