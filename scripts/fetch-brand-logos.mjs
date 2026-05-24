#!/usr/bin/env node
/**
 * fetch-brand-logos.mjs — 에어컨 민주주의 브랜드 로고 다운로더
 *
 * 사용법 (저장소 루트에서):
 *   node scripts/fetch-brand-logos.mjs
 *
 * 하는 일:
 *   1. 아래 BRANDS 목록의 각 브랜드 로고를 정사각 슬롯용으로 받아 public/brands/ 에 저장
 *   2. 소스 우선순위: Wikipedia 검증 엠블럼 → 사이트 파비콘 → Simple Icons
 *   3. 다운로드 결과를 src/lib/brandIcons.ts (자동 생성)에 기록
 *
 * Node 18+ 필요 (글로벌 fetch 사용). 외부 npm 패키지 불필요.
 *
 * 소스 설명:
 *   wiki  — 사람이 정사각으로 검증한 위키미디어 파일. 풀컬러, 대개 벡터. (최우선)
 *   domain— 브랜드 공식 사이트. Google 파비콘 서비스로 정사각 PNG 아이콘을 받음.
 *   si    — Simple Icons 슬러그. 정사각 단색 SVG. (최후 폴백)
 */

import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRANDS_DIR = path.join(ROOT, 'public', 'brands');
const ICONS_TS = path.join(ROOT, 'src', 'lib', 'brandIcons.ts');
const UA = 'aircon-democracy-logo-fetcher/1.0 (+https://aircondemocracy.com)';
const MAX_BYTES = 500 * 1024; // 절대 조건: 각 파일 500KB 이하
const MIN_BYTES = 100;

/**
 * 브랜드 목록.
 *   s      = slug (파일명·코드 ID)
 *   wiki   = 검증된 위키미디어 파일명 (정사각). 없으면 생략.
 *   wl     = wiki 언어판 (기본 'en'). 한국어판 파일이면 'ko'.
 *   domain = 파비콘 폴백용 공식 사이트 도메인.
 *   si     = Simple Icons 슬러그 (최후 폴백).
 */
