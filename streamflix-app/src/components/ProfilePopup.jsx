import { useEffect } from 'react';

const BADGE_INFO = {
  verification: {
    icon: '✓',
    label: 'موثّق',
    className: 'verified',
  },
  verified: {
    icon: '✓',
    label: 'موثّق',
    className: 'verified',
  },
  official: {
    icon: '◆',
    label: 'رسمي',
    className: 'official',
  },
  owner: {
    icon: '♛',
    label: 'مالك',
    className: 'owner',
  },
  vip: {
    icon: '★',
    label: 'VIP',
    className: 'vip',
  },
};

function getDisplayName(profile) {
  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    'مستخدم'
  );
}

function normalizeBadges(value) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((item) => String(item).trim())
          .filter(Boolean)
      ),
    ];
  }

  return [];
}

function formatMemberSince(value) {
  if (!value) return 'غير متوفر';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'غير متوفر';
  }

  return date.toLocaleDateString('ar-DZ', {
    year: 'numeric',
    month: 'long',
  });
}

export default function ProfilePopup({
  profile,
  currentUserId,
  isFriend = false,
  requestPending = false,
  onClose,
  onMessage,
  onAddFriend,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, [onClose]);

  if (!profile) return null;

  const name = getDisplayName(profile);
  const badges = normalizeBadges(profile.badges);
  const isVip = profile.is_premium === true;
  const isMe = profile.id === currentUserId;

  const initials =
    name.charAt(0).toUpperCase() || '?';

  return (
    <div
      className="profile-popup-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose?.();
        }
      }}
    >
      <section
        className={`profile-popup ${
          isVip ? 'profile-popup-vip' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={`ملف ${name}`}
      >
        <button
          type="button"
          className="profile-popup-close"
          onClick={onClose}
          aria-label="إغلاق"
        >
          ×
        </button>

        <div
          className={`profile-cover ${
            isVip ? 'profile-cover-vip' : ''
          }`}
        >
          {isVip && (
            <>
              <span className="profile-cover-glow glow-one" />
              <span className="profile-cover-glow glow-two" />

              <div className="profile-vip-ribbon">
                ★ VIP MEMBER
              </div>
            </>
          )}
        </div>

        <div className="profile-popup-body">
          <div className="profile-main">
            <div
              className={`profile-large-avatar ${
                isVip
                  ? 'profile-large-avatar-vip'
                  : ''
              }`}
              style={
                profile.avatar_url
                  ? {
                      backgroundImage: `url(${profile.avatar_url})`,
                    }
                  : undefined
              }
            >
              {!profile.avatar_url && (
                <span>{initials}</span>
              )}

              {isVip && (
                <span className="profile-avatar-star">
                  ★
                </span>
              )}
            </div>

            <div className="profile-title-area">
              <div className="profile-name-row">
                <h2>{name}</h2>

                {isVip && (
                  <span className="profile-vip-pill">
                    ★ VIP
                  </span>
                )}
              </div>

              {profile.user_code && (
                <div className="profile-user-code">
                  ID: {profile.user_code}
                </div>
              )}

              <div className="profile-status-line">
                <span className="profile-status-dot" />
                <span>
                  {isMe
                    ? 'هذا حسابك'
                    : 'صديق على StreamFlix'}
                </span>
              </div>
            </div>
          </div>

          {isVip && (
            <div className="vip-highlight">
              <div className="vip-highlight-icon">
                ★
              </div>

              <div>
                <strong>
                  عضو StreamFlix VIP
                </strong>

                <span>
                  هذا المستخدم لديه مزايا العضوية المميزة
                </span>
              </div>
            </div>
          )}

          <div className="profile-section">
            <div className="profile-section-title">
              <span>المعلومات</span>

              {isVip && (
                <small>★ معلومات VIP</small>
              )}
            </div>

            <div className="profile-info-grid">
              <div className="profile-info-card">
                <span className="profile-info-icon">
                  📍
                </span>

                <div>
                  <small>الولاية</small>
                  <strong>
                    {profile.wilaya ||
                      'غير محددة'}
                  </strong>
                </div>
              </div>

              <div className="profile-info-card">
                <span className="profile-info-icon">
                  📅
                </span>

                <div>
                  <small>عضو منذ</small>
                  <strong>
                    {formatMemberSince(
                      profile.created_at
                    )}
                  </strong>
                </div>
              </div>

              <div className="profile-info-card">
                <span className="profile-info-icon">
                  🏅
                </span>

                <div>
                  <small>البادجات</small>
                  <strong>
                    {badges.length}
                  </strong>
                </div>
              </div>

              <div
                className={`profile-info-card ${
                  isVip
                    ? 'profile-info-card-vip'
                    : ''
                }`}
              >
                <span className="profile-info-icon">
                  ★
                </span>

                <div>
                  <small>العضوية</small>
                  <strong>
                    {isVip
                      ? 'VIP'
                      : 'Free Plan'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-title">
              <span>البادجات</span>

              {badges.length > 0 && (
                <small>
                  {badges.length} بادج
                </small>
              )}
            </div>

            {badges.length > 0 ? (
              <div className="profile-badges">
                {badges.map((badge) => {
                  const info =
                    BADGE_INFO[badge] || {
                      icon: '✦',
                      label: badge,
                      className: 'custom',
                    };

                  return (
                    <div
                      key={badge}
                      className={`profile-badge profile-badge-${info.className}`}
                    >
                      <span>
                        {info.icon}
                      </span>

                      <strong>
                        {info.label}
                      </strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="profile-no-badges">
                لا توجد بادجات حالياً
              </div>
            )}
          </div>

          <div className="profile-actions">
            {!isMe && (
              <button
                type="button"
                className="profile-action-primary"
                onClick={() =>
                  onMessage?.(profile)
                }
              >
                <span>💬</span>
                مراسلة
              </button>
            )}

            {!isMe && !isFriend && (
              <button
                type="button"
                className="profile-action-secondary"
                disabled={requestPending}
                onClick={() =>
                  onAddFriend?.(profile)
                }
              >
                <span>
                  {requestPending ? '✓' : '+'}
                </span>

                {requestPending
                  ? 'تم إرسال الطلب'
                  : 'إضافة صديق'}
              </button>
            )}

            {!isMe && isFriend && (
              <div className="profile-friend-status">
                ✓ أنتم أصدقاء
              </div>
            )}

            {isMe && (
              <div className="profile-own-status">
                هذا هو ملفك الشخصي
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
