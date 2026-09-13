const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {setGlobalOptions} = require('firebase-functions/v2');
const {getAuth} = require('firebase-admin/auth');
const {initializeApp} = require('firebase-admin/app');

initializeApp();
setGlobalOptions({region: 'asia-south1', maxInstances: 10});

const ADMIN_EMAIL = 'omkarpardeshi2001@gmail.com';

exports.bootstrapAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const email = (request.auth.token.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Not authorized.');
  }

  const user = await getAuth().getUser(request.auth.uid);
  await getAuth().setCustomUserClaims(user.uid, {admin: true});

  return {ok: true, role: 'admin'};
});
