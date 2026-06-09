from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
import ssl
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
PORT = 8787
USER_AGENT = "PersonalQuantDashboard/0.1 (+local research tool)"
DB_PATH = ROOT / "research.db"

NASDAQ_LISTED = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
OTHER_LISTED = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/"
GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
NSE_EQUITY_LIST = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
JPX_LISTED = "https://www.jpx.co.jp/english/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_e.xls"
ASX_LISTED = "https://www.asx.com.au/asx/research/ASXListedCompanies.csv"
HKEX_SECURITIES = "https://www.hkex.com.hk/eng/services/trading/securities/securitieslists/ListOfSecurities.xlsx"
LSE_AIM_INSTRUMENTS = "https://api.londonstockexchange.com/api/gw/lse/download/directories/aim-adviser/instruments"
XETRA_INSTRUMENTS = "https://www.xetra.com/resource/blob/1528/49690f1830851a8740278613ee8ce477/data/t7-xetr-allTradableInstruments.csv"
TSX_DIRECTORY = "https://www.tsx.com/json/company-directory/search/tsx/%5E"
TSXV_DIRECTORY = "https://www.tsx.com/json/company-directory/search/tsxv/%5E"

CACHE_TTL = {
    "universe": 6 * 60 * 60,
    "market_universe": 24 * 60 * 60,
    "quote": 25,
    "history": 20 * 60,
    "news": 10 * 60,
}


@dataclass
class CacheEntry:
    expires_at: float
    value: Any


cache: dict[str, CacheEntry] = {}

CORE_SIGNAL_SYMBOLS = [
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "AMD", "ORCL",
    "CRM", "ADBE", "NFLX", "JPM", "BAC", "GS", "MS", "BLK", "V", "XOM",
    "CVX", "LLY", "JNJ", "UNH", "PG", "KO", "WMT", "CAT", "BA", "DIS",
]

FALLBACK_UNIVERSE = [
    {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "META", "name": "Meta Platforms Inc.", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "GOOGL", "name": "Alphabet Inc. Class A", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "TSLA", "name": "Tesla Inc.", "exchange": "NASDAQ", "assetType": "Stock", "etf": False},
    {"symbol": "BRK.B", "name": "Berkshire Hathaway Inc. Class B", "exchange": "NYSE", "assetType": "Stock", "etf": False},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "exchange": "NYSE", "assetType": "Stock", "etf": False},
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "exchange": "NYSE Arca", "assetType": "ETF", "etf": True},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust", "exchange": "NASDAQ", "assetType": "ETF", "etf": True},
]

YAHOO_EXCHANGE_SUFFIXES = {
    "AX", "L", "TO", "V", "NE", "NS", "BO", "T", "HK", "SS", "SZ", "KS", "KQ", "SI",
    "PA", "AS", "BR", "DE", "F", "MI", "MC", "SW", "ST", "CO", "OL", "HE", "SA", "MX",
}

