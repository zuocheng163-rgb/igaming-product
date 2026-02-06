# NeoStrike Developer Guide

Welcome to the NeoStrike iGaming Integration Platform. This guide helps you integrate with our unified API gateway.

## Getting Started

### 1. Sandbox Mode
NeoStrike provides a header-based sandbox mode. Use this to test your integration without requiring a live database or CRM connection.

**Header**: `x-sandbox-mode: true`

### 2. Authentication
All S2S (Server-to-Server) requests must include your Operator API Key.

**Header**: `x-api-key: YOUR_MASTER_SECRET`

## Core APIs

### Wallet SPI
Handle bets (debit), wins (credit), and deposits.
- `POST /api/debit`
- `POST /api/credit`
- `POST /api/deposit`

### Reporting & BI
Extract real-time performance metrics.
- `GET /api/stats/summary`: Get GGR/NGR metrics.
- `GET /api/stats/live`: Monitor real-time transaction health.

### Responsible Gaming
Receive hooks when player protection events occur.
- Webhook: `POST /api/webhooks/fasttrack`

## Resources
- **Postman Collection**: [Download here](./neostrike-postman.json)
- **API Reference**: `swagger.yaml` (Coming soon)
