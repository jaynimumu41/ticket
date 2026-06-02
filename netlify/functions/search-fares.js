// Netlify serverless function — fetches live prices from airline public fare pages.
// Runs in Node.js 18 on Netlify's servers, so no CORS issues.

const ROUTE_BASELINES = {
  // 華航 CI（無直飛仙台）
  "CI|TPE|NRT": { normalLow: 14200, normalHigh: 18500, oneYearAvg: 16200, oneYearMin: 13900 },
  "CI|TSA|HND": { normalLow: 15100, normalHigh: 19400, oneYearAvg: 17120, oneYearMin: 14980 },
  "CI|TPE|KIX": { normalLow: 14500, normalHigh: 18800, oneYearAvg: 16400, oneYearMin: 14200 },
  "CI|TPE|FUK": { normalLow: 12900, normalHigh: 16600, oneYearAvg: 14520, oneYearMin: 12600 },
  "CI|TPE|NGO": { normalLow: 12500, normalHigh: 16400, oneYearAvg: 14480, oneYearMin: 12490 },
  "CI|TPE|HIJ": { normalLow: 13110, normalHigh: 17040, oneYearAvg: 15180, oneYearMin: 12890 },
  "CI|TPE|OKA": { normalLow: 9500,  normalHigh: 13200, oneYearAvg: 11380, oneYearMin: 9360  },
  "CI|TPE|CTS": { normalLow: 19500, normalHigh: 25000, oneYearAvg: 22000, oneYearMin: 19200 },
  "CI|TPE|KMJ": { normalLow: 13500, normalHigh: 17500, oneYearAvg: 15400, oneYearMin: 13200 },
  "CI|TPE|TAK": { normalLow: 12800, normalHigh: 16600, oneYearAvg: 14800, oneYearMin: 12600 },
  "CI|KHH|KIX": { normalLow: 13900, normalHigh: 17900, oneYearAvg: 16040, oneYearMin: 13680 },
  "CI|KHH|NRT": { normalLow: 15500, normalHigh: 20000, oneYearAvg: 17800, oneYearMin: 15200 },
  "CI|KHH|OKA": { normalLow: 10000, normalHigh: 13800, oneYearAvg: 11900, oneYearMin: 9800  },
  // 星宇 JX（含台中 RMQ 出發）
  "JX|TPE|NRT": { normalLow: 14500, normalHigh: 18700, oneYearAvg: 16220, oneYearMin: 14390 },
  "JX|TPE|KIX": { normalLow: 15000, normalHigh: 19800, oneYearAvg: 16920, oneYearMin: 14970 },
  "JX|TPE|FUK": { normalLow: 13200, normalHigh: 17800, oneYearAvg: 15480, oneYearMin: 13180 },
  "JX|TPE|OKA": { normalLow: 8600,  normalHigh: 12800, oneYearAvg: 10960, oneYearMin: 8560  },
  "JX|TPE|CTS": { normalLow: 20000, normalHigh: 25500, oneYearAvg: 22500, oneYearMin: 19800 },
  "JX|TPE|SDJ": { normalLow: 17000, normalHigh: 22000, oneYearAvg: 19500, oneYearMin: 16800 },
  "JX|TPE|HKD": { normalLow: 20000, normalHigh: 26000, oneYearAvg: 23000, oneYearMin: 19500 },
  "JX|TPE|KMJ": { normalLow: 13500, normalHigh: 18000, oneYearAvg: 15700, oneYearMin: 13300 },
  "JX|TPE|TAK": { normalLow: 13000, normalHigh: 17500, oneYearAvg: 15200, oneYearMin: 12800 },
  "JX|KHH|NRT": { normalLow: 15100, normalHigh: 19200, oneYearAvg: 16980, oneYearMin: 14980 },
  "JX|RMQ|NRT": { normalLow: 15000, normalHigh: 19500, oneYearAvg: 17200, oneYearMin: 14800 },
  "JX|RMQ|OKA": { normalLow: 9000,  normalHigh: 13000, oneYearAvg: 11200, oneYearMin: 8800  },
  "JX|RMQ|KMJ": { normalLow: 14000, normalHigh: 18500, oneYearAvg: 16200, oneYearMin: 13700 },
  // 長榮 BR（官網封鎖自動抓取，僅提供歷史基準）
  "BR|TPE|NRT": { normalLow: 14800, normalHigh: 18900, oneYearAvg: 16820, oneYearMin: 14680 },
  "BR|TSA|HND": { normalLow: 16400, normalHigh: 20500, oneYearAvg: 18420, oneYearMin: 16180 },
  "BR|TPE|KIX": { normalLow: 15000, normalHigh: 19400, oneYearAvg: 17110, oneYearMin: 14920 },
  "BR|TPE|FUK": { normalLow: 13000, normalHigh: 17000, oneYearAvg: 15000, oneYearMin: 12800 },
  "BR|TPE|NGO": { normalLow: 13000, normalHigh: 17200, oneYearAvg: 15100, oneYearMin: 12700 },
  "BR|TPE|OKA": { normalLow: 11100, normalHigh: 14600, oneYearAvg: 12880, oneYearMin: 10890 },
  "BR|TPE|CTS": { normalLow: 19500, normalHigh: 25000, oneYearAvg: 22000, oneYearMin: 19000 },
  "BR|TPE|SDJ": { normalLow: 16000, normalHigh: 21000, oneYearAvg: 18500, oneYearMin: 15700 },
  "BR|TPE|HKD": { normalLow: 20000, normalHigh: 26000, oneYearAvg: 23000, oneYearMin: 19500 },
  "BR|KHH|NRT": { normalLow: 16000, normalHigh: 20200, oneYearAvg: 18040, oneYearMin: 15880 },
  "BR|KHH|KIX": { normalLow: 13500, normalHigh: 17500, oneYearAvg: 15500, oneYearMin: 13200 },
  "BR|KHH|OKA": { normalLow: 10500, normalHigh: 14200, oneYearAvg: 12300, oneYearMin: 10200 },
};

