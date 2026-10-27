# ?? Career Finder — Automated Naukri Job Crawler & Telegram Alerts

> **Tailored for:** Ankit Singh (Full Stack Developer: React.js, Next.js, Node.js, TypeScript | 1-3 Years Experience)  
> **Infrastructure:** 100% Lifetime Free via GitHub Actions Cloud (Zero Server Cost)

---

## ?? Latest System Updates (Migration & Cloud Architecture)

### 1. Zero-Cost Migration (GCP VM ? GitHub Actions Cloud)
* **Pichhla Setup**: Google Cloud Platform (GCP) Compute Engine VM (`career-crawler` in `us-central1-a`) par 24/7 chal raha tha, jisse har mahine heavy hourly compute aur static IP billing generate ho rahi thi.
* **Naya Cloud Setup**: Scraper ko **GitHub Actions** par migrate kar diya gaya hai.
  * **Cost**: **?0 / Lifetime Free** (GitHub ke monthly 2,000 free minutes use karta hai).
  * **Zero Server Maintenance**: Na server stop hone ka dar, na tablet/PC on rakhne ki zarurat.

### 2. Automated Scheduled Scans (Cron Schedule)
* GitHub Actions workflow [`.github/workflows/naukri_crawler.yml`](.github/workflows/naukri_crawler.yml) add kiya gaya hai jo din ke peak hiring hours me automatic run hota hai:
  * ?? **09:30 AM IST** (Morning fresh job postings)
  * ?? **01:30 PM IST** (Midday recruiter postings)
  * ?? **05:30 PM IST** (Evening digest)
  * ?? **09:30 PM IST** (Night wrap-up)
* Saath hi **1-Click Manual Trigger** (`workflow_dispatch`) enabled hai, jisse GitHub web UI se kisi bhi waqt instant scan trigger kiya ja sakta hai.

### 3. Smart Single-Cycle Runner (`scripts/run_once.js`)
* Naya execution script [`scripts/run_once.js`](scripts/run_once.js) banaya gaya hai:
  * Headless Chromium (Playwright) spin-up karta hai.
  * Naukri.com se Ankit Singh ke 9 targeted search keywords scrape karta hai.
  * Job description aur title match score calculate karta hai (Threshold: `>= 65%`).
  * Naye matches ko directly **Telegram Bot** ke zariye format karke HTML card ke roop me bhejta hai with 1-click **[Apply Now on Naukri]** button.

### 4. Dynamic Cloud & Local Environment Support
* [`scripts/auto_scheduler.js`](scripts/auto_scheduler.js) ko upgrade kiya gaya hai:
  * Ab yeh local machine par `.env` file se credentials padhta hai.
  * GitHub Cloud par bina kisi file ke secure **GitHub Repository Secrets** (`${{ secrets.TELEGRAM_BOT_TOKEN }}` aur `${{ secrets.TELEGRAM_CHAT_ID }}`) se dynamically read karta hai.

### 5. Automated Cache Sync & Duplicate Prevention (`jobs.db`)
* Workflow har execution ke baad updated [`jobs.db`](jobs.db) (SQLite) ko wapas repository me commit karta hai with `[skip ci]`.
* Isse pehle se bheji ja chuki jobs dobara Telegram par duplicate spam nahi karti.

### 6. Security Hardening
* `.gitignore` implement kiya gaya hai jo `.env`, raw credentials aur heavy caches ko leak hone se protect karta hai.
* Sample configuration ke liye [`.env.example`](.env.example) create kiya gaya hai.

---

## ??? Tech Stack
* **Language & Runtime**: Node.js 20 LTS (CommonJS)
* **Headless Browser**: Playwright v1.63 (Chromium)
* **Database**: SQLite3 (`jobs.db`)
* **Notification Engine**: Telegram Bot API (HTML Parse Mode)
* **CI/CD & Cloud Cron**: GitHub Actions (`ubuntu-latest`)

---

## ?? Configuration & Environment Secrets

| Variable | Description | Default / Example |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API Token | `8843235851:AA...` (Set in GitHub Secrets) |
| `TELEGRAM_CHAT_ID` | Telegram Chat/User ID | `1581067991` (Set in GitHub Secrets) |
| `MIN_MATCH_SCORE` | Minimum match score threshold | `65` (Only 65%+ matching jobs sent) |
| `BATCH_SIZE` | Max alerts sent per scan cycle | `20` |

---

## ?? Manual Execution Options

### Option A: GitHub Cloud se Run karna (No PC Needed)
1. GitHub repo par jaiye: `https://github.com/ankitsinghbash/Career_finder/actions`
2. **"Naukri Career Crawler & Telegram Alerts"** workflow select karein.
3. **"Run workflow"** ? **"Run workflow"** par click karein. 40 seconds me Telegram par alert aa jayega.

### Option B: Local PC par Background me Chalana
```powershell
cd D:\Office\Wapine_Project\Career_finder
npm install
node scripts/run_once.js
```
Ya continuous daemon mode ke liye:
```powershell
npm run automate
```

---

*Updated on: 2026-10-28 | Maintained by Ankit Singh*
