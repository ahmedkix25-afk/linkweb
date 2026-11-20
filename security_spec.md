# Security Specification — Direct Sale Landing Pages System

## 1. Data Invariants

1. **Isolated Product Landing Pages**: Public visitors may ONLY `get` a single `/products/{slug}` document if `isActive == true`. Public visitors can NEVER `list` `/products` or inspect inactive/hidden products.
2. **Strict Admin Governance**: Only verified administrators (`iiiykiiiiix@gmail.com` with `email_verified == true`, or verified UIDs present in `/admins/{uid}`) may create, edit, toggle, delete, or list products, and read, list, update, or delete orders.
3. **Zero PII Exposure**: Customer orders (`/orders/{orderId}`) contain PII (`customerName`, `phone`, `governorate`, `address`). Public and non-admin authenticated users have ZERO `get` or `list` access to `/orders`.
4. **Price & Product Integrity on Order Create**: An order can ONLY be created if the referenced `/products/{productSlug}` exists, is active (`isActive == true`), `unitPrice == product.price`, `totalPrice == unitPrice * quantity`, `status == 'new'`, `paymentMethod == 'cod'`, and timestamps equal `request.time`.
5. **Immutable Audit & Pricing Fields**: Once an order is created, `orderNumber`, `productSlug`, `unitPrice`, `quantity`, `totalPrice`, `customerName`, `phone`, `createdAt`, etc., cannot be altered; admin updates are restricted strictly to `['status', 'updatedAt']`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on Product Create**: Admin creates product with extra ghost field `{"isFeatured": true}`. Expected: `PERMISSION_DENIED`.
2. **Unverified Admin Email Spoof**: User with email `iiiykiiiiix@gmail.com` and `email_verified: false` tries to list `/orders`. Expected: `PERMISSION_DENIED`.
3. **Public Catalog Scraping**: Unauthenticated visitor tries `list` on `/products`. Expected: `PERMISSION_DENIED`.
4. **Hidden Product Snooping**: Unauthenticated visitor tries `get` on `/products/draft-watch` where `isActive: false`. Expected: `PERMISSION_DENIED`.
5. **Order PII Leak (Get)**: Non-admin signed-in user tries `get` on `/orders/ord_123`. Expected: `PERMISSION_DENIED`.
6. **Order PII Leak (List)**: Non-admin signed-in user tries `list` on `/orders`. Expected: `PERMISSION_DENIED`.
7. **Price Tampering on Order Create**: Customer submits order for a 1500 EGP product with `unitPrice: 1, totalPrice: 1`. Expected: `PERMISSION_DENIED`.
8. **Total Mismatch on Order Create**: Customer submits `unitPrice: 1500, quantity: 3, totalPrice: 1500`. Expected: `PERMISSION_DENIED`.
9. **Orphan / Hidden Product Order**: Customer submits order referencing non-existent or inactive `productSlug`. Expected: `PERMISSION_DENIED`.
10. **Status Spoofing on Order Create**: Customer submits order with `status: 'delivered'`. Expected: `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Customer or admin submits client-supplied timestamp instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
12. **ID Poisoning & Value Poisoning**: Payload with 300-character document ID or 5000-char `customerName` or invalid `status: 123`. Expected: `PERMISSION_DENIED`.