// Japan destinations we can fetch AND display. Must stay in sync with the front-end's
// JAPAN_AIRPORTS so every emitted offer has a proper city name (no raw codes shown).
// Anything outside this set (Kobe/Miyako/Bangkok/etc. from Starlux's mixed carousel) is dropped.
const JAPAN_AIRPORTS = new Set([
  "NRT","HND","KIX","FUK","OKA","CTS","NGO","HIJ","KMJ","SDJ","TAK","HKD"
]);

// Public fare listing pages per airline/route
// CI: flights.china-airlines.com works (server-rendered with prices)
// JX: starlux-airlines.com/flights works (server-rendered with prices)
// BR: flights.evaair.com returns 403 — skipped, baseline data shown instead
//
// Strategy: list general pages first (cover many routes), then specific pages
// for routes that may not appear on general pages. Limit = 12 runs in parallel.
const FARE_PAGES = {
  CI: [
    // China Airlines per-city pages — each verified to contain ONLY that one route's
    // fares (route mode = route fixed by page, never inferred wrongly). These are the
    // reliable CI source; the general "to-japan" page format is inconsistent so it is
    // intentionally not used.
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-tokyo",     mode: "route", from: "TPE", to: "NRT" },
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-osaka",     mode: "route", from: "TPE", to: "KIX" },
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-fukuoka",   mode: "route", from: "TPE", to: "FUK" },
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-okinawa",   mode: "route", from: "TPE", to: "OKA" },
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-hiroshima", mode: "route", from: "TPE", to: "HIJ" },
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-nagoya",    mode: "route", from: "TPE", to: "NGO" },
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-sapporo",   mode: "route", from: "TPE", to: "CTS" },
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-takamatsu", mode: "route", from: "TPE", to: "TAK" },
    { url: "https://flights.china-airlines.com/en-tw/flights-from-taipei-to-kumamoto",  mode: "route", from: "TPE", to: "KMJ" },
  ],
  JX: [
    // Starlux's per-destination URLs all return the SAME generic carousel (verified
    // byte-identical), so one named-mode fetch covers every route incl. RMQ/KHH.
    { url: "https://www.starlux-airlines.com/flights/en-TW/flights-from-taipei-to-japan", mode: "named" },
  ],
  BR: [
    // flights.evaair.com 及 evaair.com 均返回 HTTP 403，無法 server-side 抓取
    // 長榮航線顯示歷史基準資料
  ],
};

const BOOKING_URLS = {
  CI: "https://www.china-airlines.com/tw/zh",
  JX: "https://www.starlux-airlines.com/zh-TW",
  BR: "https://www.evaair.com/zh-tw",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const MONTH_MAP = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
};

