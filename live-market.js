// live-market.js - live data bridge for the restored Phosphor design.
// Keeps the prototype's object shape, but refreshes it from the local API.
(function () {
  const M = window.MarketData;
  if (!M) return;

  const CORE_SYMBOLS = [
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "AMD", "ORCL",
    "CRM", "ADBE", "NFLX", "JPM", "BAC", "GS", "MS", "BLK", "V", "XOM",
    "CVX", "LLY", "JNJ", "UNH", "PG", "KO", "WMT", "CAT", "BA", "DIS",
  ];
  const MARKET_CONFIG = {
    US: { name: "United States", currency: "USD", symbols: CORE_SYMBOLS, defaultSymbol: "NVDA", indices: [["SPX", "SPY"], ["NDX", "QQQ"], ["DJI", "DIA"], ["RUT", "IWM"]] },
    INDIA: { name: "India", currency: "INR", symbols: ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "BHARTIARTL.NS", "SBIN.NS", "LT.NS", "ITC.NS", "MARUTI.NS", "NESTLEIND.NS", "TITAN.NS"], defaultSymbol: "RELIANCE.NS", indices: [["NIFTY", "^NSEI"], ["SENSEX", "^BSESN"]] },
    JAPAN: { name: "Japan", currency: "JPY", symbols: ["7203.T", "6758.T", "9984.T", "8306.T", "6861.T", "8035.T", "6098.T", "9432.T", "6501.T", "8058.T"], defaultSymbol: "7203.T", indices: [["N225", "^N225"], ["TOPX", "1306.T"]] },
    UK: { name: "United Kingdom", currency: "GBP", symbols: ["AZN.L", "SHEL.L", "HSBA.L", "ULVR.L", "BP.L", "GSK.L", "RIO.L", "DGE.L", "LSEG.L", "BARC.L"], defaultSymbol: "AZN.L", indices: [["FTSE", "^FTSE"], ["UKX", "ISF.L"]] },
    EUROPE: { name: "Europe", currency: "EUR/CHF", symbols: ["ASML.AS", "MC.PA", "SAP.DE", "SIE.DE", "AIR.PA", "OR.PA", "SAN.PA", "NESN.SW", "NOVN.SW", "ROG.SW"], defaultSymbol: "ASML.AS", indices: [["STOXX", "^STOXX50E"], ["DAX", "^GDAXI"], ["CAC", "^FCHI"]] },
    HONGKONG: { name: "Hong Kong / China", currency: "HKD/CNY", symbols: ["0700.HK", "9988.HK", "3690.HK", "0939.HK", "1299.HK", "1810.HK", "2318.HK", "9618.HK", "0005.HK", "0388.HK"], defaultSymbol: "0700.HK", indices: [["HSI", "^HSI"], ["HSCEI", "^HSCE"]] },
    CANADA: { name: "Canada", currency: "CAD", symbols: ["RY.TO", "TD.TO", "SHOP.TO", "ENB.TO", "CNR.TO", "BNS.TO", "BAM.TO", "CNQ.TO", "SU.TO", "TRI.TO"], defaultSymbol: "RY.TO", indices: [["TSX", "^GSPTSE"], ["XIU", "XIU.TO"]] },
    AUSTRALIA: { name: "Australia", currency: "AUD", symbols: ["BHP.AX", "CBA.AX", "CSL.AX", "NAB.AX", "WBC.AX", "ANZ.AX", "MQG.AX", "WES.AX", "WOW.AX", "RIO.AX"], defaultSymbol: "BHP.AX", indices: [["ASX", "^AXJO"], ["A200", "A200.AX"]] },
  };
  const INDEX_PROXY = {
    SPX: "SPY",
    NDX: "QQQ",
    DJI: "DIA",
    RUT: "IWM",
  };
  const SECTOR_MAP = {
    Technology: ["NVDA", "AAPL", "MSFT", "AVGO", "AMD", "ORCL", "CRM", "ADBE"],
    Financials: ["JPM", "BAC", "GS", "MS", "BLK", "V"],
    Healthcare: ["LLY", "JNJ", "UNH"],
    "Consumer Disc": ["AMZN", "TSLA"],
    Communication: ["GOOGL", "META", "NFLX", "DIS"],
    Industrials: ["CAT", "BA"],
    "Cons Staples": ["PG", "KO", "WMT"],
    Energy: ["XOM", "CVX"],
  };

  const state = {
    initialized: false,
    refreshing: false,
    market: "US",
    markets: Object.entries(MARKET_CONFIG).map(([id, cfg]) => ({ id, name: cfg.name, currency: cfg.currency, count: cfg.symbols.length })),
    marketUniverse: [],
    listeners: new Set(),
    universe: [],
    liveNews: {},
    providers: [],
    signals: [],
    researchSummary: null,
    backtest: null,
    portfolio: null,
    paperJournal: [],
    alerts: [],
    alertRules: [],
    portfolioRanking: [],
    sectorMap: [],
    liveVersion: 0,
    lastStatus: "BOOT",
  };

  function notify() {
    state.liveVersion += 1;
    for (const listener of state.listeners) {
      try { listener(state.liveVersion); } catch (_) {}
    }
  }

  async function api(path) {
    const response = await fetch(path, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.detail || payload.error || path);
    return payload;
  }

  async function postApi(path, body) {
    const response = await fetch(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.detail || payload.error || path);
    return payload;
  }

  function rng(symbol, salt) {
    const raw = Math.sin((M.hash(symbol + ":" + salt) || 1) * 12.9898) * 43758.5453;
    return raw - Math.floor(raw);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function ensureTicker(symbol) {
    const sym = String(symbol || "SPY").toUpperCase().replace("/", ".");
    const meta = [...state.marketUniverse, ...state.universe].find((item) => item.symbol === sym) || {};
    if (M.BY_SYM[sym]) {
      if (meta.name && M.BY_SYM[sym].name === sym) M.BY_SYM[sym].name = meta.name;
      if (meta.exchange) M.BY_SYM[sym].industry = meta.exchange;
      if (meta.market) M.BY_SYM[sym].market = meta.market;
      if (meta.currency) M.BY_SYM[sym].currency = meta.currency;
      return M.BY_SYM[sym];
    }

    const base = M.BY_SYM.SPY || M.TICKERS[0];
    const market = meta.market || state.market || "US";
    const price = market === "JAPAN" ? 800 + rng(sym, 1) * 9000 : market === "HONGKONG" ? 20 + rng(sym, 1) * 420 : 40 + rng(sym, 1) * 460;
    const clone = {
      ...base,
      sym,
      name: meta.name || sym,
      sector: meta.assetType === "ETF" ? "ETF" : market,
      industry: meta.exchange || "Listed",
      market,
      currency: meta.currency || MARKET_CONFIG[market]?.currency || "USD",
      price,
      prevClose: price,
      pctChg: 0,
      dayHigh: price * 1.01,
      dayLow: price * 0.99,
      yHigh: price * 1.18,
      yLow: price * 0.82,
      volume: 0,
      avgVol: 0,
      mcap: 0,
      pe: 0,
      fwdPe: 0,
      pb: 0,
      peg: 0,
      div: 0,
      beta: +(0.65 + rng(sym, 2) * 1.4).toFixed(2),
      shortPct: +(rng(sym, 3) * 12).toFixed(2),
      dtc: +(0.5 + rng(sym, 4) * 5).toFixed(2),
      eps: 0,
      factors: {
        value: Math.round(25 + rng(sym, 5) * 65),
        momentum: 50,
        quality: Math.round(25 + rng(sym, 6) * 65),
        lowVol: Math.round(25 + rng(sym, 7) * 65),
        growth: Math.round(25 + rng(sym, 8) * 65),
        size: Math.round(35 + rng(sym, 9) * 60),
      },
      composite: 50,
      history: cloneHistory(base.history || [], price),
      bids: [],
      asks: [],
    };
    buildBook(clone);
    M.BY_SYM[sym] = clone;
    if (!M.TICKERS.some((ticker) => ticker.sym === sym)) M.TICKERS.unshift(clone);
    rebuildSearchTickers();
    return clone;
  }

  function cloneHistory(source, price) {
    const rows = (source || []).slice(-252);
    if (!rows.length) {
      return Array.from({ length: 120 }, (_, i) => ({ o: price, h: price, l: price, c: price, v: 0 }));
    }
    const last = rows[rows.length - 1].c || price;
    const scale = price / last;
    return rows.map((row) => ({
      o: row.o * scale,
      h: row.h * scale,
      l: row.l * scale,
      c: row.c * scale,
      v: row.v,
    }));
  }

  function applyQuote(quote) {
    const t = ensureTicker(quote.symbol);
    const previous = quote.change != null && quote.close != null ? quote.close - quote.change : t.prevClose;
    t.price = numberOr(quote.close, t.price);
    t.prevClose = numberOr(previous, t.prevClose || t.price);
    t.pctChg = numberOr(quote.changePct, t.pctChg);
    t.dayHigh = numberOr(quote.high, t.dayHigh);
    t.dayLow = numberOr(quote.low, t.dayLow);
    t.volume = numberOr(quote.volume, t.volume);
    t.avgVol = t.avgVol ? Math.round((t.avgVol * 0.85) + (t.volume * 0.15)) : t.volume;
    t.beta = +(0.55 + rng(t.sym, 20) * 1.8).toFixed(2);
    t.eps = t.pe ? +(t.price / t.pe).toFixed(2) : t.eps;
    updateFactors(t);
    buildBook(t);
    return t;
  }

  function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function updateFactors(t) {
    const momentum = clamp(50 + t.pctChg * 8 + rng(t.sym, 30) * 16 - 8, 1, 99);
    const liquidity = clamp(Math.log10(Math.max(t.volume || 1, 1)) * 10, 1, 99);
    const lowVol = clamp(95 - Math.abs(t.pctChg || 0) * 9 + rng(t.sym, 31) * 10, 1, 99);
    t.factors = {
      ...t.factors,
      momentum: Math.round(momentum),
      lowVol: Math.round(lowVol),
      size: Math.round(liquidity),
    };
    t.composite = Math.round(Object.values(t.factors).reduce((sum, value) => sum + value, 0) / 6);
  }

  function buildBook(t) {
    const tick = t.price < 50 ? 0.01 : t.price < 500 ? 0.05 : 0.10;
    const bids = [];
    const asks = [];
    for (let i = 0; i < 15; i += 1) {
      const sizeBase = Math.max(100, Math.round((t.volume || 800000) / 8000));
      bids.push({ p: +(t.price - tick * (i + 1) - rng(t.sym, i + 40) * tick).toFixed(2), sz: Math.round(sizeBase * (0.35 + rng(t.sym, i + 60) * 3)) * 100 });
      asks.push({ p: +(t.price + tick * (i + 1) + rng(t.sym, i + 80) * tick).toFixed(2), sz: Math.round(sizeBase * (0.35 + rng(t.sym, i + 100) * 3)) * 100 });
    }
    t.bids = bids;
    t.asks = asks;
  }

  function applyHistory(symbol, items, rangeName, interval) {
    const t = ensureTicker(symbol);
    const rows = (items || []).filter((row) => Number.isFinite(row.close)).map((row) => ({
      o: numberOr(row.open, row.close),
      h: numberOr(row.high, row.close),
      l: numberOr(row.low, row.close),
      c: numberOr(row.close, t.price),
      v: numberOr(row.volume, 0),
      date: row.date,
      time: row.time,
      datetime: row.datetime,
    }));
    if (rows.length) {
      t.history = rows;
      t.historyRange = String(rangeName || "").toUpperCase();
      t.historyInterval = interval || "";
      t.historyByRange = { ...(t.historyByRange || {}), [t.historyRange]: rows };
      if (t.historyRange === "1Y" || rows.length >= 200) t.longHistory = rows;
      const highs = rows.map((row) => row.h);
      const lows = rows.map((row) => row.l);
      t.yHigh = Math.max(...highs);
      t.yLow = Math.min(...lows);
      t.price = rows[rows.length - 1].c;
      if (rows.length > 2) {
        t.prevClose = rows[rows.length - 2].c;
        t.pctChg = ((t.price - t.prevClose) / t.prevClose) * 100;
      }
      t.dayHigh = rows[rows.length - 1].h;
      t.dayLow = rows[rows.length - 1].l;
      t.volume = rows[rows.length - 1].v;
      t.avgVol = Math.round(rows.slice(-21).reduce((sum, row) => sum + row.v, 0) / Math.max(1, Math.min(21, rows.length)));
      updateFactors(t);
      buildBook(t);
    }
  }

  function updateIndices() {
    const cfg = MARKET_CONFIG[state.market] || MARKET_CONFIG.US;
    if (state.market !== "US") {
      cfg.indices.forEach(([label, symbol], i) => {
        const ticker = M.BY_SYM[symbol];
        if (M.INDICES[i]) {
          M.INDICES[i][0] = label;
          M.INDICES[i][1] = MARKET_CONFIG[state.market].name;
          M.INDICES[i][2] = ticker ? ticker.price : M.INDICES[i][2];
          M.INDICES[i][3] = ticker ? ticker.pctChg : M.INDICES[i][3];
        }
      });
      for (let i = cfg.indices.length; i < M.INDICES.length; i += 1) {
        const ticker = M.MARKET_TICKERS[(i - cfg.indices.length) % Math.max(1, M.MARKET_TICKERS.length)];
        if (ticker) {
          M.INDICES[i][0] = ticker.sym.replace(/\..+$/, "").slice(0, 6);
          M.INDICES[i][1] = ticker.name;
          M.INDICES[i][2] = ticker.price;
          M.INDICES[i][3] = ticker.pctChg;
        }
      }
      return;
    }
    for (const index of M.INDICES) {
      const proxy = INDEX_PROXY[index[0]];
      if (proxy && M.BY_SYM[proxy]) {
        index[2] = M.BY_SYM[proxy].price;
        index[3] = M.BY_SYM[proxy].pctChg;
      }
    }
  }

  function updateSectors() {
    if (state.sectorMap.length) {
      state.sectorMap.slice(0, M.SECTORS.length).forEach((row, i) => {
        M.SECTORS[i][0] = row.name;
        M.SECTORS[i][1] = row.weight;
        M.SECTORS[i][2] = row.performance;
      });
      return;
    }
    if (state.market !== "US") {
      const tickers = M.MARKET_TICKERS || [];
      for (let i = 0; i < M.SECTORS.length; i += 1) {
        const group = tickers.filter((_, idx) => idx % M.SECTORS.length === i);
        const moves = group.map((ticker) => ticker.pctChg).filter((value) => Number.isFinite(value));
        M.SECTORS[i][0] = group[0]?.industry || group[0]?.sector || M.SECTORS[i][0];
        M.SECTORS[i][1] = group.length ? +(100 / Math.max(1, tickers.length) * group.length).toFixed(1) : M.SECTORS[i][1];
        if (moves.length) M.SECTORS[i][2] = +(moves.reduce((sum, value) => sum + value, 0) / moves.length).toFixed(2);
      }
      return;
    }
    for (const sector of M.SECTORS) {
      const symbols = SECTOR_MAP[sector[0]] || [];
      const moves = symbols.map((sym) => M.BY_SYM[sym]?.pctChg).filter((value) => Number.isFinite(value));
      if (moves.length) sector[2] = +(moves.reduce((sum, value) => sum + value, 0) / moves.length).toFixed(2);
    }
  }

  function updatePortfolio() {
    for (const p of M.PORTFOLIO) {
      const t = M.BY_SYM[p.sym];
      if (!t) continue;
      p.last = t.price;
      p.mv = p.qty * p.last;
      p.pnl = (p.last - p.avg) * p.qty;
      p.pct = ((p.last - p.avg) / p.avg) * 100 * (p.qty < 0 ? -1 : 1);
    }
  }

  function updateTradeIdeas() {
    const signalIdeas = state.signals.slice(0, 24).map((signal) => {
        const longBias = signal.action === "LONG_CANDIDATE" || signal.action === "WATCH";
        const price = signal.price || M.BY_SYM[signal.symbol]?.price || 0;
        const conf = Math.round(signal.confidence || signal.score || 50);
        return {
          side: longBias ? "LONG" : "SHORT",
          sym: signal.symbol,
          conf,
          thesis: `${signal.action} · score ${Number(signal.score || 0).toFixed(1)} · ${(signal.reasons || ["signal trust"])[0]}`,
          tp: Math.round(price * (longBias ? 1.08 : 0.94) * 100) / 100,
          sl: Math.round(price * (longBias ? 0.96 : 1.04) * 100) / 100,
          rr: +(1.1 + conf / 80).toFixed(1),
          trust: signal,
        };
      });
    const ranked = (M.MARKET_TICKERS || M.TICKERS).slice(0, 160).map((t) => {
      const longBias = t.composite >= 55;
      const side = longBias ? "LONG" : "SHORT";
      const conf = Math.round(clamp(longBias ? t.composite : 100 - t.composite, 45, 96));
      const move = Math.abs(t.pctChg || 0);
      const tp = longBias ? t.price * (1 + (0.05 + move / 100)) : t.price * (1 - (0.045 + move / 100));
      const sl = longBias ? t.price * (1 - 0.035) : t.price * (1 + 0.035);
      return {
        side,
        sym: t.sym,
        conf,
        thesis: `${t.factors.momentum >= 60 ? "Momentum" : "Mean reversion"} + live tape + ${t.sector}`,
        tp: Math.round(tp * 100) / 100,
        sl: Math.round(sl * 100) / 100,
        rr: +(1.2 + conf / 70).toFixed(1),
      };
    }).sort((a, b) => b.conf - a.conf);
    const seen = new Set();
    const ideas = [...signalIdeas, ...ranked].filter((idea) => {
      if (!idea.sym || seen.has(idea.sym)) return false;
      seen.add(idea.sym);
      return true;
    }).slice(0, 36);
    M.TRADE_IDEAS.splice(0, M.TRADE_IDEAS.length, ...ideas);
  }

  function newsTopicKey(symbol, tab) {
    const sym = String(symbol || "market").toUpperCase();
    if (tab === "MKT") return `${state.market}:MKT`;
    if (tab === "EARN") return `${sym}:EARN`;
    if (tab === "M&A") return `${sym}:MA`;
    return sym;
  }

  function setNews(symbol, payload) {
    const now = Date.now();
    const key = String(symbol || "market").toUpperCase();
    state.liveNews[key] = (payload.items || []).map((item) => {
      const published = item.published ? Date.parse(item.published) : now;
      const minsAgo = Number.isFinite(published) ? Math.max(1, Math.round((now - published) / 60000)) : 1;
      return {
        head: item.title,
        src: item.source || "Google News",
        minsAgo,
        link: item.link,
        sentiment: item.sentiment,
      };
    });
  }

  async function refreshNews(symbol) {
    const sym = String(symbol || "market").toUpperCase();
    const cfg = MARKET_CONFIG[state.market] || MARKET_CONFIG.US;
    const marketQuery = `${cfg.name || state.market} stock market`;
    const topics = [
      [newsTopicKey(sym, "SYM"), sym === "MARKET" ? "stock market" : `${sym} stock`],
      [newsTopicKey(sym, "MKT"), marketQuery],
      [newsTopicKey(sym, "EARN"), `${sym} earnings results guidance`],
      [newsTopicKey(sym, "M&A"), `${sym} merger acquisition activist strategic review`],
    ];
    await Promise.allSettled(topics.map(([key, query]) => (
      api(`/api/news?query=${encodeURIComponent(query)}&limit=14`).then((payload) => setNews(key, payload))
    )));
  }

  async function refreshQuotes(symbols) {
    const unique = [...new Set(symbols.filter(Boolean).map((sym) => String(sym).toUpperCase()))];
    if (!unique.length) return;
    const payload = await api(`/api/quote?symbols=${encodeURIComponent(unique.join(","))}`);
    for (const quote of payload.items || []) applyQuote(quote);
    updateDerived();
  }

  async function refreshHistory(symbol, range) {
    const payload = await api(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range || "1y"}`);
    applyHistory(symbol, payload.items || [], payload.range || range, payload.interval);
    updateDerived();
  }

})();
