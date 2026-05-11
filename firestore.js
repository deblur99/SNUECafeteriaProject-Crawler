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
 * 식단 배열을 Firestore 저장 전 정규화한다.
 * - 문자열 또는 { name: string } 객체를 모두 처리한다.
 * - trim 처리한다.
 * - 빈 문자열은 제거한다.
 * - '휴무'가 포함되면 빈 배열을 반환한다.
 */
function normalizeMealItems(items) {
  if (!Array.isArray(items)) return [];

  const normalized = items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item.name === 'string') return item.name.trim();
      return '';
    })
    .filter(Boolean);

  if (normalized.some((item) => item.includes('휴무'))) {
    return [];
  }

  return normalized;
}

/**
 * 파싱된 식단 배열을 Firestore에 일괄 저장한다.
 * 문서 ID = dateString ("2026-04-27").
 * 매번 전체 덮어쓰기(set without merge)하여 최신 크롤링 결과를 보장한다.
 * lunch, dinner 각 배열에 '휴무'가 포함되어 있으면 해당 배열은 빈 배열로 처리된다.
 *
 * @param {import('./parser').MealData[]} meals
 */
async function saveMealsToFirestore(meals) {
  const batch = db.batch();
  const mealsRef = db.collection('meals');
  const now = admin.firestore.Timestamp.now();

  for (const meal of meals) {
    const normalizedLunch = normalizeMealItems(meal.lunch);
    const normalizedDinner = normalizeMealItems(meal.dinner);
  
    console.log('[debug] meal.id =', meal.id);
    console.log('[debug] raw lunch =', JSON.stringify(meal.lunch));
    console.log('[debug] raw dinner =', JSON.stringify(meal.dinner));
    console.log('[debug] normalizedLunch =', JSON.stringify(normalizedLunch));
    console.log('[debug] normalizedDinner =', JSON.stringify(normalizedDinner));
  
    const docRef = mealsRef.doc(meal.id);
    batch.set(docRef, {
      date: admin.firestore.Timestamp.fromDate(meal.date),
      dateString: meal.dateString,
      lunch: normalizedLunch,
      dinner: normalizedDinner,
      isHoliday: meal.isHoliday,
      createdAt: now,
      version: 1,
    });
  
    const summary = meal.isHoliday
      ? '휴무'
      : `점심 ${normalizedLunch.length}개 / 석식 ${normalizedDinner.length}개`;
    console.log(`[firestore] 저장 대기: ${meal.id} (${summary})`);
  }

  await batch.commit();
}

module.exports = { initFirebase, saveMealsToFirestore };
