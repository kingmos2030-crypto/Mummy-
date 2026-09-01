import { useEffect, useState } from 'react';
import api from '../api/client';
import { useApp } from '../context/AppContext';
import { STATUS_LABELS, STATUS_ORDER } from '../lib/constants';
import RatingInput from './RatingInput';
import { Modal } from './ui';

const emptyForm = {
  status: 'want_to_watch',
  rating: null,
  quality: '',
  isFavorite: false,
  notes: '',
  dateStarted: '',
  dateFinished: '',
  rewatchCount: 0,
  tagIds: [],
};

function fromEntry(entry) {
  if (!entry) return { ...emptyForm };
  return {
    status: entry.status,
    rating: entry.rating,
    quality: entry.quality || '',
    isFavorite: entry.isFavorite,
    notes: entry.notes || '',
    dateStarted: entry.dateStarted || '',
    dateFinished: entry.dateFinished || '',
    rewatchCount: entry.rewatchCount || 0,
    tagIds: (entry.tags || []).map((t) => t.id),
  };
}

/**
 * "تجربتي" editor — the personal-data half of the app.
 * Works both for an existing entry and for adding a freshly discovered title.
 */
export default function EntryEditor({ open, onClose, media, entry, onSaved, onDeleted }) {
  const { options, tags, refreshTags, toast, bumpLibrary } = useApp();
  const [form, setForm] = useState(fromEntry(entry));
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(fromEntry(entry));
      setError(null);
    }
  }, [open, entry]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const toggleTag = (id) =>
    set({ tagIds: form.tagIds.includes(id) ? form.tagIds.filter((t) => t !== id) : [...form.tagIds, id] });

  const addTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    try {
      const { tag } = await api.createTag(name);
      await refreshTags();
      set({ tagIds: [...new Set([...form.tagIds, tag.id])] });
      setNewTag('');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      status: form.status,
      rating: form.rating == null ? null : Number(form.rating),
      quality: form.quality || null,
      isFavorite: !!form.isFavorite,
      notes: form.notes || '',
      dateStarted: form.dateStarted || null,
      dateFinished: form.dateFinished || null,
      rewatchCount: Number(form.rewatchCount) || 0,
      tagIds: form.tagIds,
    };
    try {
      let result;
      if (entry?.id) {
        result = await api.updateEntry(entry.id, payload);
      } else {
        result = await api.addToLibrary({
          internalId: media?.id,
          source: media?.source,
          sourceType: media?.sourceType,
          sourceId: media?.sourceId,
          ...payload,
        });
      }
      bumpLibrary();
      toast(entry?.id ? 'تم تحديث سجلك الشخصي' : 'تمت الإضافة إلى مكتبتك', 'success');
      onSaved?.(result.entry);
      onClose?.();
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!entry?.id) return;
    if (!window.confirm('حذف هذا العمل من مكتبتك الشخصية؟ (بيانات التتبّع فقط ستُحذف)')) return;
    try {
      await api.deleteEntry(entry.id);
      bumpLibrary();
      toast('تم حذف السجل من مكتبتك', 'success');
      onDeleted?.();
      onClose?.();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry?.id ? `تعديل تجربتي — ${media?.title || ''}` : `إضافة إلى مكتبتي — ${media?.title || ''}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {entry?.id ? (
            <button type="button" onClick={remove} className="btn text-rose-heart">
              حذف من المكتبة
            </button>
          ) : (
            <span className="text-[0.7rem] text-white/40">تُحفظ بياناتك محليًا في قاعدة بياناتك فقط.</span>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              إلغاء
            </button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl border border-rose-heart/40 bg-rose-heart/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

        <div>
          <span className="label">الحالة</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set({ status: s })}
                className={`chip cursor-pointer ${form.status === s ? 'chip-plum' : ''}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <RatingInput value={form.rating} onChange={(v) => set({ rating: v })} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="quality">
              الجودة التي شاهدتها بها
            </label>
            <select id="quality" className="field" value={form.quality} onChange={(e) => set({ quality: e.target.value })}>
              <option value="">— غير محدد —</option>
              {(options.qualities || []).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rewatch">
              عدد مرات إعادة المشاهدة
            </label>
            <input
              id="rewatch"
              type="number"
              min="0"
              max="999"
              className="field"
              value={form.rewatchCount}
              onChange={(e) => set({ rewatchCount: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="started">
              تاريخ البدء
            </label>
            <input id="started" type="date" className="field" value={form.dateStarted || ''} onChange={(e) => set({ dateStarted: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="finished">
              تاريخ الانتهاء
            </label>
            <input id="finished" type="date" className="field" value={form.dateFinished || ''} onChange={(e) => set({ dateFinished: e.target.value })} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => set({ isFavorite: !form.isFavorite })}
          className={`btn w-full ${form.isFavorite ? 'border-rose-heart/50 text-rose-heart' : ''}`}
          aria-pressed={form.isFavorite}
        >
          {form.isFavorite ? '❤ ضمن المفضلة' : '🤍 إضافة إلى المفضلة'}
        </button>

        <div>
          <span className="label">وسومي</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className="chip cursor-pointer"
                style={
                  form.tagIds.includes(t.id)
                    ? { background: `${t.color}26`, borderColor: `${t.color}80`, color: t.color }
                    : undefined
                }
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="field"
              placeholder="وسم جديد… مثال: تحفة فنية"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <button type="button" className="btn shrink-0" onClick={addTag}>
              إضافة
            </button>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">
            ملاحظاتي الخاصة
          </label>
          <textarea
            id="notes"
            rows="4"
            maxLength={5000}
            className="field resize-y"
            placeholder="ما رأيك بالعمل؟ مشاهد لا تُنسى، ملاحظات، اقتباسات…"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
          <p className="mt-1 text-left text-[0.65rem] text-white/30">{form.notes.length} / 5000</p>
        </div>
      </form>
    </Modal>
  );
}
