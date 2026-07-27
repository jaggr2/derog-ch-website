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
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/status') return handleStatus(env);
    if (url.pathname.startsWith('/api/admin/')) return handleAdmin(url, env);
    if (!env.ASSETS) return new Response('Not Found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

async function handleAdmin(url, env) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) return new Response('no token', { status: 500 });

  const path = url.pathname.replace('/api/admin/', '');
  try {
    let data;
    if (path === 'access-apps') {
      data = await cfFetch('/accounts/d30b5030df689cb8099ae5d43a09b4fe/access/apps', token);
    } else if (path.startsWith('access-app/')) {
      const id = path.split('/')[1];
      data = await cfFetch(`/accounts/d30b5030df689cb8099ae5d43a09b4fe/access/apps/${id}`, token);
    } else {
      return new Response('unknown endpoint', { status: 404 });
    }
    return new Response(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleStatus(env) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'API token not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const accessId = env.CF_ACCESS_CLIENT_ID || '';
  const accessSecret = env.CF_ACCESS_CLIENT_SECRET || '';

  try {
    const zones = await cfFetch('/zones?name=derog.ch', token);
    if (!zones.length) throw new Error('Zone derog.ch not found');
    const accountId = zones[0].account.id;
    const zoneId = zones[0].id;

    const [records, tunnels] = await Promise.allSettled([
      cfFetch(`/zones/${zoneId}/dns_records?proxied=true&per_page=100`, token),
      cfFetch(`/accounts/${accountId}/cfd_tunnel?is_deleted=false`, token).catch(() => []),
    ]);

    const dnsRecords = records.status === 'fulfilled' ? records.value : [];
    const tunnelList = tunnels.status === 'fulfilled' ? tunnels.value : [];

    const tunnelById = {};
    for (const t of tunnelList) tunnelById[t.id] = t;

    const hostnameToTunnel = {};
    const configs = await Promise.allSettled(
      tunnelList.map((t) =>
        cfFetch(`/accounts/${accountId}/cfd_tunnel/${t.id}/configurations`, token).catch(() => null)
      )
    );
    for (let i = 0; i < tunnelList.length; i++) {
      if (configs[i].status !== 'fulfilled' || !configs[i].value) continue;
      for (const rule of configs[i].value.ingress || []) {
        if (rule.hostname) hostnameToTunnel[rule.hostname] = tunnelList[i];
      }
    }

    const proxied = dnsRecords.filter((r) => r.name !== 'derog.ch');

    const results = await Promise.allSettled(
      proxied.map(async (rec) => {
        const subdomain = rec.name.replace('.derog.ch', '');
        const url = `https://${rec.name}/`;

        // 1. Look up tunnel via published routes
        let tunnel = hostnameToTunnel[rec.name];
        // 2. Fallback: extract tunnel ID from DNS CNAME target
        if (!tunnel && rec.content?.includes('.cfargotunnel.com')) {
          tunnel = tunnelById[rec.content.split('.')[0]] || null;
        }
        const tunnelStatus = tunnel?.status || null;

        // 3. HTTP probe to check actual service reachability
        let httpOk = false;
        let statusCode = null;
        let latency = null;
        try {
          const start = Date.now();
          const headers = {};
          if (accessId && accessSecret) {
            headers['CF-Access-Client-Id'] = accessId;
            headers['CF-Access-Client-Secret'] = accessSecret;
          }
          const res = await fetch(url, { method: 'HEAD', headers, signal: AbortSignal.timeout(8000), redirect: 'manual' });
          statusCode = res.status;
          latency = Date.now() - start;
          httpOk = res.status >= 200 && res.status <= 299;
        } catch {}

        // 4. Determine final status: tunnel state takes precedence, HTTP refines it
        let status;
        if (tunnelStatus === 'down' || tunnelStatus === 'inactive') {
          status = 'offline';
        } else if (!httpOk && tunnelStatus === 'healthy') {
          status = 'degraded';
        } else if (!httpOk) {
          status = 'offline';
        } else {
          status = 'online';
        }

        return { name: rec.name, subdomain, url, type: rec.type, status, statusCode, latency, tunnelStatus, proxied: rec.proxied };
      })
    );

    const services = results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
    const tunnelSummaries = tunnelList.reduce((acc, t) => { acc[t.name] = t.status; return acc; }, {});

    return new Response(JSON.stringify({ services, tunnels: tunnelSummaries, timestamp: new Date().toISOString() }), {
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
