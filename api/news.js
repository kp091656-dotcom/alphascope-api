export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint = 'news' } = req.query;

  // CNN Fear & Greed proxy
  if (endpoint === 'fgi') {
    try {
      const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://edition.cnn.com/',
          'Accept': 'application/json',
        }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      res.status(200).json(data);
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // VIX via Yahoo Finance
  if (endpoint === 'vix') {
    try {
      const symbols = ['^VIX', '^VVIX', '^VIX9D', '^VIX3M', '^VIX6M'];
      const results = await Promise.all(symbols.map(async s => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();
        const q = d?.chart?.result?.[0]?.meta;
        return { symbol: s, price: q?.regularMarketPrice ?? null, prev: q?.chartPreviousClose ?? null, name: q?.shortName ?? s };
      }));
      res.status(200).json({ data: results });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // Global Futures via Twelve Data
  if (endpoint === 'futures') {
    const TWELVE_KEY = process.env.TWELVE_DATA_KEY;
    if (!TWELVE_KEY) return res.status(500).json({ error: 'TWELVE_DATA_KEY not configured' });

    // Twelve Data symbols for futures & indices
    const FUTURES = [
      // 美股指數期貨
      { symbol: 'YM',      name: '小道瓊',     cat: '美股指數', type: 'futures' },
      { symbol: 'ES',      name: '小SP500',     cat: '美股指數', type: 'futures' },
      { symbol: 'NQ',      name: '小那斯達克',  cat: '美股指數', type: 'futures' },
      { symbol: 'RTY',     name: '羅素2000',    cat: '美股指數', type: 'futures' },
      { symbol: 'FDAX',    name: '德國DAX',     cat: '美股指數', type: 'futures' },
      { symbol: 'SOX',     name: '費城半導體',  cat: '美股指數', type: 'index' },
      // 亞股指數
      { symbol: 'TWN',     name: '台指期',      cat: '亞股指數', type: 'futures' },
      { symbol: 'NKD',     name: '日經225',     cat: '亞股指數', type: 'futures' },
      { symbol: 'HSI',     name: '香港恆生',    cat: '亞股指數', type: 'futures' },
      { symbol: 'CN50',    name: '中國A50',     cat: '亞股指數', type: 'futures' },
      // 能源
      { symbol: 'CL',      name: '輕原油',      cat: '能源', type: 'futures' },
      { symbol: 'HO',      name: '燃料油',      cat: '能源', type: 'futures' },
      { symbol: 'RB',      name: '汽油',        cat: '能源', type: 'futures' },
      { symbol: 'NG',      name: '天然氣',      cat: '能源', type: 'futures' },
      // 金屬
      { symbol: 'GC',      name: '黃金',        cat: '金屬', type: 'futures' },
      { symbol: 'SI',      name: '白銀',        cat: '金屬', type: 'futures' },
      { symbol: 'PL',      name: '白金',        cat: '金屬', type: 'futures' },
      { symbol: 'HG',      name: '銅',          cat: '金屬', type: 'futures' },
      { symbol: 'PA',      name: '鈀金',        cat: '金屬', type: 'futures' },
      // 農產品
      { symbol: 'ZS',      name: '黃豆',        cat: '農產品', type: 'futures' },
      { symbol: 'ZC',      name: '玉米',        cat: '農產品', type: 'futures' },
      { symbol: 'ZW',      name: '小麥',        cat: '農產品', type: 'futures' },
      { symbol: 'SB',      name: '11號糖',      cat: '農產品', type: 'futures' },
      { symbol: 'CC',      name: '可可',        cat: '農產品', type: 'futures' },
      { symbol: 'KC',      name: '咖啡',        cat: '農產品', type: 'futures' },
      { symbol: 'CT',      name: '棉花',        cat: '農產品', type: 'futures' },
      { symbol: 'LE',      name: '活牛',        cat: '農產品', type: 'futures' },
      { symbol: 'HE',      name: '瘦豬',        cat: '農產品', type: 'futures' },
      { symbol: 'ZO',      name: '燕麥',        cat: '農產品', type: 'futures' },
      { symbol: 'ZL',      name: '大豆油',      cat: '農產品', type: 'futures' },
      { symbol: 'ZM',      name: '大豆粉',      cat: '農產品', type: 'futures' },
      // 外匯
      { symbol: 'DX',      name: '美元指數',    cat: '外匯', type: 'futures' },
      { symbol: 'EUR/USD', name: '歐元',        cat: '外匯', type: 'forex' },
      { symbol: 'GBP/USD', name: '英鎊',        cat: '外匯', type: 'forex' },
      { symbol: 'USD/JPY', name: '日圓',        cat: '外匯', type: 'forex' },
      { symbol: 'AUD/USD', name: '澳幣',        cat: '外匯', type: 'forex' },
      { symbol: 'USD/CAD', name: '加幣',        cat: '外匯', type: 'forex' },
      // 債券
      { symbol: 'ZF',      name: '5年美債',     cat: '債券', type: 'futures' },
      { symbol: 'ZN',      name: '10年美債',    cat: '債券', type: 'futures' },
      { symbol: 'ZB',      name: '30年美債',    cat: '債券', type: 'futures' },
      // 加密貨幣
      { symbol: 'BTC/USD', name: '比特幣',      cat: '加密貨幣', type: 'crypto' },
      { symbol: 'ETH/USD', name: '以太幣',      cat: '加密貨幣', type: 'crypto' },
    ];

    try {
      // Twelve Data quote endpoint supports batch requests (comma-separated)
      const syms = FUTURES.map(f => f.symbol).join(',');
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(syms)}&apikey=${TWELVE_KEY}`;
      const r = await fetch(url);
      const data = await r.json();

      const symMap = Object.fromEntries(FUTURES.map(f => [f.symbol, f]));
      const results = [];

      for (const [sym, q] of Object.entries(data)) {
        if (q.status === 'error' || !q.close) continue;
        const info = symMap[sym] || { name: sym, cat: '其他' };
        const curr = parseFloat(q.close);
        const prev = parseFloat(q.previous_close) || curr;
        const hi   = parseFloat(q.high) || curr;
        const lo   = parseFloat(q.low)  || curr;
        const chg  = curr - prev;
        const chgPct = prev ? chg / prev : 0;
        const volPct = prev ? (hi - lo) / prev : 0;
        results.push({
          symbol: sym, name: info.name, cat: info.cat,
          prev, price: curr, high: hi, low: lo,
          chg, chgPct, volPct,
        });
      }

      res.status(200).json({ data: results, count: results.length });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // RSS news feeds
  const RSS_FEEDS = [
    { url: 'https://feeds.reuters.com/reuters/businessNews',                                                      source: 'Reuters' },
    { url: 'https://feeds.reuters.com/reuters/technologyNews',                                                    source: 'Reuters' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',                source: 'CNBC' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',                 source: 'CNBC' },
    { url: 'https://feeds.bloomberg.com/markets/news.rss',                                                        source: 'Bloomberg' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',                                         source: 'MarketWatch' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',                                        source: 'MarketWatch' },
    { url: 'https://www.ft.com/?format=rss',                                                                      source: 'FT' },
  ];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const results = await Promise.all(RSS_FEEDS.map(async ({ url, source }) => {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/rss+xml, application/xml, text/xml' },
          signal: AbortSignal.timeout(8000),
        });
        const xml = await r.text();
        return { source, xml };
      } catch(e) {
        return { source, xml: null };
      }
    }));

    const articles = [];
    for (const { source, xml } of results) {
      if (!xml) continue;
      const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
      for (const item of items.slice(0, 20)) {
        const get = (tag) => {
          const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
          return m ? (m[1] || m[2] || '').trim() : '';
        };
        const title = get('title').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&#x2019;/g,"'").replace(/&#x2018;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#[^;]+;/g,'');
        const description = get('description').replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&#[^;]+;/g,'').trim().slice(0, 300);
        const link = get('link') || item.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
        const pubDate = get('pubDate');
        if (!title || title.length < 5) continue;
        if (!description || description.length < 20) continue;
        const pub = pubDate ? new Date(pubDate) : new Date();
        if (pub < cutoff) continue;
        articles.push({ title, description, url: link.trim(), publishedAt: pub.toISOString(), source });
      }
    }

    const seen = new Set();
    const unique = articles
      .filter(a => { if (seen.has(a.title)) return false; seen.add(a.title); return true; })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    res.status(200).json({ data: unique, count: unique.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
