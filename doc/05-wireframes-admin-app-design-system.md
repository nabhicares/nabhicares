# Wireframe Plan — Hospital Staff/Admin App + Design System

This is the biggest of the three applications (Reception + Pharmacy + Inventory + Management combined, or split by RBAC).

---

## Dashboard
Today's Revenue, Today's Appointments, Inventory Value, Low Stock, Expiring Medicines, Pending Bills, Recent Activities

## Patient Management
Patients list, Add Patient, Search, Medical History, Billing, Appointment History

## Appointment Management
Calendar view, Today's Queue, Walk-in Patients, Upcoming, Cancelled

## Doctor Management
Doctors list, Availability, Departments, Leaves, Performance

## Pharmacy Dashboard
Today's Sales, Today's Profit, Stock Alerts, Quick Billing, Top Selling Medicines

## Inventory Dashboard
```
┌─────────────────────────┐
│ Inventory Value          │
├─────────────────────────┤
│ Low Stock                │
├─────────────────────────┤
│ Expiring Soon             │
├─────────────────────────┤
│ Out of Stock              │
├─────────────────────────┤
│ Fast Moving                │
├─────────────────────────┤
│ Slow Moving                │
└─────────────────────────┘

Charts: Stock Trend | Sales Trend | Category Distribution
```

## Medicine List
Search, Filter — columns: Medicine, Category, Stock, Batch, Expiry, Supplier, Status

## Medicine Details
Medicine, Barcode, Batches, Current Stock, Purchase History, Sales History, Profit, Expiry Timeline

## Add Medicine (form)
Name, Generic Name, Brand, Category, Supplier, Purchase Price, MRP, GST, Batch, Expiry, Image

## Purchase Module
```text
Purchase Orders → Receive Stock → Invoice → Inventory Updated
```

## Sales Screen
Search Medicine, Barcode Scan, Add Quantity, Apply Discount, Generate Bill

## Supplier Module
Supplier List, Add Supplier, Outstanding, Purchase History

## Reports
Sales, Inventory, Purchase, Profit, Doctor Performance, Appointments

## Analytics
Revenue, Profit, Patient Growth, Medicine Sales, Doctor Performance, Inventory Turnover

## Notifications
Low Stock, Expiry, Appointment Reminder, Supplier Due, System Alerts

## Settings
Hospital Information, Users, Roles, Permissions, Printers, GST, Invoice Template, Backup, Theme

## Bottom Navigation (Hospital/Admin)
`Dashboard | Patients | Inventory | Reports | More`

---

## Complete Screen Count (All 3 Apps)

| Module         | Approx. Screens |
|----------------|-----------------:|
| Authentication |                6 |
| Patient        |               22 |
| Doctor         |               18 |
| Hospital/Admin |               48 |
| Inventory      |               20 |
| Pharmacy       |               12 |
| Reports        |               10 |
| Settings       |                8 |
| **Total**      |     **≈144 screens** |

---

## Recommended Design System

- **Design approach:** Mobile-first, Material Design 3 principles
- **Grid:** 8-point spacing system
- **Typography:** Inter or SF Pro
- **Colors:** Primary — Medical Blue (#2563EB); Success — Green; Warning — Amber; Critical — Red
- **Charts:** Clean analytics cards with drill-down capability
- **Components:** Bottom navigation, floating action buttons for common tasks, searchable lists, cards, chips, slide-up bottom sheets

---

## Suggested Design Workflow

1. Information Architecture (complete navigation & feature map)
2. User Flows (patient, doctor, receptionist, pharmacist, admin)
3. Low-Fidelity Wireframes (all ~144 screens)
4. Interactive Prototype (Figma)
5. Design System (colors, typography, components, icons)
6. High-Fidelity UI (pixel-perfect screens)
7. Developer Handoff (design specs, assets, interactions)

This sequence minimizes rework and ensures appointments, prescriptions, pharmacy, inventory, and patient experience modules all work as one cohesive platform instead of separate features bolted together.
