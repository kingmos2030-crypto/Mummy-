'use strict';

const config = require('../config');

class HttpError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

class ApiError extends Error {
  constructor(status, message, code = 'api_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch JSON with timeout + small retry budget.
 * Node 18+ global fetch is used; no API keys ever reach the browser.
 */
async function fetchJson(url, options = {}) {
  const {
    timeoutMs = config.http.timeoutMs,
    retries = config.http.retries,
    headers = {},
    ...rest
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { Accept: 'application/json', 'User-Agent': 'MummyShaft/1.0', ...headers },
        signal: controller.signal,
      });
      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (!res.ok) {
        // 4xx (except 429) are not worth retrying
        if (res.status < 500 && res.status !== 429) {
          throw new HttpError(res.status, `Upstream ${res.status} for ${safeUrl(url)}`, body);
        }
        throw new HttpError(res.status, `Upstream ${res.status} for ${safeUrl(url)}`, body);
      }
      return body;
    } catch (error) {
      lastError = error;
      const status = error instanceof HttpError ? error.status : 0;
      const retriable = status === 0 || status >= 500 || status === 429;
      if (!retriable || attempt === retries) break;
      await sleep(300 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Strip query strings (they may carry api_key) before logging. */
function safeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return 'upstream';
  }
}

/** Simple serial rate limiter (Jikan is strict about bursts). */
function createThrottle(minIntervalMs) {
  let chain = Promise.resolve();
  let last = 0;
  return function throttle(fn) {
    const run = async () => {
      const wait = Math.max(0, last + minIntervalMs - Date.now());
      if (wait) await sleep(wait);
      last = Date.now();
      return fn();
    };
    const result = chain.then(run, run);
    chain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}

module.exports = { fetchJson, createThrottle, HttpError, ApiError, safeUrl, sleep };
