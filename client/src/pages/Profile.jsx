import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import Shelf from '../components/Shelf';
import PosterArt from '../components/PosterArt';
import { BlockSkeleton, ErrorState, Modal } from '../components/ui';
import { TYPE_LABELS, formatDate, formatNumber, formatRating } from '../lib/constants';
import useSeo from '../lib/seo';

export default function Profile() {
  const { libraryVersion, toast } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ displayName: '', bio: '', avatarUrl: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .profile()
      .then((d) => {
        setData(d);
        setForm({ displayName: d.profile.displayName, bio: d.profile.bio || '', avatarUrl: d.profile.avatarUrl || '' });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, libraryVersion]);

  useSeo({
    title: data ? `ملف ${data.profile.displayName}` : 'ملفي',
    description: 'الملف الشخصي وإحصائيات المشاهدة في Mummy شافت.',
    noIndex: true,
  });

  const save = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        displayName: form.displayName,
        bio: form.bio,
        avatarUrl: form.avatarUrl || '',
      });
      toast('تم تحديث الملف الشخصي', 'success');
      setEditOpen(false);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <BlockSkeleton height={320} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const { profile, stats, byType, topGenres } = data;

  const typeCount = (type) => byType.find((b) => b.type === type)?.count || 0;

  return (
    <div className="space-y-5">
      <section className="surface relative overflow-hidden p-5 sm:p-7 animate-rise">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brass-500/15 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="w-24 shrink-0 sm:w-28">
            <PosterArt src={profile.avatarUrl} title={profile.displayName} alt={profile.displayName} ratio="1 / 1" rounded="999px" className="ring-2 ring-brass-500/40" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-start">
            <h1 className="text-2xl font-black sm:text-3xl">{profile.displayName}</h1>
            <p className="text-xs text-white/40">@{profile.username}</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/60 sm:mx-0" dir="auto">
              {profile.bio || 'لا توجد نبذة بعد.'}
            </p>
            <p className="mt-2 text-[0.68rem] text-white/30">عضو منذ {formatDate(profile.createdAt?.slice(0, 10))}</p>
            <button type="button" className="btn mt-3" onClick={() => setEditOpen(true)}>
              تعديل الملف
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {[
            [formatNumber(stats.total), 'إجمالي الأعمال'],
            [formatNumber(typeCount('movie')), 'أفلام'],
            [formatNumber(typeCount('tv') + typeCount('cartoon')), 'مسلسلات'],
            [formatNumber(typeCount('anime')), 'أنمي'],
            [formatNumber(stats.watched), 'شاهدتها'],
            [formatNumber(stats.watching), 'قيد المشاهدة'],
            [formatNumber(stats.wantToWatch), 'أريد مشاهدتها'],
            [formatNumber(stats.favorites), 'مفضلة'],
            [formatNumber(stats.episodesWatched), 'حلقات'],
            [stats.averageRating != null ? formatRating(stats.averageRating) : '—', 'متوسط تقييمي'],
            [formatNumber(stats.rewatches), 'إعادات مشاهدة'],
            [`${formatNumber(Math.round((stats.minutesWatched || 0) / 60))} س`, 'وقت المشاهدة'],
          ].map(([value, label]) => (
            <div key={label} className="surface-soft px-2 py-3 text-center">
              <div className="text-lg font-black text-brass-400 tabular-nums">{value}</div>
              <div className="mt-0.5 text-[0.65rem] text-white/50">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {topGenres?.length > 0 && (
        <section className="surface p-4 animate-rise">
          <h2 className="mb-2 text-base font-black">أكثر تصنيفاتي مشاهدة</h2>
          <div className="flex flex-wrap gap-1.5">
            {topGenres.map((g) => (
              <Link key={g.genre} to={`/library?genre=${encodeURIComponent(g.genre)}`} className="chip cursor-pointer">
                {g.genre} · {g.count}
                {g.avgRating != null && <span className="text-brass-400"> ★{formatRating(g.avgRating)}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {byType?.length > 0 && (
        <section className="surface p-4 animate-rise">
          <h2 className="mb-2 text-base font-black">التوزيع حسب النوع</h2>
          <ul className="space-y-2">
            {byType.map((b) => {
              const pct = stats.total ? Math.round((b.count / stats.total) * 100) : 0;
              return (
                <li key={b.type}>
                  <div className="flex justify-between text-xs">
                    <Link to={`/library?type=${b.type}`} className="font-bold text-white/75 hover:text-brass-400">
                      {TYPE_LABELS[b.type] || b.type}
                    </Link>
                    <span className="text-white/45 tabular-nums">
                      {b.count} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full bg-gradient-to-l from-brass-400 to-plum-400" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Shelf title="شاهدته مؤخرًا" entries={data.recentlyWatched} moreTo="/library?status=watched" emptyHint="لا شيء بعد." />
      <Shelf title="الأعلى تقييمًا عندي" entries={data.highestRated} moreTo="/library?sort=rating_desc" emptyHint="لم تقيّم أي عمل بعد." />
      <Shelf title="مفضلتي ❤" entries={data.favorites} moreTo="/library?favorite=true" emptyHint="لا مفضلات بعد." />

      <div className="text-center">
        <a href="/api/export" className="btn btn-ghost text-xs" download>
          تصدير مكتبتي (JSON)
        </a>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="تعديل الملف الشخصي"
        size="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="displayName">
              الاسم
            </label>
            <input id="displayName" className="field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="bio">
              نبذة
            </label>
            <textarea id="bio" rows="3" className="field resize-y" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="avatar">
              رابط صورة الملف (اختياري)
            </label>
            <input id="avatar" className="field" placeholder="https://…" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
