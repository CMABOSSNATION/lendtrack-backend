# LendTrack Backend — Setup Guide

## Project Structure

```
lendtrack-backend/
├── server.js              ← Entry point
├── package.json
├── .env.example           ← Copy to .env and fill in
├── supabase_schema.sql    ← Run this in Supabase SQL Editor
├── lib/
│   └── supabase.js        ← Supabase client
├── middleware/
│   └── auth.js            ← JWT auth middleware
└── routes/
    ├── auth.js            ← Register / Login
    ├── borrowers.js       ← Borrowers CRUD
    ├── loans.js           ← Loans CRUD + mark-paid
    ├── payments.js        ← Payments CRUD
    └── dashboard.js       ← Dashboard stats
```

---

## Step 1 — Set Up Supabase

1. Go to your [Supabase](https://supabase.com) project
2. Click **SQL Editor** in the left sidebar
3. Paste the contents of `supabase_schema.sql` and click **Run**
4. This creates: `users`, `borrowers`, `loans`, `payments` tables

---

## Step 2 — Deploy Backend to Render

1. Push the `lendtrack-backend/` folder to a GitHub repo
2. Go to [Render](https://render.com) → **New Web Service**
3. Connect your repo
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Add these **Environment Variables** in Render:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase **service_role** key |
| `JWT_SECRET` | `lendtrack_secret_2026` (or any long random string) |
| `FRONTEND_URL` | Your Vercel frontend URL (e.g. `https://lendtrack.vercel.app`) |

---

## Step 3 — Update Frontend

1. Replace your `src/App.jsx` with the provided `frontend-App.jsx`
2. In your Vercel project settings, add this Environment Variable:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | Your Render backend URL + `/api`  e.g. `https://lendtrack-api.onrender.com/api` |

---

## API Endpoints

### Auth
| Method | Path | Body |
|--------|------|------|
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` |

### Borrowers (requires Bearer token)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/borrowers` | List all |
| POST | `/api/borrowers` | `{ name, phone, address, id_type, id_no }` |
| PUT | `/api/borrowers/:id` | Same fields |
| DELETE | `/api/borrowers/:id` | Cascades to loans+payments |

### Loans (requires Bearer token)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/loans` | `?status=Overdue` or `?borrower_id=xxx` |
| POST | `/api/loans` | `{ borrower_id, principal, interest_rate, term_days, start_date, notes }` |
| PUT | `/api/loans/:id` | Same fields |
| POST | `/api/loans/:id/mark-paid` | Fully settles loan |
| DELETE | `/api/loans/:id` | Cascades to payments |

### Payments (requires Bearer token)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/payments` | `?loan_id=xxx` |
| POST | `/api/payments` | `{ loan_id, amount, date, method, note }` |
| DELETE | `/api/payments/:id` | |

### Dashboard (requires Bearer token)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/dashboard` | Returns totals, overdue list, due-soon, recent payments |

---

## Notes

- All data is scoped per user — each lender only sees their own borrowers/loans
- Overdue loans are auto-detected on every GET /api/loans call
- Paying a loan that reaches ₱0 balance auto-marks it as Paid
- Deleting a borrower cascades to delete all their loans and payments
