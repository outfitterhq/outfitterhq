# Hunt codes data

- **`hunt-codes.csv`** — Preferred. Replace this file each year with the new NMDGF hunt codes list. Same format as `NMHuntCodes_*_clean.csv` (see below).
- **`NMHuntCodes_2025_clean.csv`** — Fallback used by the API if `hunt-codes.csv` is missing. You can add `NMHuntCodes_2026_clean.csv` etc. for new years.

CSV must include a `hunt_code` (or `code`) column. Optional: `species`, `unit_description`, `season_text`, `start_date`, `end_date`.

See **docs/HUNT_CODES_UPDATE.md** for full yearly-update instructions (web + iOS).
