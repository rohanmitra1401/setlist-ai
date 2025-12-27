---
description: Deploy the Setlist AI application to Vercel
---

# Deploy to Vercel

This workflow will guide you through deploying your Next.js application to Vercel.

1.  **Install Vercel CLI**
    We need the Vercel CLI to deploy from the terminal.
    ```bash
    npm i -g vercel
    ```

2.  **Login to Vercel**
    Authenticate with your Vercel account.
    ```bash
    vercel login
    ```

3.  **Link Project**
    Link this local directory to a Vercel project.
    // turbo
    ```bash
    vercel link
    ```

4.  **Pull Environment Variables (Optional)**
    If you have already set up env vars on Vercel, pull them down. Otherwise, you'll need to set them up in the dashboard or via CLI.
    ```bash
    vercel env pull .env.production.local
    ```

5.  **Build & Deploy (Preview)**
    Create a preview deployment to test everything.
    ```bash
    vercel
    ```

6.  **Deploy to Production**
    Ship it to the live URL!
    ```bash
    vercel --prod
    ```

> [!IMPORTANT]
> **Environment Variables**:
> Make sure you have added the following variables to your project settings in the Vercel Dashboard (Settings > Environment Variables):
> - `SPOTIFY_CLIENT_ID`
> - `SPOTIFY_CLIENT_SECRET`
> - `NEXTAUTH_SECRET`
> - `NEXTAUTH_URL` (Set to your Vercel domain, e.g. `https://your-project.vercel.app`)
