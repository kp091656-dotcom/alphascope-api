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
        return {
          symbol: s,
          price: q?.regularMarketPrice ?? null,
          prev: q?.chartPreviousClose ?? null,
          name: q?.shortName ?? s,
        };
      }));
      res.status(200).json({ data: results });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // RSS news feeds - only fresh sources
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

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

  try {
    const results = await Promise.all(RSS_FEEDS.map(async ({ url, source }) => {
      try {
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
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
        const title = get('title').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&#x2019;/g,"'").replace(/&#x2018;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
        const description = get('description').replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&#[^;]+;/g,'').trim().slice(0, 300);
        const link = get('link') || item.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
        const pubDate = get('pubDate');

        if (!title || title.length < 5) continue;
        if (!description || description.length < 20) continue; // skip empty descriptions

        // Only keep articles from last 24 hours
        const pub = pubDate ? new Date(pubDate) : new Date();
        if (pub < cutoff) continue;

        articles.push({
          title,
          description,
          url: link.trim(),
          publishedAt: pub.toISOString(),
          source,
        });
      }
    }

    // Deduplicate + sort newest first
    const seen = new Set();
    const unique = articles
      .filter(a => { if (seen.has(a.title)) return false; seen.add(a.title); return true; })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    res.status(200).json({ data: unique, count: unique.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
