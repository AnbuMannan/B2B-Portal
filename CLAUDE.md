# CLAUDE.md — B2B Marketplace Portal

> This file is the authoritative guide for all AI-assisted development on this codebase.
> Read every section before writing a single line of code.

---

## 1. PROJECT OVERVIEW

- **Project name**: B2B Marketplace Portal
- **Architecture**: NestJS 10 API + Next.js 14 Web — npm workspaces monorepo
- **Target market**: Indian B2B (IndiaMart-grade), Razorpay payments, MSG91 SMS, GSTN/DGFT/Udyam govt API integration
- **Current status**: Phases 0–3 complete. Modules 1–20 done. **Phase 4 starts at Module 21.**
- **API port**: 4001 | **Web port**: 4000
- **Prisma schema location**: `apps/api/src/database/schema.prisma` (NOT `apps/api/prisma/`)

---

## 2. TECH STACK

### Backend (`apps/api`)
| Concern | Package | Version |
|---|---|---|
| Framework | `@nestjs/common` | ^10.3.0 |
| ORM | `@prisma/client` + `prisma` | ^5.6.0 |
| Database | PostgreSQL (Supabase) | — |
| Cache / Sessions | `redis` | ^4.6.10 |
| Queue | `bullmq` + `bull` + `@nestjs/bull` | ^5.6.0 / ^4.16.5 / ^11.0.4 |
| Search | `@elastic/elasticsearch` | ^8.11.0 |
| Auth | `@nestjs/jwt` + `passport-jwt` | ^10.1.1 / ^4.0.1 |
| Payment | `razorpay` | ^2.9.0 |
| SMS | MSG91 via `axios` | — |
| PDF | `pdfkit` | ^0.18.0 |
| Image | `sharp` | ^0.32.6 |
| OTP/2FA | `otplib` | ^13.4.0 |
| Validation | `class-validator` + `class-transformer` | ^0.14.0 / ^0.5.1 |
| Swagger | `@nestjs/swagger` | ^7.1.15 |

### Frontend (`apps/web`)
| Concern | Package | Version |
|---|---|---|
| Framework | `next` | ^14.0.0 |
| React | `react` + `react-dom` | ^18.2.0 |
| Styling | `tailwindcss` | ^3.3.6 |
| Data fetching | `@tanstack/react-query` | ^5.95.2 (devDep) |
| HTTP | `axios` | ^1.13.6 |
| Auth | `next-auth` | ^4.24.13 |
| Forms | `react-hook-form` + `@hookform/resolvers` | ^7.72.0 / ^3.10.0 |
| Validation | `zod` | ^3.25.76 |
| UI | `@headlessui/react`, `@radix-ui/*`, `lucide-react` | various |
| Toast | `react-hot-toast` | ^2.6.0 |
| Charts | `recharts` | ^3.8.1 |
| Rich text | `@tiptap/react` | ^2.11.7 |
| Animation | `framer-motion` | ^10.18.0 |

### Root
- **TypeScript**: ^5.3.3
- **Node**: >=20.0.0 | **npm**: >=9.0.0

---

## 3. FOLDER STRUCTURE

