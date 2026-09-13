import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { STRIPE_PUBLISHABLE_KEY, PLAN_IDS } from '../lib/config';
import './Subscription.css';

export default function Subscription() {
  const { user, isPremium } = useAuth();
  const { t } = useI18n();
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  // Placeholder checkout handler. Real flow: call your backend endpoint
  // (e.g. Supabase Edge Function) that creates a Stripe Checkout Session
  // with the given price ID, then redirect to session.url. On successful
  // payment, a Stripe webhook should set profiles.is_premium = true.
  async function handleCheckout(planKey) {
    if (!user) {
      alert('Please sign in first.');
      return;
    }
    setCheckoutLoading(planKey);
    try {
      console.log('Would start Stripe Checkout with:', {
        priceId: PLAN_IDS[planKey],
        publishableKey: STRIPE_PUBLISHABLE_KEY,
        userId: user.id,
      });
      alert(
        `Placeholder: this would redirect to Stripe Checkout for plan "${planKey}".\n\n` +
        'Wire this button to a backend endpoint that creates a Checkout Session ' +
        'and sets profiles.is_premium via webhook on payment success.'
      );
    } finally {
      setCheckoutLoading(null);
    }
  }

  return (
    <div className="container subscription-page">
      <section className="hero-simple">
        <div className="hero-eyebrow">{t('nav_subscription')}</div>
        <h1>Unlock the full StreamFlix experience</h1>
        <p>Choose a plan to remove ads, stream in 4K, and host Watch Parties with friends.</p>
      </section>

      <section className="plans">
        <div className="plan-card">
          <div className="plan-name">{t('plan_free')}</div>
          <div className="plan-price">$0<span>/mo</span></div>
          <ul className="plan-features">
            <li><span className="check">✓</span> HD streaming</li>
            <li><span className="check">✓</span> Watchlist & history</li>
            <li><span className="check">✓</span> Friends & chat</li>
            <li className="muted-feature"><span>—</span> Ads between episodes</li>
          </ul>
          <button className="plan-cta ghost" disabled={!isPremium}>{t('current_plan')}</button>
        </div>

        <div className="plan-card featured">
          <div className="plan-badge">Most popular</div>
          <div className="plan-name">{t('plan_vip')}</div>
          <div className="plan-price">$9.99<span>/mo</span></div>
          <ul className="plan-features">
            <li><span className="check">✓</span> Ad-free streaming</li>
            <li><span className="check">✓</span> 4K Ultra HD & early releases</li>
            <li><span className="check">✓</span> VIP profile border</li>
            <li><span className="check">✓</span> Host Watch Parties</li>
          </ul>
          <button
            className="plan-cta primary"
            disabled={isPremium || checkoutLoading === 'vipMonthly'}
            onClick={() => handleCheckout('vipMonthly')}
          >
            {isPremium ? t('current_plan') : checkoutLoading === 'vipMonthly' ? '...' : t('upgrade')}
          </button>
        </div>

        <div className="plan-card">
          <div className="plan-name">{t('plan_vip_annual')}</div>
          <div className="plan-price">$89<span>/yr</span></div>
          <ul className="plan-features">
            <li><span className="check">✓</span> Everything in VIP</li>
            <li><span className="check">✓</span> 2 months free</li>
            <li><span className="check">✓</span> Custom animated emojis</li>
            <li><span className="check">✓</span> Unlimited voice notes</li>
          </ul>
          <button
            className="plan-cta ghost"
            disabled={checkoutLoading === 'vipAnnual'}
            onClick={() => handleCheckout('vipAnnual')}
          >
            {checkoutLoading === 'vipAnnual' ? '...' : 'Choose annual'}
          </button>
        </div>
      </section>

      <section className="features-section">
        <div className="section-title" style={{ textAlign: 'center' }}>What VIP unlocks</div>
        <div className="feature-grid">
          {[
            ['🚫', 'Ad-free streaming', 'No pre-roll, mid-roll, or banner ads anywhere on the platform.'],
            ['✨', 'VIP profile border', 'A gold animated border on your avatar, visible to friends in chat.'],
            ['📺', '4K Ultra HD & early access', 'Stream in 4K where available, and unlock select titles early.'],
            ['👥', 'Watch Party hosting', 'Host synced watch sessions with friends. Free users can only join.'],
            ['😄', 'Custom animated emojis', 'Extra emoji packs and higher voice-note limits in chat.'],
          ].map(([icon, title, desc]) => (
            <div className="feature-card vip-border" key={title}>
              <span className="lock-tag">🔒 VIP</span>
              <div className="feature-icon">{icon}</div>
              <div className="feature-title">{title}</div>
              <div className="feature-desc">{desc}</div>
            </div>
          ))}
          <div className="feature-card">
            <div className="feature-icon">⬇</div>
            <div className="feature-title">Offline downloads</div>
            <div className="feature-desc">Available on all plans, with VIP getting higher quality downloads.</div>
          </div>
        </div>
      </section>

      <div className="placeholder-note" style={{ maxWidth: 640, margin: '0 auto 60px' }}>
        // Backend: create a Supabase Edge Function that takes a price ID, creates a Stripe<br />
        // Checkout Session, and returns session.url. A Stripe webhook should then set<br />
        // profiles.is_premium = true on checkout.session.completed.
      </div>
    </div>
  );
}
