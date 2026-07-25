# Mobile Frontend Manual Testing Guide

This guide details the step-by-step instructions for testing the **PharmaStore CareFlow** Flutter mobile client application manually. It maps user persona journeys to specific screens and endpoints.

---

## 1. Running the App Locally

To start the Flutter application in your local emulator or development device:

```bash
cd mobile
flutter pub get
flutter run
```

---

## 2. Test Flow 1: Authentication & Role Portals

### Objectives:
*   Verify the splash redirect loads `/login`.
*   Validate the segmented choice chips and role bypass buttons.

### Execution Steps:
1.  Launch the app. Verify the screen opens to **PharmaStore CareFlow** showing the email, password, and portal chips.
2.  Tap on the **Patient** chip -> Click the **Patient** bypass button at the bottom.
    *   *Expected Result*: The router redirects to `/patient/home` and displays the Patient dashboard.
3.  Click the **Logout** icon in the AppBar.
    *   *Expected Result*: Clears credentials and returns to `/login`.
4.  Repeat the login bypass checks for the **Doctor**, **Pharmacist**, and **Admin** portals to ensure all role gates route to their respective dashboards.

---

## 3. Test Flow 2: Patient Booking Journey

### Objectives:
*   Verify doctor search queried from `GET /doctors` loads correctly.
*   Validate booking slot reservations via `POST /appointments`.

### Execution Steps:
1.  Log in as a **Patient**.
2.  On the Home dashboard, tap the **Book Appt** card or the **View All** recommended specialists button.
    *   *Expected Result*: Navigates to `/patient/doctors` showing the **Find a Specialist** listing.
3.  Type `House` in the search bar.
    *   *Expected Result*: List filters to show only "Dr. Gregory House".
4.  Change the department filter chip to `Neurology`.
    *   *Expected Result*: Doctor list filters accordingly.
5.  Click the **Book Consultation** button on Dr. House's card.
    *   *Expected Result*: Opens the **Schedule Visit** picker screen.
6.  Select a date from the calendar and tap the **10:00** time slot chip -> Click **Confirm and Book Slot**.
    *   *Expected Result*: A success dialog pops up confirming booking slot registration.

---

## 4. Test Flow 3: Clinical Consultation & Prescriptions

### Objectives:
*   Verify the doctor patient queue timeline.
*   Validate writing prescriptions using active SKU items.

### Execution Steps:
1.  Log in as a **Doctor**.
2.  On the dashboard queue timeline, locate patient **Alice Patient** -> Tap the **Start Visit** button.
    *   *Expected Result*: Navigates to the **Issue Prescription** editor screen.
3.  Click the **Add Medicine Row** outline button.
    *   *Expected Result*: A slide-up bottom sheet appears showing the live SKU catalog (Aspirin 100mg, Paracetamol 500mg, etc.).
4.  Tap **Aspirin 100mg**.
    *   *Expected Result*: Adds a new row with default inputs (Dosage: `1-0-1`, Duration: `5 days`, Instructions: `Take after meals`).
5.  Click **Publish Prescription**.
    *   *Expected Result*: Pushes the prescription details to `POST /prescriptions` and displays a success alert.

---

## 5. Test Flow 4: Pharmacy POS Dispatch & Billing

### Objectives:
*   Fulfill prescription orders from the POS sidebar queue.
*   Validate stock levels decrement and invoice generated.

### Execution Steps:
1.  Log in as a **Pharmacist** (or Admin).
2.  Tap the **POS** tab in the bottom navigation bar.
    *   *Expected Result*: Loads the **Pharmacy POS** viewport. The left sidebar displays the queue of pending prescription IDs.
3.  Select the latest prescription ID from the sidebar queue.
    *   *Expected Result*: The checkout panel on the right populates with the items.
4.  On the fulfillment card, tap the **Fulfillment Batch** dropdown -> Select **BATCH-INITIAL-01 (In Stock)**.
5.  Tap **Fulfill & Generate Invoice**.
    *   *Expected Result*: Processes the transactional stock deduction, decreases Aspirin stocks, and shows a cash receipt dialog displaying the generated invoice ID and total bill.
6.  Tap the **Stock** tab in the bottom navigation.
    *   *Expected Result*: Loads the inventory list. Verify that the total quantity for Aspirin has decremented exactly by the fulfilled amount (e.g. from 200 to 190).
