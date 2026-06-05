// data-extra.js — extended datasets for the multi-screen terminal
// Adds: financials, analyst ratings, DCF, peers, options chain, FX, yields,
// commodities, Fed dot plot, vol surface, earnings surprises, ownership.

(function () {
  const M = window.MarketData;
  if (!M) { console.error('data.js must load before data-extra.js'); return; }
  const { PRNG, hash, BY_SYM } = M;

  // ─── Financials (5y trailing per ticker) ───────────────────────
  function financialsFor(sym) {
    const t = BY_SYM[sym]; if (!t) return null;
    const rng = PRNG(hash(sym + 'FIN'));
    const baseRev = t.mcap / (5 + rng() * 18); // crude rev derived from mcap
    const years = [2021, 2022, 2023, 2024, 2025];
    const growth = [0.18, 0.06, -0.02, 0.14, 0.22].map(g => g + (rng() - 0.5) * 0.08);
    let rev = baseRev * 0.55;
    const income = [];
    for (let i = 0; i < 5; i++) {
      rev *= (1 + growth[i]);
      const grossM = 0.42 + (rng() - 0.5) * 0.18;
      const opM = grossM - 0.22 - rng() * 0.05;
      const netM = opM - 0.05 - rng() * 0.03;
      income.push({
        year: years[i], rev,
        cogs:   rev * (1 - grossM),
        gross:  rev * grossM,
        opex:   rev * (grossM - opM),
        opInc:  rev * opM,
        intExp: rev * 0.015,
        tax:    rev * opM * 0.21,
        netInc: rev * netM,
        eps:    (rev * netM) / (Math.max(t.mcap / t.price, 1)),
        grossM, opM, netM,
      });
    }
    const last = income[4];
    const cash = [];
    for (const yr of income) {
      cash.push({
        year: yr.year,
        opCF: yr.netInc * (1.15 + rng() * 0.3),
        capex: -yr.rev * (0.04 + rng() * 0.05),
        fcf: 0,
        finCF: -yr.netInc * (0.3 + rng() * 0.4),
        invCF: -yr.rev * (0.06 + rng() * 0.04),
      });
    }
    cash.forEach(c => { c.fcf = c.opCF + c.capex; });
    const bs = [];
    let assets = baseRev * 1.2;
    for (let i = 0; i < 5; i++) {
      assets *= 1.08 + rng() * 0.08;
      const liab = assets * (0.35 + rng() * 0.2);
      bs.push({
        year: years[i],
        cash: assets * (0.15 + rng() * 0.1),
        assets, liab,
        debt: liab * (0.5 + rng() * 0.3),
        equity: assets - liab,
        shares: t.mcap / t.price,
      });
    }
    return { income, cash, bs };
  }

  // ─── DCF assumptions + valuation ───────────────────────────────
  function dcfFor(sym) {
    const t = BY_SYM[sym]; if (!t) return null;
    const f = financialsFor(sym);
    const last = f.income[4];
    const lastFcf = f.cash[4].fcf;
    const assumptions = {
      revGrowth5y: [0.18, 0.16, 0.14, 0.12, 0.10],
      revGrowthTerm: 0.03,
      opMargin: last.opM,
      taxRate: 0.21,
      wacc: 0.092,
      terminalG: 0.025,
      shareCount: f.bs[4].shares,
    };
    // project FCF
    let fcf = lastFcf;
    const proj = [];
    for (let i = 0; i < 5; i++) {
      fcf *= (1 + assumptions.revGrowth5y[i]);
      proj.push(fcf);
    }
    const tv = proj[4] * (1 + assumptions.terminalG) / (assumptions.wacc - assumptions.terminalG);
    const pv = proj.reduce((s, c, i) => s + c / Math.pow(1 + assumptions.wacc, i + 1), 0);
    const pvTv = tv / Math.pow(1 + assumptions.wacc, 5);
    const ev = pv + pvTv;
    const equity = ev - f.bs[4].debt + f.bs[4].cash;
    const fairValue = equity / assumptions.shareCount;
    return {
      assumptions, proj,
      tv, pvProj: pv, pvTv, ev, fairValue,
      upside: (fairValue / t.price - 1) * 100,
    };
  }

  // ─── Comps / peers ─────────────────────────────────────────────
  const PEER_MAP = {
    NVDA: ['AMD', 'AVGO', 'INTC', 'TSM'],
    AAPL: ['MSFT', 'GOOGL', 'META', 'AMZN'],
    MSFT: ['GOOGL', 'AAPL', 'ORCL', 'CRM'],
    GOOGL:['META', 'MSFT', 'AAPL', 'AMZN'],
    AMZN: ['WMT', 'COST', 'AAPL', 'GOOGL'],
    META: ['GOOGL', 'NFLX', 'DIS', 'TTD'],
    TSLA: ['F', 'GM', 'STLA', 'TM'],
    AVGO: ['NVDA', 'AMD', 'TXN', 'QCOM'],
    AMD:  ['NVDA', 'AVGO', 'INTC', 'TSM'],
    ORCL: ['MSFT', 'CRM', 'SAP', 'IBM'],
    JPM:  ['BAC', 'WFC', 'C', 'GS'],
    BAC:  ['JPM', 'WFC', 'C', 'USB'],
    GS:   ['MS', 'JPM', 'BAC', 'BLK'],
    XOM:  ['CVX', 'COP', 'SHEL', 'BP'],
    LLY:  ['NVO', 'PFE', 'MRK', 'ABBV'],
  };

  function peerCompsFor(sym) {
    const t = BY_SYM[sym]; if (!t) return [];
    const peerSyms = PEER_MAP[sym] || ['MSFT', 'AAPL', 'GOOGL', 'META'];
    const all = [t.sym, ...peerSyms].map(s => {
      const x = BY_SYM[s];
      if (x) return x;
      // synth peer not in universe
      const rng = PRNG(hash(s));
      const price = 50 + rng() * 400;
      return {
        sym: s,
        name: s + ' Corp',
        price,
        pctChg: (rng() - 0.5) * 3,
        mcap: 50e9 + rng() * 800e9,
        pe: 10 + rng() * 35,
        fwdPe: 8 + rng() * 30,
        pb: 1 + rng() * 12,
        beta: 0.6 + rng() * 1.4,
        composite: Math.round(30 + rng() * 60),
        sector: t.sector,
      };
    });
    return all;
  }

  // ─── Analyst ratings ──────────────────────────────────────────
  function ratingsFor(sym) {
    const t = BY_SYM[sym]; if (!t) return null;
    const rng = PRNG(hash(sym + 'RAT'));
    const banks = ['Goldman Sachs','Morgan Stanley','JP Morgan','BofA','Citi','Barclays','Deutsche','UBS','Jefferies','Wells Fargo','Bernstein','Wedbush','RBC','Truist','Mizuho','Cowen','Loop Cap','Piper','Stifel','Needham','Oppenheimer','Susquehanna','Rosenblatt','Evercore'];
    const recs = ['BUY','BUY','BUY','BUY','OUTPERFORM','OVERWEIGHT','HOLD','HOLD','UNDERPERFORM'];
    const list = [];
    for (let i = 0; i < 14; i++) {
      const rec = recs[Math.floor(rng() * recs.length)];
      const target = t.price * (0.85 + rng() * 0.45);
      const date = ['06/24','06/22','06/18','06/14','06/10','06/05','05/30','05/24','05/18','05/12','05/06','04/28','04/20','04/15'][i];
      list.push({ bank: banks[i], rec, target, date, prev: target * (0.92 + rng() * 0.15) });
    }
    const buys = list.filter(r => /BUY|OUTPERFORM|OVERWEIGHT/.test(r.rec)).length;
    const holds = list.filter(r => r.rec === 'HOLD').length;
    const sells = list.length - buys - holds;
    const avgTarget = list.reduce((s, r) => s + r.target, 0) / list.length;
    return {
      list, buys, holds, sells, total: list.length,
      avgTarget, upside: (avgTarget / t.price - 1) * 100,
    };
  }

  // ─── Earnings surprises ────────────────────────────────────────
  function earningsHistoryFor(sym) {
    const rng = PRNG(hash(sym + 'EH'));
    const quarters = ['Q1 24','Q4 23','Q3 23','Q2 23','Q1 23','Q4 22','Q3 22','Q2 22'];
    return quarters.map((q, i) => {
      const est = 0.5 + rng() * 3;
      const actual = est * (0.85 + rng() * 0.35);
      const surprise = ((actual - est) / est) * 100;
      return { q, est, actual, surprise };
    });
  }

  // ─── Ownership breakdown ──────────────────────────────────────
  function ownershipFor(sym) {
    const rng = PRNG(hash(sym + 'OWN'));
    const inst = 0.55 + rng() * 0.35;
    const insider = rng() * 0.08;
    const retail = 1 - inst - insider;
    const topHolders = [
      ['Vanguard Group',      0.082],
      ['BlackRock Inc',       0.071],
      ['State Street',        0.044],
      ['Fidelity / FMR',      0.038],
      ['Geode Capital',       0.018],
      ['Capital Research',    0.016],
      ['T. Rowe Price',       0.014],
      ['JPMorgan Asset Mgmt', 0.011],
    ].map(([h, w]) => [h, w * (0.6 + rng() * 0.8)]);
    return { inst, insider, retail, topHolders };
  }

  // ─── Yield Curve ───────────────────────────────────────────────
  const YIELD_CURVE = [
    ['1M',  5.34],
    ['3M',  5.31],
    ['6M',  5.18],
    ['1Y',  4.86],
    ['2Y',  4.62],
    ['3Y',  4.48],
    ['5Y',  4.32],
    ['7Y',  4.28],
    ['10Y', 4.265],
    ['20Y', 4.48],
    ['30Y', 4.42],
  ];

  // Curves: today, 1m ago, 6m ago
  const YIELD_CURVES = {
    today: YIELD_CURVE,
    m1:    YIELD_CURVE.map(([k,v]) => [k, v + 0.18 + Math.random()*0.05]),
    m6:    YIELD_CURVE.map(([k,v]) => [k, v + 0.42 + Math.random()*0.08]),
    y1:    YIELD_CURVE.map(([k,v]) => [k, v + 0.85]),
  };

  // ─── FX matrix ─────────────────────────────────────────────────
  const FX = {
    pairs: ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'USD/CNH', 'USD/MXN', 'USD/INR'],
    rates: {
      'EUR/USD': [1.0712, -0.0024],
      'USD/JPY': [157.84, +0.42],
      'GBP/USD': [1.2632, -0.0018],
      'USD/CHF': [0.9018, +0.0024],
      'AUD/USD': [0.6678, -0.0034],
      'USD/CAD': [1.3712, +0.0018],
      'NZD/USD': [0.6132, -0.0042],
      'USD/CNH': [7.2812, +0.0048],
      'USD/MXN': [18.1240, +0.084],
      'USD/INR': [83.512, +0.018],
    },
  };

  // ─── Commodities ───────────────────────────────────────────────
  const COMMODITIES = [
    ['WTI Crude',   'CL',  81.74,  +1.07, 'USD/bbl'],
    ['Brent Crude', 'BZ',  85.42,  +0.98, 'USD/bbl'],
    ['Nat Gas',     'NG',   2.728, -2.14, 'USD/mmBtu'],
    ['Gold',        'GC', 2338.20, +0.42, 'USD/oz'],
    ['Silver',      'SI',   29.84, +0.84, 'USD/oz'],
    ['Copper',      'HG',    4.524,+1.24, 'USD/lb'],
    ['Platinum',    'PL', 1018.40, +0.32, 'USD/oz'],
    ['Palladium',   'PA',  984.10, -1.42, 'USD/oz'],
    ['Wheat',       'ZW',  582.50, +1.18, 'USD/bu'],
    ['Corn',        'ZC',  442.25, -0.42, 'USD/bu'],
    ['Soybeans',    'ZS', 1142.50, +0.84, 'USD/bu'],
    ['Coffee',      'KC',  225.40, +2.18, 'USD/lb'],
  ];

  // ─── Fed dot plot ──────────────────────────────────────────────
  const FED_DOTS = {
    '2024': [4.875, 5.125, 5.125, 5.125, 5.125, 5.125, 5.375, 5.375, 5.375, 5.375, 5.625, 5.625],
    '2025': [3.875, 4.125, 4.125, 4.375, 4.375, 4.375, 4.625, 4.625, 4.625, 4.875, 4.875, 5.125],
    '2026': [3.125, 3.375, 3.375, 3.625, 3.625, 3.625, 3.625, 3.875, 3.875, 4.125, 4.125, 4.375],
    'LT':   [2.500, 2.500, 2.750, 2.750, 2.750, 2.875, 2.875, 3.000, 3.000, 3.125, 3.125, 3.250],
  };

  // ─── Vol surface (per ticker) ──────────────────────────────────
  function volSurfaceFor(sym) {
    const t = BY_SYM[sym]; if (!t) return null;
    const rng = PRNG(hash(sym + 'VS'));
    const tenors = [7, 14, 30, 60, 90, 180, 365];
    const strikes = [-30, -20, -10, -5, 0, 5, 10, 20, 30]; // % from spot
    const baseIv = 22 + rng() * 30;
    const surface = strikes.map(k => tenors.map(d => {
      const skew = Math.abs(k) * 0.12 + (k < 0 ? Math.abs(k) * 0.08 : 0);
      const termStruct = -2 + (d/365) * 3;
      return +(baseIv + skew + termStruct + (rng() - 0.5) * 1.5).toFixed(1);
    }));
    return { tenors, strikes, surface, baseIv };
  }

  // ─── Options chain ─────────────────────────────────────────────
  function optionsChainFor(sym, expiry) {
    const t = BY_SYM[sym]; if (!t) return [];
    const rng = PRNG(hash(sym + (expiry || '') + 'CHN'));
    const px = t.price;
    const tick = px < 50 ? 1 : px < 200 ? 2.5 : px < 500 ? 5 : 10;
    const strikes = [];
    for (let i = -8; i <= 8; i++) strikes.push(Math.round((px + i * tick) / tick) * tick);
    return strikes.map(K => {
      const moneyness = (K - px) / px;
      const ivBase = 28 + Math.abs(moneyness) * 100 * 0.4 + (moneyness < 0 ? Math.abs(moneyness) * 40 : 0);
      const cIv = ivBase + rng() * 3;
      const pIv = ivBase + rng() * 3 + 1.5;
      const cDelta = Math.max(0.02, Math.min(0.98, 0.5 - moneyness * 2.5));
      const pDelta = cDelta - 1;
      const gamma = Math.max(0.001, 0.04 * Math.exp(-Math.abs(moneyness) * 8));
      const theta = -px * 0.003 * Math.exp(-Math.abs(moneyness) * 4);
      const vega  = px * 0.12 * Math.exp(-Math.abs(moneyness) * 4);
      const cBid = Math.max(0.01, Math.max(px - K, 0) + px * 0.04 * (1 + Math.abs(moneyness) * 2));
      const cAsk = cBid * (1 + 0.02 + rng() * 0.03);
      const pBid = Math.max(0.01, Math.max(K - px, 0) + px * 0.04 * (1 + Math.abs(moneyness) * 2));
      const pAsk = pBid * (1 + 0.02 + rng() * 0.03);
      return {
        strike: K,
        call: { bid: cBid, ask: cAsk, iv: cIv, delta: cDelta, gamma, theta, vega, vol: Math.round(rng() * 8000), oi: Math.round(500 + rng() * 30000) },
        put:  { bid: pBid, ask: pAsk, iv: pIv, delta: pDelta, gamma, theta, vega, vol: Math.round(rng() * 8000), oi: Math.round(500 + rng() * 30000) },
      };
    });
  }
  const OPT_EXPIRIES = ['06/28', '07/05', '07/12', '07/19', '08/16', '09/20', '12/20', '01/17/26', '03/21/26', '06/20/26'];

  // ─── Quant Lab backtest ────────────────────────────────────────
  function runBacktest(weights) {
    // weights: { value, momentum, quality, lowVol, growth, size } each 0..1
    const tickers = M.TICKERS;
    const scored = tickers.map(t => {
      const s =
        weights.value    * t.factors.value +
        weights.momentum * t.factors.momentum +
        weights.quality  * t.factors.quality +
        weights.lowVol   * t.factors.lowVol +
        weights.growth   * t.factors.growth +
        weights.size     * t.factors.size;
      return { ...t, score: s };
    }).sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 10);
    // Build equity curve: blend top10 history into a portfolio
    const N = 252;
    const curve = new Array(N).fill(1);
    for (let i = 1; i < N; i++) {
      let ret = 0;
      for (const t of top) {
        const h = t.history;
        const r = (h[i].c - h[i-1].c) / h[i-1].c;
        ret += r * 0.1;
      }
      curve[i] = curve[i-1] * (1 + ret);
    }
    // SPX equiv = average of all
    const bench = new Array(N).fill(1);
    for (let i = 1; i < N; i++) {
      let ret = 0;
      for (const t of tickers) {
        const h = t.history;
        const r = (h[i].c - h[i-1].c) / h[i-1].c;
        ret += r / tickers.length;
      }
      bench[i] = bench[i-1] * (1 + ret);
    }
    const totalRet = (curve[N-1] - 1) * 100;
    const benchRet = (bench[N-1] - 1) * 100;
    // Sharpe ≈ mean/std * sqrt(252)
    const rets = [];
    for (let i = 1; i < N; i++) rets.push((curve[i]/curve[i-1])-1);
    const mean = rets.reduce((s,r)=>s+r,0)/rets.length;
    const vol = Math.sqrt(rets.reduce((s,r)=>s+(r-mean)**2,0)/rets.length);
    const sharpe = (mean - 0.04/252) / vol * Math.sqrt(252);
    // Max DD
    let peak = curve[0], dd = 0;
    for (const v of curve) { if (v > peak) peak = v; const d = (v/peak)-1; if (d < dd) dd = d; }
    return {
      top, curve, bench,
      stats: {
        totalRet, benchRet, alpha: totalRet - benchRet,
        sharpe, vol: vol * Math.sqrt(252) * 100, maxDD: dd * 100,
        win: rets.filter(r => r > 0).length / rets.length * 100,
      },
    };
  }

  // ─── AI Agent personas ─────────────────────────────────────────
  // Original quant personas — NOT named after real investors.
  const AGENTS = [
    {
      id: 'VAL', name: 'VALUE HAWK',
      style: 'Deep value · margin of safety · contrarian',
      bias: 'Skeptical of multiples. Hunts mispriced cash flows.',
      color: '#88aa44',
      systemPrompt: 'You are VALUE HAWK, a deep-value quant analyst in the spirit of cigar-butt and margin-of-safety investing. Look at intrinsic value, P/E, P/B, free cash flow yield, balance sheet quality. Be skeptical of multiples and growth narratives. Voice: dry, contrarian, terse. Use trader shorthand. ≤120 words.',
    },
    {
      id: 'MOM', name: 'MOMENTUM SCOUT',
      style: 'Trend · 52w highs · CAN-SLIM',
      bias: 'Buys strength, cuts losers. Price tells the truth.',
      color: '#ffaa00',
      systemPrompt: 'You are MOMENTUM SCOUT, a momentum/trend-following analyst. Look at price action, 52-week highs, relative strength, breakout patterns, volume confirmation. Cut losers fast. Voice: confident, action-oriented, blunt. ≤120 words.',
    },
    {
      id: 'QLT', name: 'QUALITY OWNER',
      style: 'Wide moats · compounders · ROIC',
      bias: 'Owns great businesses for decades. Doesn\'t blink.',
      color: '#5cd5ff',
      systemPrompt: 'You are QUALITY OWNER, a long-term compounder investor. Focus on returns on capital, durable moats, pricing power, capital allocation. Indifferent to short-term price action. Voice: patient, business-minded, sees decades. ≤120 words.',
    },
    {
      id: 'MAC', name: 'MACRO STRATEGIST',
      style: 'Top-down · regimes · cross-asset',
      bias: 'Stock specifics matter less than regime.',
      color: '#a868ff',
      systemPrompt: 'You are MACRO STRATEGIST. Top-down. You frame any single stock through the lens of growth/inflation regime, rates path, dollar, credit conditions, liquidity. Voice: analytical, regime-aware, slightly detached. ≤120 words.',
    },
    {
      id: 'RSK', name: 'RISK MANAGER',
      style: 'Drawdowns · convexity · what could break',
      bias: 'First, do no harm. Sizes positions, not picks.',
      color: '#ff5a44',
      systemPrompt: 'You are RISK MANAGER. Your job is to find what kills the trade — vol regime, gap risk, concentration, correlation breakdown, tail events. You think in position sizing and convexity. Voice: cautious, scenario-based, surgical. ≤120 words.',
    },
    {
      id: 'GRW', name: 'GROWTH OPTIMIST',
      style: 'TAM · S-curves · narrative',
      bias: 'Today\'s expensive is tomorrow\'s cheap.',
      color: '#ff6abc',
      systemPrompt: 'You are GROWTH OPTIMIST. You believe in S-curves and TAM expansion. You\'re willing to pay up for accelerating growth and category leadership. Voice: forward-looking, expansive, narrative-driven but data-grounded. ≤120 words.',
    },
  ];

  // Pre-mocked verdicts (offline fallback)
  function mockVerdict(agentId, sym) {
    const t = BY_SYM[sym];
    const rng = PRNG(hash(sym + agentId));
    const lookup = {
      VAL: { score: 100 - t.factors.value > 50 ? 'AVOID' : (t.pe < 18 ? 'BUY' : 'HOLD'),
             snip: t.pe < 18 ? `Trading at ${t.pe.toFixed(1)}× — discount to peers; FCF yield supports.` : `${t.pe.toFixed(1)}× is rich for the asset base. Pass.` },
      MOM: { score: t.factors.momentum > 70 ? 'BUY' : t.factors.momentum > 40 ? 'HOLD' : 'AVOID',
             snip: t.factors.momentum > 70 ? `Trend intact, ${(t.price/t.yLow*100-100).toFixed(0)}% off 52w low. Riding it.` : 'Trend is rolling. Stand aside.' },
      QLT: { score: t.factors.quality > 65 ? 'BUY' : t.factors.quality > 45 ? 'HOLD' : 'AVOID',
             snip: t.factors.quality > 65 ? `Q-score ${t.factors.quality}. Moat intact, compounding story.` : `Q-score ${t.factors.quality} — not best-in-class.` },
      MAC: { score: 'HOLD',
             snip: `Regime: late-cycle, sticky inflation. ${t.sector} OW vs. defensives.` },
      RSK: { score: t.beta > 1.4 ? 'TRIM' : 'HOLD',
             snip: `β=${t.beta.toFixed(2)}, vol=${(t.beta * 18).toFixed(0)}%. ${t.beta > 1.4 ? 'Size accordingly; tight stop.' : 'Risk within budget.'}` },
      GRW: { score: t.factors.growth > 60 ? 'BUY' : 'HOLD',
             snip: t.factors.growth > 60 ? `Growth-score ${t.factors.growth} — narrative + numbers align.` : 'Story OK but execution risk.' },
    };
    return lookup[agentId] || { score: 'HOLD', snip: '—' };
  }

  Object.assign(window.MarketData, {
    financialsFor, dcfFor, peerCompsFor, ratingsFor,
    earningsHistoryFor, ownershipFor,
    YIELD_CURVE, YIELD_CURVES, FX, COMMODITIES, FED_DOTS,
    volSurfaceFor, optionsChainFor, OPT_EXPIRIES,
    runBacktest, AGENTS, mockVerdict, PEER_MAP,
  });
})();
