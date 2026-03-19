# Active Context: Sweaty Selfie Reassembly CAPTCHA

## Current State

**Status**: ✅ Fully implemented with shame persistence and gallery

The Sweaty Selfie Reassembly CAPTCHA is a single-step, maximally humiliating CAPTCHA system built as a Next.js 16 app with TypeScript and Tailwind CSS 4.

## Recently Completed

- [x] API route for cringe scoring via Mimo-V2 Pro (`src/app/api/cringe-score/route.ts`)
- [x] Main CAPTCHA component with all phases (`src/app/SweatyCaptcha.tsx`)
- [x] Upload UI with drag-and-drop file support
- [x] Image slicing into 5x5 grid using Canvas API
- [x] Drag-and-drop puzzle with sabotage mechanics (40-70% slip chance, grip failure, sweat drops)
- [x] CSS animations: fade-in, scan, wobble, slip, sweat-glisten, drip, grip-fail, bounce-once, panic-shake
- [x] 30-second countdown timer with visual urgency (red pulse at 5s, panic shake animation)
- [x] Failure on timeout or wrong-solution submission
- [x] Shame upload to Vercel Blob on failure (`src/app/api/shame-upload/route.ts`)
- [x] Hall of Shame gallery page (`src/app/gallery/page.tsx`) showing blurred failed images
- [x] "Hall of Shame" navigation link on main page
- [x] Success screen with elapsed time, move count, bot probability
- [x] Rejection screen with AI roast and cringe score
- [x] Layout metadata and env vars configured

## Architecture

| File | Purpose |
|------|---------|
| `src/app/SweatyCaptcha.tsx` | Client component — full CAPTCHA flow (upload → scoring → puzzle → success/failed) |
| `src/app/api/cringe-score/route.ts` | Server route — calls Mimo-V2 Pro via `https://api.kilo.ai/gateway` |
| `src/app/api/shame-upload/route.ts` | Server route — uploads failed image to Vercel Blob with metadata |
| `src/app/page.tsx` | Home page — renders SweatyCaptcha |
| `src/app/gallery/page.tsx` | Hall of Shame — lists all blurred failed images from Vercel Blob |
| `src/app/globals.css` | Custom CSS animations for sabotage and urgency effects |
| `src/app/layout.tsx` | Root layout with metadata |
| `.env.local` | `KILO_API_URL`, `KILO_API_KEY`, `BLOB_READ_WRITE_TOKEN` |

## Sabotage Mechanics

- **40% base slip chance** per drop (70% if drag fast)
- **Random grip failure**: 25% chance per drag start triggers shake animation
- **Sweat drops**: 3 random tiles get 💧 overlay every 2 seconds
- **Grid wobble**: entire grid shakes every 10 seconds
- **Slip-to-wrong-position**: failed drops snap tile to adjacent wrong cell
- **30-second countdown**: red pulse at ≤10s, panic-shake animation at ≤5s
- **Wrong solution = failure**: submitting with wrong arrangement triggers failure + shame upload

## AI Integration

- Model: `xiaomi/mimo-v2-pro:free` via Kilo API (`https://api.kilo.ai/gateway/v1/chat/completions`)
- API key stored in `KILO_API_KEY` env var
- Vision analysis with custom cringe-rating prompt
- Returns score (0-100), verdict (ACCEPT/REJECT), roast text
- Threshold: 85+ to pass to puzzle phase

## Shame Persistence

- On failure: client blurs nothing (image stays as-is), uploads original to Vercel Blob
- Blob path: `shame/{timestamp}.png` (image) + `shame/{timestamp}.json` (metadata)
- Metadata includes: reason (timeout/wrong_solution), time, attempts, timestamp
- Gallery page: server component lists blobs, fetches JSON metadata, renders blurred images via `next/image` with CSS `blur-xl`
- Uses `@vercel/blob` `put()` and `list()` functions

## Current Focus

All features implemented. App is live.

## Session History

| Date | Changes |
|------|---------|
| 2026-03-19 | Built complete CAPTCHA with AI scoring and sabotage puzzle |
| 2026-03-19 | Added 30s timer, shame upload to Vercel Blob, Hall of Shame gallery |
