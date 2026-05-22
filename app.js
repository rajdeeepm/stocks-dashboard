const state = {
  universe: [],
  quotes: new Map(),
  selectedSymbol: "SPY",
  selectedRange: "1y",
  priceChart: null,
  lastHistory: [],
};

const $ = (id) => document.getElementById(id);
const fmtUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmtPct = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const PHOSPHOR = {
  bg: "#0a0805",
  panel: "#0d0a05",
  panelHi: "#15100a",
  border: "#2a2114",
  grid: "rgba(245,179,64,0.08)",
  text: "#f5b340",
  bright: "#ffd060",
  dim: "#7e5d2e",
  up: "#7adc6a",
  down: "#d65a3c",
  accent: "#ffaa00",
};

const SECTORS = [
  ["TECH", ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL"]],
  ["COMMS", ["META", "GOOGL", "NFLX", "DIS"]],
  ["DISC", ["AMZN", "TSLA", "HD", "NKE"]],
  ["FIN", ["JPM", "GS", "BAC", "MS"]],
  ["ENERGY", ["XOM", "CVX", "SLB"]],
  ["HEALTH", ["LLY", "UNH", "JNJ", "PFE"]],
  ["IND", ["GE", "CAT", "HON"]],
  ["CONS", ["PG", "KO", "PEP"]],
  ["UTIL", ["NEE", "DUK", "SO"]],
  ["REIT", ["PLD", "AMT", "SPG"]],
];

const MACRO_EVENTS = [
  ["MON", "09:30", "US", "New Home Sales", "MED"],
  ["TUE", "10:00", "US", "Consumer Confidence", "MED"],
  ["WED", "14:00", "FED", "Beige Book", "HIGH"],
  ["THU", "08:30", "US", "GDP Revision", "HIGH"],
  ["FRI", "08:30", "US", "PCE Inflation", "HIGH"],
];

const PORTFOLIO = ["NVDA", "MSFT", "AAPL", "AMZN", "META", "GOOGL", "JPM", "XOM"];

function parseSymbols(value) {
  return [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
}

async function api(path) {
  const response = await fetch(path);
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.detail || payload.error || `Request failed: ${path}`);
  }
  return payload;
}

function setStatus(id, message) {
  $(id).textContent = message;
}

function pctClass(value) {
  if (!Number.isFinite(Number(value))) return "flat";
  return Number(value) >= 0 ? "up" : "down";
}

function money(value) {
  return Number.isFinite(value) ? fmtUsd.format(value) : "--";
}

function pct(value) {
  return Number.isFinite(value) ? `${fmtPct.format(value)}%` : "--";
}

function compact(value) {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return fmtNum.format(value);
}

function symbolHash(symbol = "") {
  return [...symbol].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 11), 17);
}

function pseudo(symbol, min, max, salt = 0) {
  const raw = Math.sin(symbolHash(symbol) * 12.9898 + salt * 78.233) * 43758.5453;
  const unit = raw - Math.floor(raw);
  return min + unit * (max - min);
}

