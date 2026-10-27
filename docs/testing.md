# Testing & Verification Guide

> For the comprehensive guide, see [CODEBASE.md](../CODEBASE.md).

## 1. Local Runtime Verification

Since ConstLabour is a hybrid mobile and web application, runtime verification covers both platforms:

### Web Verification
```bash
npm start
```
- Press `w` to open web in your default browser (`http://localhost:8081`).
- Verify console in browser developer tools (`F12`) for any unresolved asset, module, or SVG rendering errors.
- Test login, dashboard navigation, and tab switching.

### Mobile Verification (Expo Go)
```bash
npx expo start --tunnel
```
- Open Expo Go on Android or the Camera app on iOS and scan the QR code.
- Verify screen transitions, touch responsiveness, date picker modal popups, and signature canvas.

## 2. Edge Function Testing

Test the backend health check endpoint:
```bash
curl https://jkwrupxrjbrmuufxetlh.supabase.co/functions/v1/make-server-689d7d60/health
# Expected: {"status":"ok"}
```

Test authenticated routes:
Pass an active Supabase access token in the header:
```bash
curl -H "Authorization: Bearer <TOKEN>" https://jkwrupxrjbrmuufxetlh.supabase.co/functions/v1/make-server-689d7d60/dashboard/stats
```

## 3. Database Verification

- Check the Supabase online SQL Editor or Table Editor (`jkwrupxrjbrmuufxetlh`).
- Ensure operations against `profiles`, `sites`, `attendance`, `advances`, `payroll`, and `agreements` persist correctly without triggering RLS violations.
