# 에어컨 민주주의 — Aircon Democracy

공공 공간(강의실, 지하철, 카페 등)에서 에어컨 의견을 모으는 한국 무료 시민 서비스.

세 가지 선택지로만: **추워요 / 적당해요 / 더워요**

## 기술 스택

- **Frontend**: Vite + React 18 + TypeScript, PWA
- **Hosting**: Cloudflare Pages
- **Future Backend**: Cloudflare Workers + D1

## 개발

```bash
npm install
npm run dev
```

## 배포

`main`에 푸시하면 Cloudflare Pages가 자동 배포. 자세한 셋업은 [DEPLOY.md](./DEPLOY.md) 참조.
