# PharmaStore CareFlow System

PharmaStore CareFlow is a production-grade healthcare EMR and pharmacy management application.

## System Architecture

The project consists of:
1. **Backend**: NestJS application with a global shared Firestore instance (fully singleton resolved).
2. **Mobile Client**: Flutter application featuring patient, doctor, and pharmacist portals.

---

## 1. Backend Setup & Run

### Prerequisites
* Node.js v18+
* Google Firebase Project ID

### Installation
Copy `backend/.env.example` to `backend/.env` and fill in real values (never commit `.env`):
```ini
PORT=3000
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
BOOTSTRAP_SECRET=generate-a-long-random-string-and-keep-it-private
SEED_ON_BOOT=false
ALLOW_MOCK_AUTH=false
```

> **Security:** Rotate `BOOTSTRAP_SECRET` and the Firebase service-account private key immediately if either was ever shared, pasted into chat, or committed historically. Older docs/examples used placeholder strings such as `CareFlowLocalSecretKey_2026` / `CareFlowDefaultSecret2026` — treat those as compromised and never reuse them in production.

### Running Locally
```bash
cd backend
npm install
npm run build
npm run start
```
The server will start at `http://localhost:3000/api/v1` and Swagger docs will be available at `http://localhost:3000/docs`.

---

## 2. API Endpoints & Reference

### 2.1 Users / Authentication
* **`POST /users/bootstrap`**: Provision staff accounts.
  * **Headers**: `x-bootstrap-secret: <value of BOOTSTRAP_SECRET env var>`
  * Once a Super Administrator profile is created, the endpoint is fully locked down and requires this header to run.
  * **Payload**:
    ```json
    {
      "email": "pharmacist@pharmastore.com",
      "password": "<strong-unique-password>",
      "name": "Philip Pharmacist",
      "role": "pharmacist"
    }
    ```

### 2.2 Inventory
* **`GET /inventory/medicines`**: List medicines.
  * **Query Params**:
    * `q`: Search query matches name, generic name, brand, or barcode
    * `category`: Filter by category (e.g. `Analgesics`)
    * `status`: Filter stock levels (`low`, `out`, `ok`)
    * `page` / `limit`: Pagination parameters (default: page 1, limit 10)
    * `includeInactive`: Default: `false`. Pass `true` to include deactivated medicines.
  * **Response Shape**:
    ```json
    {
      "success": true,
      "data": [ ... ],
      "meta": {
        "totalCount": 4,
        "page": 1,
        "limit": 10,
        "totalPages": 1
      }
    }
    ```
* **`GET /inventory/summary`**: Active inventory total summary.
  * **Response Shape**:
    ```json
    {
      "success": true,
      "data": {
        "totalSKUs": 4,
        "totalUnits": 850,
        "lowStockCount": 1,
        "outOfStockCount": 1,
        "expiringCount": 1,
        "totalValue": 250.50,
        "updatedAt": "2026-07-25T18:00:00.000Z"
      }
    }
    ```
* **`GET /inventory/alerts`**: Lists expiring soon, low stock, and out of stock items.
* **`PATCH /inventory/medicines/:id`**: Soft deactivation and field updates.
* **`GET /inventory/expiry-list`**: Alias under inventory; prefer dedicated `/expiry-list`.

### 2.3 Purchases
* **`POST /purchases`** / **`POST /purchases/orders`**: Create purchase order (supplier + items). Optional `hospitalId`.
* **`GET /purchases/history`**: Full purchase history (hospital-scoped).
* **`PUT /purchases/orders/:id/receive`**: Partial goods receipt.
  * Uses shared `applyStockChanges` (same path as sales / manual stock add).
  * **Payload**:
    ```json
    {
      "items": [
        {
          "medicineId": "MED-ASP-100",
          "batchNo": "BATCH-NEW-02",
          "expiryDate": "2029-06-30",
          "quantityReceived": 50
        }
      ]
    }
    ```

