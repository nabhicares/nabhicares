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
Configure `.env` in `backend/` directory:
```ini
PORT=3000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
BOOTSTRAP_SECRET=CareFlowLocalSecretKey_2026
```

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
  * **Headers**: `x-bootstrap-secret: <BOOTSTRAP_SECRET>`
  * Once a Super Administrator profile is created, the endpoint is fully locked down and requires this header to run.
  * **Payload**:
    ```json
    {
      "email": "pharmacist@pharmastore.com",
      "password": "SecurePassword123",
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

### 2.3 Purchases
* **`PUT /purchases/orders/:id/receive`**: Partial goods receipt.
  * Checks inputs to prevent over-receiving ordered quantities.
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

---

## 3. Local Verification Tests

Run the automated integration validation script:
```bash
node backend/scratch/verify_flows.js
```
This runs a complete EMR patient checkout, POS billing dispensation, and stock deduction lifecycle.

---

## 4. Firestore Database Indexes

While the current backend fetches and sorts transactions in-memory to simplify setup, if you migrate transaction sorting to the query level (e.g., `.orderBy('createdAt', 'desc')`), you will need to define a composite index in your Firebase Console:
* **Collection**: `stockTransactions`
* **Fields**: `medicineId` (Ascending) + `type` (Ascending) + `createdAt` (Descending)

