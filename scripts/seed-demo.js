'use strict';

/**
 * Optional demo seed — fills the local library with a few tracked titles so the
 * UI can be explored immediately. Personal data only; metadata comes from the
 * normal provider pipeline (live APIs when available, offline catalog otherwise).
 *
 *   npm run seed:demo      # add demo entries
 *   npm run seed:demo -- --reset   # wipe personal data first
 */

const { db, defaultUser } = require('../server/db');
const discovery = require('../server/services/discovery');
const libraryService = require('../server/services/library');

const PLAN = [
  { q: 'interstellar', patch: { status: 'watched', rating: 9.75, quality: '4K HDR', isFavorite: true, notes: 'أفضل تجربة سينمائية شاهدتها. مشهد الالتحام لا يُنسى.', dateStarted: '2024-01-04', dateFinished: '2024-01-04' } },
  { q: 'oppenheimer', patch: { status: 'watched', rating: 8.5, quality: '1080p Blu-ray', notes: 'إخراج مبهر، الإيقاع ثقيل قليلًا في الثلث الأخير.' } },
  { q: 'parasite', patch: { status: 'watched', rating: 9.25, quality: '1080p WEB-DL', isFavorite: true } },
  { q: 'breaking bad', patch: { status: 'watching', quality: '1080p', rating: 9.5 }, episodesUpTo: 12 },
  { q: 'the last of us', patch: { status: 'paused', rating: 8, quality: '4K' }, episodesUpTo: 4 },
  { q: 'attack on titan', patch: { status: 'watching', rating: 9, quality: '1080p' }, episodesUpTo: 8 },
  { q: 'one piece', patch: { status: 'want_to_watch' } },
  { q: 'your name', patch: { status: 'watched', rating: 9, quality: '1080p Blu-ray', isFavorite: true } },
  { q: 'spirited away', patch: { status: 'watched', rating: 9.5, quality: 'Blu-ray', rewatchCount: 3 } },
  { q: 'avatar the last airbender', patch: { status: 'rewatching', rating: 9.25, quality: '1080p' }, episodesUpTo: 20 },
  { q: 'planet earth', patch: { status: 'want_to_watch' } },
  { q: 'dune part two', patch: { status: 'want_to_watch', isFavorite: false } },
];

async function main() {
  const reset = process.argv.includes('--reset');
  const userId = defaultUser.id;

  if (reset) {
    db.prepare('DELETE FROM personal_entries WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM viewing_history WHERE user_id = ?').run(userId);
    console.log('• personal data cleared');
  }

  for (const item of PLAN) {
    try {
      const { results } = await discovery.search(item.q);
      if (!results.length) {
        console.warn(`! no result for "${item.q}"`);
        continue;
      }
      const hit = results[0];
      const media = await discovery.ensureMedia({
        source: hit.source,
        sourceType: hit.sourceType,
        sourceId: hit.sourceId,
      });
      const entry = libraryService.upsertEntry(userId, media.id, item.patch);

      if (item.episodesUpTo) {
        await discovery.getEpisodes(media.id);
        const episodes = libraryService.episodesWithProgress(entry.id, media.id);
        const target = episodes[item.episodesUpTo - 1];
        if (target) libraryService.markUpTo(userId, entry.id, target.id);
      }
      console.log(`✓ ${media.title} — ${item.patch.status}`);
    } catch (error) {
      console.warn(`! failed for "${item.q}": ${error.message}`);
    }
  }

  const total = db.prepare('SELECT COUNT(*) c FROM personal_entries WHERE user_id = ?').get(userId).c;
  console.log(`\nDone. ${total} tracked titles in the library.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
