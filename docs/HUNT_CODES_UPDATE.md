# Hunt Codes List — Yearly Update

The app uses the **NMDGF-style hunt code list** (e.g. `ELK-1-294`, `ANT-1-101`) for:

- **Web:** Draw Results (hunt code picker), and anywhere we need to show or derive dates from a code.
- **iOS:** Pre-draw contract, hunt contract screen, draw results; the list is bundled or loaded from Application Support.

**This list changes every year** when NMDGF publishes new draw codes. Update it once per season so web and (optionally) iOS stay in sync.

---

## Web

1. **Where the list lives**
   - Preferred: `huntco-web/public/data/hunt-codes.csv`  
     Use a single filename so you can replace the file each year without code changes.
   - Fallbacks: `public/data/NMHuntCodes_2025_clean.csv`, `public/data/NMHuntCodes_2026_clean.csv`  
     The API checks these if `hunt-codes.csv` is missing.

2. **CSV format** (same as iOS)
   - Required column: `hunt_code` (or `code`).
   - Helpful: `species`, `unit_description`, `season_text`, `start_date`, `end_date`.

   Example header:
   ```text
   species,hunt_code,unit_description,season_text,start_date,end_date,bag_limit,licenses
   ```

3. **How to update each year**
   - Get the new NMDGF hunt codes CSV (or export from their site).
   - Save it as `public/data/hunt-codes.csv` (overwrite the previous year), **or** add e.g. `NMHuntCodes_2026_clean.csv` and the API will use it if present.
   - Redeploy the web app so the new list is served.

4. **API**
   - `GET /api/hunt-codes` returns the list as JSON. Use this for any web UI that needs the list (e.g. draw result hunt code picker).

---

## iOS

- The iOS app currently loads from:
  1. **Application Support** — `NMHuntCodes_2025_clean.csv` (or the filename you use when importing in-app).
  2. **App bundle** — `NMHuntCodes_2025_clean.csv` (shipped with the app).

- **Yearly update options**
  - **Option A:** Ship a new build each year with the updated CSV in the bundle (e.g. rename to `NMHuntCodes_2026_clean.csv` and point `HuntCodeStore` at it).
  - **Option B (future):** Have iOS fetch the list from `GET /api/hunt-codes` so one update on the web (replace `hunt-codes.csv`) updates both web and iOS after a refresh.

---

## Single source of truth (recommended)

- **Web:** Keep `public/data/hunt-codes.csv` as the canonical file. Each year, replace it with the new NMDGF list and redeploy.
- **iOS:** Either update the bundled CSV each year in Xcode, or (when implemented) fetch from `GET /api/hunt-codes` so the web file is the only place to update.
