# Samskara FIFA Predictions - Google Sheets Live Leaderboard

A premium, esports-themed real-time leaderboard dashboard for FIFA predictions, styled in a visual Red, White, and Black theme. 

The app connects directly to a published Google Sheets CSV URL, refreshing automatically every 30 seconds.

---

## ⚡ Quick Start (Local Run)

1. Install local dependencies (Express static dev server):
   ```bash
   npm install
   ```

2. Start the dev server:
   ```bash
   npm start
   ```

3. Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🌐 Production Hosting Deployment (How to make it public)

Since this project has no server dependencies in production, you can deploy it for free:

### 1. Vercel (Recommended & Free)
1. Push this folder to a GitHub repository.
2. Sign in to [Vercel](https://vercel.com) and click **Add New > Project**.
3. Import your GitHub repository and click **Deploy**. Vercel will automatically detect the static project and serve it.

### 2. Render (Free Static Site)
1. Push this folder to a GitHub repository.
2. Go to [Render](https://render.com) and click **New > Static Site**.
3. Link your GitHub repo.
4. Set the **Publish Directory** to `.` (the root directory) and leave **Build Command** blank. Click **Deploy**.

---

## 📊 Google Sheets Published URL Feed

The app polls the following Google Sheets published CSV URL directly from the client browser every 30 seconds:
`https://docs.google.com/spreadsheets/d/e/2PACX-1vSHpBTst-Wrkn67bMHGmLRobrHa0vXxmp81VXfy1QNFYSPwqnMEJmPxjyF_DNGyEinsJDjJqlLYxft0/pub?output=csv`

Data is dynamically mapped and sorted descending by the `TOTAL` column.
