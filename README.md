
# GoVroom - Shipment Management Application

This is a Next.js application built with Firebase for managing shipments, designed for both web and potentially mobile platforms.

## Project Overview

GoVroom aims to provide an efficient way to track and manage shipment logistics, including main shipment details, itemized contents, status updates, and related documentation.

## Features (Implemented & Planned)

*   **Authentication:** Firebase Email/Password with Role-Based Access Control (Admin, User).
*   **Dashboard:** Overview of pending/completed shipments and key statistics (real-time).
*   **Shipment Management:**
    *   Create, View, Update, Delete shipments.
    *   Manage shipment items (details) within each shipment.
    *   Dynamic forms with dropdowns populated from Firestore.
    *   Status tracking (Pending/Completed).
*   **Admin Panel:**
    *   Dropdown List Management (Carriers, Customers, Services, etc.).
    *   Application Settings (Default Addresses).
*   **Firebase Integration:** Firestore for data, Auth for users, Storage (planned), Cloud Functions (planned).
*   **UI:** Built with Next.js App Router, React, TypeScript, Tailwind CSS, and ShadCN UI components.

*(Planned features like PDF generation, Push Notifications, Mobile enhancements, CSV import/export, etc., are part of the roadmap).*

## Getting Started

1.  **Prerequisites:**
    *   Node.js (LTS version recommended)
    *   npm or yarn
    *   Firebase Project: Set up a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/).

2.  **Firebase Setup:**
    *   Enable Firestore Database.
    *   Enable Firebase Authentication (Email/Password provider).
    *   Create necessary Firestore collections (e.g., `users`, `carriers`, `customers`, `services` - see `src/lib/constants.ts` and `src/lib/types.ts`).
    *   Set up Firebase Security Rules (essential for production).
    *   Obtain your Firebase project configuration credentials.

3.  **Environment Variables:**
    *   Create a `.env.local` file in the project root (copy from `.env` if it exists).
    *   Add your Firebase project configuration details to `.env.local`, prefixing each key with `NEXT_PUBLIC_`:
        ```
        NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID"
        NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
        ```

4.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

5.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    Open [http://localhost:9002](http://localhost:9002) (or your specified port) in your browser.

## Project Structure

*   `src/app/`: Next.js App Router pages and layouts.
    *   `(app)/`: Authenticated routes and layouts.
    *   `admin/`: Admin-specific routes.
    *   `login/`: Login page.
*   `src/components/`: Reusable React components.
    *   `ui/`: ShadCN UI components.
    *   `layout/`: Application layout components (Header, Sidebar).
    *   `dashboard/`: Dashboard-specific components.
    *   `shipments/`: Shipment-related components (Forms, Lists).
    *   `admin/`: Admin-specific components.
*   `src/lib/`: Core logic, constants, types, utilities, Firebase services.
    *   `firebase/`: Firebase configuration and service functions (auth, firestore).
    *   `constants.ts`: Application constants (nav items, dropdown configs).
    *   `types.ts`: TypeScript type definitions.
    *   `utils.ts`: Utility functions.
*   `src/contexts/`: React context providers (e.g., AuthContext).
*   `src/hooks/`: Custom React hooks.
*   `public/`: Static assets.
*   `styles/`: Global CSS (via `globals.css`).

## Key Technologies

*   Next.js (App Router)
*   React
*   TypeScript
*   Firebase (Auth, Firestore)
*   Tailwind CSS
*   ShadCN UI
*   TanStack Query (React Query)
*   Zod (Validation)
*   React Hook Form
*   Lucide Icons

