import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/ui';
import useSeo from '../lib/seo';

const PRESET_COLORS = ['#d4ab5f', '#8b5cf6', '#4ade9f', '#60a5fa', '#f2617a', '#f0abfc'];

export default function Tags() {
  const { tags, refreshTags, toast } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  useSeo({ title: 'وسومي', description: 'وسوم شخصية قابلة للتخصيص لتنظيم مكتبتي.', noIndex: true });

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createTag(name.trim(), color);
      setName('');
      await refreshTags();
      toast('تم إنشاء الوسم', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (tag) => {
    if (!window.confirm(`حذف الوسم «${tag.name}»؟ سيُزال من كل الأعمال المرتبطة به.`)) return;
    try {
      await api.deleteTag(tag.id);
      await refreshTags();
      toast('تم حذف الوسم', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <header className="animate-rise">
        <h1 className="text-2xl font-black sm:text-3xl">وسومي</h1>
        <p className="mt-1 text-sm text-white/50">نظّم مكتبتك بوسوم خاصة بك: تحفة فنية، طفولة، مريح…</p>
      </header>

      <form onSubmit={create} className="surface flex flex-wrap items-end gap-2 p-4">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="tagName">اسم الوسم</label>
          <input id="tagName" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: يستحق إعادة المشاهدة" maxLength={40} />
        </div>
        <div>
          <span className="label">اللون</span>
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`اللون ${c}`}
                className={`h-8 w-8 rounded-lg border-2 transition ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>إضافة وسم</button>
      </form>

      {!tags.length && <EmptyState icon="🏷" title="لا وسوم بعد" hint="أنشئ وسمك الأول من الأعلى." />}

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tags.map((tag) => (
          <li key={tag.id} className="surface flex items-center justify-between gap-2 p-3">
            <Link
              to={`/library?tagId=${tag.id}`}
              className="chip cursor-pointer"
              style={{ background: `${tag.color}22`, borderColor: `${tag.color}70`, color: tag.color }}
            >
              {tag.name}
            </Link>
            <span className="text-xs text-white/40">{tag.usageCount} عمل</span>
            <button type="button" className="btn px-2.5 py-1 text-xs text-rose-heart" onClick={() => remove(tag)}>
              حذف
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
