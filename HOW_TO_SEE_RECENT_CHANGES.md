# How to See the Recent Changes

All code changes **are already in this repo**. If you still see the old behavior, do the following:

## 1. Run the web app from the correct folder

The changes are in **huntco-web**. You must run the app from here:

```bash
cd /Users/williamsorrell/Desktop/G3/huntco-web
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser (not a deployed URL unless you redeployed).

## 2. Apply the database migration (Tags for Sale type)

The "Tags for Sale" page and Type (Private Land / Unit Wide) need a new column. Run the migration:

- **Option A – Supabase Dashboard:**  
  Open your project → SQL Editor → run the contents of  
  `supabase/migrations/050_tag_type_for_sale.sql`

- **Option B – Supabase CLI:**  
  From the repo root:  
  `supabase db push`  
  (or `supabase migration up`)

If you skip this, creating/editing tags may fail with a column error.

## 3. Restart dev server and hard refresh

After pulling or editing code:

1. Stop the dev server (Ctrl+C).
2. Start it again: `npm run dev` from `huntco-web`.
3. In the browser: hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows) or open the site in an incognito/private window.

## 4. What you should see when it’s working

- **Settings / nav:** "Private Land Tags" is now **"Tags for Sale"**.
- **Tags for Sale page:** Title "Tags for Sale", table has a **Type** column, New/Edit tag has **Type** dropdown (Private Land / Unit Wide) and **Hunt Code (optional)**.
- **Calendar – event editor:** **Hunt Code (optional)** with helper text; workflow note mentions "tags for sale" and "Generate hunt contract".
- **Success Library:** Each success record shows a **photo** (or "No photo" if none).
- **Manual success entry:** Photos optional; form sends correct photo keys so uploads don’t error.
- **Client – Hunt Contract:** Dropdown to switch between **multiple contracts**; **My Tags** and purchase flow unchanged.

If you are testing a **deployed** site (e.g. Vercel), you must **redeploy** after these changes for them to appear there.