```
B2B_Portal/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── app.module.ts              ← Root module; register new modules here
│   │       ├── main.ts
│   │       ├── config/
│   │       │   └── configuration.ts       ← All env var definitions + validation
│   │       ├── database/
│   │       │   ├── schema.prisma          ← THE schema file (not apps/api/prisma/)
│   │       │   ├── database.module.ts
│   │       │   └── database.service.ts    ← PrismaService — inject this everywhere
│   │       ├── common/
│   │       │   ├── dto/
│   │       │   │   ├── api-response.dto.ts   ← ApiResponseDto (sacred)
│   │       │   │   └── pagination.dto.ts
│   │       │   ├── guards/
│   │       │   │   ├── jwt-auth.guard.ts     ← JwtAuthGuard (sacred)
│   │       │   │   └── role-based.guard.ts   ← RoleBasedGuard global (sacred)
│   │       │   ├── decorators/
│   │       │   │   └── current-user.decorator.ts
│   │       │   ├── filters/
│   │       │   │   ├── base-exception.filter.ts
│   │       │   │   ├── database-exception.filter.ts
│   │       │   │   ├── jwt-exception.filter.ts
│   │       │   │   └── validation-exception.filter.ts
│   │       │   ├── interceptors/
│   │       │   │   ├── cache.interceptor.ts
│   │       │   │   ├── feature-flag.interceptor.ts
│   │       │   │   ├── logging.interceptor.ts
│   │       │   │   └── request-id.interceptor.ts
│   │       │   ├── middleware/
│   │       │   │   └── rate-limit.middleware.ts
│   │       │   ├── services/
│   │       │   │   └── cache-invalidation.service.ts
│   │       │   ├── audit/
│   │       │   ├── constants/
│   │       │   ├── events/
│   │       │   ├── exceptions/
│   │       │   ├── utils/
│   │       │   └── validators/
│   │       ├── services/
│   │       │   ├── redis/                 ← RedisModule + RedisService
│   │       │   ├── feature-flags/         ← FeatureFlagsModule
│   │       │   └── file-system/           ← FileSystemService
│   │       └── modules/                   ← All feature modules live here
│   │           ├── audit/                 ← COMPLETE (M7)
│   │           ├── auth/                  ← COMPLETE (M1)
│   │           ├── buy-leads/             ← COMPLETE (M6)
│   │           ├── buyer/                 ← COMPLETE (M15)
│   │           ├── complaints/            ← COMPLETE (M20)
│   │           ├── compliance/            ← COMPLETE
│   │           ├── feature-flags/         ← COMPLETE
│   │           ├── health/                ← COMPLETE
│   │           ├── homepage/              ← COMPLETE (M2)
│   │           ├── lead-contact/          ← COMPLETE (M12)
│   │           ├── products/              ← COMPLETE (M3)
│   │           ├── queue/                 ← COMPLETE — queue infrastructure
│   │           ├── search/                ← COMPLETE (M5)
│   │           ├── seller-kyc/            ← COMPLETE (M8)
│   │           ├── seller-products/       ← COMPLETE (M4)
│   │           ├── sellers/               ← COMPLETE (M2)
│   │           ├── seo/                   ← COMPLETE (M14)
│   │           ├── upload/                ← COMPLETE (M14)
│   │           ├── wallet/                ← COMPLETE (M10/M11)
│   │           └── webhooks/              ← COMPLETE (M11)
│   └── web/
│       └── app/
│           ├── api/auth/[...nextauth]/    ← NextAuth config (sacred)
│           ├── auth/
│           │   ├── register/
│           │   ├── signin/
│           │   └── signup/
│           ├── buy-leads/
│           ├── buyer/
│           │   ├── dashboard/
│           │   ├── complaints/
│           │   ├── orders/
│           │   ├── profile/
│           │   ├── quotes/
│           │   ├── requirements/
│           │   └── saved/
│           ├── category/
│           ├── contact/
│           ├── post-requirement/
│           ├── product/
│           ├── providers/                 ← React Query + NextAuth + Theme providers
│           ├── search/
│           ├── seller/
│           │   ├── [sellerId]/
│           │   ├── analytics/
│           │   ├── buy-leads/
│           │   ├── complaints/
│           │   ├── dashboard/
│           │   ├── kyc-submitted/
│           │   ├── products/
│           │   ├── profile/
│           │   ├── register/
│           │   ├── settings/
│           │   └── wallet/
│           ├── sellers/
│           └── support/
└── packages/                              ← shared-types, shared-components, shared-utils
```

---

## 4. PROTECTED — DO NOT MODIFY

These are sacred. Never touch without **explicit written instruction**.

### BullMQ Queue Names (defined in `apps/api/src/modules/queue/queue.module.ts`)
```
notifications
search-sync
search-analytics
email
sms
export
payments
otp
```
Never rename, never add new queues by creating new queue files. Use existing queues only.

### Redis Key Prefixes (defined in `apps/api/src/services/redis/`)
- `auth:user:{userId}` — cached user object, TTL 300 s

### Guards
- **`JwtAuthGuard`** — `apps/api/src/common/guards/jwt-auth.guard.ts` — extends `AuthGuard('jwt')`, attaches `request.user`
- **`RoleBasedGuard`** — `apps/api/src/common/guards/role-based.guard.ts` — global APP_GUARD, enforces `@Roles()`, validates JWT itself (runs before route-level guards)

