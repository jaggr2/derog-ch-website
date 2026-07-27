# derog.ch

My little corner of the internet — a fun, educational project hosting self-managed services from home.

## 🎓 Purpose

This domain is used for educational and personal purposes. It provides access to self-hosted infrastructure for learning, experimentation, and home automation.

## 📡 Services

Services are discovered **dynamically** from Cloudflare DNS — add a proxied DNS record and it appears on the dashboard automatically.

## 🛡️ Proxy Whitelist

For firewall/proxy whitelisting purposes, the following subdomains should be allowed. All traffic flows through Cloudflare's IP ranges.

```
ha.derog.ch
kvm.derog.ch
nas.derog.ch
derog.ch
www.derog.ch
```

Allow the [Cloudflare IP ranges](https://www.cloudflare.com/ips/) if you need to whitelist origin traffic.

## 🏗️ Stack

- **Hosting:** Cloudflare Workers + Static Assets
- **Status API:** Worker (src/index.js) — calls Cloudflare API to discover records + health
- **Tunnel:** Cloudflare Tunnel (cloudflared)
- **Auth:** Cloudflare Access
- **Frontend:** Vanilla HTML + Tailwind CSS (CDN)

## 📁 Repo structure

```
├── assets/            # Static files (build output)
│   ├── index.html
│   └── _headers
├── src/
│   └── index.js       # Worker — handles /api/status, serves assets
├── wrangler.jsonc     # Worker configuration
├── .gitignore
└── README.md
```

## 🚀 Deployment

Push to `main` — Cloudflare auto-deploys.

### Required environment variable

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with `Zone:Read`, `DNS:Read`, `Cloudflare Tunnel:Read` (optional) |

### Setting up

1. **Add the API token:** In Cloudflare dashboard → Workers & Pages → `derog-ch-website` → Settings → **Variables** → Add `CLOUDFLARE_API_TOKEN`
2. **Set custom domain:** In the project → **Settings** → **Domains & Routes** → Add `derog.ch`
3. **(Optional) www redirect:** Go to Rules → Redirect Rules → create rule: hostname `www.derog.ch` → `https://derog.ch` (301)

## 📄 License

MIT
