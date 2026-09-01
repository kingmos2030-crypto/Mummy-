'use strict';

/**
 * Offline catalog — a small, curated metadata set used ONLY as a graceful
 * fallback when the external APIs are unreachable (no network, no TMDB key,
 * upstream outage, or rate limiting). It contains public metadata only:
 * titles, years, genres, overviews, credits. No media files of any kind.
 *
 * Every item is flagged `source: 'offline'` so the UI can label it honestly.
 */

const { normalizedMedia, mediaKey } = require('../lib/normalize');

const RAW = [
  {
    id: 'interstellar',
    type: 'movie',
    title: 'Interstellar',
    arTitle: 'بين النجوم',
    originalTitle: 'Interstellar',
    year: 2014,
    releaseDate: '2014-11-05',
    runtime: 169,
    genres: ['Adventure', 'Drama', 'Science Fiction'],
    overview:
      'مع تدهور الحياة على الأرض، يقود مزارع سابق فريقًا من روّاد الفضاء عبر ثقب دودي بحثًا عن موطن جديد للبشرية، بينما يصارع الزمن والمسافة وحبّه لابنته.',
    companies: ['Legendary Pictures', 'Syncopy', 'Lynda Obst Productions'],
    countries: ['United States', 'United Kingdom'],
    languages: ['English'],
    rating: 8.4,
    votes: 36000,
    cast: ['Matthew McConaughey|Cooper', 'Anne Hathaway|Brand', 'Jessica Chastain|Murph', 'Michael Caine|Professor Brand', 'Matt Damon|Mann'],
    crew: ['Christopher Nolan|Director', 'Jonathan Nolan|Writer', 'Hans Zimmer|Original Music Composer', 'Emma Thomas|Producer'],
    ids: { tmdbId: 157336, imdbId: 'tt0816692' },
  },
  {
    id: 'inception',
    type: 'movie',
    title: 'Inception',
    arTitle: 'استهلال',
    originalTitle: 'Inception',
    year: 2010,
    releaseDate: '2010-07-16',
    runtime: 148,
    genres: ['Action', 'Science Fiction', 'Adventure'],
    overview: 'لصّ متخصص في سرقة الأسرار من داخل الأحلام يُكلَّف بمهمة معاكسة: زرع فكرة في عقل رجل أعمال.',
    companies: ['Warner Bros. Pictures', 'Syncopy'],
    countries: ['United States'],
    languages: ['English'],
    rating: 8.4,
    votes: 35000,
    cast: ['Leonardo DiCaprio|Cobb', 'Joseph Gordon-Levitt|Arthur', 'Elliot Page|Ariadne', 'Tom Hardy|Eames'],
    crew: ['Christopher Nolan|Director', 'Christopher Nolan|Writer', 'Hans Zimmer|Original Music Composer'],
    ids: { tmdbId: 27205, imdbId: 'tt1375666' },
  },
  {
    id: 'parasite',
    type: 'movie',
    title: 'Parasite',
    arTitle: 'الطفيلي',
    originalTitle: '기생충',
    year: 2019,
    releaseDate: '2019-05-30',
    runtime: 133,
    genres: ['Comedy', 'Thriller', 'Drama'],
    overview: 'عائلة فقيرة تتسلل واحدًا تلو الآخر إلى منزل عائلة ثرية، فتتحول الخدعة إلى صراع طبقي دموي.',
    companies: ['Barunson E&A', 'CJ Entertainment'],
    countries: ['South Korea'],
    languages: ['Korean'],
    rating: 8.5,
    votes: 18000,
    cast: ['Song Kang-ho|Ki-taek', 'Lee Sun-kyun|Mr. Park', 'Cho Yeo-jeong|Yeon-kyo', 'Choi Woo-shik|Ki-woo'],
    crew: ['Bong Joon-ho|Director', 'Bong Joon-ho|Writer', 'Han Jin-won|Writer'],
    ids: { tmdbId: 496243, imdbId: 'tt6751668' },
  },
  {
    id: 'dune-part-two',
    type: 'movie',
    title: 'Dune: Part Two',
    arTitle: 'كثيب: الجزء الثاني',
    originalTitle: 'Dune: Part Two',
    year: 2024,
    releaseDate: '2024-02-27',
    runtime: 167,
    genres: ['Science Fiction', 'Adventure'],
    overview: 'يتحد بول أتريديس مع الفريمِن في حرب انتقام ضد المتآمرين على عائلته، بينما يحاول تفادي مستقبل مرعب يراه وحده.',
    companies: ['Legendary Pictures'],
    countries: ['United States'],
    languages: ['English'],
    rating: 8.2,
    votes: 12000,
    cast: ['Timothée Chalamet|Paul Atreides', 'Zendaya|Chani', 'Rebecca Ferguson|Jessica', 'Javier Bardem|Stilgar'],
    crew: ['Denis Villeneuve|Director', 'Jon Spaihts|Writer', 'Hans Zimmer|Original Music Composer'],
    ids: { tmdbId: 693134, imdbId: 'tt15239678' },
  },
  {
    id: 'spirited-away',
    type: 'anime',
    title: 'Spirited Away',
    arTitle: 'المخطوفة',
    originalTitle: '千と千尋の神隠し',
    year: 2001,
    releaseDate: '2001-07-20',
    runtime: 125,
    genres: ['Adventure', 'Fantasy', 'Animation'],
    overview: 'فتاة في العاشرة تتوه في عالم أرواح، وعليها أن تعمل في حمّام السحرة لتنقذ والديها وتستعيد اسمها.',
    companies: ['Studio Ghibli'],
    countries: ['Japan'],
    languages: ['Japanese'],
    rating: 8.6,
    votes: 16000,
    cast: ['Rumi Hiiragi|Chihiro', 'Miyu Irino|Haku', 'Mari Natsuki|Yubaba'],
    crew: ['Hayao Miyazaki|Director', 'Hayao Miyazaki|Writer', 'Joe Hisaishi|Original Music Composer'],
    ids: { malId: 199, tmdbId: 129 },
  },
  {
    id: 'breaking-bad',
    type: 'tv',
    title: 'Breaking Bad',
    arTitle: 'بريكنغ باد',
    originalTitle: 'Breaking Bad',
    year: 2008,
    releaseDate: '2008-01-20',
    endYear: 2013,
    runtime: 49,
    genres: ['Drama', 'Crime'],
    overview: 'مدرّس كيمياء مصاب بالسرطان يتحول إلى صناعة الميث لتأمين مستقبل عائلته، فيبتلعه عالم الجريمة شيئًا فشيئًا.',
    companies: ['Sony Pictures Television', 'AMC'],
    countries: ['United States'],
    languages: ['English'],
    rating: 8.9,
    votes: 14000,
    cast: ['Bryan Cranston|Walter White', 'Aaron Paul|Jesse Pinkman', 'Anna Gunn|Skyler White', 'Giancarlo Esposito|Gus Fring'],
    crew: ['Vince Gilligan|Creator', 'Vince Gilligan|Writer'],
    ids: { tmdbId: 1396, tvmazeId: 169, imdbId: 'tt0903747' },
    seasons: [7, 13, 13, 13, 16],
  },
  {
    id: 'the-last-of-us',
    type: 'tv',
    title: 'The Last of Us',
    arTitle: 'آخرنا',
    originalTitle: 'The Last of Us',
    year: 2023,
    releaseDate: '2023-01-15',
    runtime: 55,
    genres: ['Drama', 'Sci-Fi & Fantasy'],
    overview: 'بعد عشرين عامًا من انهيار الحضارة، يُكلَّف مهرّب بنقل فتاة قد تكون مفتاح النجاة عبر أمريكا المدمّرة.',
    companies: ['HBO', 'Naughty Dog'],
    countries: ['United States'],
    languages: ['English'],
    rating: 8.6,
    votes: 6200,
    cast: ['Pedro Pascal|Joel', 'Bella Ramsey|Ellie', 'Gabriel Luna|Tommy'],
    crew: ['Craig Mazin|Creator', 'Neil Druckmann|Creator'],
    ids: { tmdbId: 100088, tvmazeId: 41007 },
    seasons: [9, 7],
  },
  {
    id: 'one-piece',
    type: 'anime',
    title: 'One Piece',
    arTitle: 'ون بيس',
    originalTitle: 'ワンピース',
    year: 1999,
    releaseDate: '1999-10-20',
    runtime: 24,
    genres: ['Action', 'Adventure', 'Fantasy', 'Shounen'],
    overview: 'مونكي دي لوفي وطاقمه يبحرون بحثًا عن كنز «ون بيس» الأسطوري ليصبح ملك القراصنة.',
    companies: ['Toei Animation'],
    countries: ['Japan'],
    languages: ['Japanese'],
    rating: 8.7,
    votes: 1300000,
    cast: ['Mayumi Tanaka|Monkey D. Luffy', 'Kazuya Nakai|Roronoa Zoro', 'Akemi Okamura|Nami'],
    crew: ['Eiichiro Oda|Original Creator', 'Konosuke Uda|Director'],
    ids: { malId: 21, tmdbId: 37854, tvmazeId: 1505 },
    episodeCount: 1130,
  },
  {
    id: 'attack-on-titan',
    type: 'anime',
    title: 'Attack on Titan',
    arTitle: 'هجوم العمالقة',
    originalTitle: '進撃の巨人',
    year: 2013,
    releaseDate: '2013-04-07',
    runtime: 24,
    genres: ['Action', 'Drama', 'Shounen'],
    overview: 'بعد سقوط الجدار، ينضم إرين ورفاقه إلى فيلق الاستطلاع لقتال العمالقة واكتشاف الحقيقة خلف الأسوار.',
    companies: ['Wit Studio', 'MAPPA'],
    countries: ['Japan'],
    languages: ['Japanese'],
    rating: 8.5,
    votes: 2100000,
    cast: ['Yuki Kaji|Eren Yeager', 'Yui Ishikawa|Mikasa Ackerman', 'Marina Inoue|Armin Arlert'],
    crew: ['Hajime Isayama|Original Creator', 'Tetsuro Araki|Director'],
    ids: { malId: 16498, tmdbId: 1429 },
    episodeCount: 25,
  },
  {
    id: 'fullmetal-alchemist-brotherhood',
    type: 'anime',
    title: 'Fullmetal Alchemist: Brotherhood',
    arTitle: 'الخيميائي المعدني الكامل: الأخوّة',
    originalTitle: '鋼の錬金術師 FULLMETAL ALCHEMIST',
    year: 2009,
    releaseDate: '2009-04-05',
    runtime: 24,
    genres: ['Action', 'Adventure', 'Drama', 'Shounen'],
    overview: 'أخوان يبحثان عن حجر الفيلسوف لاستعادة جسديهما بعد محاولة خيميائية محرّمة.',
    companies: ['Bones'],
    countries: ['Japan'],
    languages: ['Japanese'],
    rating: 9.1,
    votes: 2000000,
    cast: ['Romi Park|Edward Elric', 'Rie Kugimiya|Alphonse Elric'],
    crew: ['Hiromu Arakawa|Original Creator', 'Yasuhiro Irie|Director'],
    ids: { malId: 5114 },
    episodeCount: 64,
  },
  {
    id: 'avatar-the-last-airbender',
    type: 'cartoon',
    title: 'Avatar: The Last Airbender',
    arTitle: 'أفاتار: آخر مُخضِعي الهواء',
    originalTitle: 'Avatar: The Last Airbender',
    year: 2005,
    releaseDate: '2005-02-21',
    runtime: 23,
    genres: ['Animation', 'Action & Adventure', 'Family'],
    overview: 'آنج، آخر مُخضِعي الهواء، يجب أن يتقن العناصر الأربعة لإيقاف أمة النار وإعادة التوازن للعالم.',
    companies: ['Nickelodeon Animation Studio'],
    countries: ['United States'],
    languages: ['English'],
    rating: 8.7,
    votes: 4200,
    cast: ['Zach Tyler Eisen|Aang', 'Mae Whitman|Katara', 'Jack De Sena|Sokka', 'Dante Basco|Zuko'],
    crew: ['Michael Dante DiMartino|Creator', 'Bryan Konietzko|Creator'],
    ids: { tmdbId: 246, tvmazeId: 592 },
    seasons: [20, 20, 21],
  },
  {
    id: 'planet-earth-ii',
    type: 'documentary',
    title: 'Planet Earth II',
    arTitle: 'كوكب الأرض 2',
    originalTitle: 'Planet Earth II',
    year: 2016,
    releaseDate: '2016-11-06',
    runtime: 50,
    genres: ['Documentary'],
    overview: 'رحلة مصوّرة مذهلة عبر الجزر والجبال والغابات والصحاري والمدن، برواية ديفيد أتينبورو.',
    companies: ['BBC Natural History Unit'],
    countries: ['United Kingdom'],
    languages: ['English'],
    rating: 8.9,
    votes: 2100,
    cast: ['David Attenborough|Narrator'],
    crew: ['Elizabeth White|Producer', 'Hans Zimmer|Original Music Composer'],
    ids: { tmdbId: 68595, tvmazeId: 20263 },
    seasons: [6],
  },
  {
    id: 'oppenheimer',
    type: 'movie',
    title: 'Oppenheimer',
    arTitle: 'أوبنهايمر',
    originalTitle: 'Oppenheimer',
    year: 2023,
    releaseDate: '2023-07-19',
    runtime: 181,
    genres: ['Drama', 'History'],
    overview: 'قصة العالم روبرت أوبنهايمر ودوره في تطوير القنبلة الذرية، وما تبعه من محاكمة أخلاقية وسياسية.',
    companies: ['Universal Pictures', 'Syncopy'],
    countries: ['United States'],
    languages: ['English'],
    rating: 8.1,
    votes: 9000,
    cast: ['Cillian Murphy|J. Robert Oppenheimer', 'Emily Blunt|Kitty', 'Robert Downey Jr.|Lewis Strauss'],
    crew: ['Christopher Nolan|Director', 'Christopher Nolan|Writer', 'Ludwig Göransson|Original Music Composer'],
    ids: { tmdbId: 872585, imdbId: 'tt15398776' },
  },
  {
    id: 'your-name',
    type: 'anime',
    title: 'Your Name.',
    arTitle: 'اسمك',
    originalTitle: '君の名は。',
    year: 2016,
    releaseDate: '2016-08-26',
    runtime: 106,
    genres: ['Romance', 'Drama', 'Animation', 'Supernatural'],
    overview: 'مراهقان يتبادلان الأجساد بشكل غامض، فتنشأ بينهما رابطة تتحدى الزمان والمكان.',
    companies: ['CoMix Wave Films'],
    countries: ['Japan'],
    languages: ['Japanese'],
    rating: 8.4,
    votes: 1600000,
    cast: ['Ryunosuke Kamiki|Taki', 'Mone Kamishiraishi|Mitsuha'],
    crew: ['Makoto Shinkai|Director', 'Makoto Shinkai|Writer'],
    ids: { malId: 32281, tmdbId: 372058 },
  },
];

