// data.js — deterministic simulated market data
// Built around a small PRNG so every render is identical, but data looks alive.

(function () {
  const PRNG = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // Universe — diversified across sectors
  const UNIVERSE = [
    // Tech mega
    ['NVDA', 'NVIDIA Corp',            'Technology',      'Semiconductors',     950.42, 2.34e12],
    ['AAPL', 'Apple Inc',              'Technology',      'Consumer Hardware',  214.18, 3.28e12],
    ['MSFT', 'Microsoft Corp',         'Technology',      'Software',           432.07, 3.21e12],
    ['GOOGL','Alphabet Inc Cl A',      'Communication',   'Internet',           172.85, 2.14e12],
    ['AMZN', 'Amazon.com Inc',         'Consumer Disc',   'E-Commerce',         186.50, 1.94e12],
    ['META', 'Meta Platforms',         'Communication',   'Social Media',       506.32, 1.28e12],
    ['TSLA', 'Tesla Inc',              'Consumer Disc',   'Auto Mfg',           238.84, 759e9],
    ['AVGO', 'Broadcom Inc',           'Technology',      'Semiconductors',     1612.50,752e9],
    ['AMD',  'Adv Micro Devices',      'Technology',      'Semiconductors',     162.24, 262e9],
    ['ORCL', 'Oracle Corp',            'Technology',      'Software',           142.16, 391e9],
    ['CRM',  'Salesforce Inc',         'Technology',      'Software',           267.43, 259e9],
    ['ADBE', 'Adobe Inc',              'Technology',      'Software',           526.81, 234e9],
    ['NFLX', 'Netflix Inc',            'Communication',   'Media',              672.18, 290e9],
    // Financials
    ['JPM',  'JPMorgan Chase',         'Financials',      'Banks',              210.34, 604e9],
    ['BAC',  'Bank of America',        'Financials',      'Banks',              42.18,  327e9],
    ['GS',   'Goldman Sachs',          'Financials',      'Inv Banking',        494.07, 161e9],
    ['MS',   'Morgan Stanley',         'Financials',      'Inv Banking',        102.43, 167e9],
    ['BLK',  'BlackRock Inc',          'Financials',      'Asset Mgmt',         842.18, 125e9],
    ['V',    'Visa Inc',               'Financials',      'Payments',           281.27, 542e9],
    // Energy / Materials
    ['XOM',  'Exxon Mobil',            'Energy',          'Integrated Oil',     115.43, 510e9],
    ['CVX',  'Chevron Corp',           'Energy',          'Integrated Oil',     157.91, 290e9],
    // Healthcare
    ['LLY',  'Eli Lilly & Co',         'Healthcare',      'Pharma',             786.23, 745e9],
    ['JNJ',  'Johnson & Johnson',      'Healthcare',      'Pharma',             148.05, 357e9],
    ['UNH',  'UnitedHealth Group',     'Healthcare',      'Managed Care',       512.45, 472e9],
    // Consumer Staples
    ['PG',   'Procter & Gamble',       'Cons Staples',    'Household Prod',     169.84, 400e9],
    ['KO',   'Coca-Cola Co',           'Cons Staples',    'Beverages',          63.71,  274e9],
    ['WMT',  'Walmart Inc',            'Cons Staples',    'Retail',             68.42,  551e9],
    // Industrials / Misc
    ['CAT',  'Caterpillar Inc',        'Industrials',     'Machinery',          347.12, 169e9],
    ['BA',   'Boeing Co',              'Industrials',     'Aerospace',          185.34, 113e9],
    ['DIS',  'Walt Disney Co',         'Communication',   'Entertainment',      102.18, 186e9],
  ];

  // Index ribbon
  const INDICES = [
    ['SPX',   'S&P 500',          5478.32,  +0.34],
    ['NDX',   'Nasdaq 100',       19682.50, +0.62],
    ['DJI',   'Dow Jones',        39124.18, -0.12],
    ['RUT',   'Russell 2000',     2032.84,  -0.41],
    ['VIX',   'CBOE Volatility',  13.42,    -2.18],
    ['DXY',   'Dollar Index',     105.84,   +0.08],
    ['US10Y', 'US 10Y Yield',     4.265,    +0.024],
    ['GOLD',  'Gold Spot',        2338.20,  +0.42],
    ['WTI',   'WTI Crude',        81.74,    +1.07],
    ['BTC',   'Bitcoin',          64842,    -1.84],
  ];

  // Sectors with weights/perf
  const SECTORS = [
    ['Technology',     32.4, +0.84],
    ['Financials',     13.2, -0.14],
    ['Healthcare',     12.8, +0.31],
    ['Consumer Disc',  10.4, +0.42],
    ['Communication',  9.1,  +0.67],
    ['Industrials',    8.2,  -0.21],
    ['Cons Staples',   5.8,  +0.08],
    ['Energy',         4.2,  -1.32],
    ['Utilities',      2.4,  +0.18],
    ['Real Estate',    2.2,  -0.42],
    ['Materials',      2.3,  -0.84],
  ];

  // Generate per-ticker rich profile
  function tickerProfile(t) {
    const rng = PRNG(hash(t[0]));
    const [sym, name, sector, industry, price, mcap] = t;
    const r1 = rng(), r2 = rng(), r3 = rng();
    const pctChg = (rng() - 0.45) * 4.5; // daily %
    const prevClose = price / (1 + pctChg / 100);
    const dayHigh = price * (1 + rng() * 0.018);
    const dayLow  = price * (1 - rng() * 0.018);
    const yHigh   = price * (1 + 0.04 + rng() * 0.45);
    const yLow    = price * (1 - 0.08 - rng() * 0.30);
    const volume  = Math.round((5 + rng() * 80) * 1e6);
    const avgVol  = Math.round(volume * (0.7 + rng() * 0.7));
    const pe      = 8 + rng() * 60;
    const fwdPe   = pe * (0.75 + rng() * 0.35);
    const pb      = 1 + rng() * 18;
    const peg     = 0.4 + rng() * 3.2;
    const div     = rng() < 0.55 ? +(rng() * 4).toFixed(2) : 0;
    const beta    = 0.4 + rng() * 1.7;
    const shortPct = +(rng() * 14).toFixed(2);
    const dtc     = +(0.4 + rng() * 5.4).toFixed(2);
    const eps     = +(price / pe).toFixed(2);

    // Factor scores 0..100
    const factors = {
      value:    Math.round(20 + rng() * 80),
      momentum: Math.round(15 + rng() * 85),
      quality:  Math.round(25 + rng() * 75),
      lowVol:   Math.round(15 + rng() * 85),
      growth:   Math.round(20 + rng() * 80),
      size:     Math.round(40 + rng() * 60),
    };

    // Composite
    const composite = Math.round(Object.values(factors).reduce((a,b)=>a+b,0) / 6);

    // Generate 252-day OHLC history walking back from current price
    const history = [];
    let p = price;
    const drift = (rng() - 0.5) * 0.0008;
    const vol = 0.012 + rng() * 0.018;
    for (let i = 0; i < 252; i++) {
      const z = (rng() + rng() + rng() + rng() - 2) * 1.5; // approx normal
      const ch = drift + z * vol;
      const o = p;
      p = Math.max(0.5, p * (1 - ch));
      const c = p;
      const h = Math.max(o, c) * (1 + rng() * 0.008);
      const l = Math.min(o, c) * (1 - rng() * 0.008);
      const v = Math.round((avgVol * (0.4 + rng() * 1.2)));
      history.push({ o, h, l, c, v });
    }
    history.reverse(); // oldest first

    // Now align: last close = current price
    const scale = price / history[history.length - 1].c;
    for (const b of history) { b.o *= scale; b.h *= scale; b.l *= scale; b.c *= scale; }

    // Order book — 15 levels each side
    const tick = price < 50 ? 0.01 : price < 500 ? 0.05 : 0.10;
    const bids = [], asks = [];
    for (let i = 0; i < 15; i++) {
      const bp = +(price - tick * (i + 1) - rng() * tick).toFixed(2);
      const ap = +(price + tick * (i + 1) + rng() * tick).toFixed(2);
      bids.push({ p: bp, sz: Math.round(100 + rng() * 4900) * 100 });
      asks.push({ p: ap, sz: Math.round(100 + rng() * 4900) * 100 });
    }

    return {
      sym, name, sector, industry, price, prevClose, pctChg,
      dayHigh, dayLow, yHigh, yLow, volume, avgVol, mcap,
      pe, fwdPe, pb, peg, div, beta, shortPct, dtc, eps,
      factors, composite, history, bids, asks,
    };
  }

  const TICKERS = UNIVERSE.map(tickerProfile);
  const BY_SYM = Object.fromEntries(TICKERS.map(t => [t.sym, t]));

  // News — Google News style headlines tied to specific tickers + market-wide
  const NEWS_TEMPLATES = {
    market: [
      ['Fed officials signal patience as inflation prints come in mixed', 'Reuters',           18],
      ['10-year Treasury yield retreats as bond auction sees strong demand', 'Bloomberg',     32],
      ['Goldman raises year-end S&P target to 5800 citing AI capex cycle', 'CNBC',            54],
      ['VIX collapses below 14 as positioning data shows record systematic length', 'WSJ',    72],
      ['Dollar rally stalls ahead of Friday\'s PCE deflator release', 'FT',                  108],
      ['Small caps lag again as breadth divergence widens to 18-month extreme', 'Barron\'s', 142],
      ['China stimulus headlines lift industrial metals; copper +2.4%', 'Reuters',           188],
      ['Powell to address Sintra conference; markets price 67% Sep cut odds', 'Bloomberg',   224],
    ],
    NVDA: [
      ['NVIDIA partners with TSMC on advanced packaging for Rubin platform', 'Reuters',       12],
      ['Hedge funds increased NVDA exposure 14% in latest 13F filings',     'Bloomberg',      28],
      ['Morgan Stanley reiterates Top Pick; lifts target to $1,200',        'CNBC',           45],
      ['Blackwell shipments tracking ahead of guide, channel checks show',  'Barron\'s',      88],
      ['NVDA option skew flattens as call demand surges into earnings',     'WSJ',           134],
    ],
    AAPL: [
      ['Apple Intelligence rollout in EU delayed amid DMA compliance review','Reuters',       22],
      ['China iPhone shipments rebound 7% in May per Counterpoint',          'Bloomberg',     58],
      ['Berkshire trimmed AAPL position by 13% in Q1 13F',                   'WSJ',          124],
    ],
    MSFT: [
      ['Microsoft Copilot enterprise seats cross 1M; ARR run-rate accelerates','Bloomberg',   18],
      ['Azure AI capacity expansion cited as driver of $13B capex guide',     'Reuters',     64],
    ],
    TSLA: [
      ['Tesla robotaxi unveil pushed to August; shares slide premarket',     'Reuters',       9],
      ['Cybertruck deliveries hit 1.7K in May per registration data',        'Electrek',     46],
      ['Musk sells 5M shares to fund AI compute buildout',                   'WSJ',          92],
    ],
    AMZN: [
      ['AWS announces $14B Mexico region commitment over 15 years',         'Bloomberg',     38],
      ['Amazon ad business pacing for $60B run-rate in Q2',                 'CNBC',         118],
    ],
    META: [
      ['Llama 3.1 405B benchmarks at parity with GPT-4 on key reasoning',   'Bloomberg',     24],
      ['Reels ad load tested at 32% in select markets',                     'Reuters',       82],
    ],
    JPM:  [['JPM raises full-year NII guidance by $2B citing balance growth', 'Bloomberg', 36]],
    AVGO: [['Broadcom VMware integration synergies tracking $1.5B ahead',    'WSJ',       72]],
    AMD:  [['AMD MI325X pricing leaked at ~40% discount to NVDA H200',       'SemiAnalysis',54]],
    GS:   [['Goldman trading desk had 14 straight $100M+ days in Q2',        'Bloomberg', 28]],
    XOM:  [['Exxon Guyana production hits 650 KBD ahead of schedule',        'Reuters',   94]],
    LLY:  [['Mounjaro Q2 scripts up 38% sequentially per IQVIA',             'Bloomberg', 18]],
  };

  function newsFor(sym) {
    const base = (NEWS_TEMPLATES[sym] || []).slice();
    base.push(...NEWS_TEMPLATES.market);
    return base.map(([head, src, minsAgo]) => ({ head, src, minsAgo }));
  }

  // Insider transactions
  const INSIDERS = {
    NVDA: [
      ['Huang, Jensen',     'CEO',           'SELL', 240000, 932.18,  '06/14'],
      ['Kress, Colette',    'CFO',           'SELL', 110000, 928.50,  '06/12'],
      ['Dally, William',    'Chief Scientist','SELL', 18000,  920.32,  '06/10'],
      ['Coxe, Tench',       'Director',      'SELL', 50000,  912.04,  '06/07'],
      ['Shoquist, Debora',  'EVP Operations','SELL', 8500,   908.18,  '06/05'],
      ['Stevens, Mark A',   'Director',      'SELL', 25000,  894.55,  '05/31'],
      ['Estrada, Cynthia',  'EVP HR',        'SELL', 4200,   882.40,  '05/24'],
      ['Hudson, Tim',       'EVP',           'BUY',  1500,   851.32,  '05/15'],
    ],
    AAPL: [
      ['Cook, Tim',         'CEO',           'SELL', 230000, 199.05,  '04/30'],
      ['Maestri, Luca',     'CFO',           'SELL', 87420,  194.18,  '04/22'],
      ['Adams, Katherine',  'GC',            'SELL', 22188,  192.40,  '04/15'],
    ],
    TSLA: [
      ['Musk, Elon',        'CEO',           'SELL', 5000000,232.18,  '06/18'],
      ['Taneja, Vaibhav',   'CFO',           'BUY',  15000,  168.42,  '04/02'],
      ['Denholm, Robyn',    'Chair',         'SELL', 112084, 184.50,  '03/14'],
    ],
  };

  function insidersFor(sym) {
    return INSIDERS[sym] || [
      [`${sym} Officer A`, 'CEO',  'SELL',  Math.round(10000+hash(sym+'1')%80000),  450, '06/12'],
      [`${sym} Officer B`, 'CFO',  'SELL',  Math.round(5000+hash(sym+'2')%40000),   442, '06/05'],
      [`${sym} Officer C`, 'Dir',  'BUY',   Math.round(500+hash(sym+'3')%4000),     431, '05/22'],
    ];
  }

  // Options flow (unusual)
  function optionsFlowFor(sym) {
    const t = BY_SYM[sym]; if (!t) return [];
    const rng = PRNG(hash(sym + 'OPT'));
    const out = [];
    const strikes = [];
    for (let i = -4; i <= 4; i++) strikes.push(Math.round(t.price * (1 + i * 0.025)));
    const exps = ['06/28', '07/19', '08/16', '09/20', '12/20'];
    for (let i = 0; i < 12; i++) {
      const isCall = rng() < 0.62;
      const k = strikes[Math.floor(rng() * strikes.length)];
      const exp = exps[Math.floor(rng() * exps.length)];
      const vol = Math.round(500 + rng() * 28000);
      const oi  = Math.round(100 + rng() * 5000);
      const prem = +(0.4 + rng() * 18).toFixed(2);
      const side = rng() < 0.55 ? 'ASK' : 'BID';
      out.push({ type: isCall ? 'C' : 'P', strike: k, exp, vol, oi, prem, side, ratio: +(vol / Math.max(oi, 1)).toFixed(1) });
    }
    return out.sort((a, b) => b.ratio - a.ratio);
  }

  // Earnings calendar (next 10 days)
  const EARNINGS = [
    ['06/26', 'MU',   'Micron Technology',      'AMC', 1.18,  'Beat exp $1.16'],
    ['06/27', 'NKE',  'Nike Inc',               'AMC', 0.84,  ''],
    ['06/27', 'WBA',  'Walgreens Boots',        'BMO', 0.68,  ''],
    ['07/02', 'STZ',  'Constellation Brands',   'BMO', 3.46,  ''],
    ['07/11', 'PEP',  'PepsiCo Inc',            'BMO', 2.16,  ''],
    ['07/12', 'JPM',  'JPMorgan Chase',         'BMO', 4.18,  ''],
    ['07/12', 'WFC',  'Wells Fargo',            'BMO', 1.28,  ''],
    ['07/12', 'C',    'Citigroup',              'BMO', 1.42,  ''],
    ['07/15', 'GS',   'Goldman Sachs',          'BMO', 8.65,  ''],
    ['07/16', 'BAC',  'Bank of America',        'BMO', 0.81,  ''],
    ['07/17', 'JNJ',  'Johnson & Johnson',      'BMO', 2.71,  ''],
    ['07/23', 'TSLA', 'Tesla Inc',              'AMC', 0.62,  ''],
    ['07/23', 'GOOGL','Alphabet',               'AMC', 1.84,  ''],
    ['07/30', 'MSFT', 'Microsoft',              'AMC', 2.91,  ''],
    ['07/30', 'AMD',  'Adv Micro Devices',      'AMC', 0.68,  ''],
    ['07/31', 'META', 'Meta Platforms',         'AMC', 4.71,  ''],
    ['08/01', 'AAPL', 'Apple Inc',              'AMC', 1.34,  ''],
    ['08/01', 'AMZN', 'Amazon.com',             'AMC', 1.02,  ''],
    ['08/28', 'NVDA', 'NVIDIA Corp',            'AMC', 0.64,  'Whisper $0.71'],
  ];

  // Economic calendar
  const ECON = [
    ['06/25', '09:00', 'US',  'S&P Case-Shiller HPI YoY',   '7.2%',  '7.4%',  'MED'],
    ['06/25', '10:00', 'US',  'Consumer Confidence',         '100.0', '102.0', 'HIGH'],
    ['06/26', '10:00', 'US',  'New Home Sales',              '640K',  '634K',  'MED'],
    ['06/27', '08:30', 'US',  'GDP Q1 Final',                '+1.4%', '+1.3%', 'HIGH'],
    ['06/27', '08:30', 'US',  'Initial Jobless Claims',      '236K',  '238K',  'MED'],
    ['06/27', '10:00', 'US',  'Pending Home Sales',          '+0.6%', '-7.7%', 'LOW'],
    ['06/28', '08:30', 'US',  'PCE Deflator YoY',            '2.6%',  '2.7%',  'HIGH'],
    ['06/28', '08:30', 'US',  'Core PCE MoM',                '0.1%',  '0.2%',  'HIGH'],
    ['06/28', '09:45', 'US',  'Chicago PMI',                 '40.1',  '35.4',  'MED'],
    ['06/28', '10:00', 'US',  'U-Mich Sentiment Final',      '65.8',  '69.1',  'MED'],
    ['07/01', '10:00', 'US',  'ISM Manufacturing',           '49.2',  '48.7',  'HIGH'],
    ['07/03', '08:30', 'US',  'ADP Employment',              '160K',  '152K',  'HIGH'],
    ['07/05', '08:30', 'US',  'Nonfarm Payrolls',            '195K',  '272K',  'HIGH'],
    ['07/05', '08:30', 'US',  'Unemployment Rate',           '4.0%',  '4.0%',  'HIGH'],
    ['07/11', '08:30', 'US',  'CPI YoY',                     '3.1%',  '3.3%',  'HIGH'],
    ['07/30', '14:00', 'US',  'FOMC Rate Decision',          '5.50%', '5.50%', 'HIGH'],
  ];

  // Trade ideas (quant ranked)
  const TRADE_IDEAS = [
    { side: 'LONG',  sym: 'NVDA', conf: 92, thesis: 'Momentum + earnings catalyst + flow', tp: 1050, sl: 880, rr: 2.4 },
    { side: 'LONG',  sym: 'AVGO', conf: 88, thesis: 'AI accelerator share + VMware accretion',  tp: 1820, sl: 1480, rr: 2.0 },
    { side: 'LONG',  sym: 'LLY',  conf: 86, thesis: 'GLP-1 capacity + Q3 script ramp',         tp: 860,  sl: 730, rr: 1.8 },
    { side: 'SHORT', sym: 'TSLA', conf: 81, thesis: 'Demand pressure + robotaxi delay risk',   tp: 195,  sl: 264, rr: 1.7 },
    { side: 'LONG',  sym: 'GS',   conf: 78, thesis: 'IB rebound + trading franchise leverage', tp: 545,  sl: 462, rr: 1.9 },
    { side: 'SHORT', sym: 'KO',   conf: 74, thesis: 'Defensives rolling on yield reset',       tp: 58,   sl: 67,  rr: 1.6 },
    { side: 'LONG',  sym: 'AMD',  conf: 72, thesis: 'MI325 traction; valuation compression',   tp: 195,  sl: 142, rr: 2.1 },
    { side: 'SHORT', sym: 'BA',   conf: 70, thesis: 'Order weakness + ops headwinds',          tp: 162,  sl: 198, rr: 1.5 },
    { side: 'LONG',  sym: 'META', conf: 69, thesis: 'Reels monetization + AI capex ROI',       tp: 560,  sl: 472, rr: 2.0 },
    { side: 'SHORT', sym: 'XOM',  conf: 67, thesis: 'Crude topping + demand softening',        tp: 102,  sl: 124, rr: 1.4 },
  ];

  // Portfolio positions (mocked)
  const PORTFOLIO = [
    ['NVDA', 'LONG', 320, 642.18, 950.42],
    ['MSFT', 'LONG', 180, 384.50, 432.07],
    ['AVGO', 'LONG',  45, 1184.30, 1612.50],
    ['LLY',  'LONG', 110, 612.42,  786.23],
    ['META', 'LONG', 240, 398.20,  506.32],
    ['GS',   'LONG',  90, 412.55,  494.07],
    ['TSLA', 'SHORT',-150, 268.40, 238.84],
    ['BA',   'SHORT', -80, 218.30, 185.34],
    ['KO',   'SHORT',-440, 68.42,  63.71],
    ['XOM',  'SHORT',-220, 124.08, 115.43],
  ].map(([sym, side, qty, avg, last]) => {
    const mv = qty * last;
    const cost = qty * avg;
    const pnl = (last - avg) * qty;
    const pct = ((last - avg) / avg) * 100 * (qty < 0 ? -1 : 1);
    return { sym, side, qty, avg, last, mv, pnl, pct };
  });

  // Correlation matrix between top tickers
  function buildCorrelation(symbols) {
    const m = {};
    for (const s of symbols) {
      m[s] = {};
      for (const t of symbols) {
        if (s === t) { m[s][t] = 1.0; continue; }
        const rng = PRNG(hash(s + '|' + t));
        // Same-sector correlations higher
        const sectorMatch = BY_SYM[s].sector === BY_SYM[t].sector;
        const base = sectorMatch ? 0.55 : 0.25;
        m[s][t] = +(base + (rng() - 0.5) * 0.7).toFixed(2);
      }
    }
    // Symmetrize
    for (const s of symbols) for (const t of symbols) if (s < t) m[t][s] = m[s][t];
    return m;
  }

  // Now timestamp utilities
  function fmtMinsAgo(m) {
    if (m < 60) return m + 'm';
    if (m < 60*24) return Math.floor(m/60) + 'h';
    return Math.floor(m/60/24) + 'd';
  }

  window.MarketData = {
    TICKERS, BY_SYM, INDICES, SECTORS,
    newsFor, insidersFor, optionsFlowFor,
    EARNINGS, ECON, TRADE_IDEAS, PORTFOLIO,
    buildCorrelation, fmtMinsAgo, PRNG, hash,
  };
})();
