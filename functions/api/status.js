const API = 'https://api.cloudflare.com/client/v4';

async function cfFetch(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`CF API ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!body.success) throw new Error(`CF API error: ${JSON.stringify(body.errors)}`);
  return body.result;
}

export async function onRequest(context) {
  const { env, request } = context;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'API token not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const hostname = new URL(request.url).hostname;
  const zoneName = hostname.split('.').slice(-2).join('.');

  try {
    const zones = await cfFetch(`/zones?name=${zoneName}`, token);
    if (!zones.length) throw new Error(`Zone ${zoneName} not found`);
    const zone = zones[0];
    const zoneId = zone.id;
    const accountId = zone.account.id;

    const [records, tunnels] = await Promise.allSettled([
      cfFetch(`/zones/${zoneId}/dns_records?proxied=true`, token),
      cfFetch(`/accounts/${accountId}/cfd_tunnel`, token).catch(() => []),
    ]);

    const dnsRecords = records.status === 'fulfilled' ? records.value : [];
    const tunnelList = tunnels.status === 'fulfilled' ? tunnels.value : [];

    const tunnelNameMap = {};
    for (const t of tunnelList) {
      tunnelNameMap[t.id] = t.status;
    }

    const serviceResults = await Promise.allSettled(
      dnsRecords.map(async (rec) => {
        const subdomain = rec.name.replace(`.${zoneName}`, '');
        const url = `https://${rec.name}/`;
        const start = Date.now();
        let reachable = false;
        try {
          const res = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(8000),
            redirect: 'manual',
          });
          reachable = true;
          const latency = Date.now() - start;
          return { name: rec.name, subdomain: subdomain === zoneName ? '@' : subdomain, url, type: rec.type, status: 'online', latency, proxied: rec.proxied };
        } catch {
          return { name: rec.name, subdomain: subdomain === zoneName ? '@' : subdomain, url, type: rec.type, status: 'offline', latency: null, proxied: rec.proxied };
        }
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
