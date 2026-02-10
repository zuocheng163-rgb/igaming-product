# 🎮 NeoStrike Platform - Visual Demo Guide

This guide describes how to showcase the **NeoStrike iGaming Integration Platform (Serverless Edition)**.

> [!TIP]
> **Demo URLs**:
> - **Player Experience**: [vercel-url.app/player](https://igaming-product.vercel.app/player)
> - **Operator Command Center**: [vercel-url.app/portal](https://igaming-product.vercel.app/portal)

---

## 🤵 Scenario 1: The Player Journey
**Objective**: Showcase a premium, high-stakes consumer experience.

1.  **Direct Access**: Navigate to `/player`.
2.  **Onboarding**: Click **"Sign Up"** and create a test identity.
3.  **Wallet Interaction**: 
    - Deposit 100 EUR. Observe the **instant balance sync**.
    - Play a few rounds. Note the **real-time win notifications**.
4.  **AI Duty of Care**: 
    - Click "Play Slot" 5 times rapidly. 
    - **Observe**: The "Reality Check" modal triggers instantly, demonstrating our real-time behavioral monitoring.

---

## 🏢 Scenario 2: NeoStrike Operator Portal (Serverless Edition)
**Objective**: Showcase the power of a stateless, high-performance Command Center.

1.  **The Entry**: Navigate to `/portal`. Note the **"OPERATOR COMMAND CENTER"** branding.
2.  **Stateless Monitoring**:
    - **The Bell**: Point out the Notification Bell. Explain that it uses **stateless polling (SWR)** to check for alerts every 30s without keeping a single socket open.
    - **Notification Drawer**: Click the bell to reveal the slide-out drawer with chronological operational events.
3.  **Business Intelligence (Glassmorphism)**:
    - **KPI Strip**: Highlight the "Glass-card" widgets for Active Players, GGR, and Approval Rates.
    - **GGR Trend Chart**: Show the interactive 30-day performance graph. Explain that this loads in **<1.5s** because the data is pre-aggregated via serverless cron jobs.
4.  **Omni-Search (Efficiency)**:
    - Press **Ctrl + K** or focus the search bar.
    - Explain how operators can instantly pivot between Player Profiles and Transaction Audits from a single entry point.

---

## 🛠️ Scenario 3: The "Serverless Advantage" (For CTOs)
**Objective**: Sell the infrastructure efficiency.

- **Infrastructure Zero**: Explain that this entire portal runs on **Vercel & Supabase Edge Functions**. No servers to manage, no Kubernetes, no persistent state.
- **Auto-Scaling**: Because every request is stateless, the portal scales horizontally to 1,000+ simultaneous operators without any database connection pool exhaustion.
- **Resilience**: Point out that the system continues to function even during heavy load because of the **PostgreSQL logic-tier** (Triggers & Functions) handling the heavy lifting.

> [!NOTE]
> The platform is now at **Maturity Level 5**, providing enterprise-grade stability with zero infrastructure overhead.
