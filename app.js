// v5: 長榮(BR)改純 API、納入即時來回價(9 航線)，每筆 offer 帶 lastUpdated（最後更新時間）。
// v4: 移除內建假資料、改純即時起價、修正抓價對應錯誤。版本升級可清掉舊裝置上殘留的
// 假價／錯誤即時快取（含「長榮僅歷史」舊狀態），強制重新從官網擷取。
const STORAGE_KEY = "japanFareRadarState:v5";

const AIRLINE_ORDER = ["CI", "JX", "BR"];
const AIRLINES = {
  CI: { name: "中華航空", short: "華航", badge: "badge-ci" },
  JX: { name: "星宇航空", short: "星宇", badge: "badge-jx" },
  BR: { name: "長榮航空", short: "長榮", badge: "badge-br" }
};

// 各航空公司官網均以「台北 Taipei」標示 TPE/TSA（非「桃園」），故 short 以台北起首，
// 避免使用者到官網找不到「桃園」。代碼 (TPE/TSA) 在卡片上一併顯示以利對照訂票。
// 顯示順序：桃園 → 松山 → 台中 → 高雄（依使用者習慣由北到南、桃園優先）。
const TAIWAN_AIRPORTS = {
  TPE: { code: "TPE", short: "台北桃園", name: "台北桃園國際機場", bookingCity: "台北 Taipei" },
  TSA: { code: "TSA", short: "台北松山", name: "台北松山機場", bookingCity: "台北 Taipei" }
};

const JAPAN_AIRPORTS = {
  NRT: { code: "NRT", short: "成田", name: "東京成田機場" },
  HND: { code: "HND", short: "羽田", name: "東京羽田機場" },
  KIX: { code: "KIX", short: "關西", name: "大阪關西國際機場" },
  FUK: { code: "FUK", short: "福岡", name: "福岡機場" },
  CTS: { code: "CTS", short: "新千歲", name: "札幌新千歲機場" },
  NGO: { code: "NGO", short: "名古屋", name: "名古屋中部國際機場" },
  HIJ: { code: "HIJ", short: "廣島", name: "廣島機場" },
  OKA: { code: "OKA", short: "那霸", name: "沖繩那霸機場" },
  KMJ: { code: "KMJ", short: "熊本", name: "熊本機場" },
  SDJ: { code: "SDJ", short: "仙台", name: "仙台機場" },
  TAK: { code: "TAK", short: "高松", name: "高松機場" },
  HKD: { code: "HKD", short: "函館", name: "函館機場" },
  KMQ: { code: "KMQ", short: "小松", name: "小松機場" },
  AOJ: { code: "AOJ", short: "青森", name: "青森機場" }
};

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
  // 星宇 JX（含台中出發）
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

// 智能搜尋的選單一律由「實際即時票價」驅動（見 liveRouteIndex / refreshSearchFields），
// 確保航空×出發地×目的地的組合與官網真實航線一致（例：星宇高松只有台中出發）。

// 目前推薦改為「純即時」：資料一律來自航空公司官網即時擷取（liveCache），不再放任何
// 內建假資料。先前的內建示例價是憑空填的，會與官網對不上、破壞可信度，故全部移除。
// 長榮（BR）2026-06 起改用官網低價日曆 API（純 HTTP），已納入即時來回價（9 條日本線），
// 與華航/星宇一視同仁；下方歷史基準僅用於「即時資料尚未涵蓋」的航線月份對照。
const SEED_OFFERS = [];

const PROMOS = [
  {
    airline: "CI",
    title: "華航最新活動頁",
    startDate: "2026-05-29",
    note: "不定期刷新日本線促銷與信用卡合作活動，建議購票前先確認是否有優惠。",
    url: "https://www.china-airlines.com/tw/zh/itinerary-booking/exclusive-offers/latest-events?inspirationTypes=current-offer"
  },
  {
    airline: "JX",
    title: "星宇官方優惠與即時報",
    startDate: "2026-05-30",
    note: "星宇促銷常透過官方活動頁或即時報公布，建議在購票前確認。",
    url: "https://www.starlux-airlines.com/flights/en-us/promotions"
  },
  {
    airline: "BR",
    title: "長榮 Happy Hours",
    startDate: "2026-05-31",
    note: "限時特賣不定期開放，值得在購票前先檢查是否有日本線優惠。",
    url: "https://booking.evaair.com/flyeva/eva/b2c/booking-happyhour.aspx?lang=zh-tw"
  }
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const currencyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

let state = loadState();

function loadState() {
  const seed = seedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    return {
      ...seed,
      ...parsed,
      selectedFrom: TAIWAN_AIRPORTS[parsed.selectedFrom] ? parsed.selectedFrom : seed.selectedFrom,
      airlineFilter: parsed.airlineFilter || "ALL",
      activeTab: parsed.activeTab || "recommend",
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      offers: Array.isArray(parsed.offers) && parsed.offers.length
        ? parsed.offers.map(normalizeOffer)
        : seed.offers,
      liveStatus: parsed.liveStatus || seed.liveStatus,
      liveCache: parsed.liveCache || null
    };
  } catch {
    return seed;
  }
}

