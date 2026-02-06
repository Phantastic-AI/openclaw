#!/usr/bin/env bash
# Check domain availability via DomainDuck API
# Usage: check_domains.sh <api_key> <domain1> [domain2] ...
# Output: TSV lines: domain\tavailability

set -euo pipefail

API_KEY="${1:?Usage: check_domains.sh <api_key> <domain1> [domain2] ...}"
shift

BASE="https://v1.api.domainduck.io/api/get/"

for domain in "$@"; do
  result=$(curl -sf "${BASE}?domain=${domain}&apikey=${API_KEY}&bulk" 2>/dev/null || echo '{"availability":"error"}')
  avail=$(echo "$result" | grep -oP '"availability"\s*:\s*"\K[^"]+')
  echo -e "${domain}\t${avail}"
  sleep 0.3
done