### Prisma Enum Values — NEVER delete, only append
| Enum | Values |
|---|---|
| `Role` | SELLER, BUYER, ADMIN |
| `CompanyType` | PROPRIETORSHIP, PRIVATE_LIMITED, LLP |
| `BusinessModel` | MANUFACTURER, WHOLESALER, DISTRIBUTOR, RETAILER |
| `BusinessType` | COMPANY, TRADER, CONSUMER |
| `KycStatus` | PENDING, APPROVED, REJECTED |
| `AvailabilityStatus` | IN_STOCK, OUT_OF_STOCK |
| `AdminApprovalStatus` | PENDING, APPROVED, REJECTED |
| `ContactChannel` | WHATSAPP, TELEGRAM, EMAIL |
| `RepeatOption` | NONE, WEEKLY, MONTHLY |
| `RequirementType` | RETAIL, WHOLESALE |
| `Currency` | INR, USD |
| `LeadCreditTxnType` | PURCHASE, SPEND, REFUND |
| `OrderStatus` | QUOTED, ACCEPTED, REJECTED, FULFILLED, CANCELLED |
| `PaymentStatus` | PENDING, COMPLETED, FAILED, REFUNDED |
| `QuoteStatus` | PENDING, ACCEPTED, REJECTED |
| `AdminEntityType` | SELLER_KYC, PRODUCT_LISTING, BUYER_FRAUD |
| `AuditAction` | CREATE, UPDATE, DELETE |
| `NegotiationRole` | BUYER, SELLER |
| `ComplaintCategory` | FRAUD, PRODUCT_QUALITY, PAYMENT, DELIVERY, OTHER |
| `ComplaintStatus` | OPEN, IN_PROGRESS, RESOLVED, CLOSED |

### ApiResponseDto — `apps/api/src/common/dto/api-response.dto.ts`
```ts
// The ONLY allowed response shapes:
ApiResponseDto.success(message: string, data?: T, statusCode?: number)
ApiResponseDto.error(message: string, error?: any, statusCode?: number)
```
Never return raw objects from controllers. Always wrap in `ApiResponseDto`.

### Feature Flags
- `FeatureFlag` Prisma model stores flag state; controlled by `FEATURE_FLAGS_MODE` env var
- `FeatureFlagsModule` at `apps/api/src/services/feature-flags/`
- Do not bypass or remove flag checks

### Compliance-critical fields (no rename, no delete)
- `Seller`: `gstNumber`, `panNumber`, `aadhaarLastFour`, `iecCode`, `udyamNumber`, `kycStatus`
- `LeadCreditTransaction`: `gstAmount`, `baseAmount`, `totalAmount`, `invoiceNumber`, `invoicePath`, `razorpayPaymentId`
- `LeadContactReveal`: `buyerPhoneNumber`, `buyerEmail`, `buyerWhatsapp` (PII — encrypted at app layer)
- `ComplaintTicket`: `slaDeadline`, `slaBreach` (Consumer Protection Rules 2020)

### NextAuth Configuration
- Location: `apps/web/app/api/auth/[...nextauth]/auth.tsx`
- Extends NextAuth `Session` and `JWT` types with `id`, `role`, `accessToken`
- Never restructure the credential flow — it calls NestJS `/api/auth/login`

---

## 5. CODING CONVENTIONS

### Backend Controller Pattern
```ts
import { Body, Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ExampleService } from './example.service';
import { CreateExampleDto } from './dto/create-example.dto';

@ApiTags('example')
@Controller('example')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles('SELLER')
  @ApiOperation({ summary: 'Create example' })
  @ApiResponse({ status: 201 })
  async create(
    @Body() dto: CreateExampleDto,
    @CurrentUser() user: { id: string; role: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.exampleService.create(dto, user.id);
    return ApiResponseDto.success('Created successfully', result);
  }
}
```

### Backend Service Pattern
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ExampleService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notifQueue: Queue,
    // Only inject queues that already exist in queue.module.ts
  ) {}

  async create(dto: CreateExampleDto, userId: string) {
    return this.prisma.someModel.create({ data: { ...dto, userId } });
  }
}
```

### DTO Validation Pattern
```ts
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateExampleDto {
  @ApiProperty({ example: 'value' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
```

### Module Registration Pattern
```ts
// In example.module.ts
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: 'notifications' }), // only existing queues
  ],
  controllers: [ExampleController],
  providers: [ExampleService],
  exports: [ExampleService],
})
export class ExampleModule {}

// Then in apps/api/src/app.module.ts — add to imports array:
import { ExampleModule } from './modules/example/example.module';
// ...
imports: [..., ExampleModule]
```

### Error Handling
- Throw NestJS built-in exceptions: `NotFoundException`, `ConflictException`, `BadRequestException`, `ForbiddenException`, `UnauthorizedException`
- Global filters (`BaseExceptionFilter`, `DatabaseExceptionFilter`, `ValidationExceptionFilter`, `JwtExceptionFilter`) handle formatting — do not catch-and-reformat in services

### Frontend Page Pattern (`'use client'`)
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export default function ExamplePage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await axios.get(`${API_URL}/api/example`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data.data);
      } catch {
        router.push('/auth/signin');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  return <div className="p-6">…</div>;
}
```