MARKET_UNIVERSES = {
    "US": {
        "name": "United States",
        "currency": "USD",
        "symbols": [
            ("NVDA", "NVIDIA Corporation", "NASDAQ", "Stock"),
            ("AAPL", "Apple Inc.", "NASDAQ", "Stock"),
            ("MSFT", "Microsoft Corporation", "NASDAQ", "Stock"),
            ("GOOGL", "Alphabet Inc. Class A", "NASDAQ", "Stock"),
            ("AMZN", "Amazon.com Inc.", "NASDAQ", "Stock"),
            ("META", "Meta Platforms Inc.", "NASDAQ", "Stock"),
            ("TSLA", "Tesla Inc.", "NASDAQ", "Stock"),
            ("JPM", "JPMorgan Chase & Co.", "NYSE", "Stock"),
            ("LLY", "Eli Lilly & Co.", "NYSE", "Stock"),
            ("XOM", "Exxon Mobil Corporation", "NYSE", "Stock"),
            ("SPY", "SPDR S&P 500 ETF Trust", "NYSE Arca", "ETF"),
            ("QQQ", "Invesco QQQ Trust", "NASDAQ", "ETF"),
        ],
    },
    "INDIA": {
        "name": "India",
        "currency": "INR",
        "symbols": [
            ("RELIANCE.NS", "Reliance Industries", "NSE", "Stock"),
            ("TCS.NS", "Tata Consultancy Services", "NSE", "Stock"),
            ("HDFCBANK.NS", "HDFC Bank", "NSE", "Stock"),
            ("INFY.NS", "Infosys", "NSE", "Stock"),
            ("ICICIBANK.NS", "ICICI Bank", "NSE", "Stock"),
            ("BHARTIARTL.NS", "Bharti Airtel", "NSE", "Stock"),
            ("SBIN.NS", "State Bank of India", "NSE", "Stock"),
            ("LT.NS", "Larsen & Toubro", "NSE", "Stock"),
            ("ITC.NS", "ITC", "NSE", "Stock"),
            ("MARUTI.NS", "Maruti Suzuki India", "NSE", "Stock"),
            ("NESTLEIND.NS", "Nestle India", "NSE", "Stock"),
            ("TITAN.NS", "Titan Company", "NSE", "Stock"),
        ],
    },
    "JAPAN": {
        "name": "Japan",
        "currency": "JPY",
        "symbols": [
            ("7203.T", "Toyota Motor", "Tokyo", "Stock"),
            ("6758.T", "Sony Group", "Tokyo", "Stock"),
            ("9984.T", "SoftBank Group", "Tokyo", "Stock"),
            ("8306.T", "Mitsubishi UFJ Financial", "Tokyo", "Stock"),
            ("6861.T", "Keyence", "Tokyo", "Stock"),
            ("8035.T", "Tokyo Electron", "Tokyo", "Stock"),
            ("6098.T", "Recruit Holdings", "Tokyo", "Stock"),
            ("9432.T", "Nippon Telegraph & Telephone", "Tokyo", "Stock"),
            ("6501.T", "Hitachi", "Tokyo", "Stock"),
            ("8058.T", "Mitsubishi Corporation", "Tokyo", "Stock"),
        ],
    },
    "UK": {
        "name": "United Kingdom",
        "currency": "GBP",
        "symbols": [
            ("AZN.L", "AstraZeneca", "LSE", "Stock"),
            ("SHEL.L", "Shell", "LSE", "Stock"),
            ("HSBA.L", "HSBC Holdings", "LSE", "Stock"),
            ("ULVR.L", "Unilever", "LSE", "Stock"),
            ("BP.L", "BP", "LSE", "Stock"),
            ("GSK.L", "GSK", "LSE", "Stock"),
            ("RIO.L", "Rio Tinto", "LSE", "Stock"),
            ("DGE.L", "Diageo", "LSE", "Stock"),
            ("LSEG.L", "London Stock Exchange Group", "LSE", "Stock"),
            ("BARC.L", "Barclays", "LSE", "Stock"),
        ],
    },
    "EUROPE": {
        "name": "Europe",
        "currency": "EUR/CHF",
        "symbols": [
            ("ASML.AS", "ASML Holding", "Euronext Amsterdam", "Stock"),
            ("MC.PA", "LVMH", "Euronext Paris", "Stock"),
            ("SAP.DE", "SAP", "XETRA", "Stock"),
            ("SIE.DE", "Siemens", "XETRA", "Stock"),
            ("AIR.PA", "Airbus", "Euronext Paris", "Stock"),
            ("OR.PA", "L'Oreal", "Euronext Paris", "Stock"),
            ("SAN.PA", "Sanofi", "Euronext Paris", "Stock"),
            ("NESN.SW", "Nestle", "SIX", "Stock"),
            ("NOVN.SW", "Novartis", "SIX", "Stock"),
            ("ROG.SW", "Roche Holding", "SIX", "Stock"),
        ],
    },
    "HONGKONG": {
        "name": "Hong Kong / China",
        "currency": "HKD/CNY",
        "symbols": [
            ("0700.HK", "Tencent Holdings", "HKEX", "Stock"),
            ("9988.HK", "Alibaba Group", "HKEX", "Stock"),
            ("3690.HK", "Meituan", "HKEX", "Stock"),
            ("0939.HK", "China Construction Bank", "HKEX", "Stock"),
            ("1299.HK", "AIA Group", "HKEX", "Stock"),
            ("1810.HK", "Xiaomi", "HKEX", "Stock"),
            ("2318.HK", "Ping An Insurance", "HKEX", "Stock"),
            ("9618.HK", "JD.com", "HKEX", "Stock"),
            ("0005.HK", "HSBC Holdings", "HKEX", "Stock"),
            ("0388.HK", "Hong Kong Exchanges", "HKEX", "Stock"),
        ],
    },
    "CANADA": {
        "name": "Canada",
        "currency": "CAD",
        "symbols": [
            ("RY.TO", "Royal Bank of Canada", "TSX", "Stock"),
            ("TD.TO", "Toronto-Dominion Bank", "TSX", "Stock"),
            ("SHOP.TO", "Shopify", "TSX", "Stock"),
            ("ENB.TO", "Enbridge", "TSX", "Stock"),
            ("CNR.TO", "Canadian National Railway", "TSX", "Stock"),
            ("BNS.TO", "Bank of Nova Scotia", "TSX", "Stock"),
            ("BAM.TO", "Brookfield Corporation", "TSX", "Stock"),
            ("CNQ.TO", "Canadian Natural Resources", "TSX", "Stock"),
            ("SU.TO", "Suncor Energy", "TSX", "Stock"),
            ("TRI.TO", "Thomson Reuters", "TSX", "Stock"),
        ],
    },
    "AUSTRALIA": {
        "name": "Australia",
        "currency": "AUD",
        "symbols": [
            ("BHP.AX", "BHP Group", "ASX", "Stock"),
            ("CBA.AX", "Commonwealth Bank", "ASX", "Stock"),
            ("CSL.AX", "CSL", "ASX", "Stock"),
            ("NAB.AX", "National Australia Bank", "ASX", "Stock"),
            ("WBC.AX", "Westpac Banking", "ASX", "Stock"),
            ("ANZ.AX", "ANZ Group", "ASX", "Stock"),
            ("MQG.AX", "Macquarie Group", "ASX", "Stock"),
            ("WES.AX", "Wesfarmers", "ASX", "Stock"),
            ("WOW.AX", "Woolworths Group", "ASX", "Stock"),
            ("RIO.AX", "Rio Tinto", "ASX", "Stock"),
        ],
    },
}


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def week_key(value: date | None = None) -> str:
    year, week, _ = (value or date.today()).isocalendar()
    return f"{year}-W{week:02d}"


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_research_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS provider_status (
              name TEXT PRIMARY KEY,
              provider_type TEXT NOT NULL,
              source TEXT NOT NULL,
              status TEXT NOT NULL,
              latency_ms INTEGER,
              updated_at TEXT NOT NULL,
              detail TEXT
            );
            CREATE TABLE IF NOT EXISTS signal_runs (
              run_id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              week TEXT NOT NULL,
              universe_count INTEGER NOT NULL,
              status TEXT NOT NULL,
              notes TEXT
            );
            CREATE TABLE IF NOT EXISTS signals (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              run_id TEXT NOT NULL,
              symbol TEXT NOT NULL,
              name TEXT NOT NULL,
              action TEXT NOT NULL,
              score REAL NOT NULL,
              confidence REAL NOT NULL,
              price REAL,
              factors_json TEXT NOT NULL,
              reasons_json TEXT NOT NULL,
              risks_json TEXT NOT NULL,
              freshness_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(run_id) REFERENCES signal_runs(run_id)
            );
            CREATE INDEX IF NOT EXISTS idx_signals_symbol_created ON signals(symbol, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_signals_run_score ON signals(run_id, score DESC);
            CREATE TABLE IF NOT EXISTS paper_orders (
              order_id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              symbol TEXT NOT NULL,
              side TEXT NOT NULL,
              qty INTEGER NOT NULL,
              order_type TEXT NOT NULL,
              limit_price REAL,
              status TEXT NOT NULL,
              reason TEXT,
              fill_price REAL,
              notional REAL
            );
            CREATE INDEX IF NOT EXISTS idx_paper_orders_created ON paper_orders(created_at DESC);
            CREATE TABLE IF NOT EXISTS alert_rules (
              rule_id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              symbol TEXT NOT NULL,
              rule_type TEXT NOT NULL,
              threshold REAL,
              severity TEXT NOT NULL,
              status TEXT NOT NULL,
              note TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_alert_rules_symbol ON alert_rules(symbol, status);
            """
        )
        for name, meta in PROVIDERS.items():
            conn.execute(
                """
                INSERT OR IGNORE INTO provider_status
                (name, provider_type, source, status, latency_ms, updated_at, detail)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (name, meta["type"], meta["source"], "BOOT", None, now_iso(), "provider registered"),
            )


def cached(key: str, loader, ttl: int):
    now = time.time()
    entry = cache.get(key)
    if entry and entry.expires_at > now:
        return entry.value
    value = loader()
    cache[key] = CacheEntry(now + ttl, value)
    return value


def fetch_text(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            return response.read().decode("utf-8", errors="replace")


def fetch_bytes(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except urllib.error.URLError as exc:
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            return response.read()


def parse_bool(value: str | None) -> bool:
    return str(value or "").strip().upper() in {"Y", "YES", "TRUE", "1"}


def clean_symbol(symbol: str) -> str:
    return symbol.strip().upper().replace("/", ".")


def clean_cell(value: Any) -> str:
    text = str(value or "").replace("\xa0", " ").strip()
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def xlsx_col_index(cell_ref: str) -> int | None:
    letters = "".join(ch for ch in cell_ref.upper() if ch.isalpha())
    if not letters:
        return None
    index = 0
    for ch in letters:
        index = index * 26 + (ord(ch) - ord("A") + 1)
    return index - 1


def xlsx_rows(data: bytes) -> list[list[str]]:
    with zipfile.ZipFile(io.BytesIO(data)) as workbook:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            for item in root.findall("x:si", ns):
                parts = [node.text or "" for node in item.findall(".//x:t", ns)]
                shared.append("".join(parts))

        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in workbook.namelist():
            sheet_name = next(name for name in workbook.namelist() if name.startswith("xl/worksheets/sheet"))
        root = ET.fromstring(workbook.read(sheet_name))
        ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        rows: list[list[str]] = []
        for row in root.findall(".//x:sheetData/x:row", ns):
            values: list[str] = []
            for cell in row.findall("x:c", ns):
                cell_type = cell.attrib.get("t", "")
                value_node = cell.find("x:v", ns)
                inline_node = cell.find(".//x:t", ns)
                value = ""
                if cell_type == "s" and value_node is not None:
                    idx = int(value_node.text or "0")
                    value = shared[idx] if idx < len(shared) else ""
                elif inline_node is not None:
                    value = inline_node.text or ""
                elif value_node is not None:
                    value = value_node.text or ""
                col_index = xlsx_col_index(cell.attrib.get("r", ""))
                if col_index is None:
                    col_index = len(values)
                while len(values) <= col_index:
                    values.append("")
                values[col_index] = clean_cell(value)
            if any(values):
                rows.append(values)
        return rows


def dict_rows(headers: list[str], rows: list[list[str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in rows:
        item = {headers[index]: row[index] if index < len(row) else "" for index in range(len(headers))}
        if any(item.values()):
            out.append(item)
    return out


def yahoo_symbol(symbol: str) -> str:
    normalized = clean_symbol(symbol)
    if "." in normalized:
        suffix = normalized.rsplit(".", 1)[1]
        if suffix in YAHOO_EXCHANGE_SUFFIXES:
            return normalized
    return normalized.replace(".", "-")


def market_config(market: str) -> tuple[str, dict[str, Any]]:
    key = str(market or "US").upper()
    if key not in MARKET_UNIVERSES:
        key = "US"
    return key, MARKET_UNIVERSES[key]


def curated_market_items(market: str) -> list[dict[str, Any]]:
    key, config = market_config(market)
    return [
        {
            "symbol": symbol,
            "name": name,
            "exchange": exchange,
            "assetType": asset_type,
            "etf": asset_type.upper() == "ETF",
            "market": key,
            "currency": config["currency"],
        }
        for symbol, name, exchange, asset_type in config["symbols"]
    ]


def dedupe_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in items:
        symbol = clean_symbol(str(item.get("symbol", "")))
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        copy = dict(item)
        copy["symbol"] = symbol
        out.append(copy)
    return out


def market_list_payload() -> dict[str, Any]:
    return {
        "source": "public-exchange-directories-with-curated-fallbacks",
        "items": [
            {
                "id": key,
                "name": config["name"],
                "currency": config["currency"],
                "count": len(config["symbols"]),
            }
            for key, config in MARKET_UNIVERSES.items()
        ],
    }


def parse_nasdaq_universe_items() -> list[dict[str, Any]]:
    payload = cached("universe", load_universe, CACHE_TTL["universe"])
    return [
        {
            "symbol": item["symbol"],
            "name": item.get("name") or item["symbol"],
            "exchange": item.get("exchange") or "US",
            "assetType": item.get("assetType") or ("ETF" if item.get("etf") else "Stock"),
            "etf": bool(item.get("etf")),
            "market": "US",
            "currency": "USD",
        }
        for item in payload.get("items", [])
    ]


def load_india_universe() -> list[dict[str, Any]]:
    text = fetch_text(NSE_EQUITY_LIST, timeout=20)
    rows = csv.DictReader(text.splitlines())
    items: list[dict[str, Any]] = []
    for row in rows:
        symbol = clean_symbol(row.get("SYMBOL", ""))
        name = (row.get("NAME OF COMPANY") or symbol).strip()
        series = (row.get(" SERIES") or row.get("SERIES") or "").strip().upper()
        if not symbol or not name:
            continue
        items.append(
            {
                "symbol": f"{symbol}.NS",
                "name": name.title() if name.isupper() else name,
                "exchange": "NSE",
                "assetType": "Stock",
                "series": series,
                "isin": (row.get(" ISIN NUMBER") or row.get("ISIN NUMBER") or "").strip(),
                "etf": False,
                "market": "INDIA",
                "currency": "INR",
            }
        )
    if not items:
        raise ValueError("NSE equity directory returned no rows")
    return dedupe_items(items)


def load_japan_universe() -> list[dict[str, Any]]:
    try:
        import xlrd
    except ImportError as exc:
        raise RuntimeError("JPX directory requires xlrd to read the official XLS file") from exc

    workbook = xlrd.open_workbook(file_contents=fetch_bytes(JPX_LISTED, timeout=30))
    sheet = workbook.sheet_by_index(0)
    headers = [clean_cell(sheet.cell_value(0, col)) for col in range(sheet.ncols)]
    rows = []
    for row_index in range(1, sheet.nrows):
        row = {headers[col]: clean_cell(sheet.cell_value(row_index, col)) for col in range(sheet.ncols)}
        rows.append(row)

    items: list[dict[str, Any]] = []
    for row in rows:
        local_code = clean_symbol(row.get("Local Code", ""))
        name = clean_cell(row.get("Name (English)") or row.get("Name") or local_code)
        section = clean_cell(row.get("Section/Products"))
        if not local_code or not name:
            continue
        asset_type = "ETF" if "ETF" in section.upper() else "REIT" if "REIT" in section.upper() else "Stock"
        items.append(
            {
                "symbol": f"{local_code}.T",
                "name": name,
                "exchange": "JPX",
                "assetType": asset_type,
                "sector": clean_cell(row.get("33 Sector(name)")),
                "section": section,
                "etf": asset_type == "ETF",
                "market": "JAPAN",
                "currency": "JPY",
            }
        )
    if not items:
        raise ValueError("JPX directory returned no rows")
    return dedupe_items(items)


def load_asx_universe() -> list[dict[str, Any]]:
    text = fetch_text(ASX_LISTED, timeout=25)
    lines = text.splitlines()
    header_index = next((idx for idx, line in enumerate(lines) if line.startswith("Company name,")), -1)
    if header_index < 0:
        raise ValueError("ASX directory header not found")
    rows = csv.DictReader(lines[header_index:])
    items: list[dict[str, Any]] = []
    for row in rows:
        code = clean_symbol(row.get("ASX code", ""))
        name = clean_cell(row.get("Company name") or code)
        if not code or not name:
            continue
        items.append(
            {
                "symbol": f"{code}.AX",
                "name": name,
                "exchange": "ASX",
                "assetType": "Stock",
                "sector": clean_cell(row.get("GICS industry group")),
                "etf": False,
                "market": "AUSTRALIA",
                "currency": "AUD",
            }
        )
    if not items:
        raise ValueError("ASX directory returned no rows")
    return dedupe_items(items)


def load_hongkong_universe() -> list[dict[str, Any]]:
    rows = xlsx_rows(fetch_bytes(HKEX_SECURITIES, timeout=30))
    header_index = next(
        (idx for idx, row in enumerate(rows) if "Stock Code" in row and "Name of Securities" in row),
        -1,
    )
    if header_index < 0:
        raise ValueError("HKEX directory header not found")
    headers = rows[header_index]
    records = dict_rows(headers, rows[header_index + 1 :])
    items: list[dict[str, Any]] = []
    for row in records:
        code = clean_cell(row.get("Stock Code"))
        name = clean_cell(row.get("Name of Securities") or code)
        category = clean_cell(row.get("Category"))
        if not code or not name or (category and "equity" not in category.lower()):
            continue
        digits = "".join(ch for ch in code if ch.isdigit())
        symbol_code = str(int(digits)).zfill(4) if digits else code
        items.append(
            {
                "symbol": f"{symbol_code}.HK",
                "name": name,
                "exchange": "HKEX",
                "assetType": "Stock",
                "category": category,
                "subCategory": clean_cell(row.get("Sub-Category")),
                "isin": clean_cell(row.get("ISIN")),
                "etf": False,
                "market": "HONGKONG",
                "currency": clean_cell(row.get("Trading Currency")) or "HKD",
            }
        )
    if not items:
        raise ValueError("HKEX directory returned no rows")
    return dedupe_items(items)


def load_uk_universe() -> list[dict[str, Any]]:
    text = fetch_text(LSE_AIM_INSTRUMENTS, timeout=25)
    rows = csv.DictReader(text.splitlines())
    items: list[dict[str, Any]] = []
    for row in rows:
        code = clean_symbol(row.get("Code", ""))
        name = clean_cell(row.get("Name") or code)
        if not code or not name:
            continue
        items.append(
            {
                "symbol": f"{code}.L",
                "name": name,
                "exchange": "LSE AIM",
                "assetType": "Stock",
                "sector": clean_cell(row.get("Sector")),
                "location": clean_cell(row.get("Location")),
                "etf": False,
                "market": "UK",
                "currency": "GBP",
            }
        )
    items = curated_market_items("UK") + items
    if not items:
        raise ValueError("LSE AIM directory returned no rows")
    return dedupe_items(items)


def load_europe_universe() -> list[dict[str, Any]]:
    text = fetch_text(XETRA_INSTRUMENTS, timeout=30)
    lines = text.splitlines()
    header_index = next((idx for idx, line in enumerate(lines) if "Instrument" in line and ";" in line), -1)
    if header_index < 0:
        raise ValueError("Xetra directory header not found")
    rows = csv.DictReader(lines[header_index:], delimiter=";")
    items: list[dict[str, Any]] = []
    for row in rows:
        status = clean_cell(row.get("Instrument Status") or row.get("Product Status"))
        if status and status.lower() not in {"active", "published"}:
            continue
        mnemonic = clean_symbol(
            row.get("Instrument Mnemonic", "")
            or row.get("Mnemonic", "")
            or row.get("Issuer Specific Instrument Identifier", "")
        )
        name = clean_cell(row.get("Instrument") or row.get("Instrument Name") or mnemonic)
        if not mnemonic or not name or len(mnemonic) > 12:
            continue
        group = clean_cell(row.get("Product Assignment Group") or row.get("Product Type"))
        asset_type = "ETF" if "ETF" in group.upper() else "Stock"
        items.append(
            {
                "symbol": f"{mnemonic}.DE",
                "name": name,
                "exchange": "Xetra",
                "assetType": asset_type,
                "isin": clean_cell(row.get("ISIN")),
                "sector": group,
                "etf": asset_type == "ETF",
                "market": "EUROPE",
                "currency": clean_cell(row.get("Currency")) or "EUR",
            }
        )
    items = curated_market_items("EUROPE") + items
    if not items:
        raise ValueError("Xetra directory returned no rows")
    return dedupe_items(items)


def parse_tsx_payload(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("jQuery"):
        match = re.search(r"^[^(]+\((.*)\);?$", stripped, re.S)
        if match:
            stripped = match.group(1)
    return json.loads(stripped)


def load_canada_universe() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for url, exchange, market_suffix in [
        (TSX_DIRECTORY, "TSX", ".TO"),
        (TSXV_DIRECTORY, "TSXV", ".V"),
    ]:
        payload = parse_tsx_payload(fetch_text(url, timeout=25))
        for row in payload.get("results", []):
            instruments = row.get("instruments") or [row]
            for instrument in instruments:
                symbol = clean_symbol(instrument.get("symbol") or row.get("symbol", ""))
                name = clean_cell(instrument.get("name") or row.get("name") or symbol)
                if not symbol or not name:
                    continue
                items.append(
                    {
                        "symbol": f"{symbol}{market_suffix}",
                        "name": name,
                        "exchange": exchange,
                        "assetType": "Stock",
                        "etf": False,
                        "market": "CANADA",
                        "currency": "CAD",
                    }
                )
    items = curated_market_items("CANADA") + items
    if not items:
        raise ValueError("TMX directory returned no rows")
    return dedupe_items(items)


MARKET_PROVIDER_NAMES = {
    "US": "nasdaq-universe",
    "INDIA": "nse-universe",
    "JAPAN": "jpx-universe",
    "UK": "lse-aim-universe",
    "EUROPE": "xetra-universe",
    "HONGKONG": "hkex-universe",
    "CANADA": "tsx-universe",
    "AUSTRALIA": "asx-universe",
}


def load_market_universe(market: str) -> dict[str, Any]:
    key, config = market_config(market)
    if key == "US":
        items = parse_nasdaq_universe_items()
        source = "nasdaqtrader-listed-and-otherlisted"
        fallback = False
        record_provider("nasdaq-universe", "OK", None, f"{len(items)} instruments")
    elif key == "INDIA":
        items = load_india_universe()
        source = "nse-official-equity-list"
        fallback = False
        record_provider("nse-universe", "OK", None, f"{len(items)} instruments")
    elif key == "JAPAN":
        items = load_japan_universe()
        source = "jpx-official-listed-issues"
        fallback = False
        record_provider("jpx-universe", "OK", None, f"{len(items)} instruments")
    elif key == "UK":
        items = load_uk_universe()
        source = "lse-official-aim-directory-plus-curated-main-market"
        fallback = False
        record_provider("lse-aim-universe", "OK", None, f"{len(items)} instruments")
    elif key == "EUROPE":
        items = load_europe_universe()
        source = "xetra-official-tradable-instruments-plus-curated-europe"
        fallback = False
        record_provider("xetra-universe", "OK", None, f"{len(items)} instruments")
    elif key == "HONGKONG":
        items = load_hongkong_universe()
        source = "hkex-official-securities-list"
        fallback = False
        record_provider("hkex-universe", "OK", None, f"{len(items)} instruments")
    elif key == "CANADA":
        items = load_canada_universe()
        source = "tsx-tsxv-official-company-directory-plus-curated"
        fallback = False
        record_provider("tsx-universe", "OK", None, f"{len(items)} instruments")
    elif key == "AUSTRALIA":
        items = load_asx_universe()
        source = "asx-official-listed-companies"
        fallback = False
        record_provider("asx-universe", "OK", None, f"{len(items)} instruments")
    else:
        items = curated_market_items(key)
        source = "curated-yahoo-symbol-registry"
        fallback = True
    return {
        "source": source,
        "fallback": fallback,
        "market": key,
        "name": config["name"],
        "currency": config["currency"],
        "count": len(items),
        "items": items,
        "updatedAt": now_iso(),
    }


def market_universe_payload(market: str) -> dict[str, Any]:
    key, config = market_config(market)
    try:
        return cached(f"market_universe:{key}", lambda: load_market_universe(key), CACHE_TTL["market_universe"])
    except Exception as exc:
        items = curated_market_items(key)
        record_provider(MARKET_PROVIDER_NAMES.get(key, "nasdaq-universe"), "DEGRADED", None, str(exc))
        return {
            "source": "curated-yahoo-symbol-registry",
            "fallback": True,
            "market": key,
            "name": config["name"],
            "currency": config["currency"],
            "count": len(items),
            "items": items,
            "updatedAt": now_iso(),
            "detail": str(exc),
        }


def market_items(market: str) -> list[dict[str, Any]]:
    return market_universe_payload(market)["items"]


def static_market_universe_payload(market: str) -> dict[str, Any]:
    key, config = market_config(market)
    items = curated_market_items(key)
    return {
        "source": "local-global-market-registry",
        "market": key,
        "name": config["name"],
        "currency": config["currency"],
        "count": len(items),
        "items": items,
    }


def parse_pipe_table(text: str) -> list[dict[str, str]]:
    lines = [line for line in text.splitlines() if line and not line.startswith("File Creation Time")]
    reader = csv.DictReader(lines, delimiter="|")
    return [row for row in reader if row]


def load_universe() -> dict[str, Any]:
    started = time.perf_counter()
    try:
        nasdaq_rows = parse_pipe_table(fetch_text(NASDAQ_LISTED))
        other_rows = parse_pipe_table(fetch_text(OTHER_LISTED))
        rows: list[dict[str, Any]] = []

        for row in nasdaq_rows:
            symbol = clean_symbol(row.get("Symbol", ""))
            name = row.get("Security Name", "").strip()
            if not symbol or symbol == "Symbol" or parse_bool(row.get("Test Issue")):
                continue
            is_etf = parse_bool(row.get("ETF"))
            rows.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "exchange": "NASDAQ",
                    "assetType": "ETF" if is_etf else "Stock",
                    "etf": is_etf,
                }
            )

        exchange_map = {"A": "NYSE American", "N": "NYSE", "P": "NYSE Arca", "Z": "BATS", "V": "IEXG"}
        for row in other_rows:
            symbol = clean_symbol(row.get("ACT Symbol", ""))
            name = row.get("Security Name", "").strip()
            if not symbol or parse_bool(row.get("Test Issue")):
                continue
            is_etf = parse_bool(row.get("ETF"))
            rows.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "exchange": exchange_map.get(row.get("Exchange", "").strip(), row.get("Exchange", "").strip()),
                    "assetType": "ETF" if is_etf else "Stock",
                    "etf": is_etf,
                }
            )

        rows.sort(key=lambda item: (item["assetType"], item["symbol"]))
        record_provider("nasdaq-universe", "OK", int((time.perf_counter() - started) * 1000), f"{len(rows)} symbols")
        return {"source": "nasdaqtrader", "count": len(rows), "items": rows}
    except Exception as exc:
        record_provider("nasdaq-universe", "DEGRADED", int((time.perf_counter() - started) * 1000), str(exc))
        return {"source": "fallback", "error": str(exc), "count": len(FALLBACK_UNIVERSE), "items": FALLBACK_UNIVERSE}


def load_quotes(symbols: list[str]) -> dict[str, Any]:
    unique = []
    seen = set()
    for symbol in symbols:
        cleaned = clean_symbol(symbol)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique.append(cleaned)

    if not unique:
        return {"source": "yahoo-chart", "items": []}

    items = []
    workers = min(12, len(unique))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(load_quote, symbol): symbol for symbol in unique}
        for future in as_completed(futures):
            try:
                quote = future.result()
            except Exception:
                quote = None
            if quote:
                items.append(quote)
    items.sort(key=lambda item: unique.index(item["symbol"]) if item["symbol"] in unique else 9999)
    return {"source": "yahoo-chart", "items": items}


def load_quote(symbol: str) -> dict[str, Any] | None:
    started = time.perf_counter()
    params = urllib.parse.urlencode({"range": "5d", "interval": "1d"})
    payload = json.loads(fetch_text(f"{YAHOO_CHART}{urllib.parse.quote(yahoo_symbol(symbol))}?{params}"))
    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        return None

    meta = result.get("meta", {})
    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators", {}).get("quote") or [{}])[0]) or {}
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []
    last_index = latest_value_index(closes)
    close = to_float(str(meta.get("regularMarketPrice"))) or value_at(closes, last_index)
    open_price = value_at(opens, last_index)
    previous = to_float(str(meta.get("chartPreviousClose")))
    change = None
    change_pct = None
    if close is not None and previous not in (None, 0):
        change = close - previous
        change_pct = (change / previous) * 100

    row_date = None
    if timestamps and last_index is not None and last_index < len(timestamps):
        row_date = datetime.fromtimestamp(timestamps[last_index]).strftime("%Y-%m-%d")

    record_provider("yahoo-chart", "OK", int((time.perf_counter() - started) * 1000), f"quote {clean_symbol(symbol)}")
    return {
        "symbol": clean_symbol(symbol),
        "date": row_date,
        "time": datetime.fromtimestamp(meta.get("regularMarketTime", time.time())).strftime("%H:%M:%S"),
        "open": open_price,
        "high": value_at(highs, last_index) or to_float(str(meta.get("regularMarketDayHigh"))),
        "low": value_at(lows, last_index) or to_float(str(meta.get("regularMarketDayLow"))),
        "close": close,
        "volume": value_at(volumes, last_index) or to_float(str(meta.get("regularMarketVolume"))),
        "change": change,
        "changePct": change_pct,
    }


def latest_value_index(values: list[Any]) -> int | None:
    for index in range(len(values) - 1, -1, -1):
        if values[index] is not None:
            return index
    return None


def value_at(values: list[Any], index: int | None) -> float | None:
    if index is None or index >= len(values):
        return None
    value = values[index]
    if value is None:
        return None
    return to_float(str(value))


def to_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip().replace(",", "")
    if not value or value.upper() == "N/D":
        return None
    try:
        numeric = float(value)
    except ValueError:
        return None
    if math.isnan(numeric) or math.isinf(numeric):
        return None
    return numeric


def none_if_nd(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return None if cleaned.upper() in {"", "N/D"} else cleaned


def parse_range(range_name: str) -> date:
    today = date.today()
    ranges = {
        "1d": today - timedelta(days=2),
        "5d": today - timedelta(days=8),
        "1m": today - timedelta(days=35),
        "3m": today - timedelta(days=100),
        "6m": today - timedelta(days=190),
        "ytd": date(today.year, 1, 1),
        "1y": today - timedelta(days=370),
        "3y": today - timedelta(days=365 * 3 + 10),
        "5y": today - timedelta(days=365 * 5 + 10),
    }
    return ranges.get(range_name, today - timedelta(days=370))


def load_history(symbol: str, range_name: str) -> dict[str, Any]:
    started = time.perf_counter()
    normalized_range = str(range_name or "1y").strip().lower()
    range_map = {
        "1d": ("1d", "5m"),
        "5d": ("5d", "30m"),
        "1m": ("1mo", "1d"),
        "3m": ("3mo", "1d"),
        "6m": ("6mo", "1d"),
        "ytd": ("ytd", "1d"),
        "1y": ("1y", "1d"),
        "3y": ("5y", "1wk"),
        "5y": ("5y", "1wk"),
    }
    yahoo_range, interval = range_map.get(normalized_range, ("1y", "1d"))
    params = urllib.parse.urlencode({"range": yahoo_range, "interval": interval})
    payload = json.loads(fetch_text(f"{YAHOO_CHART}{urllib.parse.quote(yahoo_symbol(symbol))}?{params}"))
    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        return {"source": "yahoo-chart", "symbol": clean_symbol(symbol), "range": normalized_range, "interval": interval, "items": []}

    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators", {}).get("quote") or [{}])[0]) or {}
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []
    start = parse_range(normalized_range)
    prices = []
    for index, timestamp in enumerate(timestamps):
        row_dt = datetime.fromtimestamp(timestamp)
        row_date = row_dt.date()
        if row_date < start:
            continue
        prices.append(
            {
                "date": row_date.isoformat(),
                "time": row_dt.time().replace(microsecond=0).isoformat(),
                "datetime": row_dt.replace(microsecond=0).isoformat(),
                "open": value_at(opens, index),
                "high": value_at(highs, index),
                "low": value_at(lows, index),
                "close": value_at(closes, index),
                "volume": value_at(volumes, index),
            }
        )
    record_provider("yahoo-chart", "OK", int((time.perf_counter() - started) * 1000), f"history {clean_symbol(symbol)} {normalized_range} {interval}")
    return {"source": "yahoo-chart", "symbol": clean_symbol(symbol), "range": normalized_range, "interval": interval, "items": prices}


def load_news(query: str, limit: int) -> dict[str, Any]:
    started = time.perf_counter()
    params = urllib.parse.urlencode({"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    text = fetch_text(f"{GOOGLE_NEWS_RSS}?{params}")
    root = ET.fromstring(text)
    items = []
    for item in root.findall("./channel/item")[:limit]:
        title = item.findtext("title", default="").strip()
        published = item.findtext("pubDate", default="").strip()
        link = item.findtext("link", default="").strip()
        source = item.findtext("source", default="").strip()
        items.append(
            {
                "title": title,
                "published": published,
                "link": link,
                "source": source,
                "sentiment": score_headline(title),
            }
        )
    record_provider("google-news-rss", "OK", int((time.perf_counter() - started) * 1000), f"{len(items)} headlines for {query}")
    return {"source": "google-news-rss", "query": query, "items": items}


POSITIVE_WORDS = {
    "beats",
    "beat",
    "surge",
    "surges",
    "upgrade",
    "upgraded",
    "growth",
    "profit",
    "rally",
    "record",
    "strong",
    "bullish",
    "raises",
    "gain",
    "gains",
}

NEGATIVE_WORDS = {
    "miss",
    "misses",
    "cut",
    "cuts",
    "downgrade",
    "downgraded",
    "falls",
    "fall",
    "slump",
    "slumps",
    "weak",
    "lawsuit",
    "probe",
    "loss",
    "bearish",
    "warning",
    "risk",
}


def score_headline(title: str) -> int:
    words = {word.strip(".,:;!?()[]{}\"'").lower() for word in title.split()}
    return sum(1 for word in words if word in POSITIVE_WORDS) - sum(1 for word in words if word in NEGATIVE_WORDS)


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api(parsed)
            return
        if parsed.path == "/":
            self.path = "/Phosphor.html"
        super().do_GET()

    def handle_api(self, parsed: urllib.parse.ParseResult):
        try:
            params = urllib.parse.parse_qs(parsed.query)
            if parsed.path == "/api/universe":
                data = cached("universe", load_universe, CACHE_TTL["universe"])
                self.write_json(data)
            elif parsed.path == "/api/markets":
                self.write_json(market_list_payload())
            elif parsed.path == "/api/market/universe":
                market = params.get("market", ["US"])[0]
                self.write_json(market_universe_payload(market))
            elif parsed.path == "/api/quote":
                symbols = ",".join(params.get("symbols", [""])).split(",")
                clean_symbols = ",".join(sorted(clean_symbol(symbol) for symbol in symbols if clean_symbol(symbol)))
                key = f"quote:{clean_symbols}"
                data = cached(key, lambda: load_quotes(symbols), CACHE_TTL["quote"])
                self.write_json(data)
            elif parsed.path == "/api/history":
                symbol = params.get("symbol", ["SPY"])[0]
                range_name = params.get("range", ["1y"])[0]
                key = f"history:{clean_symbol(symbol)}:{range_name}"
                data = cached(key, lambda: load_history(symbol, range_name), CACHE_TTL["history"])
                self.write_json(data)
            elif parsed.path == "/api/news":
                query = params.get("query", ["market stocks"])[0]
                limit = max(1, min(40, int(params.get("limit", ["12"])[0])))
                key = f"news:{query}:{limit}"
                data = cached(key, lambda: load_news(query, limit), CACHE_TTL["news"])
                self.write_json(data)
            else:
                self.write_json({"error": "Unknown endpoint"}, status=404)
        except urllib.error.URLError as exc:
            record_provider("yahoo-chart", "DOWN", None, str(exc))
            self.write_json({"error": "Network request failed", "detail": str(exc)}, status=502)
        except Exception as exc:
            self.write_json({"error": "Request failed", "detail": str(exc)}, status=500)


    def write_json(self, payload: Any, status: int = 200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    init_research_db()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DashboardHandler)
    print(f"Personal Quant Dashboard running at http://127.0.0.1:{PORT}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
