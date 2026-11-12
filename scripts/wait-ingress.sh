#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
namespace="$(terraform -chdir=infra output -raw namespace)"
ingress="$(terraform -chdir=infra output -raw ingress_name)"

for attempt in {1..90}; do
  address="$(kubectl --context kind-portal -n "$namespace" get ingress "$ingress" \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  if [[ -n "$address" ]] \
    && curl --noproxy '*' -fsS --max-time 3 "http://$address/api/health" >/dev/null \
    && curl --noproxy '*' -fsS --max-time 3 "http://$address/health" >/dev/null; then
    printf 'http://%s\n' "$address"
    exit 0
  fi
  sleep 2
done

echo "Portal ingress did not become ready." >&2
kubectl --context kind-portal -n "$namespace" get ingress,services,pods -o wide >&2
exit 1
