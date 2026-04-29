'use strict';

const { chromium } = require('playwright');
const { getReferenceInfo, parseWeekMeals, navigateToPage, MENU_URL } = require('./parser');
const { initFirebase, saveMealsToFirestore } = require('./firestore');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('[scraper] SNUE 학생식당 식단 크롤러 시작');

  if (DRY_RUN) {
    console.log('[scraper] DRY RUN 모드 — Firestore에 저장하지 않습니다');
  } else {
    initFirebase();
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; SNUECafeteriaScraper/1.0)',
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  try {
    // ── 1페이지: 이번 주 ──────────────────────────────────────────
    console.log('[scraper] 1페이지 로딩...');
    await page.goto(MENU_URL, { waitUntil: 'networkidle', timeout: 30_000 });

    const ref1 = await getReferenceInfo(page);
    console.log(`[scraper] 1페이지 기준 날짜: 연도=${ref1.year} 월=${ref1.month}`);

    const page1Meals = await parseWeekMeals(page, ref1.year, ref1.month);
    console.log(`[scraper] 1페이지 파싱 완료: ${page1Meals.length}일`);

    // ── 2페이지: 다음 주 ──────────────────────────────────────────
    console.log('[scraper] 2페이지로 이동...');
    await navigateToPage(page, 2);

    const ref2 = await getReferenceInfo(page);
    console.log(`[scraper] 2페이지 기준 날짜: 연도=${ref2.year} 월=${ref2.month}`);

    const page2Meals = await parseWeekMeals(page, ref2.year, ref2.month);
    console.log(`[scraper] 2페이지 파싱 완료: ${page2Meals.length}일`);

    // ── 결과 처리 ─────────────────────────────────────────────────
    const allMeals = [...page1Meals, ...page2Meals];
    console.log(`[scraper] 총 ${allMeals.length}일 데이터 수집 완료`);

    if (DRY_RUN) {
      console.log('[scraper] 파싱 결과:');
      console.log(JSON.stringify(allMeals, null, 2));
    } else {
      await saveMealsToFirestore(allMeals);
      console.log('[scraper] Firestore 저장 완료');
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[scraper] 치명적 오류:', err);
  process.exit(1);
});
