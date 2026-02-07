# 🎮 NeoStrike Platform - Visual Demo Guide

This guide describes how to showcase the **NeoStrike iGaming Integration Platform** using the live frontend. No terminal commands required for the demo itself!

> [!TIP]
> **Demo URL**: Use your Vercel deployment URL (e.g., `https://igaming-product.vercel.app`) for the best experience.

---

## 🤵 Scenario 1: The Player Journey
**Objective**: Build trust by showing a seamless onboarding and gaming experience.

1.  **Onboarding**: 
    - Click **"Sign Up"** on the login screen.
    - Enter a username and email. Click **"Sign Up"**.
    - *GUI Note*: Observe the transition from the Auth screen to the Hero Dashboard.
2.  **Wallet Interaction**:
    - Click the **"Deposit 100 EUR"** button.
    - **Observe**: Your "Real Balance" updates instantly with smooth animations.
3.  **Gameplay Simulation**:
    - Click the **"Play Slot (Bet 10)"** button.
    - **Observe**: The "Status Banner" shifts to **"Spinning..."**.
    - *Outcome*: If you win, you'll see a **"BIG WIN: 20!"** message and your balance will tick up.

---

## 🛡️ Scenario 2: AI Duty of Care (Compliance)
**Objective**: Demonstrate real-time player protection.

1.  **Triggering Risk**: 
    - Click the **"Play Slot"** button 5 times in very rapid succession.
2.  **Observation**: 
    - Keep an eye on the **Status Banner** (the light blue box below your balance).
    - As soon as the AI detects the **Velocity Spike**, the status will update to reflect the intervention.
    
> [!IMPORTANT]
> In this demo version, the system logic is tuned to trigger a **Velocity Spike** warning if more than 3 bets are placed within 5 seconds.

---

## 🏢 Scenario 3: The Operator Portal (Admin View)
**Objective**: Switch perspectives to the "Business Headquarters" (The Tenant Portal).

1.  **Login as Admin**:
    - Log out of the Player Dashboard.
    - Enter a username that contains the word **"admin"** (e.g., `PlatformAdmin`).
    - Enter any token/password and Login.
2.  **GUI Overview**:
    - **GGR & NGR Cards**: See Gross and Net revenue totals calculated in real-time.
    - **Live Metrics**: Monitor the "Transaction Volume" and watch for any "Large Wins" flags.
3.  **Risk Management**:
    - Scroll to the **"Churn Risk Alerts"** list.
    - **Action**: Click **"Retain"** next to a user to simulate an automated CRM intervention.

---

## 🛠️ Scenario 4: Developer Sandbox (The "Unfair Advantage")
**Objective**: Show the "Plug & Play" maturity that wins over CTOs.

- Explain to your audience that even if the **Supabase Database** is disconnected (e.g., missing credentials), the entire frontend and backend continue to function in **Sandbox Mode**.
- This allows operators to test the integration and UI *before* any data migration.

> [!NOTE]
> The platform is currently at **Level 5 Maturity**, meaning it has built-in failovers for every critical component.
