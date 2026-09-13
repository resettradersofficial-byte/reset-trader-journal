const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {setGlobalOptions, onInit} = require('firebase-functions/v2');

setGlobalOptions({region: 'asia-south1', maxInstances: 10});
const ADMIN_EMAIL = 'omkarpardeshi2001@gmail.com';

// Keep deployment-time initialization extremely light. Firebase recommends
// deferring slow/global initialization with onInit so function discovery does
// not time out during deployment.
let adminReady = false;
let db;
let auth;
let messaging;
let Timestamp;

onInit(() => {
  const {initializeApp} = require('firebase-admin/app');
  const {getFirestore, Timestamp: FirestoreTimestamp} = require('firebase-admin/firestore');
  const {getAuth} = require('firebase-admin/auth');
  const {getMessaging} = require('firebase-admin/messaging');

  initializeApp();
  db = getFirestore();
  auth = getAuth();
  messaging = getMessaging();
  Timestamp = FirestoreTimestamp;
  adminReady = true;
});

function ensureAdminReady() {
  if (!adminReady) throw new Error('Firebase Admin is not initialized.');
}

exports.bootstrapAdmin = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  ensureAdminReady();
  const email = (request.auth.token.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL) throw new HttpsError('permission-denied', 'Not authorized.');
  const user = await auth.getUser(request.auth.uid);
  await auth.setCustomUserClaims(user.uid, {admin: true});
  return {ok: true, role: 'admin'};
});

exports.registerPushToken = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  ensureAdminReady();
  const token = String(request.data?.token || '').trim();
  if (!token || token.length > 4096) throw new HttpsError('invalid-argument', 'Invalid push token.');
  const id = Buffer.from(token).toString('base64url').slice(0, 120);
  await db.doc(`users/${request.auth.uid}/devices/${id}`).set({
    token,
    updatedAt: Timestamp.now(),
    platform: 'web'
  }, {merge: true});
  return {ok: true};
});

exports.removePushToken = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  ensureAdminReady();
  const token = String(request.data?.token || '').trim();
  if (!token) return {ok: true};
  const id = Buffer.from(token).toString('base64url').slice(0, 120);
  await db.doc(`users/${request.auth.uid}/devices/${id}`).delete().catch(() => {});
  return {ok: true};
});

exports.sendDueAlerts = onSchedule({
  schedule: 'every 1 minutes',
  timeZone: 'Asia/Kolkata'
}, async () => {
  ensureAdminReady();
  const now = Timestamp.now();
  const windowStart = Timestamp.fromMillis(Date.now() - 90000);
  const snap = await db.collectionGroup('alerts')
    .where('status', '==', 'scheduled')
    .where('nextAt', '<=', now)
    .where('nextAt', '>', windowStart)
    .limit(100)
    .get();

  for (const alertDoc of snap.docs) {
    const alert = alertDoc.data();
    if (!alert.uid || !alert.type) continue;

    const devices = await db.doc(`users/${alert.uid}`).collection('devices').get();
    const deviceDocs = devices.docs;
    const tokens = deviceDocs.map(d => d.data().token).filter(Boolean);

    if (tokens.length) {
      const body = alert.type === 'pretrade'
        ? 'It’s time for your daily pre-trade check.'
        : 'It’s time for your daily post-trade journal.';
      const target = alert.type === 'pretrade' ? '#today' : '#trades';

      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {title: 'RESET TRADER', body},
        data: {alertId: alertDoc.id, type: alert.type, link: target},
        webpush: {
          fcmOptions: {
            link: `https://resettradersofficial-byte.github.io/reset-trader-journal/${target}`
          },
          notification: {
            icon: 'https://resettradersofficial-byte.github.io/reset-trader-journal/icons/icon-192.png',
            tag: alertDoc.id
          }
        }
      });

      response.responses.forEach((r, i) => {
        if (!r.success && [
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token'
        ].includes(r.error?.code)) {
          deviceDocs[i]?.ref.delete().catch(() => {});
        }
      });
    }

    const nextFields = {
      lastSentAt: now,
      status: alert.repeat && alert.repeat !== 'once' ? 'scheduled' : 'sent'
    };

    if (alert.repeat && alert.repeat !== 'once' && alert.nextAt) {
      const d = alert.nextAt.toDate();
      if (alert.repeat === 'daily') d.setDate(d.getDate() + 1);
      else if (alert.repeat === 'weekdays') {
        d.setDate(d.getDate() + 1);
        while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
      }
      nextFields.nextAt = Timestamp.fromDate(d);
    }

    await alertDoc.ref.set(nextFields, {merge: true});
  }

  return null;
});
