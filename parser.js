'use strict';

const MENU_URL = 'https://www.snue.ac.kr/snue/mm/menu/userMenuList.do?mi=1275';

/**
 * pagingForm의 regDate 필드("2026.04.27")에서 연도와 월을 추출한다.
 * @param {import('playwright').Page} page
 * @returns {{ year: number, month: number }}
 */
async function getReferenceInfo(page) {
  const regDate = await page.$eval('input[name="regDate"]', el => el.value);
  const [year, month] = regDate.split('.').map(Number);
  return { year, month };
}

/**
 * 현재 페이지 DOM에서 주간 식단 데이터를 파싱한다.
 * @param {import('playwright').Page} page
 * @param {number} refYear - pagingForm.regDate 기준 연도 (연말/연초 경계 처리용)
 * @param {number} refMonth - pagingForm.regDate 기준 월
 * @returns {Promise<MealData[]>}
 */
async function parseWeekMeals(page, refYear, refMonth) {
  const rawData = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h3'));
    const lunchH3 = headings.find(h => h.textContent.includes('중식'));
    const dinnerH3 = headings.find(h => h.textContent.includes('석식'));

    function parseList(h3) {
      if (!h3) return {};
      const ul = h3.parentElement.querySelector('ul');
      if (!ul) return {};

      const result = {};
      ul.querySelectorAll('li').forEach(li => {
        const dateEl = li.querySelector('strong');
        const menuEl = li.querySelector('p');
        if (!dateEl || !menuEl) return;

        const dateMD = dateEl.textContent.trim(); // "04.27"
        const text = menuEl.textContent.trim();
        const isHoliday = text.startsWith('휴무');

        // <p> 안의 텍스트 노드들을 메뉴 항목으로 파싱
        const menuItems = isHoliday
          ? []
          : Array.from(menuEl.childNodes)
              .filter(n => n.nodeType === 3) // TEXT_NODE
              .map(n => n.textContent.trim())
              .filter(s => s.length > 0);

        result[dateMD] = { isHoliday, menuItems };
      });
      return result;
    }

    return {
      lunch: parseList(lunchH3),
      dinner: parseList(dinnerH3),
    };
  });

  const dateKeys = new Set([
    ...Object.keys(rawData.lunch),
    ...Object.keys(rawData.dinner),
  ]);

  return Array.from(dateKeys)
    .map(dateMD => {
      const dateString = toISODateString(dateMD, refYear, refMonth);
      const lunchData = rawData.lunch[dateMD] ?? { isHoliday: false, menuItems: [] };
      const dinnerData = rawData.dinner[dateMD] ?? { isHoliday: false, menuItems: [] };
      const isHoliday = lunchData.isHoliday && dinnerData.isHoliday;

      return {
        id: dateString,
        dateString,
        // Seoul midnight — Firestore Timestamp 변환 시 정확한 날짜 보장
        date: new Date(`${dateString}T00:00:00+09:00`),
        lunch: lunchData.menuItems.map(name => ({ name })),
        dinner: dinnerData.menuItems.map(name => ({ name })),
        isHoliday,
      };
    })
    .sort((a, b) => a.dateString.localeCompare(b.dateString));
}

/**
 * "04.27" → "2026-04-27" 변환.
 * refMonth == 12이고 현재 월이 1이면 연도를 +1한다 (12월말 → 1월초 경계 처리).
 * @param {string} dateMD - "MM.DD"
 * @param {number} refYear
 * @param {number} refMonth
 * @returns {string} "YYYY-MM-DD"
 */
function toISODateString(dateMD, refYear, refMonth) {
  const [mm, dd] = dateMD.split('.').map(s => s.padStart(2, '0'));
  const month = parseInt(mm, 10);
  const year = refMonth === 12 && month === 1 ? refYear + 1 : refYear;
  return `${year}-${mm}-${dd}`;
}

/**
 * pagingForm을 통해 특정 페이지로 이동한다.
 * @param {import('playwright').Page} page
 * @param {number} pageNumber
 */
async function navigateToPage(page, pageNumber) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15_000 }),
    page.evaluate(n => {
      const form = document.getElementById('pagingForm');
      form.querySelector('input[name="currPage"]').value = String(n);
      form.submit();
    }, pageNumber),
  ]);
}

module.exports = { getReferenceInfo, parseWeekMeals, navigateToPage, MENU_URL };
