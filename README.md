# Customer Portal DevOps Lab

This is a DevOps demo, not a product. All customers, orders and credentials are synthetic. The GitHub Actions workflow builds and deploys the entire stack to a disposable kind cluster on a Linux runner. It needs no added accounts, API keys, repository secrets, cloud infrastructure or Docker installation on your PC.

[![Portal CI](https://github.com/hamza2829/customer-portal-devops-lab/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hamza2829/customer-portal-devops-lab/actions/workflows/ci.yml)

## Architecture

```mermaid
flowchart LR
    browser["Browser"] --> ingress["kind Ingress"]
    subgraph cluster["kind cluster"]
        ingress -->|"portal routes"| web["Next.js App Router<br/>Node 22 · TypeScript"]
        ingress -->|"/api"| api["NestJS API<br/>Node 22 · TypeScript"]
        web -->|"server requests with JWT"| api
        api -->|"TypeORM"| db[("PostgreSQL 16")]
        api -->|"month, order data and service token"| report["FastAPI reports<br/>Python 3.12"]
    end
    ci["GitHub Actions"] -->|"load local images"| cluster
    tf["Terraform Kubernetes provider"] -->|"apply manifests"| cluster
```

The frontend keeps the JWT in an HTTP-only cookie and forwards it server-side. NestJS owns access control and order data. FastAPI computes JSON and CSV summaries from the orders NestJS selects. PostgreSQL and FastAPI use internal service addresses.

## Demo credentials

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@example.test` | `portal-demo-2026` |
| Admin | `admin@example.test` | `portal-demo-2026` |

Choose January 2026 to see the seeded report. The admin page lists customers and orders and can create both. OpenAPI documents the complete CRUD endpoints. The two login identities are built-in fixtures. Creating a customer record creates an order owner.

## Run locally with Docker Compose

These commands are optional and intended for a Linux development machine with Docker and the Compose plugin.

```bash
docker compose up --build --wait
```

Open the [portal](http://localhost:3000) or [OpenAPI UI](http://localhost:3001/api/docs). Run `docker compose down` to stop the stack. Add `--volumes` to reset the demo database.

## Run in kind

GitHub Actions performs these steps automatically on pushes to `main` and on pull requests. To repeat the deployment locally on Linux, install Docker with Compose, kind, kubectl, Terraform and [Cloud Provider KIND](https://kind.sigs.k8s.io/docs/user/ingress/). CI pins the tool versions in [the workflow](.github/workflows/ci.yml).

```bash
docker compose build
bash scripts/deploy-kind.sh
sudo --preserve-env=HOME cloud-provider-kind
```

Leave the ingress controller running. From a second terminal in the repository:

```bash
portal_url="$(bash scripts/wait-ingress.sh)"
echo "$portal_url"
# The API docs are at $portal_url/api/docs.
```

To remove the stack, stop the controller and run `terraform -chdir=infra destroy -auto-approve` and `kind delete cluster --name portal`.

## Requirements and test results

See the eight stories and their acceptance criteria in [REQUIREMENTS.md](REQUIREMENTS.md). Each test name contains its story ID. The workflow checks test coverage by story and uploads `portal-test-report` with JUnit XML, a case-by-case TSV and the generated mapping below.

<!-- test-results:start -->
Results from [Linux Actions run 43184282623](https://github.com/hamza2829/customer-portal-devops-lab/actions/runs/43184282623).

**95/95 tests passed.**

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| api-unit | 28 | 0 | 0 |
| api-integration | 26 | 0 | 0 |
| web-unit | 13 | 0 | 0 |
| report-unit | 16 | 0 | 0 |
| smoke | 12 | 0 | 0 |

| Story | Tests by suite | Result |
| --- | --- | --- |
| S01 · Sign in and out | [api-unit](api/test/portal.unit.spec.ts) (4), [api-integration](api/test/portal.integration.spec.ts) (4), [web-unit](web/test/portal.spec.tsx) (1), [smoke](web/smoke/portal.spec.ts) (2) | Pass |
| S02 · View my open orders | [api-unit](api/test/portal.unit.spec.ts) (1), [api-integration](api/test/portal.integration.spec.ts) (3), [web-unit](web/test/portal.spec.tsx) (2), [smoke](web/smoke/portal.spec.ts) (1) | Pass |
| S03 · Download a monthly report | [api-unit](api/test/portal.unit.spec.ts) (5), [api-integration](api/test/portal.integration.spec.ts) (5), [web-unit](web/test/portal.spec.tsx) (1), [report-unit](report/tests/test_report.py) (6), [smoke](web/smoke/portal.spec.ts) (2) | Pass |
| S04 · Manage customers | [api-unit](api/test/portal.unit.spec.ts) (1), [api-integration](api/test/portal.integration.spec.ts) (3), [web-unit](web/test/portal.spec.tsx) (2), [smoke](web/smoke/portal.spec.ts) (1) | Pass |
| S05 · Manage orders | [api-unit](api/test/portal.unit.spec.ts) (2), [api-integration](api/test/portal.integration.spec.ts) (2), [web-unit](web/test/portal.spec.tsx) (2), [smoke](web/smoke/portal.spec.ts) (1) | Pass |
| S06 · Restrict admin operations | [api-integration](api/test/portal.integration.spec.ts) (3), [web-unit](web/test/portal.spec.tsx) (1), [smoke](web/smoke/portal.spec.ts) (2) | Pass |
| S07 · Reject invalid inputs | [api-unit](api/test/portal.unit.spec.ts) (13), [api-integration](api/test/portal.integration.spec.ts) (4), [web-unit](web/test/portal.spec.tsx) (4), [report-unit](report/tests/test_report.py) (9), [smoke](web/smoke/portal.spec.ts) (1) | Pass |
| S08 · Check availability and API docs | [api-unit](api/test/portal.unit.spec.ts) (2), [api-integration](api/test/portal.integration.spec.ts) (2), [report-unit](report/tests/test_report.py) (1), [smoke](web/smoke/portal.spec.ts) (2) | Pass |
<!-- test-results:end -->

## Limits

- Kubernetes deployment targets a disposable kind cluster. It provisions no cloud resources.
- Data and credentials are synthetic. The kind database uses ephemeral storage.
- The lab uses plain HTTP, demo secrets and TypeORM schema synchronization. Production hardening, production migrations and secret management are outside scope.
