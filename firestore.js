'use strict';

const admin = require('firebase-admin');

let db;

/**
 * Firebase Admin SDK를 초기화한다.
 * FIREBASE_SERVICE_ACCOUNT 환경변수에서 서비스 계정 JSON을 읽는다.
 */
function initFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다.');
  }

  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  console.log('[firestore] Firebase Admin 초기화 완료');
}

/**
 * 파싱된 식단 배열을 Firestore에 일괄 저장한다.
 * 문서 ID = dateString ("2026-04-27").
 * 매번 전체 덮어쓰기(set without merge)하여 최신 크롤링 결과를 보장한다.
 *
 * @param {import('./parser').MealData[]} meals
 */
async function saveMealsToFirestore(meals) {
  const batch = db.batch();
  const mealsRef = db.collection('meals');
  const now = admin.firestore.Timestamp.now();

  for (const meal of meals) {
    const docRef = mealsRef.doc(meal.id);
    batch.set(docRef, {
      date: admin.firestore.Timestamp.fromDate(meal.date),
      dateString: meal.dateString,
      lunch: meal.lunch,
      dinner: meal.dinner,
      isHoliday: meal.isHoliday,
      createdAt: now,
      version: 1,
    });

    const summary = meal.isHoliday
      ? '휴무'
      : `점심 ${meal.lunch.length}개 / 석식 ${meal.dinner.length}개`;
    console.log(`[firestore] 저장 대기: ${meal.id} (${summary})`);
  }

  await batch.commit();
}

module.exports = { initFirebase, saveMealsToFirestore };
