# derog.ch

My little corner of the internet — a fun, educational project hosting self-managed services from home.

## 🎓 Purpose

This domain is used for educational and personal purposes. It provides access to self-hosted infrastructure for learning, experimentation, and home automation.

## 📡 Services

| Subdomain | Service | Description |
|-----------|---------|-------------|
| `ha.derog.ch` | Home Assistant | Smart home automation platform |
| `kvm.derog.ch` | KVM / Proxmox | Virtualization lab |
| `nas.derog.ch` | NAS | Network storage & backups |

All services are accessible only through Cloudflare Tunnel + Access (authenticated).

## 🛡️ Proxy Whitelist

For firewall/proxy whitelisting purposes, the following subdomains should be allowed. All traffic flows through Cloudflare's IP ranges.

```
ha.derog.ch
kvm.derog.ch
nas.derog.ch
derog.ch
www.derog.ch
```

These subdomains are proxied through Cloudflare. Allow the [Cloudflare IP ranges](https://www.cloudflare.com/ips/) if you need to whitelist origin traffic.

## 🏗️ Stack

- **Hosting:** Cloudflare Pages
- **Status API:** Cloudflare Pages Function (Worker)
- **Auth:** Cloudflare Access with Service Auth
- **Tunnel:** Cloudflare Tunnel (cloudflared)
- **Frontend:** Vanilla HTML + Tailwind CSS (CDN)

## 🚀 Deployment

Push to `main` — Cloudflare Pages auto-deploys.

### Required environment variables (Cloudflare Pages):

| Variable | Description |
|----------|-------------|
| `SERVICES` | JSON array of services: `[{"name":"Home Assistant","subdomain":"ha","url":"https://ha.derog.ch/"}, ...]` |
| `CF_ACCESS_CLIENT_ID` | Cloudflare Access Service Token Client ID |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare Access Service Token Client Secret |

### Cloudflare Access Setup

1. Go to Zero Trust → Access → Service Auth → Create Service Token
2. Note the Client ID and Client Secret
3. For each application (ha, kvm, nas), add a policy that allows this service token
4. Add the service token env vars to Cloudflare Pages

## 📄 License

MIT