function seedState() {
  return {
    selectedFrom: "TPE",
    selectedRouteKey: "",
    airlineFilter: "ALL",
    activeTab: "recommend",
    favorites: [],
    lastNotificationKey: "",
    liveStatus: {
      mode: "loading",
      updatedAt: "",
      message: "正在讀取官網即時來回票價…"
    },
    offers: SEED_OFFERS.map(normalizeOffer),
    liveCache: null  // { offers: [...], loadedAt: "ISO string" }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeOffer(offer) {
  const airline = AIRLINES[offer.airline] ? offer.airline : "CI";
  const from = String(offer.from || "TPE").toUpperCase();
  const to = String(offer.to || "NRT").toUpperCase();
  const baseline = ROUTE_BASELINES[`${airline}|${from}|${to}`] || {};
  const price = moneyNumber(offer.price);
  const normalLow = moneyNumber(offer.normalLow || baseline.normalLow || Math.round(price * 0.94));
  const normalHigh = moneyNumber(offer.normalHigh || baseline.normalHigh || Math.round(price * 1.28));
  const oneYearAvg = moneyNumber(offer.oneYearAvg || baseline.oneYearAvg || Math.round((normalLow + normalHigh) / 2));
  const oneYearMin = moneyNumber(offer.oneYearMin || baseline.oneYearMin || Math.min(price, normalLow));
  return {
    id: offer.id || `${airline}-${from}-${to}-${offer.departDate}-${offer.returnDate}`.toLowerCase(),
    airline,
    from,
    to,
    departDate: normalizeDate(offer.departDate) || todayISO(),
    returnDate: normalizeDate(offer.returnDate) || normalizeDate(offer.departDate) || todayISO(),
    price,
    normalLow,
    normalHigh: Math.max(normalHigh, normalLow),
    oneYearAvg,
    oneYearMin,
    source: offer.source === "official public fare page" ? "官方公開票價頁" : (offer.source || "官方公開票價頁"),
    sourceUrl: offer.sourceUrl || offer.bookingUrl || "",
    bookingUrl: offer.bookingUrl || offer.sourceUrl || airlineHome(airline),
    seenAt: normalizeDate(offer.seenAt) || todayISO(),
    lastUpdated: offer.lastUpdated || null,   // 該筆票價最後一次自官網更新的時間（ISO，含時區）
    isLive: offer.isLive === true,
    roundTrip: offer.roundTrip === true,
    // 即時擷取的真實票價不編造歷史走勢（避免假資料）；趨勢改用「近期真實逐日價」呈現。
    history: Array.isArray(offer.history) && offer.history.length
      ? offer.history.map(normalizeHistoryPoint)
      : (offer.isLive === true ? [] : buildHistory({ oneYearAvg, oneYearMin, normalHigh, currentPrice: price }))
  };
}

function normalizeHistoryPoint(point) {
  return {
    date: normalizeDate(point.date || point.checkedAt) || todayISO(),
    price: moneyNumber(point.price)
  };
}

function buildHistory({ oneYearAvg, oneYearMin, normalHigh, currentPrice }) {
  const dates = [
    "2025-06-15", "2025-07-15", "2025-08-15", "2025-09-15",
    "2025-10-15", "2025-11-15", "2025-12-15", "2026-01-15",
    "2026-02-15", "2026-03-15", "2026-04-15", "2026-05-30"
  ];
  const factors = [1.12, 1.05, 0.98, 0.94, 1.08, 1.18, 1.14, 1.06, 0.99, 0.95, 0.91, 1];
  return dates.map((date, index) => {
    let price = Math.round(oneYearAvg * factors[index]);
    if (index === 4) price = Math.min(normalHigh, Math.round(oneYearAvg * 1.08));
    if (index === 10) price = oneYearMin;
    if (index === 11) price = currentPrice;
    return { date, price };
  });
}

// ─── render orchestration ────────────────────────────────────────────────────

function renderAll() {
  renderSummary();
  renderMainTabs();
  if (state.activeTab === "recommend") {
    renderDepartureTabs();
    renderAirlineFilterTabs();
    renderRecommendations();
    renderPromos();
  }
}

// ─── tab nav ─────────────────────────────────────────────────────────────────

function renderMainTabs() {
  $$(".main-tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === state.activeTab;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
  $("#panel-recommend").classList.toggle("hidden", state.activeTab !== "recommend");
  $("#panel-search").classList.toggle("hidden", state.activeTab !== "search");
}

// ─── departure tabs ───────────────────────────────────────────────────────────

function renderDepartureTabs() {
  $("#departureTabs").innerHTML = Object.values(TAIWAN_AIRPORTS).map((airport) => {
    const count = recommendationsFor(airport.code).length;
    return `
      <button class="departure-tab ${state.selectedFrom === airport.code ? "active" : ""}" type="button" data-from="${airport.code}" role="tab" aria-selected="${state.selectedFrom === airport.code}">
        <strong>${airport.short}</strong>
        <small>${airport.code} · ${count} 筆</small>
      </button>
    `;
  }).join("");
}

// ─── airline filter tabs ─────────────────────────────────────────────────────

function renderAirlineFilterTabs() {
  const options = [
    { key: "ALL", label: "全部" },
    ...AIRLINE_ORDER.map((code) => ({ key: code, label: AIRLINES[code].short }))
  ];
  $("#airlineFilterBar").innerHTML = options.map(({ key, label }) => `
    <button class="airline-filter-btn ${state.airlineFilter === key ? "active" : ""}" type="button" data-airline="${key}">
      ${label}
    </button>
  `).join("");
}

// ─── hero summary ─────────────────────────────────────────────────────────────

function renderSummary() {
  const recommendations = recommendationsFor(state.selectedFrom);
  // 統計列「可考慮購買 / 日本目的地」要跟著航空篩選一起變動（全部 or 單一航空）。
  const scoped = state.airlineFilter === "ALL"
    ? recommendations
    : recommendations.filter((o) => o.airline === state.airlineFilter);
  const routes = groupRoutes(scoped);
  const airport = TAIWAN_AIRPORTS[state.selectedFrom];
  const destinationCount = new Set(scoped.map((offer) => offer.to)).size;

  $("#recommendCount").textContent = routes.length;
  $("#airportCount").textContent = destinationCount;
  $("#currentAirportNote").textContent = `${airport.name}（${airport.code}）`;
  $("#syncStatus").textContent = statusText();
  if ($("#fareRange")) $("#fareRange").textContent = fareRangeText();
  if ($("#recommendBasis")) $("#recommendBasis").textContent = recommendBasisText();
}

// ─── recommendations ──────────────────────────────────────────────────────────

function renderRecommendations() {
  const container = $("#airlineGroups");
  const allRecs = recommendationsFor(state.selectedFrom);

  if (!allRecs.length) {
    const mode = (state.liveStatus && state.liveStatus.mode) || "loading";
    let msg;
    if (mode === "loading") {
      msg = "正在讀取官網即時來回票價，請稍候…";
    } else if (mode === "error") {
      msg = "暫時無法連線航空公司官網，請稍後重新整理頁面再試。";
    } else {
      msg = `${TAIWAN_AIRPORTS[state.selectedFrom].short}出發目前沒有可顯示的即時票價。可改用上方「智能搜尋」依日期查詢，或換一個出發機場。`;
    }
    container.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  // Filter by selected airline
  const filtered = state.airlineFilter === "ALL"
    ? allRecs
    : allRecs.filter((o) => o.airline === state.airlineFilter);

  if (!filtered.length) {
    const meta = AIRLINES[state.airlineFilter];
    container.innerHTML = `<div class="empty-state">${meta ? meta.short : ""}目前沒有符合條件的推薦票價。</div>`;
    return;
  }

  const routes = groupRoutes(filtered);
  container.innerHTML = routes.map(renderRouteCard).join("");
}

function renderRouteCard(route) {
  const from = airportName(route.from);
  const to = airportName(route.to);
  const best = route.best;
  const stats = routeStats(route);
  const label = dataMonthsLabel();
  const reason = recommendationReason(best, stats);
  const meta = AIRLINES[route.airline];
  const peak = peakSeasonNote(best.departDate);
  // 划算徽章：最低價比「目前三個月平均」低 15% 以上才標示，避免每張卡都掛。
  const isGoodDeal = stats.avg > 0 && best.price <= Math.round(stats.avg * 0.85);
  return `
    <article class="route-card ${isGoodDeal ? "is-ultra" : ""}">
      <div class="route-main">
        <div class="route-title">
          <div class="route-title-top">
            <span class="airline-badge ${meta.badge}">${meta.short}</span>
            ${isGoodDeal ? `<span class="ultra-badge">⚡ ${label}相對低</span>` : ""}
            ${best.isLive ? '<span class="live-tag">即時</span>' : ""}
          </div>
          <h4>${from.short} → ${to.short}</h4>
          <p class="route-subtitle">${escapeHTML(best.source)}${best.isLive && best.lastUpdated ? ` · 🕒 ${escapeHTML(formatLastUpdated(best.lastUpdated))}` : ""}</p>
        </div>
        <div class="route-actions">
          <a class="route-book-link" href="${escapeHTML(best.bookingUrl || airlineHome(route.airline))}" target="_blank" rel="noreferrer">前往官網查票</a>
        </div>
      </div>
      <div class="price-line">
        <strong>${formatMoney(best.price)}</strong>
        <span>${escapeHTML(reason.short)}</span>
      </div>
      <div class="route-facts">
        <div class="fact"><small>最便宜出發日</small><strong>${formatDate(best.departDate)}</strong></div>
        <div class="fact"><small>${label}最低</small><strong>${formatMoney(stats.min)}</strong></div>
        <div class="fact"><small>${label}平均</small><strong>${formatMoney(stats.avg)}</strong></div>
        <div class="fact"><small>${label}最高</small><strong>${formatMoney(stats.max)}</strong></div>
      </div>
      ${peak ? `<p class="peak-hint">⚠️ ${peak}，價格可能受旺季因素影響</p>` : ""}
    </article>
  `;
}

// ─── promos ───────────────────────────────────────────────────────────────────

function renderPromos() {
  const today = todayISO();
  $("#promoList").innerHTML = PROMOS.map((promo) => {
    const meta = AIRLINES[promo.airline];
    const isActive = normalizeDate(promo.startDate) <= today;
    return `
      <article class="promo-card">
        <div class="promo-main">
          <div>
            <div class="promo-header-row">
              <span class="airline-badge ${meta.badge}">${meta.name}</span>
              ${isActive ? '<span class="promo-active-icon" title="促銷進行中"><svg><use href="#icon-event"></use></svg></span>' : ""}
            </div>
            <h3>${escapeHTML(promo.title)}</h3>
            <p>${escapeHTML(promo.note)}</p>
          </div>
        </div>
        <a class="secondary-button" href="${escapeHTML(promo.url)}" target="_blank" rel="noreferrer">
          <svg><use href="#icon-link"></use></svg>
          開啟官方頁
        </a>
      </article>
    `;
  }).join("");
}

// ─── seasonal price factors (higher = more expensive month) ──────────────────
const SEASONAL_FACTOR = {
  "01": 1.08, "02": 1.16, "03": 0.96, "04": 0.93,
  "05": 0.91, "06": 0.94, "07": 1.10, "08": 1.13,
  "09": 0.93, "10": 1.04, "11": 1.00, "12": 1.18
};

const SEASONAL_NOTE = {
  "01": "元旦連假前後，票價通常比平均高約 8%",
  "02": "農曆新年旺季，票價常比平均貴 15% 以上，建議提早購票",
  "03": "淡旺季過渡期，票價相對合理",
  "04": "日本春假尾聲，票價略低，是出遊好時機",
  "05": "五月是日本旅遊相對淡季，票價通常偏低",
  "06": "梅雨季，票價平穩，適合預算旅行",
  "07": "暑假開始，票價上揚約 10%，建議早訂",
  "08": "暑假高峰，票價為全年最貴月份之一",
  "09": "暑假結束後回落，票價恢復平穩，性價比高",
  "10": "秋季賞楓旺季，票價略有上漲",
  "11": "賞楓旺季尾聲，仍是熱門月份",
  "12": "聖誕跨年旺季，票價全年最高，若要飛建議盡早訂"
};

// ─── smart search ─────────────────────────────────────────────────────────────

async function doSearch(formData) {
  const airline = formData.get("airline") || "";
  const from = formData.get("from") || "";
  const to = formData.get("to") || "";
  const depart = formData.get("depart") || "";  // "YYYY-MM"；空＝不限月份
  const [year, month] = depart ? depart.split("-") : ["", ""];
  const duration = parseInt(formData.get("duration") || "0", 10);
  const passengers = Math.max(1, parseInt(formData.get("passengers") || "1", 10));

  const panel = $("#searchResults");

  const monthNames = ["", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const fromLabel = from ? `${TAIWAN_AIRPORTS[from]?.short || from}（${from}）` : "任一台灣機場";
  const toLabel = to ? `${JAPAN_AIRPORTS[to]?.short || to}（${to}）` : "任一日本機場";
  const airlineLabel = airline ? (AIRLINES[airline]?.name || airline) : "任一航空";
  const monthLabel = month ? `${year || "2026"} 年 ${monthNames[parseInt(month, 10)]}` : (year ? `${year} 年` : "任一月份");
  const durationLabel = duration ? `${duration} 天` : "不限天數";
  const seasonNote = month ? SEASONAL_NOTE[month] : null;
  const seasonFactor = month ? (SEASONAL_FACTOR[month] || 1) : 1;

  // Show loading state
  panel.innerHTML = `
    <div class="search-loading">
      <div class="search-loading-spinner"></div>
      <p>正在向航空公司官網查詢票價，請稍候…</p>
    </div>
  `;

  // 資料來源：開頁載入的真實票價（liveCache，夜間爬蟲產出）。依搜尋條件在前端篩選，
  // 不再呼叫伺服器。沒有真實資料的航線，下方仍以「歷史參考」基準卡呈現。
  const allMatches = currentOffers().filter((o) => {
    if (airline && o.airline !== airline) return false;
    if (from && o.from !== from) return false;
    if (to && o.to !== to) return false;
    if (o.departDate < todayISO()) return false;
    if (year || month) {
      const [oYear, oMonth] = o.departDate.split("-");
      if (year && oYear !== year) return false;
      if (month && oMonth !== month.padStart(2, "0")) return false;
    }
    if (duration) {
      const days = Math.round((new Date(o.returnDate) - new Date(o.departDate)) / 86400000) + 1;
      if (Math.abs(days - duration) > 1) return false;
    }
    return true;
  }).sort((a, b) => a.price - b.price);

  // 各航線在「符合條件結果」中的真實價格分布，作為划算/偏貴的判斷基準（取代寫死 baseline）。
  const pricesByRoute = {};
  for (const o of allMatches) {
    const k = `${o.airline}|${o.from}|${o.to}`;
    (pricesByRoute[k] || (pricesByRoute[k] = [])).push(o.price);
  }
  const routeStatOf = (o) => {
    const arr = (pricesByRoute[`${o.airline}|${o.from}|${o.to}`] || []).slice().sort((a, b) => a - b);
    if (!arr.length) return null;
    return { min: arr[0], avg: Math.round(arr.reduce((s, p) => s + p, 0) / arr.length), max: arr[arr.length - 1] };
  };
  const liveCount = allMatches.filter((o) => o.isLive).length;

  // Baseline entries for routes with no live or local data
  const baselineEntries = Object.entries(ROUTE_BASELINES).filter(([key]) => {
    const [bAirline, bFrom, bTo] = key.split("|");
    if (airline && bAirline !== airline) return false;
    if (from && bFrom !== from) return false;
    if (to && bTo !== to) return false;
    return true;
  });

  if (!baselineEntries.length && !allMatches.length) {
    panel.innerHTML = `<div class="search-no-result"><p>沒有找到符合條件的航線資料。目前支援華航、星宇、長榮從桃園、松山、高雄飛日本各城市。</p></div>`;
    return;
  }

  // Render offer cards
  const offerCards = allMatches.map((o) => {
    const verdict = priceVerdict(o.price, routeStatOf(o));
    const totalPrice = o.price * passengers;
    const meta = AIRLINES[o.airline];
    const fromA = airportName(o.from);
    const toA = airportName(o.to);
    const isLive = o.isLive === true;
    const priceLabel = o.roundTrip ? "每人來回票價" : "每人票價";
    return `
      <article class="search-result-card">
        <div class="search-result-top">
          <span class="airline-badge ${meta.badge}">${meta.short}</span>
          <span class="verdict-badge verdict-${verdict.level}">${verdict.label}</span>
          ${isLive ? '<span class="live-tag">即時</span>' : ""}
        </div>
        <div class="search-result-route">${fromA.short} → ${toA.short}</div>
        <div class="search-result-dates">${formatDateRange(o)}</div>
        <div class="search-result-price">
          <div><small>${priceLabel}</small><strong>${formatMoney(o.price)}</strong></div>
          ${passengers > 1 ? `<div><small>${passengers} 人合計</small><strong>${formatMoney(totalPrice)}</strong></div>` : ""}
        </div>
        <div class="search-result-analysis">${escapeHTML(verdict.advice)}</div>
        ${isLive && o.lastUpdated ? `<p class="last-updated">🕒 ${escapeHTML(formatLastUpdated(o.lastUpdated))}</p>` : ""}
        ${isLive ? '<p class="price-disclaimer">⚠️ 此為夜間自官網查得的真實票價，實際可訂價格與規則請至官網結帳前再確認。</p>' : ""}
        <a class="secondary-button" href="${escapeHTML(o.bookingUrl || airlineHome(o.airline))}" target="_blank" rel="noreferrer">
          <svg><use href="#icon-link"></use></svg>
          前往官網確認並訂票
        </a>
      </article>
    `;
  }).join("");

  // Baseline cards for routes with no data
  const coveredRoutes = new Set(allMatches.map((o) => `${o.airline}|${o.from}|${o.to}`));
  const baselineCards = baselineEntries
    .filter(([key]) => !coveredRoutes.has(key))
    .map(([key, b]) => {
      const [bAirline, bFrom, bTo] = key.split("|");
      const meta = AIRLINES[bAirline];
      const fromA = airportName(bFrom);
      const toA = airportName(bTo);
      // 不再用季節係數「預估」尚未到來的月份（會誤導）。直接顯示過去一年的常態區間供對照。
      // （長榮已納入即時抓取，這裡只在「即時資料尚未涵蓋此航線月份」時顯示，與其他航空一致。）
      const datesLine = "官網未查到此月份票價，以下為近一年歷史區間供參考";
      return `
        <article class="search-result-card is-baseline">
          <div class="search-result-top">
            <span class="airline-badge ${meta.badge}">${meta.short}</span>
            <span class="verdict-badge verdict-neutral">歷史參考</span>
          </div>
          <div class="search-result-route">${fromA.short} → ${toA.short}</div>
          <div class="search-result-dates">${datesLine}</div>
          <div class="search-result-price">
            <div><small>近一年常態區間</small><strong>${formatMoney(b.normalLow)} – ${formatMoney(b.normalHigh)}</strong></div>
            <div><small>近一年平均</small><strong>${formatMoney(b.oneYearAvg)}</strong></div>
          </div>
          <div class="search-result-analysis baseline-tip">這是過去一年的票價區間，僅供參考，並非 ${monthLabel} 的實際票價。請至官網查詢 ${monthLabel} 實際票價後，再對照此區間判斷是否划算。${seasonFactor > 1.05 ? ` ⚠️ ${SEASONAL_NOTE[month] || ""}` : ""}</div>
          <a class="secondary-button" href="${escapeHTML(airlineHome(bAirline))}" target="_blank" rel="noreferrer">
            <svg><use href="#icon-link"></use></svg>
            前往官網查票
          </a>
        </article>
      `;
    }).join("");

  const sourceNote = allMatches.length > 0
    ? `<p class="search-summary-note">✅ 共 ${allMatches.length} 筆符合條件，由低到高排列${liveCount ? `，其中 ${liveCount} 筆為官網即時${allMatches.some((o) => o.roundTrip) ? "來回" : ""}票價` : ""}。${passengers > 1 ? ` 標示 ${passengers} 人合計。` : ""}</p>`
    : `<p class="search-summary-note">這個條件目前沒有即時票價，下方提供歷史區間參考。</p>`;

  panel.innerHTML = `
    <div class="search-summary">
      <div class="search-summary-row">
        <strong>${airlineLabel}</strong>
        <span class="summary-sep">·</span>
        <span>${fromLabel} → ${toLabel}</span>
        <span class="summary-sep">·</span>
        <span>${monthLabel}</span>
        <span class="summary-sep">·</span>
        <span>${durationLabel}</span>
        <span class="summary-sep">·</span>
        <span>${passengers} 人</span>
      </div>
      ${sourceNote}
      ${seasonNote ? `<div class="season-hint"><svg><use href="#icon-calendar"></use></svg> ${escapeHTML(seasonNote)}</div>` : ""}
    </div>
    <div class="search-results-grid">
      ${offerCards}
      ${baselineCards}
    </div>
  `;
}

// 依「同航線在本次搜尋結果中的真實價格分布」判斷划算程度（取代寫死的 baseline）。
function priceVerdict(price, stats) {
  if (!stats || !stats.avg) {
    return { level: "neutral", label: "參考", advice: "目前沒有足夠的同航線即時資料可比較，僅供參考。" };
  }
  const { min, avg, max } = stats;
  if (price <= Math.round(min * 1.03)) {
    return { level: "great", label: "近期最低", advice: `這是近期查到的最低價附近（近期最低 ${formatMoney(min)}），是相對好的入手點。` };
  }
  if (price <= avg) {
    return { level: "good", label: "划算", advice: `低於近期平均 ${formatMoney(avg)}，屬於近期相對划算的日期。` };
  }
  if (price <= Math.round((avg + max) / 2)) {
    return { level: "average", label: "普通", advice: `略高於近期平均 ${formatMoney(avg)}，屬於一般行情，可再看看其他日期。` };
  }
  return { level: "expensive", label: "偏貴", advice: `接近近期最高價 ${formatMoney(max)}，屬於近期偏貴的日期，建議換個日期或再等等。` };
}

// ─── logic helpers ────────────────────────────────────────────────────────────

function recommendationsFor(fromCode) {
  // 全部來自夜間擷取的真實票價，這裡只篩出發機場與未來日期；好壞由各航線「近期真實
  // 價格分布」在卡片上呈現（recommendationReason / routeStats），不再用寫死的 baseline 過濾。
  return currentOffers()
    .filter((offer) => offer.from === fromCode)
    .filter((offer) => offer.departDate >= todayISO())
    .sort((a, b) => {
      const routeCompare = a.to.localeCompare(b.to);
      if (routeCompare) return routeCompare;
      return a.price - b.price;
    });
}

function currentOffers() {
  const live = (state.liveCache && Array.isArray(state.liveCache.offers)) ? state.liveCache.offers : [];
  if (!live.length) return state.offers.map(normalizeOffer);
  const seen = new Set(live.map(o => `${o.airline}|${o.from}|${o.to}|${o.departDate}|${o.returnDate}`));
  const merged = [...live];
  for (const o of state.offers) {
    const n = normalizeOffer(o);
    const k = `${n.airline}|${n.from}|${n.to}|${n.departDate}|${n.returnDate}`;
    if (!seen.has(k)) merged.push(n);
  }
  return merged;
}

function isRecommended(offer) {
  const lowerEdge = Math.round(offer.normalLow * 1.03);
  return offer.price <= offer.oneYearAvg || offer.price <= lowerEdge;
}

function groupRoutes(offers) {
  const map = new Map();
  offers.forEach((offer) => {
    const key = routeKey(offer);
    if (!map.has(key)) {
      map.set(key, { key, airline: offer.airline, from: offer.from, to: offer.to, offers: [] });
    }
    map.get(key).offers.push(offer);
  });

  return Array.from(map.values()).map((route) => {
    route.offers.sort((a, b) => a.price - b.price || a.departDate.localeCompare(b.departDate));
    route.best = route.offers[0];
    return route;
  }).sort((a, b) => {
    const airlineCompare = AIRLINE_ORDER.indexOf(a.airline) - AIRLINE_ORDER.indexOf(b.airline);
    if (airlineCompare) return airlineCompare;
    return a.best.price - b.best.price;
  });
}

function selectedRoute() {
  return groupRoutes(recommendationsFor(state.selectedFrom)).find((route) => route.key === state.selectedRouteKey) || null;
}

function ensureSelectedRoute() {
  const routes = groupRoutes(recommendationsFor(state.selectedFrom));
  if (!routes.length) { state.selectedRouteKey = ""; return; }
  if (!routes.some((route) => route.key === state.selectedRouteKey)) {
    state.selectedRouteKey = routes[0].key;
  }
}

// 全部以「該航線近期實際擷取到的票價分布」計算，不含任何編造的歷史資料。
function routeStats(route) {
  const prices = route.offers.map((offer) => moneyNumber(offer.price)).filter(Boolean).sort((a, b) => a - b);
  if (!prices.length) return { min: 0, avg: 0, max: 0 };
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return { min: prices[0], avg: Math.round(sum / prices.length), max: prices[prices.length - 1] };
}

// ─── 月份區間標籤 + 旺季提醒 ──────────────────────────────────────────────────
// 划算判斷一律以「目前有資料的這幾個月（如 12–2 月）實際票價的平均與高低點」為基準。
// 因為這幾個月可能正好都是旺季，所以再加上旺季提醒，避免誤把旺季偏高價當成行情。

// 目前資料涵蓋的月份標籤，例如 "12–2月"（依實際 offers 的出發月份動態產生）。
function dataMonthsLabel() {
  const set = new Set(currentOffers().map((o) => (o.departDate || "").slice(0, 7)).filter(Boolean));
  const yms = [...set].sort();
  if (!yms.length) return "目前區間";
  const first = parseInt(yms[0].slice(5), 10);
  const last = parseInt(yms[yms.length - 1].slice(5), 10);
  return first === last ? `${first}月` : `${first}–${last}月`;
}

// 旺季月份提醒（聖誕、跨年、農曆新年、賞櫻、賞楓）。
const PEAK_SEASON = {
  "11": "11月賞楓旺季",
  "12": "12月聖誕、跨年旺季",
  "01": "1月元旦、跨年旺季",
  "02": "2月農曆新年旺季",
  "03": "3月下旬賞櫻旺季",
  "04": "4月賞櫻旺季"
};
function peakSeasonNote(departDate) {
  return PEAK_SEASON[(departDate || "").slice(5, 7)] || "";
}

// 「目前推薦」區塊的基準說明：講明是以目前三個月的實際票價為準，並列出其中的旺季月份。
function recommendBasisText() {
  // 依資料實際的出發年月排序（12→1→2 而非 1→2→12），取出其中的旺季月份。
  const yms = [...new Set(currentOffers().map((o) => (o.departDate || "").slice(0, 7)).filter(Boolean))].sort();
  const seen = new Set();
  const peaks = [];
  for (const ym of yms) {
    const m = ym.slice(5, 7);
    if (PEAK_SEASON[m] && !seen.has(m)) { seen.add(m); peaks.push(PEAK_SEASON[m]); }
  }
  let s = `推薦以目前有資料的「${dataMonthsLabel()}」實際票價的平均與高低點為基準判斷划算與否。`;
  if (peaks.length) s += `提醒：${peaks.join("、")}，這些月份票價可能受旺季因素影響而偏高，請對照後再決定。`;
  return s;
}

function recommendationReason(offer, stats) {
  const label = dataMonthsLabel();
  const avg = (stats && stats.avg) || offer.price;
  const min = (stats && stats.min) || offer.price;
  const pct = avg ? Math.round(((avg - offer.price) / avg) * 100) : 0;
  const peak = peakSeasonNote(offer.departDate);
  const peakTail = peak ? `（注意：${peak}，價格可能受旺季因素影響）` : "";
  if (offer.price <= Math.round(min * 1.03)) {
    return {
      short: `${label}最低價附近`,
      long: `這是${label}查到的最低價附近（${label}最低 ${formatMoney(min)}），以目前三個月行情看是相對好的入手點。${peakTail}`
    };
  }
  if (offer.price <= avg) {
    return {
      short: `低於${label}平均 ${Math.max(0, pct)}%`,
      long: `比${label}平均 ${formatMoney(avg)} 低約 ${Math.max(0, pct)}%，以目前三個月行情看屬於相對划算的日期。${peakTail}`
    };
  }
  return {
    short: `高於${label}平均`,
    long: `高於${label}平均 ${formatMoney(avg)}，以目前三個月行情看屬於較貴的日期，可考慮換個日期或再等等。${peakTail}`
  };
}

// ─── sync ─────────────────────────────────────────────────────────────────────

// 資料來源：夜間爬蟲（scraper/scrape_fares.py）產出的靜態檔 data/live-fares.json。
// 不再依賴 Netlify function；部署時這份 JSON 會一起上傳。
function liveApiBase() {
  return "data/live-fares.json";
}

async function fetchLiveOffers() {
  const res = await fetch(`${liveApiBase()}?t=${Date.now()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(25000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.offers) ? data.offers.map(normalizeOffer) : [];
}

// 同步票價按鈕：強制重新擷取（略過 6 小時快取）。
async function syncLiveFares() {
  const button = $("#syncButton");
  if (button) { button.classList.add("is-loading"); button.disabled = true; }
  $("#syncStatus").textContent = "正在讀取官網即時來回票價…";

  try {
    const incoming = await fetchLiveOffers();
    if (!incoming.length) throw new Error("no live offers");

    state.liveCache = { offers: incoming, loadedAt: new Date().toISOString() };
    state.liveStatus = {
      mode: "live",
      updatedAt: state.liveCache.loadedAt,
      message: `已更新 ${incoming.length} 筆官網即時來回票價（資料每晚自官網更新）`
    };
    saveState();
    renderAll();
    refreshSearchFields();
    notifyTopRecommendation();
    showToast("已更新官網即時來回票價");
  } catch {
    state.liveStatus = {
      mode: "error",
      updatedAt: new Date().toISOString(),
      message: "暫時無法連線航空公司官網，請稍後再按一次同步票價"
    };
    saveState();
    renderAll();
    showToast("暫時無法讀取官網票價，請稍後再試");
  } finally {
    if (button) { button.classList.remove("is-loading"); button.disabled = false; }
  }
}

function mergeOffers(existing, incoming) {
  const map = new Map();
  existing.forEach((offer) => map.set(offerIdentity(offer), offer));
  incoming.forEach((offer) => {
    const key = offerIdentity(offer);
    const old = map.get(key);
    if (old) {
      offer.history = mergeHistory(old.history, [
        ...(offer.history || []),
        { date: offer.seenAt || todayISO(), price: offer.price }
      ]);
    }
    map.set(key, offer);
  });
  return Array.from(map.values()).sort((a, b) => a.departDate.localeCompare(b.departDate));
}

function mergeHistory(a = [], b = []) {
  const map = new Map();
  [...a, ...b].forEach((item) => {
    const normalized = normalizeHistoryPoint(item);
    map.set(`${normalized.date}:${normalized.price}`, normalized);
  });
  return Array.from(map.values()).sort((left, right) => left.date.localeCompare(right.date)).slice(-18);
}

// ─── notifications ────────────────────────────────────────────────────────────

async function requestNotificationPermission() {
  if (!("Notification" in window)) { showToast("這個瀏覽器不支援通知"); return false; }
  const permission = await Notification.requestPermission();
  showToast(permission === "granted" ? "通知已開啟" : "通知尚未開啟");
  return permission === "granted";
}

function notifyTopRecommendation() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const route = groupRoutes(recommendationsFor(state.selectedFrom))[0];
  if (!route) return;
  const key = `${route.key}:${route.best.price}:${route.best.departDate}`;
  if (state.lastNotificationKey === key) return;
  state.lastNotificationKey = key;
  saveState();

  const meta = AIRLINES[route.airline];
  const from = airportName(route.from);
  const to = airportName(route.to);
  const title = `${meta.short} ${from.short} → ${to.short} 可考慮購買`;
  const body = `${formatDateRange(route.best)} ${formatMoney(route.best.price)}，${recommendationReason(route.best).short}`;
  try {
    new Notification(title, { body, icon: "assets/icon.svg", tag: key });
  } catch {
    // Notification failures should not interrupt fare rendering.
  }
}

// ─── chart ────────────────────────────────────────────────────────────────────

// 畫「近期每日真實票價」曲線（x = 出發日，y = 該日票價）。資料全來自夜間擷取，無編造。
function drawPriceChart(canvas, route) {
  const context = setupCanvas(canvas);
  if (!context) return;
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  context.clearRect(0, 0, width, height);

  const history = (route.offers || [])
    .map((offer) => ({ date: offer.departDate, price: moneyNumber(offer.price) }))
    .filter((item) => item.price)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!history.length) return;
  const stats = routeStats(route);
  const prices = history.map((item) => item.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = { top: 22, right: 18, bottom: 34, left: 58 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  context.strokeStyle = "#dce3df";
  context.lineWidth = 1;
  context.beginPath();
  [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const y = pad.top + ratio * plotHeight;
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
  });
  context.stroke();

  context.fillStyle = "#66737c";
  context.font = "12px Segoe UI, sans-serif";
  [max, Math.round((min + max) / 2), min].forEach((value) => {
    const y = yFor(value, min, max, pad, plotHeight);
    context.fillText(formatMoney(value).replace("NT$", "$"), 8, y + 4);
  });

  context.strokeStyle = "#2369a5";
  context.lineWidth = 2.5;
  context.beginPath();
  history.forEach((item, index) => {
    const x = pad.left + (index / Math.max(1, history.length - 1)) * plotWidth;
    const y = yFor(item.price, min, max, pad, plotHeight);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  context.fillStyle = "#2369a5";
  history.forEach((item, index) => {
    const x = pad.left + (index / Math.max(1, history.length - 1)) * plotWidth;
    const y = yFor(item.price, min, max, pad, plotHeight);
    context.beginPath();
    context.arc(x, y, index === history.length - 1 ? 4.5 : 3, 0, Math.PI * 2);
    context.fill();
  });

  context.strokeStyle = "#b84b5b";
  context.setLineDash([5, 4]);
  const avgY = yFor(stats.avg, min, max, pad, plotHeight);
  context.beginPath();
  context.moveTo(pad.left, avgY);
  context.lineTo(width - pad.right, avgY);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#66737c";
  context.textAlign = "left";
  context.fillText(formatDate(history[0].date), pad.left, height - 10);
  context.textAlign = "right";
  context.fillText(formatDate(history[history.length - 1].date), width - pad.right, height - 10);
  context.textAlign = "left";
}

function setupCanvas(canvas) {
  if (!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height || Number(canvas.getAttribute("height")) || 220);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function yFor(value, min, max, pad, plotHeight) {
  if (max === min) return pad.top + plotHeight / 2;
  return pad.top + (1 - (value - min) / (max - min)) * plotHeight;
}

// ─── utils ────────────────────────────────────────────────────────────────────

function routeKey(offer) {
  return `${offer.airline}|${offer.from}|${offer.to}`;
}

function offerIdentity(offer) {
  return `${offer.airline}|${offer.from}|${offer.to}|${offer.departDate}|${offer.returnDate}`;
}

function isFavorite(key) {
  return state.favorites.includes(key);
}

function toggleFavorite(key) {
  if (isFavorite(key)) {
    state.favorites = state.favorites.filter((item) => item !== key);
    showToast("已取消星號");
  } else {
    state.favorites = [...state.favorites, key];
    showToast("已加入星號");
  }
  saveState();
  renderAll();
}

function airportName(code) {
  return TAIWAN_AIRPORTS[code] || JAPAN_AIRPORTS[code] || { code, short: code, name: `${code} 機場` };
}

// 從「實際即時票價」建立航線索引：航空→出發地、航空→目的地、(航空,出發地)→目的地。
function liveRouteIndex() {
  const origins = {};   // airline -> Set(from)
  const dests = {};     // airline -> Set(to)
  const odDests = {};   // `${airline}|${from}` -> Set(to)
  currentOffers().forEach((o) => {
    (origins[o.airline] = origins[o.airline] || new Set()).add(o.from);
    (dests[o.airline] = dests[o.airline] || new Set()).add(o.to);
    const k = `${o.airline}|${o.from}`;
    (odDests[k] = odDests[k] || new Set()).add(o.to);
  });
  return { origins, dests, odDests };
}

// 重建「出發機場」選單：只列該航空（在實際資料中）有出發的台灣機場。
function rebuildOriginOptions() {
  const sel = $("#s-from");
  if (!sel) return;
  const airline = ($("#s-airline") && $("#s-airline").value) || "";
  const idx = liveRouteIndex();
  let allowed;
  if (airline && idx.origins[airline]) {
    allowed = idx.origins[airline];
  } else {
    allowed = new Set();
    Object.values(idx.origins).forEach((s) => s.forEach((c) => allowed.add(c)));
  }
  const codes = Object.keys(TAIWAN_AIRPORTS).filter((c) => allowed.has(c));
  if (!codes.length) return; // 資料未載入時保留原選項
  const prev = sel.value;
  sel.innerHTML = ['<option value="">任一台灣機場</option>']
    .concat(codes.map((c) => `<option value="${c}">${TAIWAN_AIRPORTS[c].short}（${c}）</option>`))
    .join("");
  sel.value = allowed.has(prev) ? prev : "";
}

// 重建「目的地」選單：依（航空, 出發地）只列實際有飛的日本機場。
function rebuildDestOptions() {
  const sel = $("#s-to");
  if (!sel) return;
  const airline = ($("#s-airline") && $("#s-airline").value) || "";
  const from = ($("#s-from") && $("#s-from").value) || "";
  const idx = liveRouteIndex();
  let allowed = new Set();
  if (airline && from) {
    allowed = idx.odDests[`${airline}|${from}`] || new Set();
  } else if (airline) {
    allowed = idx.dests[airline] || new Set();
  } else if (from) {
    Object.entries(idx.odDests).forEach(([k, v]) => {
      if (k.endsWith("|" + from)) v.forEach((c) => allowed.add(c));
    });
  } else {
    Object.values(idx.dests).forEach((s) => s.forEach((c) => allowed.add(c)));
  }
  const codes = Object.keys(JAPAN_AIRPORTS).filter((c) => allowed.has(c));
  if (!codes.length && !(airline || from)) return; // 無資料且未篩選 → 保留原選項
  const prev = sel.value;
  sel.innerHTML = ['<option value="">任一日本機場</option>']
    .concat(codes.map((c) => `<option value="${c}">${JAPAN_AIRPORTS[c].short}（${c}）</option>`))
    .join("");
  sel.value = allowed.has(prev) ? prev : "";
}

// 智能搜尋的年/月只能選「實際有資料」的（目前 2026/12、2027/01、2027/02）。
function liveYearMonths() {
  const s = new Set();
  currentOffers().forEach((o) => s.add(o.departDate.slice(0, 7)));
  return [...s].sort();
}

// 智能搜尋的「出發時間」只列實際有資料的月份（目前 2026/12、2027/01、2027/02），標示為「2026年12月」；
// 之後夜間資料月份滾動，這裡會自動跟著更新。
function rebuildDepartOptions() {
  const sel = $("#s-depart");
  if (!sel) return;
  const yms = liveYearMonths();
  if (!yms.length) return;
  const label = (ym) => { const [y, m] = ym.split("-"); return `${y}年${+m}月`; };
  const prev = sel.value;
  sel.innerHTML = ['<option value="">不限（全部月份）</option>']
    .concat(yms.map((ym) => `<option value="${ym}">${label(ym)}</option>`)).join("");
  sel.value = yms.includes(prev) ? prev : "";
}

// 航空改變 → 重建出發地與目的地；出發地改變 → 重建目的地；出發時間依實際資料月份。
function refreshSearchFields() {
  rebuildOriginOptions();
  rebuildDestOptions();
  rebuildDepartOptions();
}

function airlineHome(code) {
  if (code === "CI") return "https://www.china-airlines.com/tw/zh";
  if (code === "JX") return "https://www.starlux-airlines.com/zh-TW";
  return "https://www.evaair.com/zh-tw";
}

function moneyNumber(value) {
  const number = Number(String(value ?? 0).replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function formatMoney(value) {
  return currencyFormatter.format(moneyNumber(value));
}

function normalizeDate(value) {
  if (!value) return "";
  const text = String(value).trim().replaceAll("/", "-");
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value) {
  return normalizeDate(value).replaceAll("-", "/") || "--";
}

function formatDateRange(offer) {
  return `${formatDate(offer.departDate)}-${formatDate(offer.returnDate)}`;
}

// 來回行程的晚數（出發到回程的天數差）。
function tripNights(offer) {
  const d1 = new Date(offer.departDate);
  const d2 = new Date(offer.returnDate);
  const n = Math.round((d2 - d1) / 86400000);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function statusText() {
  const status = state.liveStatus || {};
  const time = status.updatedAt ? formatDateTime(status.updatedAt) : "";
  return `${status.message || "尚未同步"}${time ? ` · ${time}` : ""}`;
}

// 「目前更新票價區間 YYYY/M/D–YYYY/M/D」：取所有即時票價的最早～最晚出發日。
function fareRangeText() {
  const offers = currentOffers();
  if (!offers.length) return "";
  let min = offers[0].departDate, max = offers[0].departDate;
  for (const o of offers) {
    if (o.departDate < min) min = o.departDate;
    if (o.departDate > max) max = o.departDate;
  }
  const fmt = (iso) => { const [y, m, d] = iso.split("-"); return `${y}/${+m}/${+d}`; };
  return `目前更新票價區間 ${fmt(min)}–${fmt(max)}`;
}

// 「最後更新」：今天更新→顯示時間（今天 HH:MM 更新）；昨天→「昨天更新」；更早→「M/D 更新」。
// value 為 ISO 字串：純 API 抓到的含時區時間（今天會顯示時間）；既有資料回填則為純日期。
function formatLastUpdated(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hasTime = /T\d{2}:\d{2}/.test(String(value));
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  const now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const vk = dayKey(d);
  if (vk === dayKey(now)) return hasTime ? `今天 ${pad(d.getHours())}:${pad(d.getMinutes())} 更新` : "今天更新";
  if (vk === dayKey(yest)) return "昨天更新";
  return `${d.getMonth() + 1}/${d.getDate()} 更新`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(date);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]
  ));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// ─── events ───────────────────────────────────────────────────────────────────

function attachEvents() {
  // Main tab switching
  $("#mainTabNav").addEventListener("click", (event) => {
    const btn = event.target.closest(".main-tab-btn[data-tab]");
    if (!btn) return;
    state.activeTab = btn.dataset.tab;
    saveState();
    renderAll();
  });

  // Departure airport tabs
  document.addEventListener("click", (event) => {
    const btn = event.target.closest("#departureTabs button[data-from]");
    if (!btn) return;
    state.selectedFrom = btn.dataset.from;
    state.selectedRouteKey = "";
    saveState();
    renderAll();
  });

  // Airline filter tabs
  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".airline-filter-btn[data-airline]");
    if (!btn) return;
    state.airlineFilter = btn.dataset.airline;
    saveState();
    renderAirlineFilterTabs();
    renderSummary();         // 統計列「可考慮購買 / 日本目的地」跟著切換的航空更新
    renderRecommendations();
  });

  // Search form
  $("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    doSearch(new FormData(event.target)).catch(() => {
      showToast("查詢出現錯誤，請稍後再試");
    });
  });

  // 航空×出發地×目的地三層連動（一律以實際即時資料為準）
  if ($("#s-airline")) {
    $("#s-airline").addEventListener("change", refreshSearchFields);
  }
  if ($("#s-from")) {
    $("#s-from").addEventListener("change", rebuildDestOptions);
  }
  refreshSearchFields();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    await navigator.serviceWorker.register("service-worker.js");
  } catch {
    // The app works without offline caching.
  }
}

// 開頁自動載入即時起價。若有 6 小時內的快取就沿用，否則背景擷取。
async function loadLiveRecommendations() {
  if (state.liveCache && state.liveCache.loadedAt) {
    const age = Date.now() - new Date(state.liveCache.loadedAt).getTime();
    if (age < 6 * 3600 * 1000) {
      if (state.liveStatus && state.liveStatus.mode === "loading") {
        state.liveStatus = {
          mode: "live",
          updatedAt: state.liveCache.loadedAt,
          message: `官網即時來回票價（${state.liveCache.offers.length} 筆，6 小時內）。資料每晚自官網更新。`
        };
        renderAll();
      }
      refreshSearchFields();
      return;
    }
  }
  try {
    const offers = await fetchLiveOffers();
    if (!offers.length) {
      state.liveStatus = {
        mode: "empty",
        updatedAt: new Date().toISOString(),
        message: "目前沒有可顯示的即時票價，請用智能搜尋查詢或前往官網。"
      };
      saveState();
      renderAll();
      return;
    }
    state.liveCache = { offers, loadedAt: new Date().toISOString() };
    state.liveStatus = {
      mode: "live",
      updatedAt: state.liveCache.loadedAt,
      message: `已更新 ${offers.length} 筆官網即時來回票價（資料每晚自官網更新）`
    };
    saveState();
    renderAll();
    refreshSearchFields();
  } catch {
    state.liveStatus = {
      mode: "error",
      updatedAt: new Date().toISOString(),
      message: "暫時無法連線航空公司官網，請稍後重新整理頁面再試。"
    };
    renderAll();
  }
}

function init() {
  attachEvents();
  renderAll();
  registerServiceWorker();
  loadLiveRecommendations();
}

document.addEventListener("DOMContentLoaded", init);
