# Health Platform — Mobile App

React Native + Expo + TypeScript mobile client for the Health Platform.

## Setup

```bash
cd mobile
npm install
```

Set environment variable (create `.env` in `mobile/`):
```
EXPO_PUBLIC_API_BASE_URL=https://your-backend.com
```
For local dev: `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000`

## Run

```bash
# Start Expo dev server
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android
```

## Architecture

```
mobile/
├── App.tsx                        Entry point
├── app.json                       Expo config
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx        JWT auth state (SecureStore)
│   ├── services/
│   │   └── api.ts                 Axios instance with Bearer auth
│   ├── navigation/
│   │   ├── index.tsx              Root navigator (Auth vs App)
│   │   ├── AuthStack.tsx          Login / Register / ConsentGate
│   │   └── AppStack.tsx           Bottom tabs + stack screens
│   └── screens/
│       ├── LoginScreen.tsx        Email/password login
│       ├── RegisterScreen.tsx     Registration + 5 consent checkboxes
│       ├── ConsentGateScreen.tsx  Consent review/acceptance
│       ├── HomeScreen.tsx         Patient dashboard + quick actions
│       ├── PatientProfileScreen.tsx  Demographics, allergies, emergency
│       ├── ReadingsScreen.tsx     Device readings log + add new
│       ├── BookConsultationScreen.tsx  Doctor list + schedule
│       ├── PrescriptionRequestScreen.tsx  Rx requests + status
│       ├── FamilyScreen.tsx       Family members CRUD
│       ├── NotificationsScreen.tsx   Notifications + mark read
│       └── SettingsScreen.tsx     Account info + change password
```

## Auth Flow

1. App starts → checks `SecureStore` for saved session
2. If no session → `AuthStack` (Login / Register / ConsentGate)
3. After login/register → token saved in SecureStore  
4. `AppStack` mounts with bottom tab navigation
5. All API calls automatically attach `Authorization: Bearer <token>`

## API alignment

All screens call the same endpoints as the web frontend:
- `PATCH /api/v1/patients/me` (not PUT)
- `POST /api/v1/patients/profile` (not `/api/v1/patients/`)
- `PATCH /api/v1/doctors/me` (not PUT)
- `POST /auth/change-password` (unified endpoint)
- Consents: all 5 types (`terms_of_service`, `privacy_policy`, `medical_disclaimer`, `health_data_processing`, `telemedicine_consent`)
