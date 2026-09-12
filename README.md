# RESET TRADER — Admin Entitlement Build

This build keeps the working email/password and Google popup authentication, Firestore sync, and PWA behavior. It adds a secure Firebase custom-claim based admin entitlement for `omkarpardeshi2001@gmail.com`.

## Admin
The admin claim is created by the callable `bootstrapAdmin` Cloud Function. The function only grants the claim when the authenticated account email exactly matches the configured admin email.

## Deployment
1. Deploy the Functions and Firestore rules from this project with Firebase CLI.
2. Replace the live GitHub Pages `index.html`, `sw.js`, `firestore.rules`, and add the `functions/` directory plus `firebase.json` to the repository.
3. Sign in as the admin account once. The app bootstraps the admin claim and refreshes the ID token.

Cloud Functions deployment may require enabling billing/Blaze in Firebase. Do not expose service-account credentials in the repository.
