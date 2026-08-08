# ORKY commerce handoff to Orchidy

ORKY displays and selects real Orchidy products, but it is not a payment authority. The complete cart is handed to Orchidy and revalidated there before payment.

## ORKY production variables

Configure the **web / Next.js runtime** in Coolify:

```env
NEXT_PUBLIC_ORCHIDY_BASE_URL=https://orchidy.fr
ORCHIDY_API_BASE_URL=https://orchidy.fr
NEXT_PUBLIC_USE_DEMO=false

# Server-only. Must be exactly the same secret configured in Orchidy.
ORKY_CHECKOUT_HANDOFF_SECRET=<long-random-secret>
```

`docker-compose.prod.yml` now requires `ORKY_CHECKOUT_HANDOFF_SECRET` on the web runtime. Do not add it to Docker build arguments or any `NEXT_PUBLIC_*` variable.

Generate a secret with, for example:

```bash
openssl rand -hex 32
```

## Browser → ORKY server

The Shop sends only:

- Orchidy product identity;
- variant identity;
- selected options;
- quantity;
- same-origin ORKY return URL.

It does **not** send an authoritative price, total, stock value or shipping amount.

`POST /api/orchidy/checkout-handoff` validates the local shape and then signs the exact server-to-server body with HMAC-SHA256 before calling Orchidy.

## User journey

```text
ORKY real cart
  ↓
ORKY server signs cart identity/variant/quantity only
  ↓
Orchidy validates public catalogue
  ↓
one-time handoff
  ↓
Orchidy login if necessary
  ↓
Orchidy revalidates real Product + variant + stock + price + currency
  ↓
canonical Orchidy checkout
  ↓
Stripe / CinetPay / gift card settlement
  ↓
Orchidy verifies actual order state
  ↓
signed orchidy_receipt
  ↓
ORKY verifies receipt server-side
  ↓
paid: clear ORKY cart
cancelled: keep ORKY cart
```

## Demo behaviour

Production must use:

```env
NEXT_PUBLIC_USE_DEMO=false
```

If the Orchidy catalogue is unavailable, ORKY displays an explicit unavailable state and disables purchasing. Demo products are shown only when the demo flag is explicitly enabled, and their cart is non-commercial: there is no payment action.

## Deployment order

Deploy the Orchidy integration endpoint first and configure:

```env
ORKY_CHECKOUT_HANDOFF_SECRET=<same-secret>
ORKY_RETURN_ORIGINS=https://<orky-production-origin>
```

Then deploy ORKY. This prevents a window in which ORKY exposes a checkout button against an Orchidy version that does not understand the handoff contract.
