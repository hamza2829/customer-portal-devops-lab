# Customer portal requirements

### S01 · Sign in and out

As a customer, I want to sign in to see my dashboard and sign out when I’m done.

- Valid demo credentials issue an expiring JWT. The frontend stores it in an HTTP-only cookie and opens the dashboard.
- Invalid credentials or tokens return 401. Signing out clears the session and the dashboard requires sign-in again.

### S02 · View my open orders

As a customer, I want to see my open orders so I can check what’s outstanding.

- The dashboard lists my orders with item, date, status and amount. Selecting **Open orders** hides other statuses.
- The API returns only my orders and returns 404 for another customer’s order.

### S03 · Download a monthly report

As a customer, I want to download a month’s report so I can review my order activity.

- The dashboard downloads a CSV with status counts and the total in cents excluding cancelled orders. The API serves the same summary as JSON.
- The report uses only my orders from the selected calendar month. The report service requires the service token.

### S04 · Manage customers

As an admin, I want to maintain customer records so orders go to the correct customer.

- I can create a customer and see it on the admin page. The API supports listing, reading, updating and deleting customers.
- Duplicate emails return 409. Deleting a customer removes their orders.

### S05 · Manage orders

As an admin, I want to maintain orders so their details and status stay current.

- The API supports creating, listing, reading, updating and deleting orders. The admin page lists orders and can create them.
- New orders default to open and must reference an existing customer.

### S06 · Restrict admin operations

As an admin, I want customer sessions blocked from administration so records stay protected.

- An admin signs in to the admin page. A customer who opens it is redirected to the dashboard.
- Customer tokens receive 403 from admin-only API operations.

### S07 · Reject invalid inputs

As a portal user, I want invalid requests rejected before they change my records or produce a report.

- The API returns 400 for invalid dates, amounts, statuses, formats and identifiers, and rejects unknown request fields.
- The report service returns 422 for invalid inputs. The frontend rejects malformed months on the download route.

### S08 · Check availability and API docs

As a portal operator, I want health endpoints and API docs so I can verify and inspect a deployment.

- The frontend, API and report service have health endpoints. The API returns 503 when PostgreSQL is unavailable.
- The ingress serves frontend and API health, and the API publishes OpenAPI documentation with bearer authentication.
