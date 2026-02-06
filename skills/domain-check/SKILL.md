---
name: domain-check
description: Check domain name availability using the DomainDuck API. Use when asked to check if domains are available, suggest available domain names, or verify domain registration status. Supports bulk checking and WHOIS lookups.
---

# Domain Check

Check domain availability via the [DomainDuck API](https://api.domainduck.io/documentation/).

## API Key

The API key is provided by the user per-request. Do not hardcode keys.

## Quick Check (bulk mode, 10x cheaper)

Use the bundled script for batch checks:

```bash
bash scripts/check_domains.sh <API_KEY> domain1.com domain2.io domain3.dev
```

Output is TSV: `domain\tavailability`

## Manual API Call

```bash
curl -s "https://v1.api.domainduck.io/api/get/?domain=example.com&apikey=API_KEY&bulk"
```

## Response Values

- `true` — available
- `false` — taken
- `premium` — available at premium price
- `blocked` — reserved by registry, not available

## WHOIS Lookup

Add `&whois=1` (omit `&bulk`):

```bash
curl -s "https://v1.api.domainduck.io/api/get/?domain=example.com&apikey=API_KEY&whois=1"
```

Returns registrar, dates, nameservers, contacts, raw WHOIS/RDAP.

## Workflow

1. Gather list of candidate domains from user (or generate suggestions)
2. Run bulk check script with user's API key
3. Present results as a table with ✅/❌ indicators
4. Offer WHOIS on specific domains if needed

## Notes

- Bulk mode results may be cached; for authoritative check, omit `&bulk`
- Rate limits apply — add `sleep 0.3` between requests
- Script path: `scripts/check_domains.sh`
