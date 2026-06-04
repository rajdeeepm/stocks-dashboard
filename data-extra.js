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

  Object.assign(window.MarketData, {
    financialsFor, dcfFor, peerCompsFor, ratingsFor, earningsHistoryFor, ownershipFor, PEER_MAP,
  });
})();