const BRANDS = [
  // ── 1차 라운드에서 등록된 3개 (재내려받기 편의용) ──────────────────
  { s: 'ediya',  wiki: '이디야커피 로고.png', wl: 'ko', domain: 'ediya.com' },
  { s: 'yonsei', wiki: 'YonseiUniversityEmblem.svg', domain: 'yonsei.ac.kr' },
  { s: 'ku',     wiki: 'Korea University Global Symbol.svg', domain: 'korea.ac.kr' },

  // ── A. 카페 프랜차이즈 ────────────────────────────────────────────
  { s: 'mega',        domain: 'mega-mgccoffee.com' },
  { s: 'compose',     domain: 'composecoffee.com' },
  { s: 'hollys',      wiki: 'Hollys logo.png', domain: 'hollys.co.kr' },
  { s: 'paulbassett', domain: 'paulbassett.co.kr' },
  { s: 'angelinus',   domain: 'angelinus.com' },
  { s: 'tomntoms',    wiki: 'Tom N Toms logo.gif', domain: 'tomntoms.com' },
  { s: 'cafebene',    domain: 'caffebene.co.kr' },
  { s: 'theventi',    domain: 'theventi.co.kr' },
  { s: 'mammoth',     domain: 'mammoth-coffee.com' },
  { s: 'coffeebean',  wiki: 'Coffee Bean & Tea Leaf logo.svg', domain: 'coffeebeankorea.com' },
  { s: 'bluebottle',  wiki: 'Blue Bottle Coffee logo.svg', domain: 'bluebottlecoffee.com' },
  { s: 'gongcha',     wiki: 'Gong Cha logo.svg', domain: 'gong-cha.co.kr' },
  { s: 'dessert39',   domain: 'dessert39.com' },
  { s: 'coffeebay',   domain: 'coffeebay.co.kr' },
  { s: 'bbangsgu',    domain: 'bbangsgu.co.kr' },

  // ── B. 대학교 ─────────────────────────────────────────────────────
  { s: 'skku',     wiki: 'Sungkyunkwan University seal.svg', domain: 'skku.edu' },
  { s: 'cau',      wiki: 'CAU emblem.png', domain: 'cau.ac.kr' },
  { s: 'khu',      wiki: 'Kyung Hee University emblem.png', domain: 'khu.ac.kr' },
  { s: 'hufs',     wiki: 'Hankuk University of Foreign Studies emblem.png', domain: 'hufs.ac.kr' },
  { s: 'uos',      wiki: 'University of Seoul.svg', domain: 'uos.ac.kr' },
  { s: 'konkuk',   wiki: 'Konkuk University logo.svg', domain: 'konkuk.ac.kr' },
  { s: 'dongguk',  wiki: 'Dongguk University logo.svg', domain: 'dongguk.edu' },
  { s: 'hongik',   wiki: 'Hongik University.svg', domain: 'hongik.ac.kr' },
  { s: 'sookmyung',wiki: "Sookmyung Women's University logo.svg", domain: 'sookmyung.ac.kr' },
  { s: 'ewha',     wiki: 'Ewha Womans University logo.svg', domain: 'ewha.ac.kr' },
  { s: 'sogang',   wiki: 'Sogang University emblem.png', domain: 'sogang.ac.kr' },
  { s: 'ssu',      wiki: 'Logo of soongsil university.png', domain: 'ssu.ac.kr' },
  { s: 'sejong',   wiki: 'Sejong University logo.svg', domain: 'sejong.ac.kr' },
  { s: 'kw',       wiki: 'Kwangwoon University logo.svg', domain: 'kw.ac.kr' },
  { s: 'mju',      wiki: 'Myongji University logo.svg', domain: 'mju.ac.kr' },
  { s: 'postech',  wiki: 'POSTECH emblem.svg', domain: 'postech.ac.kr' },
  { s: 'unist',    domain: 'unist.ac.kr' },
  { s: 'gist',     wiki: 'Gist.jpeg', domain: 'gist.ac.kr' },
  { s: 'dgist',    domain: 'dgist.ac.kr' },
  { s: 'pnu',      wiki: 'Pusan National University logo.svg', domain: 'pusan.ac.kr' },
  { s: 'knu',      wiki: 'Knuemblem00.jpg', domain: 'knu.ac.kr' },
  { s: 'jnu',      wiki: 'Chonnam National University logo.svg', domain: 'jnu.ac.kr' },
  { s: 'cnu',      domain: 'cnu.ac.kr' },
  { s: 'cbnu',     wiki: 'Logo for Chungbuk University.png', domain: 'chungbuk.ac.kr' },
  { s: 'kangwon',  domain: 'kangwon.ac.kr' },
  { s: 'jejunu',   domain: 'jejunu.ac.kr' },
  { s: 'ajou',     wiki: '0-ss-ajou-symbol.jpg', domain: 'ajou.ac.kr' },
  { s: 'inha',     wiki: 'Inha University.svg', domain: 'inha.ac.kr' },
  { s: 'gachon',   wiki: 'Gachonemblem.jpg', domain: 'gachon.ac.kr' },
  { s: 'dankook',  wiki: 'Dankook University emblem.svg', domain: 'dankook.ac.kr' },

  // ── C. 패스트푸드 / 외식 ──────────────────────────────────────────
  { s: 'mcdonalds',  wiki: "McDonald's Golden Arches.svg", domain: 'mcdonalds.co.kr', si: 'mcdonalds' },
  { s: 'burgerking', wiki: 'Burger King 2020.svg', domain: 'burgerking.co.kr', si: 'burgerking' },
  { s: 'lotteria',   domain: 'lotteria.com' },
  { s: 'momstouch',  domain: 'momstouch.co.kr' },
  { s: 'kfc',        wiki: 'KFC logo-image.svg', domain: 'kfckorea.com', si: 'kfc' },
  { s: 'subway',     domain: 'subway.co.kr', si: 'subway' },
  { s: 'dominos',    domain: 'dominos.co.kr', si: 'dominos' },
  { s: 'pizzahut',   wiki: 'Pizza Hut 2025.svg', domain: 'pizzahut.co.kr', si: 'pizzahut' },
  { s: 'mrpizza',    domain: 'mrpizza.co.kr' },
  { s: 'vips',       domain: 'vips.co.kr' },
  { s: 'outback',    domain: 'outback.co.kr' },
  { s: 'ashley',     domain: 'ashley.co.kr' },
  { s: 'hansot',     domain: 'hsd.co.kr' },
  { s: 'bonjuk',     domain: 'bonif.co.kr' },
  { s: 'kyochon',    domain: 'kyochon.com' },
  { s: 'bhc',        domain: 'bhc.co.kr' },
  { s: 'bbq',        domain: 'bbq.co.kr' },
  { s: 'nene',       domain: 'nenechicken.com' },
  { s: 'gimgane',    domain: 'gimgane.co.kr' },

  // ── D. 편의점 ─────────────────────────────────────────────────────
  { s: 'gs25',     domain: 'gs25.gsretail.com' },
  { s: 'cu',       domain: 'cu.bgfretail.com' },
  { s: '7eleven',  wiki: '7-Eleven logo 2021.svg', domain: '7-eleven.co.kr' },
  { s: 'emart24',  domain: 'emart24.co.kr' },
  { s: 'ministop', domain: 'ministop.co.kr' },

  // ── E. 대형마트 / 백화점 ──────────────────────────────────────────
  { s: 'emart',     domain: 'emart.ssg.com' },
  { s: 'homeplus',  domain: 'homeplus.co.kr' },
  { s: 'lottemart', domain: 'lottemart.com' },
  { s: 'costco',    domain: 'costco.co.kr', si: 'costco' },
  { s: 'shinsegae', domain: 'shinsegae.com' },
  { s: 'lottedept', domain: 'lotteshopping.com' },
  { s: 'hyundai',   domain: 'ehyundai.com' },
  { s: 'nc',        domain: 'elandretail.com' },

  // ── F. IT 회사 ────────────────────────────────────────────────────
  { s: 'naver',       domain: 'naver.com', si: 'naver' },
  { s: 'kakao',       domain: 'kakaocorp.com' },
  { s: 'coupang',     domain: 'coupang.com' },
  { s: 'woowabros',   domain: 'woowahan.com' },
  { s: 'toss',        domain: 'toss.im' },
  { s: 'line',        wiki: 'LINE logo.svg', domain: 'linecorp.com', si: 'line' },
  { s: 'yanolja',     domain: 'yanolja.com' },
  { s: 'kurly',       domain: 'kurly.com' },
  { s: 'nhn',         domain: 'nhn.com' },
  { s: 'wemakeprice', domain: 'wemakeprice.com' },
  { s: 'tmon',        domain: 'tmon.co.kr' },
  { s: 'daangn',      domain: 'daangn.com' },

  // ── G. 대기업 ─────────────────────────────────────────────────────
  { s: 'samsung',       domain: 'samsung.com', si: 'samsung' },
  { s: 'lg',            domain: 'lg.com', si: 'lg' },
  { s: 'hyundai-group', domain: 'hyundai.com' },
  { s: 'sk',            wiki: 'SK logo.svg', domain: 'sk.com' },
  { s: 'lotte',         domain: 'lotte.co.kr' },
  { s: 'hanwha',        domain: 'hanwha.com' },
  { s: 'cj',            wiki: 'CJ logo.svg', domain: 'cj.net' },
  { s: 'gs',            domain: 'gs.co.kr' },
  { s: 'kt',            wiki: 'KT Corp 2D logo.svg', domain: 'kt.com' },
  { s: 'posco',         domain: 'posco.co.kr' },

  // ── H. 대중교통 운영사 ────────────────────────────────────────────
  { s: 'korail',      domain: 'letskorail.com' },
  { s: 'seoulmetro',  domain: 'seoulmetro.co.kr' },
  { s: 'sr',          domain: 'srail.or.kr' },
  { s: 'airportrail', domain: 'arex.or.kr' },

  // ── I. 도서관 / 문화 ──────────────────────────────────────────────
  { s: 'nlk',         domain: 'nl.go.kr' },
  { s: 'assemblylib', domain: 'nanet.go.kr' },

  // ── J. 베이커리 / 디저트 ──────────────────────────────────────────
  { s: 'parisbaguette', domain: 'paris.co.kr' },
  { s: 'tousles',       domain: 'tlj.co.kr' },
  { s: 'dunkin',        domain: 'dunkindonuts.co.kr', si: 'dunkin' },
  { s: 'krispykreme',   domain: 'krispykreme.co.kr' },
  { s: 'baskin',        domain: 'baskinrobbins.co.kr', si: 'baskinrobbins' },
];

