import { Link } from 'react-router-dom';
import useSeo from '../lib/seo';

export default function NotFound() {
  useSeo({ title: 'الصفحة غير موجودة', noIndex: true });
  return (
    <div className="surface mx-auto max-w-lg px-6 py-14 text-center animate-rise">
      <div className="text-5xl">🎬</div>
      <h1 className="mt-3 text-2xl font-black">هذه الصفحة غير موجودة</h1>
      <p className="mt-2 text-sm text-white/50">ربما تغيّر الرابط أو حُذف العمل من مكتبتك.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Link to="/" className="btn btn-primary">الرئيسية</Link>
        <Link to="/search" className="btn">ابحث عن عمل</Link>
      </div>
    </div>
  );
}
