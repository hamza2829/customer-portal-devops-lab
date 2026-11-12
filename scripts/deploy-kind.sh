#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Each invocation creates an ephemeral, dedicated kind cluster.
kind create cluster --name portal --wait 120s
kind load docker-image --name portal portal-api:lab portal-web:lab portal-report:lab
terraform -chdir=infra fmt -check -recursive
terraform -chdir=infra init -input=false
terraform -chdir=infra validate
terraform -chdir=infra apply -auto-approve -input=false
