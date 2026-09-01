import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import { BlockSkeleton, EmptyState, ErrorState } from '../components/ui';
import { STATUS_COLORS, STATUS_LABELS, TYPE_LABELS, formatNumber, formatRating } from '../lib/constants';
import useSeo from '../lib/seo';

const CHART_COLORS = ['#d4ab5f', '#8b5cf6', '#4ade9f', '#60a5fa', '#f2617a', '#f0abfc', '#facc15', '#22d3ee'];

const tooltipStyle = {
  contentStyle: { background: '#12111b', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#d4ab5f' },
};

function Card({ title, children, hint }) {
  return (
    <section className="surface p-4 animate-rise">
      <h2 className="text-sm font-black sm:text-base">{title}</h2>
      {hint && <p className="mb-2 text-[0.68rem] text-white/40">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Metric({ value, label, accent = 'text-brass-400' }) {
  return (
    <div className="surface-soft px-3 py-3 text-center">
      <div className={`text-xl font-black tabular-nums sm:text-2xl ${accent}`}>{value}</div>
      <div className="mt-0.5 text-[0.68rem] text-white/55">{label}</div>
    </div>
  );
}

export default function Stats() {
  const { libraryVersion } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useSeo({ title: 'إحصائياتي', description: 'لوحة إحصائيات مشاهداتي: الحالات، التصنيفات، السنوات، الجودة والتقييمات.', noIndex: true });

  const load = useCallback(() => {
    setLoading(true);
    api
      .stats()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, libraryVersion]);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <BlockSkeleton height={140} />
        <BlockSkeleton height={140} />
        <BlockSkeleton height={260} />
        <BlockSkeleton height={260} />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;

  const t = data.totals;
  if (!t.total) {
    return (
      <EmptyState
        icon="📊"
        title="لا توجد بيانات بعد"
        hint="أضف أعمالًا إلى مكتبتك وستظهر إحصائياتك هنا تلقائيًا."
        action={
          <Link to="/search" className="btn btn-primary mt-3">
            ابدأ الآن
          </Link>
        }
      />
    );
  }

  const statusData = (data.byStatus || []).map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || '#8b5cf6',
  }));
  const typeData = (data.byType || []).map((s) => ({ name: TYPE_LABELS[s.type] || s.type, value: s.count }));
  const genreData = (data.byGenre || []).slice(0, 10).map((g) => ({ name: g.genre, value: g.count }));
  const yearData = (data.byYear || []).map((y) => ({ name: String(y.year), value: y.count }));
  const qualityData = (data.byQuality || []).map((q) => ({ name: q.quality, value: q.count }));
  const ratingData = (data.ratingBuckets || []).map((r) => ({ name: `${r.bucket}+`, value: r.count }));
  const monthly = (data.monthly || []).map((m) => ({ name: m.month, value: m.count }));

  const hours = Math.round((t.minutesWatched || 0) / 60);

  return (
    <div className="space-y-5">
      <header className="animate-rise">
        <h1 className="text-2xl font-black sm:text-3xl">إحصائياتي</h1>
        <p className="mt-1 text-sm text-white/50">كل الأرقام محسوبة من بيانات تتبّعك الشخصية.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric value={formatNumber(t.total)} label="إجمالي الأعمال" />
        <Metric value={formatNumber(t.watched)} label="أعمال مكتملة" accent="text-mint-400" />
        <Metric value={formatNumber(t.episodesWatched)} label="حلقات شوهدت" accent="text-plum-400" />
        <Metric value={t.averageRating != null ? formatRating(t.averageRating) : '—'} label="متوسط تقييمي" />
        <Metric value={formatNumber(t.favorites)} label="مفضلة" accent="text-rose-heart" />
        <Metric value={`${formatNumber(hours)} س`} label="وقت المشاهدة التقريبي" accent="text-white" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الأعمال حسب الحالة">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {statusData.map((d) => (
                  <Cell key={d.name} fill={d.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="الأعمال حسب النوع">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {typeData.map((d, i) => (
                  <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="أكثر التصنيفات مشاهدة">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={genreData} layout="vertical" margin={{ right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis type="number" tick={{ fill: '#8f8aa3', fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={95} tick={{ fill: '#b6b1c7', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#d4ab5f" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="حسب سنة الإصدار">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="name" tick={{ fill: '#8f8aa3', fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#8f8aa3', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="حسب الجودة التي شاهدتها بها">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={qualityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="name" tick={{ fill: '#8f8aa3', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={54} />
              <YAxis allowDecimals={false} tick={{ fill: '#8f8aa3', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#4ade9f" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="توزيع تقييماتي" hint="عدد الأعمال في كل نطاق تقييم">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ratingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="name" tick={{ fill: '#8f8aa3', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#8f8aa3', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#f0abfc" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {monthly.length > 1 && (
          <Card title="أعمال أنهيتها شهريًا" hint="آخر 12 شهرًا">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="name" tick={{ fill: '#8f8aa3', fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#8f8aa3', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke="#d4ab5f" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card title="الأعلى والأدنى تقييمًا عندي">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['الأعلى', data.topRated?.slice(0, 5), 'text-mint-400'],
              ['الأدنى', data.lowestRated?.slice(0, 5), 'text-rose-heart'],
            ].map(([label, list, color]) => (
              <div key={label}>
                <p className={`mb-1.5 text-xs font-black ${color}`}>{label}</p>
                <ul className="space-y-1">
                  {(list || []).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                      <Link to={`/title/${e.mediaId}`} className="truncate text-white/75 hover:text-brass-400" dir="auto">
                        {e.media?.title}
                      </Link>
                      <span className="shrink-0 tabular-nums text-white/50">{formatRating(e.rating)}</span>
                    </li>
                  ))}
                  {!(list || []).length && <li className="text-xs text-white/35">لا تقييمات بعد.</li>}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
