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

- **Hosting:** Cloudflare Pages
- **Status API:** Pages Function (Worker) — calls Cloudflare API to discover records + health
- **Tunnel:** Cloudflare Tunnel (cloudflared)
- **Auth:** Cloudflare Access
- **Frontend:** Vanilla HTML + Tailwind CSS (CDN)

## 📁 Repo structure

```
├── public/                # Static assets (build output)
│   ├── index.html
│   └── _headers
├── functions/             # Pages Functions (server-side)
│   └── api/
│       └── status.js      # GET /api/status
├── .gitignore
└── README.md
```

## 🚀 Deployment

Push to `main` — Cloudflare Pages auto-deploys.

### Required environment variables

| Variable | Description | Required permissions |
|----------|-------------|---------------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | `Zone:Read`, `DNS:Read`, `Cloudflare Tunnel:Read` (tunnel status optional) |

### Creating the API token

1. Go to Cloudflare Dashboard → My Profile → API Tokens → Create Token
2. Use the "Custom token" template
3. Add permissions:
   - `Zone` → `Read` for `derog.ch`
   - `DNS` → `Read` for `derog.ch`
   - `Cloudflare Tunnel` → `Read` (optional — adds tunnel health to the dashboard, found under Account permissions)
4. Copy the token and add it as `CLOUDFLARE_API_TOKEN` in Pages → Settings → Environment variables

### Cloudflare Pages setup

1. Go to Workers & Pages → Create → Pages → Connect to Git
2. Select `jaggr2/derog-ch-website`
3. Build settings: Framework = **None**, Build command = *(empty)*, Build output = `public`
4. Set the environment variable above
5. Deploy and set custom domain → `derog.ch`

### Optional: www → root redirect

The `_redirects` file was removed because Cloudflare Pages doesn't support absolute URLs there. To redirect `www.derog.ch` to `derog.ch`, create a **Redirect Rule** in Cloudflare dashboard:

1. Go to `derog.ch` → Rules → Redirect Rules
2. Create a redirect rule:
   - **When:** Hostname equals `www.derog.ch`
   - **Then:** `https://derog.ch` (dynamic, preserve path)
   - **Status:** 301

## 📄 License

MIT
