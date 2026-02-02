# Boehm Tech Invoice System

A professional, high-performance invoice management application tailored for localized business needs. Built with Vanilla JavaScript and Firebase for speed, reliability, and ease of deployment.

## 🚀 Key Features

*   **Smart Dashboard**: Real-time visualization of revenue, outstanding balances, and recent activity.
*   **Client Management**: Create, view, and manage client profiles with intelligent caching for instant access.
*   **Invoice Lifecycle**:
    *   **Create/Edit**: Flexible editor with automatic calculations for GST, Advance, and Totals.
    *   **Duplicate**: Rapidly clone existing invoices for recurring billing.
    *   **Void (Close)**: Mark invoices as closed/void to adjust balances without deleting history.
    *   **Delete**: Permanently remove records when necessary.
*   **Flexible Payments**: Record formatted payments (Full, Half, Custom) with immediate status updates (Paid, Partial, Unpaid).
*   **Professional Output**:
    *   **PDF**: Generates high-fidelity PDF invoices using `jsPDF` and `html2canvas`.
    *   **Print**: CSS-optimized print layout for standard A4 paper.
*   **Performance Optimized**: Uses DocumentFragments and deferred loading for a snappy experience on any device.

---

## 📖 User Guide

### 1. Getting Started
*   **Login**: Access the secure admin panel using your credentials.
*   **Navigation**: Use the top bar to switch between the Dashboard and Analytics views.

### 2. Managing Clients
*   Click the **"+" Folder** icon in the dashboard to add a new client.
*   Click any **Client Folder** to view their specific invoice history.

### 3. Managing Invoices
*   **Create New**: Click "Create New Invoice" from a client's folder.
*   **Invoice Actions** (found in the invoice list):
    *   **Menu (⋮)**: Quick payment options (Full, Half, Custom).
    *   **C (Close)**: Voids the invoice. Balance becomes zero, status output as "Closed (Void)".
    *   **Copy Icon**: Duplicates the invoice content into a new draft.
    *   **Edit Icon**: Opens the invoice in the editor.
    *   **Trash Icon**: Deletes the invoice (Requires confirmation).

### 4. Printing & PDF
*   Open an invoice in **Edit/View** mode.
*   Use the **Print** button for physical copies.
*   (Optional) Use browser "Save as PDF" or the integrated download feature if enabled.

---

## 🛠️ Technical Architecture

### Technology Stack
*   **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 Modules).
*   **Backend / Database**: Firebase Firestore (NoSQL) & Authentication.
*   **Libraries**:
    *   `Chart.js` (Analytics)
    *   `jsPDF` & `html2canvas` (PDF Generation)
    *   `FontAwesome` (Icons)
    *   `Google Fonts` (Montserrat)

### File Structure
*   `index.html` / `app.js`: Main Invoice Editor & Viewer. Handles DOM manipulation, calculation logic, and PDF generation.
*   `admin.html` / `admin.js`: Admin Dashboard. Handles auth state, client rendering, charts, and invoice lists.
*   `data-service.js`: Centralized Service Layer. Manages all Firestore interactions (CRUD) and caching logic.
*   `style.css` / `admin.css`: Core styling and theme definitions.
*   `firebase-config.js`: Firebase initialization/configuration (Not included in repo for security, must be added).

### Data Model (Firestore)
**Collection: `clients`**
*   `name`: string
*   `createdAt`: timestamp

**Collection: `invoices`**
*   `clientId`: string (Reference)
*   `invoiceNumber`: string
*   `date`: string
*   `totalAmount`: number
*   `receivedAmount`: number
*   `status`: 'open' | 'paid' | 'partial' | 'closed'
*   `items`: array
*   `...` (other metadata)

---

## ⚡ Performance Optimizations

Recent updates have significantly improved application performance:

1.  **Document Fragment Rendering**: Invoice lists are built in memory before being appended to the DOM, reducing reflows and improving rendering speed for long lists.
2.  **Client Caching**: The `DataService` caches the client list for 5 minutes (TTL). Navigating between dashboard and client views no longer triggers redundant database reads.
3.  **Deferred Loading**: Heavy libraries (`jspdf`, `chart.js`) form non-critical paths are loaded with the `defer` attribute, speeding up the "First Contentful Paint".

---

## ⚙️ Setup & Installation

1.  **Clone Repository**
    ```bash
    git clone [repository-url]
    cd [folder-name]
    ```

2.  **Firebase Config**
    Create a file named `firebase-config.js` in the root directory with your credentials:
    ```javascript
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
    import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "...",
      appId: "..."
    };

    const app = initializeApp(firebaseConfig);
    export const db = getFirestore(app);
    export const auth = getAuth(app);
    ```

3.  **Serve**
    Use any static file server (e.g., Live Server in VS Code):
    ```bash
    npx serve .
    ```

---
*Maintained by Boehm Tech*
