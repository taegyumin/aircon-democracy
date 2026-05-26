import { BRAND_ICONS } from './brandIcons';

export interface Brand {
  id: string;
  iconUrl: string;
  /** True if the given place name matches this brand. */
  matches: (placeName: string) => boolean;
}

const includesAny = (n: string, ...needles: string[]) => needles.some((k) => n.includes(k));

// All entries must be SQUARE assets (emblems/seals/symbols), not wordmarks.
// Wide wordmarks render poorly in the square icon slots — prefer the Lucide
// type-icon fallback over a squashed wordmark.

/**
 * Static brands — logo files committed directly to public/brands/.
 */
const STATIC: Brand[] = [
  // ── Cafes ─────────────────────────────────────────────────────────
  { id: 'starbucks', iconUrl: '/brands/starbucks.svg', matches: (n) => includesAny(n, '스타벅스') || /starbucks/i.test(n) },
  { id: 'twosome',   iconUrl: '/brands/twosome.png',   matches: (n) => includesAny(n, '투썸') || /twosome/i.test(n) },
  { id: 'paik',      iconUrl: '/brands/paik.png',      matches: (n) => includesAny(n, '빽다방') || /paik('?s)?\s*(coffee|bread)?/i.test(n) },
  { id: 'ediya',     iconUrl: '/brands/ediya.png',     matches: (n) => includesAny(n, '이디야') || /ediya/i.test(n) },
  // ── Universities ──────────────────────────────────────────────────
  // '서울대' 포함은 '서울대입구역'까지 잡아 false positive — '서울대학교' 또는
  // '서울대 ' (공백 뒤 동·건물명) 또는 영문 표기로만 match. snuPlaceName은 '서울대 {b.name}'.
  { id: 'snu',       iconUrl: '/brands/snu.png',       matches: (n) => /^서울대학교(\s|$)/.test(n) || /^서울대\s/.test(n) || /seoul\s*national\s*university/i.test(n) },
  { id: 'hanyang',   iconUrl: '/brands/hanyang.svg',   matches: (n) => includesAny(n, '한양대학교', '한양대') || /hanyang/i.test(n) },
  { id: 'kaist',     iconUrl: '/brands/kaist.svg',     matches: (n) => includesAny(n, '카이스트', 'KAIST') || /kaist/i.test(n) },
  { id: 'yonsei',    iconUrl: '/brands/yonsei.svg',    matches: (n) => includesAny(n, '연세대학교', '연세대') || /yonsei/i.test(n) },
  { id: 'ku',        iconUrl: '/brands/ku.svg',        matches: (n) => includesAny(n, '고려대학교', '고려대') || /korea\s*university/i.test(n) },
];

interface BrandDef {
  id: string;
  matches: (placeName: string) => boolean;
}

/**
 * Fetched brands — logos are downloaded by scripts/fetch-brand-logos.mjs into
 * public/brands/ and recorded in the generated brandIcons.ts. A brand only
 * becomes active once its logo exists in BRAND_ICONS, so the UI never points
 * at a missing file.
 *
 * ORDER MATTERS: brandFor() returns the first match, so specific brands
 * (롯데리아 / GS25 / 이마트24 / 현대백화점) must precede broader group brands
 * (롯데 / GS / 이마트 / 현대).
 */
const FETCHED: BrandDef[] = [
  // ── A. Cafes ──────────────────────────────────────────────────────
  { id: 'mega',        matches: (n) => includesAny(n, '메가커피', '메가엠지씨', '메가MGC', '메가 엠지씨') || /mega\s*mgc/i.test(n) || /mega\s*coffee/i.test(n) },
  { id: 'compose',     matches: (n) => includesAny(n, '컴포즈') || /compose\s*coffee/i.test(n) },
  { id: 'hollys',      matches: (n) => includesAny(n, '할리스') || /hollys/i.test(n) },
  { id: 'paulbassett', matches: (n) => includesAny(n, '폴바셋', '폴 바셋') || /paul\s*bassett/i.test(n) },
  { id: 'angelinus',   matches: (n) => includesAny(n, '엔젤리너스') || /angel(-|\s|in)?-?in?-?us/i.test(n) },
  { id: 'tomntoms',    matches: (n) => includesAny(n, '탐앤탐스') || /tom\s*'?n'?\s*toms/i.test(n) },
  { id: 'cafebene',    matches: (n) => includesAny(n, '카페베네') || /caff?e\s*bene/i.test(n) },
  { id: 'theventi',    matches: (n) => includesAny(n, '더벤티') || /the\s*venti/i.test(n) },
  { id: 'mammoth',     matches: (n) => includesAny(n, '매머드커피', '매머드 커피', '매머드익스프레스') || /mammoth\s*(coffee|express)/i.test(n) },
  { id: 'coffeebean',  matches: (n) => includesAny(n, '커피빈') || /coffee\s*bean/i.test(n) },
  { id: 'bluebottle',  matches: (n) => includesAny(n, '블루보틀') || /blue\s*bottle/i.test(n) },
  { id: 'gongcha',     matches: (n) => includesAny(n, '공차') || /gong\s*cha/i.test(n) },
  { id: 'dessert39',   matches: (n) => includesAny(n, '디저트39', '디저트삼구') || /dessert\s*39/i.test(n) },
  { id: 'coffeebay',   matches: (n) => includesAny(n, '커피베이') || /coffee\s*bay/i.test(n) },
  { id: 'bbangsgu',    matches: (n) => includesAny(n, '빵스구') || /bbangsgu/i.test(n) },

  // ── B. Universities ───────────────────────────────────────────────
  { id: 'skku',     matches: (n) => includesAny(n, '성균관대학교', '성균관대') || /sungkyunkwan/i.test(n) },
  { id: 'cau',      matches: (n) => includesAny(n, '중앙대학교', '중앙대') || /chung-?ang\s*univ/i.test(n) },
  { id: 'khu',      matches: (n) => includesAny(n, '경희대학교', '경희대') || /kyung\s*hee/i.test(n) },
  { id: 'hufs',     matches: (n) => includesAny(n, '한국외국어대학교', '한국외대', '외국어대학교') || /hufs/i.test(n) },
  { id: 'uos',      matches: (n) => includesAny(n, '서울시립대학교', '서울시립대', '시립대학교') || /university\s*of\s*seoul/i.test(n) },
  { id: 'konkuk',   matches: (n) => includesAny(n, '건국대학교', '건국대') || /konkuk/i.test(n) },
  { id: 'dongguk',  matches: (n) => includesAny(n, '동국대학교', '동국대') || /dongguk/i.test(n) },
  { id: 'hongik',   matches: (n) => includesAny(n, '홍익대학교', '홍익대') || /hongik/i.test(n) },
  { id: 'sookmyung',matches: (n) => includesAny(n, '숙명여자대학교', '숙명여대') || /sookmyung/i.test(n) },
  { id: 'ewha',     matches: (n) => includesAny(n, '이화여자대학교', '이화여대') || /ewha/i.test(n) },
  { id: 'sogang',   matches: (n) => includesAny(n, '서강대학교', '서강대') || /sogang/i.test(n) },
  { id: 'ssu',      matches: (n) => includesAny(n, '숭실대학교', '숭실대') || /soongsil/i.test(n) },
  { id: 'sejong',   matches: (n) => includesAny(n, '세종대학교') || /sejong\s*univ/i.test(n) },
  { id: 'kw',       matches: (n) => includesAny(n, '광운대학교', '광운대') || /kwangwoon/i.test(n) },
  { id: 'mju',      matches: (n) => includesAny(n, '명지대학교', '명지대') || /myongji/i.test(n) },
  { id: 'postech',  matches: (n) => includesAny(n, '포항공과대학교', '포항공대', '포스텍') || /postech/i.test(n) },
  { id: 'unist',    matches: (n) => includesAny(n, '울산과학기술원', '유니스트') || /unist/i.test(n) },
  { id: 'gist',     matches: (n) => includesAny(n, '광주과학기술원', '지스트') || /\bgist\b/i.test(n) },
  { id: 'dgist',    matches: (n) => includesAny(n, '대구경북과학기술원', '디지스트') || /dgist/i.test(n) },
  { id: 'pnu',      matches: (n) => includesAny(n, '부산대학교', '부산대') || /pusan\s*national/i.test(n) },
  { id: 'knu',      matches: (n) => includesAny(n, '경북대학교', '경북대') || /kyungpook/i.test(n) },
  { id: 'jnu',      matches: (n) => includesAny(n, '전남대학교', '전남대') || /chonnam\s*national/i.test(n) },
  { id: 'cnu',      matches: (n) => includesAny(n, '충남대학교', '충남대') || /chungnam\s*national/i.test(n) },
  { id: 'cbnu',     matches: (n) => includesAny(n, '충북대학교', '충북대') || /chungbuk\s*national/i.test(n) },
  { id: 'kangwon',  matches: (n) => includesAny(n, '강원대학교', '강원대') || /kangwon\s*national/i.test(n) },
  { id: 'jejunu',   matches: (n) => includesAny(n, '제주대학교', '제주대') || /jeju\s*national/i.test(n) },
  { id: 'ajou',     matches: (n) => includesAny(n, '아주대학교', '아주대') || /ajou/i.test(n) },
  { id: 'inha',     matches: (n) => includesAny(n, '인하대학교', '인하대') || /inha/i.test(n) },
  { id: 'gachon',   matches: (n) => includesAny(n, '가천대학교', '가천대') || /gachon/i.test(n) },
  { id: 'dankook',  matches: (n) => includesAny(n, '단국대학교', '단국대') || /dankook/i.test(n) },

  // ── C. Fast food / dining ─────────────────────────────────────────
  { id: 'lotteria',  matches: (n) => includesAny(n, '롯데리아') || /lotteria/i.test(n) },
  { id: 'mcdonalds', matches: (n) => includesAny(n, '맥도날드', '맥날') || /mcdonald/i.test(n) },
  { id: 'burgerking',matches: (n) => includesAny(n, '버거킹') || /burger\s*king/i.test(n) },
  { id: 'momstouch', matches: (n) => includesAny(n, '맘스터치') || /mom'?s\s*touch/i.test(n) },
  { id: 'kfc',       matches: (n) => includesAny(n, '케이에프씨') || /kfc/i.test(n) },
  { id: 'subway',    matches: (n) => includesAny(n, '서브웨이') || /subway/i.test(n) },
  { id: 'dominos',   matches: (n) => includesAny(n, '도미노피자', '도미노') || /domino'?s/i.test(n) },
  { id: 'pizzahut',  matches: (n) => includesAny(n, '피자헛') || /pizza\s*hut/i.test(n) },
  { id: 'mrpizza',   matches: (n) => includesAny(n, '미스터피자', '미스터 피자') || /mr\.?\s*pizza/i.test(n) },
  { id: 'vips',      matches: (n) => includesAny(n, '빕스') || /\bvips\b/i.test(n) },
  { id: 'outback',   matches: (n) => includesAny(n, '아웃백') || /outback/i.test(n) },
  { id: 'ashley',    matches: (n) => includesAny(n, '애슐리') || /ashley/i.test(n) },
  { id: 'hansot',    matches: (n) => includesAny(n, '한솥') || /hansot/i.test(n) },
  { id: 'bonjuk',    matches: (n) => includesAny(n, '본죽') || /bonjuk/i.test(n) },
  { id: 'kyochon',   matches: (n) => includesAny(n, '교촌치킨', '교촌') || /kyochon/i.test(n) },
  { id: 'bhc',       matches: (n) => includesAny(n, '비비씨치킨') || /\bbhc\b/i.test(n) },
  { id: 'bbq',       matches: (n) => includesAny(n, '비비큐', 'BBQ치킨') || /\bbbq\b/i.test(n) },
  { id: 'nene',      matches: (n) => includesAny(n, '네네치킨') || /nene\s*chicken/i.test(n) },
  { id: 'gimgane',   matches: (n) => includesAny(n, '김가네') || /gimgane/i.test(n) },

  // ── D. Convenience stores ─────────────────────────────────────────
  { id: 'gs25',     matches: (n) => includesAny(n, 'GS25', '지에스25', '지에스이십오') || /gs\s*25/i.test(n) },
  { id: 'cu',       matches: (n) => includesAny(n, '씨유') || /\bCU\b/.test(n) },
  { id: '7eleven',  matches: (n) => includesAny(n, '세븐일레븐', '세븐 일레븐') || /seven\s*eleven/i.test(n) || /7\s*-?\s*eleven/i.test(n) },
  { id: 'emart24',  matches: (n) => includesAny(n, '이마트24', '이마트 24') || /e-?mart\s*24/i.test(n) },
  { id: 'ministop', matches: (n) => includesAny(n, '미니스톱') || /ministop/i.test(n) },

  // ── E. Marts / department stores ──────────────────────────────────
  { id: 'lottemart', matches: (n) => includesAny(n, '롯데마트') || /lotte\s*mart/i.test(n) },
  { id: 'lottedept', matches: (n) => includesAny(n, '롯데백화점') || /lotte\s*depart/i.test(n) },
  { id: 'hyundai',   matches: (n) => includesAny(n, '현대백화점') || /hyundai\s*depart/i.test(n) },
  { id: 'emart',     matches: (n) => includesAny(n, '이마트') || /e-?mart/i.test(n) },
  { id: 'homeplus',  matches: (n) => includesAny(n, '홈플러스') || /home\s*plus/i.test(n) },
  { id: 'costco',    matches: (n) => includesAny(n, '코스트코') || /costco/i.test(n) },
  { id: 'shinsegae', matches: (n) => includesAny(n, '신세계') || /shinsegae/i.test(n) },
  { id: 'nc',        matches: (n) => includesAny(n, 'NC백화점', '엔씨백화점') || /\bnc\s*depart/i.test(n) },

  // ── F. IT companies ───────────────────────────────────────────────
  { id: 'naver',       matches: (n) => includesAny(n, '네이버') || /naver/i.test(n) },
  { id: 'kakao',       matches: (n) => includesAny(n, '카카오') || /kakao/i.test(n) },
  { id: 'coupang',     matches: (n) => includesAny(n, '쿠팡') || /coupang/i.test(n) },
  { id: 'woowabros',   matches: (n) => includesAny(n, '우아한형제들', '배달의민족', '배민') || /woowa/i.test(n) },
  { id: 'toss',        matches: (n) => includesAny(n, '토스뱅크', '토스증권', '비바리퍼블리카') || /\btoss\b/i.test(n) },
  { id: 'line',        matches: (n) => includesAny(n, '라인플러스') || /line\s*(plus|corp)/i.test(n) },
  { id: 'yanolja',     matches: (n) => includesAny(n, '야놀자') || /yanolja/i.test(n) },
  { id: 'kurly',       matches: (n) => includesAny(n, '마켓컬리', '컬리') || /kurly/i.test(n) },
  { id: 'nhn',         matches: (n) => includesAny(n, '엔에이치엔') || /\bnhn\b/i.test(n) },
  { id: 'wemakeprice', matches: (n) => includesAny(n, '위메프', '위메이크프라이스') || /wemakeprice/i.test(n) },
  { id: 'tmon',        matches: (n) => includesAny(n, '티몬') || /\btmon\b/i.test(n) },
  { id: 'daangn',      matches: (n) => includesAny(n, '당근마켓') || /daangn|karrot/i.test(n) },

  // ── G. Conglomerates (office buildings) ───────────────────────────
  { id: 'samsung',       matches: (n) => includesAny(n, '삼성') || /samsung/i.test(n) },
  { id: 'lg',            matches: (n) => includesAny(n, '엘지전자', '엘지디스플레이', '엘지화학', '엘지에너지') || /\bLG\b/.test(n) },
  { id: 'hyundai-group', matches: (n) => includesAny(n, '현대') || /hyundai/i.test(n) },
  { id: 'sk',            matches: (n) => includesAny(n, '에스케이') || /\bSK\b/.test(n) },
  { id: 'lotte',         matches: (n) => includesAny(n, '롯데') || /lotte/i.test(n) },
  { id: 'hanwha',        matches: (n) => includesAny(n, '한화') || /hanwha/i.test(n) },
  { id: 'cj',            matches: (n) => includesAny(n, '씨제이') || /\bCJ\b/.test(n) },
  { id: 'gs',            matches: (n) => includesAny(n, '지에스') || /\bGS\b/.test(n) },
  { id: 'kt',            matches: (n) => includesAny(n, '케이티') || /\bKT\b/.test(n) },
  { id: 'posco',         matches: (n) => includesAny(n, '포스코') || /posco/i.test(n) },

  // ── H. Public transit operators ───────────────────────────────────
  { id: 'korail',      matches: (n) => includesAny(n, '코레일', '한국철도공사') || /korail/i.test(n) },
  { id: 'seoulmetro',  matches: (n) => includesAny(n, '서울교통공사', '서울메트로') || /seoul\s*metro/i.test(n) },
  { id: 'sr',          matches: (n) => includesAny(n, '에스알', 'SRT') || /\bsrt\b/i.test(n) },
  { id: 'airportrail', matches: (n) => includesAny(n, '공항철도', '인천공항철도') || /arex|airport\s*rail/i.test(n) },

  // ── I. Libraries / culture ────────────────────────────────────────
  { id: 'nlk',         matches: (n) => includesAny(n, '국립중앙도서관') || /national\s*library\s*of\s*korea/i.test(n) },
  { id: 'assemblylib', matches: (n) => includesAny(n, '국회도서관') || /national\s*assembly\s*library/i.test(n) },

  // ── J. Bakeries / desserts ────────────────────────────────────────
  { id: 'parisbaguette',matches: (n) => includesAny(n, '파리바게뜨', '파리바게트', '파리 바게뜨') || /paris\s*baguette/i.test(n) },
  { id: 'tousles',      matches: (n) => includesAny(n, '뚜레쥬르', '뚜레주르') || /tous\s*les\s*jours/i.test(n) },
  { id: 'dunkin',       matches: (n) => includesAny(n, '던킨') || /dunkin/i.test(n) },
  { id: 'krispykreme',  matches: (n) => includesAny(n, '크리스피크림', '크리스피 크림') || /krispy\s*kreme/i.test(n) },
  { id: 'baskin',       matches: (n) => includesAny(n, '배스킨라빈스', '베스킨라빈스', '배라') || /baskin\s*robbins/i.test(n) },
];

export const BRANDS: Brand[] = [
  ...STATIC,
  ...FETCHED.flatMap((d) => {
    const iconUrl = BRAND_ICONS[d.id];
    return iconUrl ? [{ id: d.id, iconUrl, matches: d.matches }] : [];
  }),
];

export function brandFor(placeName: string): Brand | null {
  return BRANDS.find((b) => b.matches(placeName)) ?? null;
}