/** 매직 바이트로 실제 이미지 형식 판별. 아니면 null (= HTML 오류페이지 등). */
function sniff(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return 'ico';
  const head = b.slice(0, 600).toString('utf8').toLowerCase();
  if (head.includes('<svg')) return 'svg';
  if (head.includes('<?xml') && head.includes('svg')) return 'svg';
  return null;
}

async function tryFetch(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) return null;
    const ext = sniff(buf);
    if (!ext) return null;
    return { buf, ext };
  } catch {
    return null;
  }
}

function sourcesFor(b) {
  const out = [];
  if (b.wiki) {
    const lang = b.wl || 'en';
    out.push({ kind: 'wikipedia', url: `https://${lang}.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(b.wiki)}` });
  }
  if (b.domain) {
    out.push({ kind: 'favicon', url: `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(b.domain)}` });
  }
  if (b.si) {
    out.push({ kind: 'simpleicons', url: `https://cdn.simpleicons.org/${b.si}` });
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALL_EXT = ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'];

async function main() {
  await mkdir(BRANDS_DIR, { recursive: true });
  const results = {};
  const report = [];
  let ok = 0;

  for (const b of BRANDS) {
    let hit = null;
    for (const src of sourcesFor(b)) {
      const r = await tryFetch(src.url);
      if (r) { hit = { ...r, via: src.kind }; break; }
      await sleep(150);
    }
    if (hit) {
      // 같은 slug 의 다른 확장자 파일이 남아있으면 정리
      for (const e of ALL_EXT) {
        if (e !== hit.ext) await unlink(path.join(BRANDS_DIR, `${b.s}.${e}`)).catch(() => {});
      }
      const file = `${b.s}.${hit.ext}`;
      await writeFile(path.join(BRANDS_DIR, file), hit.buf);
      results[b.s] = `/brands/${file}`;
      ok++;
      report.push(`  OK    ${b.s.padEnd(15)} ${hit.via.padEnd(12)} ${String(Math.ceil(hit.buf.length / 1024)).padStart(4)}KB  ${file}`);
    } else {
      report.push(`  MISS  ${b.s.padEnd(15)} (정사각 로고를 찾지 못함)`);
    }
    await sleep(120);
  }

  // src/lib/brandIcons.ts 자동 생성
  const entries = Object.keys(results).sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(results[k])},`)
    .join('\n');
  const ts =
    '// AUTO-GENERATED by scripts/fetch-brand-logos.mjs — 직접 수정하지 마세요.\n' +
    '// 브랜드 id → 내려받은 로고 경로. 스크립트를 다시 실행하면 갱신됩니다.\n' +
    'export const BRAND_ICONS: Record<string, string> = {\n' +
    entries + '\n};\n';
  await writeFile(ICONS_TS, ts);

  console.log('\n' + report.join('\n'));
  console.log(`\n${ok}/${BRANDS.length}개 로고를 public/brands/ 에 저장했습니다.`);
  console.log(`${path.relative(ROOT, ICONS_TS)} 갱신 완료.`);
  if (ok < BRANDS.length) {
    console.log('MISS 항목은 정사각 로고를 자동으로 찾지 못한 브랜드입니다 (수동 추가 필요).');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
