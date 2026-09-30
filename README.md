# AYV Invest

AYV Invest is a personal investment portfolio tracker by **AYV WRLD**.

You enter your own buys and sells. The app loads stock, ETF, and crypto prices on the server and calculates:

- portfolio value in EUR
- amount invested and profit/loss
- today's change, when the provider supplies a previous close
- allocation by holding and by asset type
- a performance chart rebuilt from your transactions and historical prices
- transaction history

It tracks and displays your data. It does not recommend investments.

## Tech stack

- Next.js, React, and TypeScript
- Tailwind CSS
- Supabase Auth and Postgres, with Row Level Security
- Recharts
- Vitest for the portfolio calculation tests

Market data goes through one service (`lib/market-data`). The current provider reads Yahoo Finance quote and chart data on the server, and converts other currencies to EUR with the Frankfurter exchange-rate API. Neither call uses a secret key. The provider can be replaced later without rewriting the screens.

## Architecture

```text
app/                         pages and route handlers
components/                  interface pieces
lib/portfolio/calculations   pure buy/sell math, covered by tests
lib/portfolio/load.ts        turns transactions plus quotes into a portfolio view
lib/market-data/             search, quotes, history, and exchange rates
lib/actions/                 sign-in and transaction writes
supabase/migrations/         tables, trigger, and RLS policies
```

Transactions are the source of truth. Holdings are not stored. When a page loads, the server replays every buy and sell with the average-cost method:

- a buy increases quantity and adds `quantity × price + fees` to the cost basis
- a sell reduces quantity and cost basis by the current average cost
- fees on a sell reduce the proceeds
- selling more than you own is rejected in the server action and again by a database trigger

Prices in other currencies are converted to EUR with the rate on the transaction date when that rate exists, otherwise the latest available rate. The portfolio total is hidden for a holding when its price or exchange rate is missing, instead of showing a made-up number.

The performance chart multiplies the quantity you held on each day by that day's market close. Weekends reuse the last real close. Days with no price at all for a holding are marked incomplete. The chart does not invent a history.

## Database

| Table | What it stores |
| --- | --- |
| `profiles` | display name and theme for the signed-in user |
| `portfolios` | the user's portfolio; base currency is EUR for now |
| `assets` | shared market instruments (symbol, name, type) |
| `transactions` | buys and sells, including an `origin` of `manual` or `sample` |
| `portfolio_snapshots` | today's calculated total, written only when every holding has a price |

Row Level Security is enabled on every table. A signed-in user can read and change only the profile, portfolio, transactions, and snapshots linked to `auth.uid()`. Assets are readable by any signed-in user because they are public market instruments. They can be created only through the `upsert_asset` database function.

A new account gets a profile and a portfolio from a trigger on `auth.users`.

`supabase/tests/rls.sql` documents a manual check with two users. This repository does not ship a live Supabase project, so that script has to be run in your own SQL editor.

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
MARKET_DATA_PROVIDER=yahoo
```

The anon key is meant for the browser. Access is limited by Row Level Security. Do not add the Supabase service-role key to this app. `.env.local` is gitignored.

## Local development

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/migrations/20260930140000_init.sql`.
3. In Supabase Auth, allow the site URL and `http://localhost:3000/auth/callback` as a redirect URL.
4. For easier local testing, you can turn off email confirmation in Auth settings. If it stays on, sign-up asks you to confirm by email.
5. Copy `.env.example` to `.env.local` and fill in the URL and anon key.
6. Install and start:

```bash
npm install
npm run dev
```

Other checks:

```bash
npm run typecheck
npm run lint
npm test
```

In development, Settings includes buttons to load and remove sample transactions. Those actions are refused when `NODE_ENV` is not `development`. Sample rows are marked `origin = sample` so they can be deleted without touching transactions you entered yourself. Current prices for those symbols still come from the market-data provider.

## Market data

Search, quotes, and history come from the market-data service. On a normal Next.js server, the browser calls a same-origin proxy so Yahoo Finance can be reached without a public API key. The published GitHub Pages site has no server, so the browser calls the provider directly. Yahoo does not allow that from another website, and the screen says market data could not be loaded. Frankfurter exchange rates can still load. Prices are not invented.

The interface is `searchAssets`, `getAssetQuote`, `getAssetQuotes`, `getHistoricalPrices`, and `getExchangeRateSeries`. Yahoo's endpoints are unofficial and can change.

Market data may be delayed. The product does not claim the prices are real-time.

## Deployment

GitHub Pages publishes the site at [https://cxd3rev.github.io/ayv-invest/](https://cxd3rev.github.io/ayv-invest/). A push to `main` builds a static export and deploys the `out` folder. The public homepage is a normal HTML page, with `robots.txt` and `sitemap.xml`, so a search engine can request it. Search engines decide if and when they list it.

Sign-in still needs your Supabase project. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as GitHub Actions variables, then push again so the build can include them. Add `https://cxd3rev.github.io/ayv-invest/auth/callback/` to the Supabase Auth redirect URLs. Run the SQL migration before inviting users. Do not add the service-role key.

The same app can run as a server with `npm run dev` or on Vercel. Leave `GITHUB_PAGES` unset for that build. Set the same public environment variables there.

## GitHub

The repository is `ayv-invest`. Do not commit `.env.local`, API keys, or the Supabase service-role key.

## Future roadmap

These are intentionally not built yet: broker imports, dividends, tax reports, CSV import, multiple portfolios, watchlists, alerts, benchmarks, subscriptions, and Stripe. The transaction and market-data boundaries are the places those features would connect.
