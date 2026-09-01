import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import { BlockSkeleton, ErrorState, Spinner } from '../components/ui';
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '../lib/constants';
import useSeo from '../lib/seo';

function Section({ title, hint, children }) {
  return (
    <section className="surface p-4 sm:p-5 animate-rise">
      <h2 className="text-base font-black sm:text-lg">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-white/45">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { options, tags, prefs, setPrefs, toast, t } = useApp();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ displayName: '', bio: '', avatarUrl: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useSeo({ title: t('settings.title'), noIndex: true });

  useEffect(() => {
    api
      .profile()
      .then((data) => {
        setProfile(data.profile);
        setForm({
          displayName: data.profile.displayName || '',
          bio: data.profile.bio || '',
          avatarUrl: data.profile.avatarUrl || '',
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api.updateProfile(form);
      setProfile(data.profile);
      toast(t('settings.saved'), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState message={error} />;
  if (!profile) return <BlockSkeleton height={320} />;

  return (
    <div className="space-y-5">
      <header className="animate-rise">
        <h1 className="text-2xl font-black sm:text-3xl">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-white/50">{t('settings.subtitle')}</p>
      </header>

      {/* ------------------------------------------------ profile */}
      <Section title={`👤 ${t('settings.profile')}`}>
        <form onSubmit={save} className="space-y-3">
          <div className="flex items-center gap-3">
            {form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt=""
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/15"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brass-500 to-plum-500 text-xl font-black text-ink-950">
                {(form.displayName || 'M').slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="displayName">
                {t('settings.displayName')}
              </label>
              <input
                id="displayName"
                className="field py-2 text-sm"
                value={form.displayName}
                maxLength={60}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="bio">
              {t('settings.bio')}
            </label>
            <textarea
              id="bio"
              className="field text-sm"
              rows={3}
              maxLength={600}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="avatarUrl">
              {t('settings.avatarUrl')}
            </label>
            <input
              id="avatarUrl"
              className="field py-2 text-sm"
              dir="ltr"
              type="url"
              placeholder="https://…"
              value={form.avatarUrl}
              onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            />
            <p className="mt-1 text-[0.65rem] text-white/35">{t('settings.avatarHint')}</p>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner /> : t('settings.save')}
          </button>
        </form>
      </Section>

      {/* ------------------------------------------------ appearance */}
      <Section title={`🎨 ${t('settings.appearance')}`} hint={t('settings.languageHint')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="theme">
              {t('settings.theme')}
            </label>
            <select
              id="theme"
              className="field py-2 text-sm"
              value={prefs.theme}
              onChange={(e) => setPrefs({ theme: e.target.value })}
            >
              <option value="cinema">{t('settings.theme.cinema')}</option>
              <option value="midnight">{t('settings.theme.midnight')}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lang">
              {t('settings.language')}
            </label>
            <select
              id="lang"
              className="field py-2 text-sm"
              value={prefs.lang}
              onChange={(e) => setPrefs({ lang: e.target.value })}
            >
              <option value="ar">العربية (RTL)</option>
              <option value="en">English (LTR)</option>
            </select>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------ tracking options */}
      <Section title={`📼 ${t('settings.tracking')}`}>
        <label className="label">{t('settings.qualities')}</label>
        <div className="flex flex-wrap gap-1.5">
          {(options.qualities || []).map((q) => (
            <span key={q} className="chip">
              {q}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[0.65rem] text-white/35">{t('settings.qualitiesHint')}</p>

        <label className="label mt-4">{t('settings.statuses')}</label>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((s) => (
            <span
              key={s}
              className="chip"
              style={{ background: `${STATUS_COLORS[s]}1f`, borderColor: `${STATUS_COLORS[s]}55`, color: STATUS_COLORS[s] }}
            >
              {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------ tags */}
      <Section title={`🏷 ${t('settings.tags')}`} hint={t('settings.tagsHint')}>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="chip"
              style={{ background: `${tag.color}1f`, borderColor: `${tag.color}66`, color: tag.color }}
            >
              {tag.name} · {tag.usageCount}
            </span>
          ))}
          {tags.length === 0 && <p className="text-xs text-white/40">—</p>}
        </div>
        <Link to="/tags" className="btn btn-ghost mt-3 text-xs text-brass-400">
          {t('settings.tagsManage')}
        </Link>
      </Section>

      {/* ------------------------------------------------ export */}
      <Section title={`⬇ ${t('settings.export')}`} hint={t('settings.exportHint')}>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href={api.exportUrl('json')} download>
            {t('settings.exportJson')}
          </a>
          <a className="btn" href={api.exportUrl('csv')} download>
            {t('settings.exportCsv')}
          </a>
        </div>
      </Section>

      {/* ------------------------------------------------ about */}
      <Section title={`🎬 ${t('settings.about')}`}>
        <p className="text-xs leading-relaxed text-white/60">{t('settings.aboutBody')}</p>
        <p className="mt-2 text-xs leading-relaxed text-white/60">{t('settings.aboutTmdb')}</p>
        <p className="mt-2 text-xs leading-relaxed text-white/60">{t('settings.aboutAnime')}</p>
      </Section>
    </div>
  );
}
