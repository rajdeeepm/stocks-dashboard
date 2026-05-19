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

