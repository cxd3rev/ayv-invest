# AYV Invest

Personal investment portfolio tracker by **AYV WRLD**.

Track stocks, ETFs, and crypto that you enter yourself. AYV Invest loads market prices on the server and calculates portfolio value, profit and loss, allocation, and history from those transactions.

This repository is the application. Setup, architecture, and deployment notes are expanded as the project is built.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase URL and anon key.
3. Install and run:

```bash
npm install
npm run dev
```

Do not commit `.env.local` or any private keys.
