export async function onRequest(context) {
  const { env } = context;

  const services = JSON.parse(env.SERVICES || '[]');
  const clientId = env.CF_ACCESS_CLIENT_ID || '';
  const clientSecret = env.CF_ACCESS_CLIENT_SECRET || '';

  const results = await Promise.allSettled(
    services.map(async (svc) => {
      const start = Date.now();
      const res = await fetch(svc.url, {
        headers: {
          'CF-Access-Client-Id': clientId,
          'CF-Access-Client-Secret': clientSecret,
        },
        signal: AbortSignal.timeout(10000),
      });
      const latency = Date.now() - start;
      const status = res.ok || res.status === 302 || res.status === 303 ? 'online' : 'offline';
      return { ...svc, status, latency };
    })
  );

  const serviceResults = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { ...services[i], status: 'offline', latency: null, error: r.reason?.message }
  );

  return new Response(JSON.stringify({ services: serviceResults, timestamp: new Date().toISOString() }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30, s-maxage=30',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