### 2.4 Stock
* **`POST /stock/add`**: Manual stock addition (`medicineId`, `batchNo`, `qty`, `expiryDate`, `hospitalId`). Firestore transaction + `stockTransactions` audit + `stockSummaries` cache.
* **`GET /stock/batches/:batchNo`**: Aggregate batch lookup from `stockTransactions` (+ PO/supplier, sales drawn from batch). Query: `hospitalId`.

### 2.5 Sales & Customers
* **`POST /sales`**: Create sale in one Firestore transaction — deduct stock per batch, write `stockTransactions` (`type: sale`), create/update customer, write `payments`.  
  * `paymentMethod`: `cash` | `upi` | `credit`  
  * `upi` requires `upiTransactionRef`  
  * `credit` writes `creditLedger` and bumps doctor `creditBalance` when `doctorId` present  
  * Body includes required `hospitalId`
* **`GET /sales`**: List with filters `hospitalId`, `date` via `from`/`to`, `customerId`, `paymentMethod`
* **`POST /sales/:id/invoice`**: Generate invoice (base64 stub PDF) using shop `profile`
* **`POST /sales/:id/send`**: Send invoice via SMS/WhatsApp stub provider (`channels`: sms|whatsapp|both)
* **`GET /customers`**, **`POST /customers`**, **`PATCH /customers/:id`**: Customer CRUD (hospital-scoped)

### 2.6 Profile
* **`GET /profile?hospitalId=`**: Shop logo, address, signature, branding
* **`PATCH /profile`**: Upsert per-hospital shop profile

### 2.7 Doctors (extended)
* **`POST /doctors`**: Also accepts `hospitalId`, `phone`, `commissionRate`, `specialization` (alias of specialty)
* **`GET /doctors`**: Optional `hospitalId`; pass `page`/`limit` for paginated `{ items, meta }`
* **`GET /doctors/:id/credits`**: Credit ledger for referred sales

### 2.8 Expiry
* **`GET /expiry-list`**: Admin/staff only; sorted by nearest expiry. Query: `hospitalId`, `thresholdDays`

---

## 3. Local Verification Tests

Run the automated integration validation scripts (server on `:3000`):
```bash
node backend/scratch/verify_flows.js
node backend/scratch/verify_sales_stock.js
```
* `verify_flows.js` — EMR → prescription → POS dispense lifecycle  
* `verify_sales_stock.js` — sale → stock deduction, purchase receive → stock increase, credit sale → ledger entry

---

## 4. Firestore Database Indexes

While the current backend fetches and sorts transactions in-memory to simplify setup, if you migrate transaction sorting to the query level (e.g., `.orderBy('createdAt', 'desc')`), you will need to define a composite index in your Firebase Console:
* **Collection**: `stockTransactions`
* **Fields**: `medicineId` (Ascending) + `type` (Ascending) + `createdAt` (Descending)

---

## 5. Security notes (pre-deploy)

* Secrets live only in environment variables / secret managers (Vercel env, local `.env`). They must not appear as string literals in source.
* `.env` is gitignored. Commit `.env.example` with **placeholders only**.
* Set `ALLOW_MOCK_AUTH=false` for real production once Flutter uses Firebase Auth ID tokens.
* Set `SEED_ON_BOOT=false` in production after initial demo seeding.
* **Rotate any previously hardcoded secrets immediately.** Values that appeared in README / `.env.example` / code fallbacks may still exist in git history even after this cleanup. Generate a new `BOOTSTRAP_SECRET` and rotate the Firebase service-account key in Google Cloud Console if there is any chance of exposure.
* This stack does **not** use Supabase, Stripe, MongoDB, or Next.js `NEXT_PUBLIC_` / `REACT_APP_` client env prefixes. The Flutter app only receives a public API base URL (`API_BASE_URL` / default Vercel URL), which is safe to ship client-side.

