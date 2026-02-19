# Deploy huntco-web to Vercel

## 1. Connect the repo (first time)

- Push this project to GitHub/GitLab/Bitbucket.
- Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
- Import the repo and set **Root Directory** to the folder that contains `huntco-web` (or `.` if the repo root is huntco-web).
- Leave **Framework Preset** as Next.js and **Build Command** as `npm run build`.

## 2. Environment variables

In the Vercel project → **Settings** → **Environment Variables**, add (for **Production**, and optionally Preview):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Production URL (e.g. `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_WEB_APP_URL` | Same as `NEXT_PUBLIC_APP_URL` (used for invite links) |

Optional (enable when ready):

- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **DocuSign:** `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_USER_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_BASE_URL`

## 3. Deploy

- **From Git:** Push to the connected branch; Vercel deploys automatically.
- **From CLI:** From the `huntco-web` directory run:
  ```bash
  npx vercel
  ```
  First run will prompt login and link the project. Use `npx vercel --prod` for production.

## 4. After deploy

- Set **Supabase** redirect URLs: Authentication → URL Configuration → add your Vercel URL (e.g. `https://your-app.vercel.app/**`).
- If using Stripe webhooks, set the webhook URL to `https://your-app.vercel.app/api/...` (your webhook route).
