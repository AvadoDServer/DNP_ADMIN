import axios from "axios";
import { parseNews } from "./news";

/**
 * Fetches the one news item AVADO publishes for box owners (see ./news).
 *
 *   GET https://bo.ava.do/value/admin-news -> "{\"id\":...}"   404 when there is none
 *
 * Asked once per page load and never polled: the answer, or the failure, is
 * kept for as long as the page stays open. Every failure (no item, timeout,
 * no internet, an item that fails the checks) resolves to null, so Home
 * simply shows no news.
 *
 * In mock mode (`yarn dev`, REACT_APP_MOCK_DATA=true) a sample item is served
 * locally, without any network call.
 */

export const MOCK = Boolean(import.meta.env.REACT_APP_MOCK_DATA);
export const NEWS_URL = "https://bo.ava.do/value/admin-news";
const TIMEOUT_MS = 8000;

export const MOCK_NEWS = {
  id: "mock-sample",
  title: "This is where news from AVADO appears",
  body: "A sample item, shown only in the demo. A real one tells you about something that matters for your AVADO, in a sentence or two.",
  link: { label: "Visit ava.do", url: "https://www.ava.do/" },
};

let cached = null;

/** The current news item, checked, or null. Never rejects. */
export function loadNews({ mock = MOCK, get = axios.get } = {}) {
  if (!cached) {
    cached = mock
      ? Promise.resolve(parseNews(MOCK_NEWS))
      : Promise.resolve()
          .then(() => get(NEWS_URL, { timeout: TIMEOUT_MS }))
          .then(res => parseNews(res && res.data))
          .catch(() => null);
  }
  return cached;
}

/** For tests: forget the answer, as a page reload would. */
export function resetNewsCache() {
  cached = null;
}
