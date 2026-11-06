# Upholstery & Steel Works — Inventory & Job Order System

Next.js 14 (App Router) · TypeScript · Tailwind · Lucide · Supabase (Postgres + RPC + RLS) · Vercel

## File structure

```
app/
  layout.tsx, globals.css, page.tsx          Profile picker + PIN pad (public)
  actions.ts                                 Server actions (login, stock, jobs, users…)
  api/reports/csv/route.ts                   CSV export (owner/admin only)
  (app)/layout.tsx                           Sidebar shell (requires session)
  (app)/dashboard | inventory | stock | jobs | catalog | suppliers | audit | reports | users | settings
components/                                  Sidebar, LoginScreen, InventoryClient, StockForms, JobBuilder, …
lib/                                         session (signed JWT), supabase RPC wrapper, auth guards, format
middleware.ts                                Route protection (clerks locked to /inventory and /settings)
supabase/schema.sql                          Tables, RLS, pgcrypto RPCs, seed data (idempotent)
```

## 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor → New query →** paste all of `supabase/schema.sql` → **Run**. It is safe to re-run.
3. **Project Settings → API:** copy the **Project URL** and the **anon public** key.

Seeded profiles all start with **PIN `1234`** and security answer **`Bulacan`**
(question: "What is the shop city?"). Change the PINs after the first login (My Account).

## 2. Local run

```bash
cp .env.example .env.local     # then fill in the three values
npm install
npm run dev                    # http://localhost:3000
```

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
AUTH_SESSION_SECRET=<32+ random chars>     # openssl rand -base64 48
```

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Vercel → **Add New → Project** → import the repo (framework: Next.js, defaults are fine).
3. Add the same three environment variables under **Settings → Environment Variables** (Production + Preview).
4. Deploy. Changing `AUTH_SESSION_SECRET` later signs everyone out.

## How security works

- Tables have RLS enabled with **no policies** and no grants to `anon`/`authenticated`, so the public key cannot read or write any table directly.
- All data access goes through `SECURITY DEFINER` RPC functions. `verify_pin()` checks the PIN with `crypt()` (bcrypt via pgcrypto), locks the profile for 60 seconds after 5 wrong attempts, and returns a random session token (only its SHA-256 is stored).
- The token lives in an HTTP-only, signed (HS256) cookie. Every RPC re-checks the role in SQL, so a clerk who forces a URL or calls the API gets `FORBIDDEN`; clerks receive `unit_price = null` from `list_materials`.
- Stock changes lock the material row (`FOR UPDATE`) and a `CHECK (current_stock >= 0)` backs it up, so concurrent requests cannot drive stock negative. Job orders deduct materials in the same transaction as creation — if any material is short, nothing is saved.
- `audit_log` has triggers that reject UPDATE/DELETE/TRUNCATE. Corrections are separate "Stock Adjustment" entries.

## Role summary

| | Owner | Admin | Inventory Clerk |
|---|---|---|---|
| Inventory view | with prices | with prices | quantities only |
| Quick Stock-In / Out | ✓ | ✓ | ✓ (on landing screen) |
| Jobs, catalog, suppliers, audit, reports | ✓ | ✓ | ✗ |
| Create profiles | ✓ | ✓ | ✗ |
| Reset PINs | anyone | clerks only | ✗ |
| Delete profiles | ✓ | ✗ | ✗ |

**3-step clerk flow:** click profile → type PIN (auto-submits at 4 digits) → press Submit on the Stock-In or Stock-Out card already on the landing page.

## Notes

- PINs are exactly 4 digits. Security answers are case-insensitive.
- Dates and "monthly/daily" boundaries use Asia/Manila time.
- This was written without being able to run `npm install`/`next build` in the authoring sandbox, so run `npm run build` once locally and fix any typing nits before deploying.