function normalizeDate(value) {
  if (!value) return null;
  const clean = String(value).trim();

  // YYYY/MM/DD or YYYY-MM-DD
  const iso = clean.replace(/\//g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;

  // DD Mon YY(YY) — e.g. "20 Nov 26" or "20 Nov 2026"
  const dmy = clean.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const mon = MONTH_MAP[dmy[2].toLowerCase()];
    if (!mon) return null;
    const month = String(mon).padStart(2, "0");
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function parsePrice(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 1000 && n < 200000 ? n : null;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Parsing strategy (verified against real HTML 2026-05) ────────────────────
//
// Pages come in two shapes, handled by two different modes. The cardinal rule:
// NEVER infer a route from the page URL when the page lists multiple routes —
// that is what produced garbage like "桃園→新千歲 7,591" (actually 桃園→澳門).
//
//  mode "named"  — the page is a mixed carousel listing many destinations. Only
//                  accept an entry when BOTH origin and destination codes appear
//                  in the text immediately beside the price+dates. The route is
//                  taken from the matched codes, never from the URL. Non-Japan
//                  destinations are dropped. (Starlux general page; also safe for
//                  China Airlines' general Japan page.)
//                  Format: "(TPE) to Sapporo (CTS) 2026/11/15 - 2026/11/22 From TWD20,358"
//
//  mode "route"  — the page is dedicated to ONE route (China Airlines per-city
//                  pages, verified to contain only that single route's fares).
//                  Rows omit the route name, so the route is taken from the page
//                  definition. This is safe ONLY because the page is single-route.
//                  Date format: "DD Mon YY" e.g. "10 Dec 26".

// Named carousel rows, slash-date format (Starlux): "(TPE) to City (CTS) 2026/11/15 - 2026/11/22 From TWD20,358"
const NAMED_SLASH_RE = /\((?<from>TPE|TSA|RMQ|KHH)\)\s*to\s+[A-Za-z .'-]{1,40}?\((?<to>[A-Z]{3})\)\s*(?<depart>\d{4}\/\d{1,2}\/\d{1,2})\s*[-–]\s*(?<ret>\d{4}\/\d{1,2}\/\d{1,2})\s*From\s*TWD\s*(?<price>[\d,]+)/gi;

// Named carousel rows, "DD Mon YY" format (China Airlines general page):
// "Taipei (TPE) Tokyo (NRT) ... 20 Nov 26 (Fri) - 26 Nov 26 (Thu) From TWD14,524"
const NAMED_DMY_RE = /\((?<from>TPE|TSA|RMQ|KHH)\)\s+[A-Za-z .'-]{1,40}?\((?<to>[A-Z]{3})\)[^(]{0,60}?(?<depart>\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s*\([^)]{1,10}\)\s*[-–]\s*(?<ret>\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s*\([^)]{1,10}\)\s*From\s*TWD\s*(?<price>[\d,]+)/gi;

// Single-route rows, "DD Mon YY" with the price either before or after the dates.
const ROUTE_DMY_AFTER_RE  = /(?<depart>\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s*(?:\([^)]{1,10}\))?\s*[-–]\s*(?<ret>\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s*(?:\([^)]{1,10}\))?\s*From\s*TWD\s*(?<price>[\d,]+)/gi;
const ROUTE_DMY_BEFORE_RE = /From\s*TWD\s*(?<price>[\d,]+)\s*[-–]?\s*(?<depart>\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s*(?:\([^)]{1,10}\))?\s*[-–]\s*(?<ret>\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/gi;

function pushOffer(results, seen, airlineCode, from, to, depart, ret, price, sourceUrl, today) {
  const departDate = normalizeDate(depart);
  const returnDate = normalizeDate(ret);
  const p = parsePrice(price);
  if (!departDate || !returnDate || !p) return;
  if (departDate < today) return;
  if (returnDate < departDate) return;
  if (!JAPAN_AIRPORTS.has(to)) return; // safety: destination must be a Japan airport

  const key = `${airlineCode}|${from}|${to}|${departDate}|${returnDate}|${p}`;
  if (seen.has(key)) return;
  seen.add(key);

  results.push({
    airline: airlineCode,
    from,
    to,
    departDate,
    returnDate,
    price: p,
    source: "官網即時起價",
    sourceUrl,
    bookingUrl: sourceUrl,
    seenAt: today,
    isLive: true,
  });
}

function parseFares(airlineCode, html, page) {
  const text = stripHtml(html);
  const results = [];
  const seen = new Set();
  const today = new Date().toISOString().slice(0, 10);
  const sourceUrl = page.url;

  if (page.mode === "route" && page.from && page.to) {
    // Single-route page: route is fixed by the page definition (safe — no other
    // routes are on the page). Try both date/price orderings.
    for (const re of [ROUTE_DMY_AFTER_RE, ROUTE_DMY_BEFORE_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const g = m.groups;
        pushOffer(results, seen, airlineCode, page.from, page.to, g.depart, g.ret, g.price, sourceUrl, today);
      }
    }
  } else {
    // Carousel / general page: named-only. Route comes from matched codes.
    for (const re of [NAMED_SLASH_RE, NAMED_DMY_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const g = m.groups;
        pushOffer(results, seen, airlineCode, g.from.toUpperCase(), g.to.toUpperCase(), g.depart, g.ret, g.price, sourceUrl, today);
      }
    }
  }
  return results;
}

async function fetchPage(url) {
  const controller = new AbortController();
  // Keep under Netlify's 10s synchronous-function wall (pages run in parallel).
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function matchesSearch(offer, { airline, from, to, year, month, duration }) {
  if (airline && offer.airline !== airline) return false;
  if (from && offer.from !== from) return false;
  if (to && offer.to !== to) return false;
  if (year || month) {
    const [oYear, oMonth] = offer.departDate.split("-");
    if (year && oYear !== year) return false;
    if (month && oMonth !== month.padStart(2, "0")) return false;
  }
  if (duration) {
    const d1 = new Date(offer.departDate);
    const d2 = new Date(offer.returnDate);
    const days = Math.round((d2 - d1) / 86400000) + 1; // inclusive (Dec 9-13 = 5 days)
    if (Math.abs(days - parseInt(duration, 10)) > 1) return false;
  }
  return true;
}

export async function handler(event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  const q = event.queryStringParameters || {};
  const { airline = "", from = "", to = "", year = "", month = "", duration = "", passengers = "1" } = q;

  // Decide which pages to fetch
  const pagesToFetch = [];
  const airlinesWanted = airline ? [airline] : Object.keys(FARE_PAGES);
  for (const code of airlinesWanted) {
    const pages = FARE_PAGES[code] || [];
    for (const page of pages) {
      if (from && page.from && page.from !== from) continue;
      if (to && page.to && page.to !== to) continue;
      pagesToFetch.push({ code, ...page });
    }
  }

  // Deduplicate by URL and limit for Netlify's timeout (pages run in parallel ~12s each)
  const uniquePages = [...new Map(pagesToFetch.map((p) => [p.url, p])).values()];
  const limited = uniquePages.slice(0, 12);

  // Fetch all pages in parallel
  const fetched = await Promise.allSettled(
    limited.map(async (page) => {
      const html = await fetchPage(page.url);
      if (!html) return [];
      return parseFares(page.code, html, page);
    })
  );

  const allOffers = [];
  const errors = [];
  for (let i = 0; i < fetched.length; i++) {
    if (fetched[i].status === "fulfilled") {
      allOffers.push(...fetched[i].value);
    } else {
      errors.push(limited[i].url);
    }
  }

  // Add note about BR being unavailable for live fetch
  const brRequested = !airline || airline === "BR";
  if (brRequested) {
    errors.push("BR:flights.evaair.com (HTTP 403 — server-side fetch blocked by airline)");
  }

  // Deduplicate: keep lowest price per route+dates
  const seen = new Map();
  for (const o of allOffers) {
    const key = `${o.airline}|${o.from}|${o.to}|${o.departDate}|${o.returnDate}`;
    if (!seen.has(key) || o.price < seen.get(key).price) seen.set(key, o);
  }
  const dedupedOffers = Array.from(seen.values());

  // Filter by search criteria
  const filtered = dedupedOffers
    .filter((o) => matchesSearch(o, { airline, from, to, year, month, duration }))
    .sort((a, b) => a.price - b.price);

  // Attach baseline data
  const offersWithBaseline = filtered.map((o) => {
    const b = ROUTE_BASELINES[`${o.airline}|${o.from}|${o.to}`] || {};
    return { ...o, ...b };
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      offers: offersWithBaseline,
      totalFetched: dedupedOffers.length,
      pagesSearched: limited.length,
      errors,
      updatedAt: new Date().toISOString(),
    }),
  };
}
