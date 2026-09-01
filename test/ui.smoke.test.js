'use strict';

/**
 * UI smoke test: renders every route in jsdom against a real API server and
 * asserts that nothing throws and the expected Arabic headings appear.
 * Catches runtime errors that a production build cannot detect.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const babel = require('@babel/core');
const { JSDOM } = require('jsdom');
const Module = require('node:module');

// react & friends live in client/node_modules
const clientRequire = Module.createRequire(path.join(__dirname, '..', 'client', 'package.json'));

const tmpDb = path.join(os.tmpdir(), `mummy-ui-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = tmpDb;
process.env.TMDB_API_KEY = '';

const app = require('../server/index');
let server;
let baseUrl;

// --- transpile JSX on require -------------------------------------------
const clientRoot = path.join(__dirname, '..', 'client', 'src');
const origJs = Module._extensions['.js'];
const compile = (module, filename) => {
  if (!filename.startsWith(clientRoot)) return origJs(module, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const { code } = babel.transformSync(source, {
    filename,
    presets: [
      [require.resolve('@babel/preset-env'), { targets: { node: 'current' }, modules: 'commonjs' }],
      [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
    ],
    babelrc: false,
    configFile: false,
  });
  module._compile(code, filename);
};
Module._extensions['.js'] = compile;
Module._extensions['.jsx'] = compile;
Module._extensions['.css'] = (module) => module._compile('module.exports = {};', 'style');

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // seed a little personal data so the pages have content to render
  const post = (p, body) =>
    fetch(baseUrl + p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const search = await fetch(`${baseUrl}/api/discover/search?q=interstellar`).then((r) => r.json());
  const hit = search.results[0];
  const details = await fetch(
    `${baseUrl}/api/discover/media/${hit.source}/${hit.sourceType}/${hit.sourceId}`
  ).then((r) => r.json());
  await post('/api/library', {
    internalId: details.media.id,
    status: 'watched',
    rating: 9.5,
    quality: '4K HDR',
    isFavorite: true,
  });

  const dom = new JSDOM('<!doctype html><html dir="rtl" lang="ar"><head></head><body><div id="root"></div></body></html>', {
    url: `${baseUrl}/`,
    pretendToBeVisual: true,
  });
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
  global.localStorage = dom.window.localStorage;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = clearTimeout;
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  dom.window.ResizeObserver = global.ResizeObserver;
  dom.window.confirm = () => true;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  // relative /api fetches -> real server
  const realFetch = globalThis.fetch;
  global.fetch = (url, options) =>
    realFetch(typeof url === 'string' && url.startsWith('/') ? baseUrl + url : url, options);
});

test.after(() => {
  server?.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(tmpDb + suffix);
    } catch {
      /* ignore */
    }
  }
});

async function renderRoute(route) {
  const React = clientRequire('react');
  const { createRoot } = clientRequire('react-dom/client');
  const { MemoryRouter } = clientRequire('react-router-dom');
  const App = require('../client/src/App.jsx').default;
  const { AppProvider } = require('../client/src/context/AppContext.jsx');

  const errors = [];
  const origError = console.error;
  console.error = (...args) => {
    const text = args.map(String).join(' ');
    if (!/not wrapped in act|ReactDOMTestUtils|Warning: /i.test(text)) errors.push(text);
  };

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  class Boundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error };
    }
    render() {
      if (this.state.error) return React.createElement('pre', null, `RENDER_ERROR: ${this.state.error.message}`);
      return this.props.children;
    }
  }

  root.render(
    React.createElement(
      Boundary,
      null,
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(AppProvider, null, React.createElement(App, null))
      )
    )
  );

  // allow lazy chunks + data fetches to settle
  for (let i = 0; i < 40; i += 1) await new Promise((r) => setTimeout(r, 25));

  const html = container.innerHTML;
  const text = container.textContent || '';
  root.unmount();
  container.remove();
  console.error = origError;
  return { html, text, errors };
}

const ROUTES = [
  ['/', ['Mummy', 'شافت']],
  ['/search?q=interstellar', ['اكتشف']],
  ['/library', ['مكتبتي']],
  ['/watchlist', ['أريد مشاهدته']],
  ['/stats', ['إحصائياتي']],
  ['/profile', ['Mummy']],
  ['/history', ['سجل المشاهدة']],
  ['/tags', ['وسومي']],
  ['/no-such-page', ['غير موجودة']],
];

for (const [route, expectations] of ROUTES) {
  test(`renders ${route} without runtime errors`, async () => {
    const { text, errors } = await renderRoute(route);
    assert.ok(!text.includes('RENDER_ERROR'), `crashed: ${text.slice(0, 300)}`);
    for (const expected of expectations) {
      assert.ok(text.includes(expected), `"${expected}" missing from ${route}: ${text.slice(0, 300)}`);
    }
    assert.equal(errors.length, 0, `console errors: ${errors.slice(0, 3).join(' | ')}`);
  });
}

test('renders a media details page with the personal section', async () => {
  const list = await fetch(`${baseUrl}/api/library`).then((r) => r.json());
  const mediaId = list.entries[0].mediaId;
  const { text } = await renderRoute(`/title/${mediaId}`);
  assert.ok(!text.includes('RENDER_ERROR'));
  assert.ok(text.includes('تجربتي'), 'personal section missing');
  assert.ok(text.includes('Interstellar'));
  assert.ok(text.includes('4K HDR'));
});
