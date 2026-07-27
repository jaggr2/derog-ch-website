const CF_API = 'https://api.cloudflare.com/client/v4';

async function cfFetch(path, token) {
  const res = await fetch(`${CF_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`CF API ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error(`CF API error: ${JSON.stringify(body.errors)}`);
  return body.result;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/status') {
      return handleStatus(env);
    }

    if (!env.ASSETS) {
      return new Response('Not Found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleStatus(env) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'API token not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const zones = await cfFetch('/zones?name=derog.ch', token);
    if (!zones.length) throw new Error('Zone derog.ch not found');
    const zone = zones[0];
    const zoneId = zone.id;
    const accountId = zone.account.id;

    const [records, tunnels] = await Promise.allSettled([
      cfFetch(`/zones/${zoneId}/dns_records?proxied=true&per_page=100`, token),
      cfFetch(`/accounts/${accountId}/cfd_tunnel?is_deleted=false`, token).catch(() => []),
    ]);

    const dnsRecords = records.status === 'fulfilled' ? records.value : [];
    const tunnelList = tunnels.status === 'fulfilled' ? tunnels.value : [];

    const tunnelById = {};
    const tunnelByNameStripped = {};
    for (const t of tunnelList) {
      tunnelById[t.id] = t;
      tunnelByNameStripped[t.name.toLowerCase().replace(/[^a-z]/g, '')] = t.status;
    }

    const proxiedSubdomains = dnsRecords.filter((r) => r.name !== 'derog.ch');

    const serviceResults = await Promise.allSettled(
      proxiedSubdomains.map(async (rec) => {
        const subdomain = rec.name.replace('.derog.ch', '');
        const url = `https://${rec.name}/`;

        let tunnelStatus = null;
        if (rec.content && rec.content.includes('.cfargotunnel.com')) {
          const tid = rec.content.split('.')[0];
          const t = tunnelById[tid];
          if (t) tunnelStatus = t.status;
        }
        if (!tunnelStatus) {
          const key = Object.keys(tunnelByNameStripped).find(k => k.includes(subdomain));
          if (key) tunnelStatus = tunnelByNameStripped[key];
        }

        let status = 'unknown';
        let statusCode = null;
        let latency = null;

        try {
          const start = Date.now();
          const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000), redirect: 'manual' });
          statusCode = res.status;
          latency = Date.now() - start;

          if (tunnelStatus === 'healthy' || tunnelStatus === 'degraded') {
            status = res.status < 500 ? 'online' : 'offline';
          } else if (tunnelStatus === 'down' || tunnelStatus === 'inactive') {
            status = 'offline';
          } else {
            status = res.status < 500 ? 'online' : 'offline';
          }
        } catch {
          if (tunnelStatus === 'healthy') {
            status = 'degraded';
          } else {
            status = 'offline';
          }
        }

        return { name: rec.name, subdomain, url, type: rec.type, status, statusCode, latency, tunnelStatus, proxied: rec.proxied };
      })
    );

    const services = serviceResults.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
    const tunnelStatus = tunnelList.length > 0
      ? tunnelList.reduce((acc, t) => { acc[t.name] = t.status; return acc; }, {})
      : null;

    return new Response(JSON.stringify({ services, tunnels: tunnelStatus, timestamp: new Date().toISOString() }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