function buildEpisodes(item) {
  const episodes = [];
  if (item.seasons) {
    item.seasons.forEach((count, index) => {
      for (let n = 1; n <= count; n += 1) {
        episodes.push({
          seasonNumber: index + 1,
          episodeNumber: n,
          title: `الحلقة ${n}`,
          overview: '',
          airDate: null,
          runtime: item.runtime || null,
          imageUrl: null,
          source: 'offline',
        });
      }
    });
  } else if (item.episodeCount) {
    for (let n = 1; n <= item.episodeCount; n += 1) {
      episodes.push({
        seasonNumber: 1,
        episodeNumber: n,
        absoluteNumber: n,
        title: `الحلقة ${n}`,
        overview: '',
        airDate: null,
        runtime: item.runtime || null,
        imageUrl: null,
        source: 'offline',
      });
    }
  }
  return episodes;
}

function buildMedia(item) {
  const episodes = buildEpisodes(item);
  const seasonNumbers = [...new Set(episodes.map((e) => e.seasonNumber))];
  return normalizedMedia({
    key: mediaKey('offline', item.type, item.id),
    source: 'offline',
    sourceType: item.type,
    sourceId: item.id,
    mediaType: item.type,
    title: item.arTitle ? `${item.title}` : item.title,
    originalTitle: item.originalTitle,
    alternativeTitles: [item.arTitle, item.originalTitle, item.title].filter(Boolean),
    releaseDate: item.releaseDate,
    releaseYear: item.year,
    endYear: item.endYear || null,
    overview: item.overview,
    posterUrl: null,
    backdropUrl: null,
    runtime: item.runtime,
    status: item.endYear ? 'Ended' : 'Released',
    genres: item.genres,
    languages: item.languages,
    countries: item.countries,
    companies: item.companies,
    cast: (item.cast || []).map((entry, order) => {
      const [name, character] = entry.split('|');
      return { name, character: character || '', image: null, order };
    }),
    crew: (item.crew || []).map((entry) => {
      const [name, job] = entry.split('|');
      return { name, job: job || '', department: job || '', image: null };
    }),
    trailers: [],
    externalRating: item.rating,
    externalVotes: item.votes,
    totalSeasons: seasonNumbers.length || (item.type === 'movie' ? 0 : 1),
    totalEpisodes: episodes.length,
    homepage: '',
    externalIds: item.ids || {},
    seasons: seasonNumbers.map((n) => ({
      seasonNumber: n,
      name: `الموسم ${n}`,
      overview: '',
      airDate: null,
      episodeCount: episodes.filter((e) => e.seasonNumber === n).length,
      posterUrl: null,
    })),
    episodes,
    extra: { offline: true, arabicTitle: item.arTitle },
  });
}

const CATALOG = RAW.map(buildMedia);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function search(query, { type } = {}) {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(' ');
  return CATALOG.filter((m) => !type || m.mediaType === type)
    .map((m) => {
      const haystack = normalize(
        [m.title, m.originalTitle, ...(m.alternativeTitles || []), ...(m.genres || [])].join(' ')
      );
      let score = 0;
      if (haystack.startsWith(q)) score += 6;
      if (haystack.includes(q)) score += 4;
      for (const t of tokens) if (t.length > 1 && haystack.includes(t)) score += 1;
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

function byId(id) {
  return CATALOG.find((m) => m.sourceId === String(id)) || null;
}

function trending() {
  return [...CATALOG].sort((a, b) => (b.externalRating || 0) - (a.externalRating || 0)).slice(0, 12);
}

module.exports = { search, byId, trending, CATALOG, normalize };