### API Call Pattern from Frontend
- Use `axios` with `NEXT_PUBLIC_API_URL` base
- Read JWT from `localStorage.getItem('accessToken')` for client components
- Server-side: use `INTERNAL_API_URL` env var (falls back to `NEXT_PUBLIC_API_URL`)
- Next.js rewrites proxy `/api/*` (except `/api/auth/*`) to the NestJS backend

---

## 6. DATABASE RULES

- **Schema file**: `apps/api/src/database/schema.prisma` — this is the single source of truth
- **Run migrations**: `npm run db:migrate --workspace=apps/api` (dev) / `npm run db:deploy --workspace=apps/api` (prod)
- **Never rename existing columns** — add new nullable columns instead
- **Always add DB indexes** for:
  - Foreign key fields
  - Fields used in `WHERE` clauses with high cardinality
  - Timestamp fields used in `ORDER BY`
- **Enum rule**: never delete existing enum values, only append new ones
- **Decimal precision**: monetary fields use `@db.Decimal(18, 2)`, quantity fields use `@db.Decimal(18, 4)`
- **Soft deletes**: use `deletedAt DateTime?` pattern — never hard-delete user, seller, buyer, product, or order records
- **PII fields**: encrypt at application layer before writing — do not store raw PII without encryption (see `LeadContactReveal`)
- **Aadhaar**: only last 4 digits — never store full Aadhaar number

---

## 7. MODULE BUILD RULES

Apply to every new module without exception:

1. **Complete production code only** — no `// TODO`, no placeholder implementations, no `throw new Error('not implemented')`
2. **Auth on every protected endpoint** — `@UseGuards(JwtAuthGuard)` + `@Roles('SELLER'|'BUYER'|'ADMIN')` as appropriate
3. **Every DTO** must have `class-validator` decorators on every field and `@ApiProperty` for Swagger
4. **Every service** injects `PrismaService` via constructor — no direct `new PrismaClient()`
5. **BullMQ jobs** — use existing queue names from `queue.module.ts` only. Import `BullModule.registerQueue({ name: '...' })` in the feature module, inject via `@InjectQueue('...')` in service
6. **Always return `ApiResponseDto`** from controllers — never raw objects
7. **Frontend pages** — use existing Tailwind classes, match visual style of `/apps/web/app/seller/dashboard/page.tsx` as reference
8. **New npm packages** — state explicitly before installing; explain why an existing package cannot solve the problem
9. **New module checklist**:
   - [ ] `example.module.ts` + `example.controller.ts` + `example.service.ts`
   - [ ] `dto/` folder with request/response DTOs
   - [ ] Module imported in `apps/api/src/app.module.ts`
   - [ ] Prisma migration if schema changes
   - [ ] Frontend page(s) in `apps/web/app/`

---

## 8. ENVIRONMENT VARIABLES

### Required (app will not start without these)
| Variable | Description |
|---|---|
| `NODE_ENV` | `development` \| `production` \| `test` |
| `POSTGRES_URL` | Supabase pooler URL (pgbouncer, port 6543), `connection_limit=1` |
| `DIRECT_URL` | Direct Postgres URL (port 5432) — **required for Prisma migrations** |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | Min 32 chars — sign access tokens |
| `NEXTAUTH_SECRET` | Min 32 chars — NextAuth session encryption |
| `NEXTAUTH_URL` | Frontend URL for NextAuth callbacks (e.g. `http://localhost:4000`) |
| `RAZORPAY_KEY_ID` | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret |
| `MSG91_AUTHKEY` | MSG91 SMS gateway auth key |
| `ENCRYPTION_KEY` | 64-char hex — AES-256-GCM for PII fields (buyer contact, Aadhaar) |
| `NEXT_PUBLIC_API_URL` | Public API URL (consumed by browser, e.g. `http://localhost:4001`) |

