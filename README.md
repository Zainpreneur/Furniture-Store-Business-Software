# Woodhaven — Furniture Store Business Software

A full-stack business management system (ERP/POS) for a furniture store: product
catalog & inventory, customers, suppliers & purchasing, point-of-sale style
sales orders with printable invoices, and a live analytics dashboard — with
role-based access for Admins, Managers, and Staff.

## Tech stack

| Layer    | Technology |
|----------|------------|
| Backend  | Node.js, Express, TypeScript, Prisma ORM, SQLite (dev) |
| Frontend | React 18, TypeScript, Vite, React Router, Tailwind CSS, Recharts |
| Auth     | JWT (JSON Web Tokens), bcrypt password hashing |

SQLite is used by default so the app runs with **zero external setup**. For
production, swap the Prisma datasource to PostgreSQL (see [Switching to
PostgreSQL](#switching-to-postgresql) below) — the schema and code need no
other changes.

## Features

- **Auth & roles** — JWT login, three roles (`ADMIN`, `MANAGER`, `STAFF`) with
  route- and action-level permission checks. The first account ever registered
  automatically becomes `ADMIN`.
- **Product catalog** — SKU, category, material, dimensions, cost & selling
  price, stock quantity, reorder level, soft-delete.
- **Inventory management** — stock auto-adjusts on sales and received
  purchase orders; manual stock adjustments are logged; every change is
  recorded in an inventory audit log.
- **Customers (CRM)** — contact directory with order history.
- **Suppliers & purchasing** — supplier directory, purchase orders with line
  items; marking a PO "received" automatically increases stock.
- **Sales orders / POS** — a cart-style "New Sale" screen that validates
  stock, snapshots prices, applies an order-level discount, computes tax, and
  generates a printable invoice. Cancelling an order returns stock to inventory.
- **Discounts** — a dollar discount per sale, applied before tax.
- **Partial payments / layaway** — record a deposit at checkout and collect
  the rest later; an order's status (`PENDING` → `PARTIALLY_PAID` → `PAID`)
  and balance due are derived automatically from its payment history.
- **Delivery scheduling** — mark a sale for pickup or delivery, set an
  address and scheduled date, and track it through
  `NOT_SCHEDULED → SCHEDULED → OUT_FOR_DELIVERY → DELIVERED` from a
  dedicated Deliveries screen.
- **Expense tracking & profit report** — log operating expenses (rent, wages,
  marketing, ...) by category; the dashboard shows gross profit (revenue −
  cost of goods sold) and net profit (gross − expenses) for the month.
- **CSV export** — one-click export of the Products and Sales Orders lists.
- **Global quick search** — a navbar search that jumps to matching products,
  customers, or sales orders by number.
- **Dashboard** — today/month revenue, net profit, 30-day revenue trend,
  top-selling products, low-stock alerts, recent orders, and upcoming
  deliveries.
- **User management** — Admin-only screen to create staff accounts, change
  roles, and activate/deactivate accounts.

## Project structure

```
├── server/                 Express + TypeScript API
│   ├── prisma/
│   │   ├── schema.prisma   Data model
│   │   └── seed.ts         Demo data (users, catalog, customers, orders)
│   └── src/
│       ├── modules/        One folder per resource (routes + logic)
│       ├── middleware/     Auth guard, role guard, error handler
│       └── lib, utils/      Prisma client, JWT helpers, etc.
└── client/                 React + Vite admin app
    └── src/
        ├── pages/          One screen per route
        ├── components/     Layout, shared UI kit
        ├── api/            Axios client + typed resource calls
        └── context/        Auth context
```

## Getting started

Requires Node.js 18+.

```bash
# 1. Install dependencies (npm workspaces install both server & client)
npm install

# 2. Configure the server environment
cp server/.env.example server/.env
# (defaults work out of the box — SQLite file DB, dev JWT secret)

# 3. Create the database and load demo data
npm run db:migrate      # applies Prisma migrations (creates server/prisma/dev.db)
npm run db:seed         # seeds demo users, catalog, customers, suppliers, orders

# 4. Run both the API and the web app together
npm run dev
```

- API: http://localhost:4000 (proxied at `/api` from the client dev server)
- Web app: http://localhost:5173

### Demo accounts

All seeded accounts use the password `password123`:

| Role    | Email                        |
|---------|-------------------------------|
| Admin   | admin@furniturestore.com     |
| Manager | manager@furniturestore.com   |
| Staff   | staff@furniturestore.com     |

### Running client/server individually

```bash
npm run dev:server   # API only, on :4000
npm run dev:client   # web app only, on :5173 (proxies /api to :4000)
```

### Building for production

```bash
npm run build         # builds both server (tsc) and client (vite build)
npm start -w server    # serve the compiled API (after `npm run build`)
```

The compiled client is a static bundle in `client/dist/` — serve it with any
static file host or reverse-proxy it alongside the API.

## Switching to PostgreSQL

SQLite has no native enum type, so the schema stores "enum-like" columns
(`role`, `status`, `paymentMethod`, `reason`) as plain strings validated by
Zod at the API layer — this keeps the same schema portable to Postgres
without a rewrite. To move to PostgreSQL:

1. In `server/prisma/schema.prisma`, change the datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` in `server/.env` to your Postgres connection string.
3. Run `npm run db:migrate` again to create the schema in Postgres, then
   `npm run db:seed`.

## API overview

All routes are prefixed with `/api` and (except `/auth/login`,
`/auth/register`) require a `Authorization: Bearer <token>` header.

| Resource         | Base path              | Notes |
|------------------|-------------------------|-------|
| Auth             | `/api/auth`             | register, login, me |
| Users            | `/api/users`             | Admin only |
| Categories       | `/api/categories`        | |
| Products         | `/api/products`          | includes `/adjust-stock` and `/inventory-logs` |
| Customers        | `/api/customers`         | |
| Suppliers        | `/api/suppliers`         | |
| Purchase orders  | `/api/purchase-orders`   | `/status` transitions restock inventory on RECEIVED |
| Sales orders     | `/api/sales-orders`      | `/status` restocks on CANCELLED; `/payments` records a payment; `/delivery` updates fulfillment/delivery status; `?search=` matches order # or customer name |
| Expenses         | `/api/expenses`          | Admin/Manager only |
| Dashboard        | `/api/dashboard/summary` | revenue, profit, top products, low stock, recent orders, upcoming deliveries |

## Notes on the demo data

`npm run db:seed` is idempotent for users/categories/products/customers/
suppliers (safe to re-run), but only creates its sample sales orders the
first time the database is empty of orders. To fully reset, delete
`server/prisma/dev.db` and re-run `npm run db:migrate` + `npm run db:seed`.
