# B2B Portal — Enterprise B2B Marketplace Platform

An IndiaMart-grade B2B digital marketplace connecting verified Indian
manufacturers, wholesalers, distributors and exporters with buyers
across India and globally.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | NestJS 10, Node.js 20 LTS |
| Database | PostgreSQL 15 (Supabase) |
| ORM | Prisma 5 |
| Cache | Redis 7 (Upstash) |
| Search | Elasticsearch 8 |
| Auth | NextAuth.js + JWT |
| Payments | Razorpay (UPI, Cards, NetBanking) |
| SMS / OTP | MSG91 (DLT registered) |
| Email | SendGrid |
| Deployment | Docker + AWS EC2 |

## Project Structure

```
b2b-portal/
├── apps/
│   ├── web/          # Next.js 14 frontend (port 4000)
│   └── api/          # NestJS backend API (port 4001)
├── packages/
│   ├── shared-types/
│   ├── shared-components/
│   └── shared-utils/
├── infrastructure/
│   └── docker/
└── docs/
```

## Getting Started

### Prerequisites
- Node.js 20+
- npm 9+
- PostgreSQL (or Supabase account)

### Installation

```bash
# Clone the repository
git clone https://github.com/AnbuMannan/B2B-Portal.git
cd B2B-Portal

# Install all dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Generate Prisma client
cd apps/api
npx prisma generate --schema=src/database/schema.prisma

# Run database migrations
npx prisma migrate deploy --schema=src/database/schema.prisma

# Seed initial data
npx ts-node --transpile-only src/database/seed.ts
```

### Development

```bash
# Run both frontend and backend together
npm run dev

# Or run separately:
npm run dev:api     # Backend on http://localhost:4001
npm run dev:web     # Frontend on http://localhost:4000
```

### API Documentation

Once running, visit: `http://localhost:4001/api/docs`

## Modules

### Completed
- ✅ Phase 0: Infrastructure (Redis, Elasticsearch, BullMQ, Auth, Feature Flags)
- ✅ Module 1: Homepage (live buy leads ticker, categories, featured sellers)
- ✅ Module 2: Category & Product Listing (filters, grid, pagination)
- ✅ Module 3: Product Detail Page (pricing tiers, seller card, enquiry)
- ✅ Module 4: Seller Public Profile Page

### In Progress
- 🔄 Module 5: Search & Discovery Engine
- 🔄 Module 8: Seller Registration & KYC

### Planned
- Modules 5–7: Public Website
- Modules 8–14: Seller Platform
- Modules 15–20: Buyer Platform
- Modules 21–28: Admin Panel & Compliance
- Modules 29–35: Payments & Notifications
- Modules 36–40: Analytics & Advanced Features

## Indian Regulatory Compliance

- DPDP Act 2023 (Digital Personal Data Protection)
- IT Act Section 79 (Intermediary Liability)
- Consumer Protection (E-Commerce) Rules 2020
- GST e-Invoicing with IRN generation
- UIDAI Aadhaar guidelines (masked storage only)

## License

Proprietary — All rights reserved.
Developed by Anbalagan Mannan.
