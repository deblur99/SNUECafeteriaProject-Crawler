# SNUE Cafeteria Crawler

서울교육대학교 학생식당 식단 정보 페이지로부터 중식·석식 메뉴 데이터를 수집하여 Firebase Firestore에 저장하는 자동화 크롤러입니다.

## 동작 방식

1. Playwright(Chromium)를 사용해 [학식 메뉴 페이지](https://www.snue.ac.kr/snue/mm/menu/userMenuList.do?mi=1275)에 접속합니다.
2. 이번 주(1페이지)와 다음 주(2페이지)의 중식·석식 데이터를 파싱합니다.
3. Repository Secret에 등록된 Firebase 서비스 계정 인증정보(`FIREBASE_SERVICE_ACCOUNT`)를 통해 Firebase Admin SDK로 Firestore에 접근하여 수집한 데이터를 저장합니다.

## GitHub Actions 스케줄

매주 일요일 21:00 KST(UTC 12:00)에 자동 실행됩니다. Actions 탭의 **Run workflow** 버튼으로 수동 실행도 가능합니다.

## Repository Secret 설정

| Secret 이름 | 설명 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 프로젝트의 서비스 계정 키 JSON 전체 내용 |

Firebase Console → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성**으로 발급한 JSON 파일의 내용을 그대로 등록합니다.

## 로컬 실행

```sh
npm install
npx playwright install chromium

# Firestore에 저장하지 않고 파싱 결과만 출력
npm run dry-run

# 실제 저장 (FIREBASE_SERVICE_ACCOUNT 환경변수 필요)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' npm start
```