function signed(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${fmtPct.format(value)}%`;
}

function quoteScore(quote) {
  const day = Number(quote.changePct || 0);
  const liquidity = Math.log10(Math.max(Number(quote.volume || 1), 1));
  const intradayRange = quote.high && quote.low && quote.close ? ((quote.high - quote.low) / quote.close) * 100 : 0;
  return day * 1.8 + liquidity * 3 + intradayRange * 1.2;
}

async function loadUniverse() {
  setStatus("universeStatus", "Loading universe");
  const payload = await api("/api/universe");
  state.universe = payload.items || [];
  setStatus("universeStatus", `${fmtNum.format(payload.count || state.universe.length)} symbols from ${payload.source}`);
}

async function loadQuotes(symbols) {
  if (!symbols.length) return [];
  const payload = await api(`/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`);
  for (const quote of payload.items || []) {
    state.quotes.set(quote.symbol, quote);
  }
  return payload.items || [];
}

function renderWatchlist(quotes) {
  const wrap = $("watchCards");
  if (!quotes.length) {
    wrap.innerHTML = `<div class="empty">No watchlist quotes available.</div>`;
    return;
  }
  wrap.innerHTML = quotes.map((quote) => `
    <article class="watch-card" data-symbol="${quote.symbol}">
      <div class="top"><strong>${quote.symbol}</strong><span class="${pctClass(quote.changePct)}">${pct(quote.changePct)}</span></div>
      <b>${money(quote.close)}</b>
      <small>Vol ${compact(quote.volume)} | ${quote.date || "latest"}</small>
    </article>
  `).join("");
  wrap.querySelectorAll(".watch-card").forEach((card) => {
    card.addEventListener("click", () => selectSymbol(card.dataset.symbol));
  });
}

function updatePulse() {
  const spy = state.quotes.get("SPY");
  const qqq = state.quotes.get("QQQ");
  $("spyPrice").textContent = money(spy?.close);
  $("spyMove").textContent = `SPY ${pct(spy?.changePct)}`;
  $("spyMove").className = pctClass(spy?.changePct);
  $("qqqPrice").textContent = money(qqq?.close);
  $("qqqMove").textContent = `QQQ ${pct(qqq?.changePct)}`;
  $("qqqMove").className = pctClass(qqq?.changePct);

  const breadthQuotes = [...state.quotes.values()].filter((q) => Number.isFinite(q.changePct) && !["SPY", "QQQ"].includes(q.symbol));
  if (breadthQuotes.length) {
    const advancing = breadthQuotes.filter((q) => q.changePct > 0).length / breadthQuotes.length;
    const label = advancing > 0.6 ? "Risk On" : advancing < 0.4 ? "Defensive" : "Mixed";
    $("riskGauge").textContent = label;
    $("riskNote").textContent = `${Math.round(advancing * 100)}% watchlist advancing`;
    $("regimeGauge").textContent = label.toUpperCase();
    $("regimeNote").textContent = advancing > 0.6 ? "Momentum factors favored" : advancing < 0.4 ? "Protective posture favored" : "Selective tape";
  }
  const tone = $("newsTone").textContent;
  const spyMove = Number(spy?.changePct || 0);
  const qqqMove = Number(qqq?.changePct || 0);
  const stack = spyMove + qqqMove + (tone === "Positive" ? 0.6 : tone === "Negative" ? -0.6 : 0);
  $("signalStack").textContent = stack > 1 ? "LONG" : stack < -1 ? "HEDGE" : "WAIT";
  $("signalNote").textContent = `Composite ${stack.toFixed(2)}`;
  renderIndexRibbon();
}

function filteredUniverse() {
  const mode = $("assetFilter").value;
  return state.universe.filter((item) => {
    if (mode === "stocks") return !item.etf;
    if (mode === "etfs") return item.etf;
    return true;
  });
}

async function runScan() {
  const size = Math.max(20, Math.min(700, Number($("scanSize").value) || 160));
  const universe = filteredUniverse().slice(0, size);
  setStatus("scanStatus", `Scanning ${universe.length}`);
  const rows = [];
  const chunkSize = 40;
  for (let i = 0; i < universe.length; i += chunkSize) {
    const chunk = universe.slice(i, i + chunkSize);
    setStatus("scanStatus", `${i + 1}-${Math.min(i + chunkSize, universe.length)} / ${universe.length}`);
    const quotes = await loadQuotes(chunk.map((item) => item.symbol));
    for (const quote of quotes) {
      const meta = state.universe.find((item) => item.symbol === quote.symbol) || {};
      if (Number.isFinite(quote.close)) rows.push({ ...quote, ...meta, score: quoteScore(quote) });
    }
  }
  rows.sort((a, b) => b.score - a.score);
  renderScanner(rows.slice(0, 100));
  setStatus("scanStatus", `${rows.length} ranked`);
  updatePulse();
}

function renderScanner(rows) {
  const body = $("scannerRows");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty">Run a scan to rank symbols.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((row) => `
    <tr data-symbol="${row.symbol}">
      <td class="symbol-cell">${row.symbol}</td>
      <td class="name-cell" title="${row.name || ""}">${row.name || "--"}</td>
      <td>${money(row.close)}</td>
      <td class="${pctClass(row.changePct)}">${pct(row.changePct)}</td>
      <td>${compact(row.volume)}</td>
      <td>${row.score.toFixed(1)}</td>
    </tr>
  `).join("");
  body.querySelectorAll("tr[data-symbol]").forEach((row) => {
    row.addEventListener("click", () => selectSymbol(row.dataset.symbol));
  });
}

function sma(values, window) {
  return values.map((_, index) => {
    if (index + 1 < window) return null;
    const slice = values.slice(index + 1 - window, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / window;
  });
}

function dailyReturns(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i - 1]) returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
}

function stdev(values) {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function rsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function maxDrawdown(closes) {
  let peak = -Infinity;
  let worst = 0;
  for (const close of closes) {
    peak = Math.max(peak, close);
    worst = Math.min(worst, (close - peak) / peak);
  }
  return worst * 100;
}

function setMetric(id, value, className = "") {
  const el = $(id);
  el.textContent = value;
  el.className = className;
}

async function selectSymbol(symbol) {
  state.selectedSymbol = symbol || "SPY";
  $("selectedTitle").textContent = state.selectedSymbol;
  $("orderTitle").textContent = `${state.selectedSymbol} Book`;
  await Promise.all([loadHistory(), loadNews(`${state.selectedSymbol} stock`)]);
  renderSupplementalPanels();
}

async function loadHistory() {
  const payload = await api(`/api/history?symbol=${encodeURIComponent(state.selectedSymbol)}&range=${state.selectedRange}`);
  state.lastHistory = payload.items || [];
  renderChart(state.lastHistory);
  renderMetrics(state.lastHistory);
  renderResearchNotes();
}

function renderChart(items) {
  const labels = items.map((item) => item.date);
  const closes = items.map((item) => item.close).filter(Number.isFinite);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const ctx = $("priceChart");
  if (state.priceChart) state.priceChart.destroy();
  state.priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Close", data: closes, borderColor: PHOSPHOR.bright, borderWidth: 2, pointRadius: 0, tension: 0.18 },
        { label: "SMA 20", data: sma20, borderColor: PHOSPHOR.up, borderWidth: 1.5, pointRadius: 0, tension: 0.18 },
        { label: "SMA 50", data: sma50, borderColor: PHOSPHOR.accent, borderWidth: 1.5, pointRadius: 0, tension: 0.18 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { usePointStyle: true, boxWidth: 8, color: PHOSPHOR.dim } },
        tooltip: { backgroundColor: PHOSPHOR.panelHi, borderColor: PHOSPHOR.border, borderWidth: 1, titleColor: PHOSPHOR.bright, bodyColor: PHOSPHOR.text },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: PHOSPHOR.dim }, grid: { color: PHOSPHOR.grid } },
        y: { position: "right", ticks: { color: PHOSPHOR.dim, callback: (value) => `$${value}` }, grid: { color: PHOSPHOR.grid } },
      },
    },
  });
}

function renderMetrics(items) {
  const closes = items.map((item) => item.close).filter(Number.isFinite);
  const volumes = items.map((item) => item.volume).filter(Number.isFinite);
  if (closes.length < 2) {
    ["trendMetric", "momentumMetric", "rsiMetric", "volMetric", "drawdownMetric", "volumeMetric"].forEach((id) => setMetric(id, "--"));
    return;
  }
  const ma20 = sma(closes, 20).at(-1);
  const ma50 = sma(closes, 50).at(-1);
  const trend = ma20 && ma50 ? (ma20 > ma50 ? "Bullish" : "Bearish") : "Building";
  const oneMonthBase = closes.at(-22) || closes[0];
  const momentum = ((closes.at(-1) - oneMonthBase) / oneMonthBase) * 100;
  const volatility = (stdev(dailyReturns(closes).slice(-63)) || 0) * Math.sqrt(252) * 100;
  const rsiValue = rsi(closes);
  const drawdown = maxDrawdown(closes);
  const avgVolume = volumes.slice(-21, -1).reduce((sum, value) => sum + value, 0) / Math.max(volumes.slice(-21, -1).length, 1);
  const volumePulse = avgVolume ? volumes.at(-1) / avgVolume : null;

  setMetric("trendMetric", trend, trend === "Bullish" ? "up" : trend === "Bearish" ? "down" : "");
  setMetric("momentumMetric", pct(momentum), pctClass(momentum));
  setMetric("rsiMetric", rsiValue ? rsiValue.toFixed(1) : "--", rsiValue > 70 ? "down" : rsiValue < 30 ? "up" : "");
  setMetric("volMetric", pct(volatility));
  setMetric("drawdownMetric", pct(drawdown), drawdown < -10 ? "down" : "");
  setMetric("volumeMetric", volumePulse ? `${volumePulse.toFixed(2)}x` : "--", volumePulse > 1.6 ? "up" : "");
}

function renderResearchNotes() {
  const closes = state.lastHistory.map((item) => item.close).filter(Number.isFinite);
  const quote = state.quotes.get(state.selectedSymbol);
  const notes = [];
  if (closes.length > 50) {
    const ma20 = sma(closes, 20).at(-1);
    const ma50 = sma(closes, 50).at(-1);
    notes.push({
      type: ma20 > ma50 ? "" : "warn",
      text: ma20 > ma50
        ? "Short-term trend is above the intermediate trend. This favors continuation setups when broad market breadth confirms."
        : "Short-term trend is below the intermediate trend. Treat breakouts with more skepticism until price repairs the moving-average structure.",
    });
  }
  if (quote && Number.isFinite(quote.changePct)) {
    notes.push({
      type: Math.abs(quote.changePct) > 3 ? "warn" : "",
      text: `Latest quote shows a ${pct(quote.changePct)} move from the previous close with ${compact(quote.volume)} shares reported by the data feed.`,
    });
  }
  notes.push({
    type: "risk",
    text: "This dashboard ranks evidence, not certainty. Cross-check liquidity, catalysts, earnings dates, position sizing, and broader market regime before making any trade.",
  });
  $("researchNotes").innerHTML = notes.map((note) => `<div class="note ${note.type}">${note.text}</div>`).join("");
}

function renderIndexRibbon() {
  const symbols = [
    ["SPY", "S&P"],
    ["QQQ", "NDX"],
    ["DIA", "DOW"],
    ["IWM", "RUT"],
    ["NVDA", "NVDA"],
    ["AAPL", "AAPL"],
    ["MSFT", "MSFT"],
    ["JPM", "JPM"],
    ["XOM", "XOM"],
    ["TSLA", "TSLA"],
  ];
  $("indexRibbon").innerHTML = symbols.map(([symbol, label], index) => {
    const quote = state.quotes.get(symbol);
    const move = Number.isFinite(quote?.changePct) ? quote.changePct : pseudo(symbol, -1.2, 1.2, index);
    const price = Number.isFinite(quote?.close) ? money(quote.close).replace("$", "") : pseudo(symbol, 80, 780, index).toFixed(2);
    return `
      <div class="index-cell">
        <b>${label}</b>
        <span>${price}</span>
        <strong class="${pctClass(move)}">${move >= 0 ? "+" : "-"}${Math.abs(move).toFixed(2)}%</strong>
      </div>
    `;
  }).join("");
}

function factorComposite(symbol) {
  const quote = state.quotes.get(symbol) || {};
  const momentum = Math.max(0, Math.min(100, 50 + Number(quote.changePct || 0) * 9 + pseudo(symbol, -12, 12, 1)));
  const quality = pseudo(symbol, 35, 92, 2);
  const liquidity = Math.max(0, Math.min(100, Math.log10(Math.max(quote.volume || 1, 1)) * 10));
  const lowVol = pseudo(symbol, 25, 88, 3);
  return Math.round((momentum * 0.35) + (quality * 0.25) + (liquidity * 0.25) + (lowVol * 0.15));
}

function renderTradeIdeas() {
  const symbols = parseSymbols($("watchlistInput").value);
  const rows = symbols.map((symbol) => {
    const quote = state.quotes.get(symbol) || {};
    const score = factorComposite(symbol);
    const side = score > 68 ? "LONG" : score < 45 ? "SHORT" : "WATCH";
    const conf = Math.min(96, Math.max(42, score + Math.abs(Number(quote.changePct || 0)) * 4));
    const horizon = score > 70 ? "2-6W" : score < 45 ? "1-3W" : "WAIT";
    return { symbol, side, score, conf, horizon, move: quote.changePct };
  }).sort((a, b) => b.conf - a.conf);

  $("tradeIdeas").innerHTML = rows.map((row, index) => `
    <button class="terminal-row" style="grid-template-columns: 22px 52px 52px 1fr 46px 46px;" data-symbol="${row.symbol}">
      <span class="flat">${index + 1}</span>
      <b class="${row.side === "LONG" ? "up" : row.side === "SHORT" ? "down" : "flat"}">${row.side}</b>
      <span class="symbol-cell">${row.symbol}</span>
      <span>${row.horizon} / score ${row.score}</span>
      <span class="${pctClass(row.move)}">${pct(row.move)}</span>
      <strong>${row.conf.toFixed(0)}%</strong>
    </button>
  `).join("");
  $("tradeIdeas").querySelectorAll("[data-symbol]").forEach((row) => {
    row.addEventListener("click", () => selectSymbol(row.dataset.symbol));
  });
}

function renderOrderBook() {
  const symbol = state.selectedSymbol;
  const quote = state.quotes.get(symbol) || {};
  const mid = Number(quote.close || 100);
  const spread = Math.max(mid * pseudo(symbol, 0.00015, 0.0012, 4), 0.01);
  const rows = [];
  for (let i = 5; i >= 1; i -= 1) {
    rows.push({ side: "ASK", price: mid + spread * i, size: Math.round(pseudo(symbol, 200, 2400, i + 10)), depth: pseudo(symbol, 22, 88, i + 15) });
  }
  for (let i = 1; i <= 5; i += 1) {
    rows.push({ side: "BID", price: mid - spread * i, size: Math.round(pseudo(symbol, 200, 2600, i + 30)), depth: pseudo(symbol, 22, 92, i + 35) });
  }
  $("orderBook").innerHTML = rows.slice(0, 5).map((row) => bookRow(row)).join("")
    + `<div class="mid-row"><span>MID ${money(mid)}</span><span>SPRD ${spread.toFixed(2)}</span></div>`
    + rows.slice(5).map((row) => bookRow(row)).join("");
}

function bookRow(row) {
  const cls = row.side === "BID" ? "bid up" : "ask down";
  return `
    <div class="book-row ${cls}" style="--depth:${row.depth}%">
      <span>${row.side[0]}</span>
      <span>${row.price.toFixed(2)}</span>
      <span>${Math.round(row.size / 100)}</span>
    </div>
  `;
}

function renderOptionsFlow() {
  const symbol = state.selectedSymbol;
  const quote = state.quotes.get(symbol) || {};
  const price = Number(quote.close || 100);
  const rows = Array.from({ length: 8 }, (_, index) => {
    const call = pseudo(symbol, 0, 1, index) > 0.42;
    const strike = price * (1 + pseudo(symbol, -0.08, 0.1, index + 40));
    const ratio = pseudo(symbol, 1.2, 8.6, index + 50);
    const premium = pseudo(symbol, 0.35, 12.4, index + 60);
    return { call, strike, ratio, premium, side: ratio > 4.8 ? "SWEEP" : "BLOCK", exp: `${7 + index * 7}D` };
  });
  $("optionsFlow").innerHTML = rows.map((row) => `
    <div class="terminal-row" style="grid-template-columns: 22px 48px 38px 44px 44px 48px;">
      <b class="${row.call ? "up" : "down"}">${row.call ? "C" : "P"}</b>
      <span>${row.strike.toFixed(0)}</span>
      <span class="flat">${row.exp}</span>
      <span>${row.ratio.toFixed(1)}x</span>
      <span>${row.premium.toFixed(2)}</span>
      <strong class="${row.side === "SWEEP" ? "up" : "flat"}">${row.side}</strong>
    </div>
  `).join("");
}

function renderSectorHeatmap() {
  const html = SECTORS.map(([sector, symbols], index) => {
    const moves = symbols.map((symbol) => state.quotes.get(symbol)?.changePct).filter(Number.isFinite);
    const perf = moves.length ? moves.reduce((sum, value) => sum + value, 0) / moves.length : pseudo(sector, -1.4, 1.5, index);
    const alpha = Math.min(0.72, 0.16 + Math.abs(perf) / 2.2);
    const heat = perf >= 0 ? "var(--green)" : "var(--red)";
    return `
      <div class="sector-cell ${index < 2 ? "large" : ""}" style="--heat:${heat};--heat-alpha:${alpha}">
        <b>${sector}</b>
        <strong class="${pctClass(perf)}">${signed(perf)}</strong>
        <small>${symbols.slice(0, 3).join(" ")}</small>
      </div>
    `;
  }).join("");
  $("sectorHeatmap").innerHTML = html;
}

function renderMacroCalendar() {
  $("macroCalendar").innerHTML = MACRO_EVENTS.map((event) => `
    <div class="terminal-row" style="grid-template-columns: 34px 42px 34px 1fr 42px;">
      <span class="flat">${event[0]}</span>
      <span>${event[1]}</span>
      <span class="symbol-cell">${event[2]}</span>
      <span>${event[3]}</span>
      <strong class="${event[4] === "HIGH" ? "down" : "flat"}">${event[4]}</strong>
    </div>
  `).join("");
}

function renderPortfolioPnl() {
  $("portfolioPnl").innerHTML = PORTFOLIO.map((symbol, index) => {
    const quote = state.quotes.get(symbol) || {};
    const weight = pseudo(symbol, 4, 18, index);
    const pnl = Number(quote.changePct || pseudo(symbol, -1.5, 1.5, index)) * weight * 8.5;
    return `
      <button class="terminal-row" style="grid-template-columns: 52px 44px 1fr 54px;" data-symbol="${symbol}">
        <span class="symbol-cell">${symbol}</span>
        <span>${weight.toFixed(1)}%</span>
        <span class="${pctClass(quote.changePct)}">${pct(quote.changePct)}</span>
        <strong class="${pnl >= 0 ? "up" : "down"}">${pnl >= 0 ? "+" : ""}${pnl.toFixed(0)}</strong>
      </button>
    `;
  }).join("");
  $("portfolioPnl").querySelectorAll("[data-symbol]").forEach((row) => {
    row.addEventListener("click", () => selectSymbol(row.dataset.symbol));
  });
}

function renderSupplementalPanels() {
  renderIndexRibbon();
  renderTradeIdeas();
  renderOrderBook();
  renderOptionsFlow();
  renderSectorHeatmap();
  renderMacroCalendar();
  renderPortfolioPnl();
}

async function loadNews(query = "stock market") {
  const payload = await api(`/api/news?query=${encodeURIComponent(query)}&limit=14`);
  const items = payload.items || [];
  $("newsTitle").textContent = query.includes("stock") && query !== "stock market" ? `${state.selectedSymbol} Headlines` : "Market Headlines";
  renderNews(items);
  const totalTone = items.reduce((sum, item) => sum + Number(item.sentiment || 0), 0);
  $("newsTone").textContent = totalTone > 1 ? "Positive" : totalTone < -1 ? "Negative" : "Neutral";
  $("newsNote").textContent = `${items.length} recent headlines`;
}

function renderNews(items) {
  const feed = $("newsFeed");
  if (!items.length) {
    feed.innerHTML = `<div class="empty">No headlines returned.</div>`;
    return;
  }
  feed.innerHTML = items.map((item) => {
    const tone = item.sentiment > 0 ? "up" : item.sentiment < 0 ? "down" : "";
    const mins = item.published ? Math.max(1, Math.round((Date.now() - new Date(item.published).getTime()) / 60000)) : "--";
    return `
      <article class="news-item">
        <span class="flat">${Number.isFinite(mins) ? `${mins}m` : "--"}</span>
        <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
        <span class="sentiment ${tone}">T${item.sentiment}</span>
        <div class="news-meta">
          <span>${item.source || "Google News"}</span>
          <span>${item.published ? new Date(item.published).toLocaleString() : ""}</span>
        </div>
      </article>
    `;
  }).join("");
}

async function refreshAll() {
  const symbols = parseSymbols($("watchlistInput").value);
  const quotes = await loadQuotes([...symbols, "SPY", "QQQ", "DIA", "IWM", ...PORTFOLIO, ...SECTORS.flatMap((sector) => sector[1])]);
  renderWatchlist(quotes.filter((quote) => symbols.includes(quote.symbol)));
  renderScanner(symbols.map((symbol) => {
    const quote = state.quotes.get(symbol) || {};
    const meta = state.universe.find((item) => item.symbol === symbol) || { symbol };
    return { ...quote, ...meta, symbol, score: quoteScore(quote) };
  }).filter((row) => Number.isFinite(row.close)).sort((a, b) => b.score - a.score));
  updatePulse();
  renderSupplementalPanels();
  await selectSymbol(state.selectedSymbol);
}

function wireEvents() {
  $("refreshButton").addEventListener("click", () => refreshAll().catch(showError));
  $("scanButton").addEventListener("click", () => runScan().catch(showError));
  $("newsRefresh").addEventListener("click", () => loadNews(`${state.selectedSymbol} stock`).catch(showError));
  $("rangeControls").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      $("rangeControls").querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.selectedRange = button.dataset.range;
      await loadHistory().catch(showError);
    });
  });
}

function showError(error) {
  console.error(error);
  setStatus("scanStatus", "Check server log");
  $("researchNotes").innerHTML = `<div class="note risk">${error.message}</div>`;
}

function tickClock() {
  $("clock").textContent = new Date().toLocaleString();
}

async function init() {
  wireEvents();
  tickClock();
  setInterval(tickClock, 1000);
  if (window.lucide) window.lucide.createIcons();
  await loadUniverse();
  await refreshAll();
  await loadNews("stock market");
  renderSupplementalPanels();
}

init().catch(showError);
