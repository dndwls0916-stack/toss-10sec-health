# 10초 건강컷 🏃

토스 스타일의 게이미피케이션 건강 습관 웹앱

## 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:5173` 접속

### 3. 프로덕션 빌드
```bash
npm run build
npm run preview
```

## 프로젝트 구조

```
healthquest/
├── index.html              # Vite HTML 진입점
├── package.json            # 의존성 및 스크립트
├── vite.config.js          # Vite 설정
├── tailwind.config.js      # Tailwind CSS 설정
├── postcss.config.js       # PostCSS 설정
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx            # React 루트 마운트
    ├── index.css           # Tailwind 디렉티브
    └── App.jsx             # 전체 앱 컴포넌트
```

## 기술 스택

- **React 18** — 함수형 컴포넌트 + Hooks
- **Vite 5** — 빌드 도구
- **Tailwind CSS 3** — 유틸리티 스타일링
- **Framer Motion 11** — 애니메이션
- **lucide-react** — 아이콘

## 센서 퀘스트 테스트

`까치발 펌핑` 퀘스트는 스마트폰에서 테스트해야 합니다.

1. `npm run build` 후 배포 또는
2. `npm run dev` 후 로컬 네트워크 IP로 스마트폰 접속
   - `vite.config.js`에 `server: { host: true }` 추가하면 네트워크 IP 노출됨

## 개발 로드맵

- [x] Step 1: 메인 UI + 모달 뼈대
- [x] Step 2: 타이머 퀘스트 (원형 게이지 + Framer Motion)
- [x] Step 3: 센서 퀘스트 (DeviceMotion API)
- [ ] Step 4: 보상 시스템 (Confetti + 레벨업)
- [ ] Step 5: LocalStorage 영구 저장