### Required but have defaults
| Variable | Default | Description |
|---|---|---|
| `PORT` | `4001` | NestJS API port |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch node URL |
| `REDIS_URL` | — | Redis connection URL (comment out to disable in dev) |
| `FRONTEND_URL` | `http://localhost:4000` | CORS + redirect base |
| `BACKEND_URL` | `http://localhost:4001` | Internal API base |
| `CORS_ORIGIN` | `http://localhost:4000` | Comma-separated allowed origins |
| `FILE_UPLOAD_DIR` | `./uploads` | Local file upload directory |
| `MAX_FILE_SIZE` | `10485760` | Max upload size in bytes (10 MB) |
| `BCRYPT_SALT_ROUNDS` | `12` | Password hashing rounds |
| `JWT_EXPIRES_IN` | `7d` | Access token expiry |
| `LOG_LEVEL` | `info` | Winston log level |
| `FEATURE_FLAGS_MODE` | `database` | `database` reads from DB, `config` uses static config |

### Optional
| Variable | Description |
|---|---|
| `INTERNAL_API_URL` | Server-side API URL for SSR (falls back to `NEXT_PUBLIC_API_URL`) |
| `GSTN_SANDBOX_KEY` | GSTN government API key (sandbox) |
| `DGFT_API_KEY` | DGFT IEC verification API key |
| `GSTN_API_URL` | GSTN API base URL |
| `INCOME_TAX_API_URL` | Income tax verification API URL |
| `UDYAM_API_URL` | Udyam registration API URL |
| `AWS_REGION` | AWS S3 region (future migration) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_BUCKET_NAME` | S3 bucket name |
| `DATADOG_API_KEY` | Datadog monitoring |
| `SENTRY_DSN` | Sentry error tracking |
| `DATABASE_URL` | Direct connection alias (used over POSTGRES_URL in runtime Prisma client to avoid pool exhaustion) |

---

## 9. CURRENT MODULE STATUS

All modules below are **COMPLETE** — do not rebuild, do not refactor unless explicitly asked.

| Module | Name | Status |
|---|---|---|
| M1 | Auth (register, login, OTP, 2FA, refresh token, password reset) | COMPLETE |
| M2 | Homepage + Seller profiles + State filtering | COMPLETE |
| M3 | Product catalog (public browse, categories) | COMPLETE |
| M4 | Seller product management (CRUD, multi-tier pricing) | COMPLETE |
| M5 | Search (Elasticsearch, autocomplete, CTR tracking) | COMPLETE |
| M6 | Buy leads (post, browse, filter) | COMPLETE |
| M7 | Audit log | COMPLETE |
| M8 | Seller KYC (document upload, admin review, 2FA, refresh tokens, business profile) | COMPLETE |
| M9 | Notifications (in-app, preferences) | COMPLETE |
| M10 | Lead credit wallet (balance, top-up via Razorpay) | COMPLETE |
| M11 | Webhooks (Razorpay payment verification) | COMPLETE |
| M12 | Lead contact reveal (credit deduction, watchlist) | COMPLETE |
| M13 | Admin panel (approvals, KYC review) | COMPLETE |
| M14 | SEO + file upload (logo, product images, WebP conversion) | COMPLETE |
| M15 | Buyer profile (registration, dashboard, saved sellers/products) | COMPLETE |
| M16 | Post buy requirement (requirement type, currency, delivery state) | COMPLETE |
| M17 | Quote management (seller quotes on buy leads, negotiation messages) | COMPLETE |
| M18 | Orders (lifecycle: QUOTED → ACCEPTED → FULFILLED) | COMPLETE |
| M19 | Buyer watchlist (saved products, saved sellers) | COMPLETE |
| M20 | Complaints & support tickets (SLA, admin responses, grievance) | COMPLETE |

**Phase 4 begins at Module 21.**

---

## 10. TESTING & VERIFICATION

After building any module, verify:

- [ ] `npm run typecheck --workspace=apps/api` — zero TypeScript errors
- [ ] `npm run typecheck --workspace=apps/web` — zero TypeScript errors
- [ ] No circular dependency warnings in NestJS startup log
- [ ] List any new Prisma migrations added under `apps/api/src/database/migrations/`
- [ ] List any new environment variables added (update `.env.example` and section 8 above)
- [ ] Confirm all new controller endpoints are registered in AppModule (or in the module that is already imported by AppModule)
- [ ] Confirm all new queue consumers use only existing queue names

---

## 11. CAVEMAN MODE

**Default response style: CAVEMAN MODE ON.**

- Skip preamble. No "I'll now create…". No "This service will handle…". No "Great question!".
- Write the code. Explain only when asked.
- No filler comments. Code is self-documenting via naming.
- One comment max, only if the WHY is non-obvious (hidden constraint, compliance rule, workaround).
- No trailing summaries of what you just wrote — the diff speaks for itself.
