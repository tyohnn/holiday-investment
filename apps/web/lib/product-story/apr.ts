import type { ProductStory } from './types';

/**
 * 에이피알(278470) 제품 스토리 — 2026-08-18 대화에서 교차확인한 공개 수치만.
 * SKU 매출 성장률은 공시에 없으므로 단위 판매·부문 YoY만 적고, 없으면 넣지 않는다.
 */
export const APR_PRODUCT_STORY: ProductStory = {
  stockCode: '278470',
  brand: '메디큐브',
  asOf: '2026-08-18',
  thesis:
    '메디큐브는 브랜드이고, 그 안에 화장품(고민별 라인)과 에이지알 홈케어 기기가 같이 있다. 2025년 전사 +111%의 주역은 화장품(+218%)이며 기기는 +30%다.',
  mix: [
    {
      title: '2025 연간 부문',
      source: '회사 실적 설명 · 매일경제·바이라인',
      href: 'https://www.mk.co.kr/news/business/11952480',
      rows: [
        { label: '화장품·뷰티', amount: '1조 771억', yoy: '+218%', share: '70.5%' },
        { label: '뷰티 디바이스(AGE-R)', amount: '4,070억', yoy: '+30%', share: '26.6%' },
        { label: '메디큐브 합산(추정)', amount: '1조 4,167억', yoy: '+145%', note: '회사 추정' },
      ],
    },
    {
      title: '2025 연간 지역',
      source: '서울경제·매일경제',
      href: 'https://www.sedaily.com/article/20004698',
      rows: [
        { label: '해외', amount: '1조 2,258억', yoy: '+207%', share: '80%' },
        { label: '국내', amount: '~3,016억', yoy: '−6.6%', share: '20%' },
        { label: '미국', amount: '약 5,651억', yoy: '+255%', share: '37%' },
        { label: '일본', amount: '약 1,832억', yoy: '3배+', share: '12%' },
        { label: '중화권', amount: '—', share: '8%', note: '비중 14%→8%' },
      ],
    },
    {
      title: '2026 2Q',
      source: 'ZDNet · 약업신문',
      href: 'https://zdnet.co.kr/view/?no=20260805154631',
      rows: [
        { label: '화장품·뷰티', amount: '6,483억', yoy: '+186%', share: '84.5%' },
        { label: '해외', amount: '7,042억', yoy: '+178%', share: '92%' },
        { label: '북미', amount: '3,763억', yoy: '+265%', share: '49%' },
        { label: '유럽', amount: '1,451억', yoy: '+380%', share: '19%' },
        { label: '국내', amount: '633억', yoy: '−14.5%' },
      ],
    },
  ],
  lines: [
    {
      id: 'pdrn',
      name: 'PDRN 라인',
      brief: '연어 유래 PDRN. 2024.6 론칭 후 화장품 점프의 주역.',
      concern: '미백 · 탄력 · 광채',
      growth: [
        {
          label: '제품군 누적 판매',
          value: '20개월 5,000만 개 (2026.2)',
          kind: 'units',
          source: '에이피알 보도',
          href: 'https://apr-blog.com/medicube-pdrn',
        },
        {
          label: '2025.7 → 2026.2',
          value: '1,500만 → 5,000만 (+233%)',
          kind: 'units',
          source: '에이피알 보도',
          href: 'https://apr-blog.com/medicube-pdrn',
        },
      ],
      news: [
        {
          title: 'PDRN 제품군 글로벌 누적 5,000만 개',
          date: '2026-02',
          href: 'https://apr-blog.com/medicube-pdrn',
        },
        {
          title: 'PDRN 라인 론칭 1년 1,500만 개',
          date: '2025-07',
          href: 'https://apr-blog.com/pdrn-15million',
        },
      ],
      products: [
        {
          id: 'pdrn-ampoule',
          name: 'PDRN 핑크 펩타이드 앰플',
          role: '라인 판매의 절반 이상(겔 마스크와 합산). 부스터 프로와 같이 쓰는 루틴 코어.',
          hit: true,
          growth: [
            {
              label: '2025.7 누적',
              value: '약 400만 개 (당시 PDRN 투톱)',
              kind: 'units',
              source: '에이피알 보도',
              href: 'https://apr-blog.com/pdrn-15million',
            },
          ],
          news: [
            {
              title: '헤일리 비버·카일리 제너 등 사용 노출',
              href: 'https://apr-blog.com/pdrn-15million',
              note: '회사 보도 인용. 매출 기여도는 확인 불가',
            },
          ],
        },
        {
          id: 'pdrn-gel-mask',
          name: 'PDRN 핑크 콜라겐 겔 마스크',
          role: '앰플과 함께 PDRN 판매 투톱. 아마존 카테고리 상위.',
          hit: true,
          growth: [],
          news: [
            {
              title: '앰플과 합산 시 PDRN 판매의 절반 이상',
              href: 'https://apr-blog.com/pdrn-15million',
            },
          ],
        },
        {
          id: 'collagen-glow-sun',
          name: '콜라겐 글로우 선크림',
          role: '노캐스트(백탁 없는 광채) 선케어. 미국 비중이 큼.',
          hit: true,
          growth: [
            {
              label: '출시 8개월 누적',
              value: '40만 개 (미국 60%+)',
              kind: 'units',
              source: '서울경제TV',
              href: 'https://www.sentv.co.kr/article/view/sentv202607030110',
            },
          ],
          news: [
            {
              title: '출시 8개월 40만 개 · 미국 60%+',
              date: '2026-07',
              href: 'https://www.sentv.co.kr/article/view/sentv202607030110',
            },
          ],
        },
        {
          id: 'pdrn-toneup-sun',
          name: 'PDRN 핑크 톤업 선크림',
          role: 'PDRN 선케어. 백악관 대변인 SNS 언급(회사 보도).',
          growth: [],
          news: [
            {
              title: 'APEC 방한 일정 중 개인 구매 언급',
              href: 'https://apr-blog.com/medicube-pdrn',
              note: '인지도 사례. 판매량 확인 불가',
            },
          ],
        },
        {
          id: 'pdrn-exosome',
          name: 'PDRN 핑크 콜라겐 엑소좀 샷 2000/7500',
          role: '바르는 스킨부스터. 농도  Dual SKU.',
          growth: [],
          news: [],
        },
        {
          id: 'pdrn-capsule-cream',
          name: 'PDRN 핑크 콜라겐 캡슐크림',
          role: '원액 캡슐. 공식몰 피처드.',
          growth: [],
          news: [],
        },
      ],
    },
    {
      id: 'zero',
      name: '제로라인',
      brief: '모공·피지·블랙헤드. 국내 입문·재구매 축.',
      concern: '모공 · 피지',
      growth: [
        {
          label: '부문 매출 YoY',
          value: '라인 단독 공시 없음 (확인 불가)',
          kind: 'qualitative',
          source: '추정',
        },
      ],
      news: [],
      products: [
        {
          id: 'zero-pad',
          name: '제로모공패드 2.0',
          role: 'AHA·BHA·PHA 데일리 패드. 국내 “국민 패드”.',
          hit: true,
          growth: [],
          news: [
            {
              title: '공식몰 제로라인 대표 SKU',
              href: 'https://themedicube.co.kr/category/zero-line/57/',
            },
          ],
        },
        {
          id: 'zero-foam',
          name: '제로 폼 클렌저 / 캡슐 폼',
          role: '저자극 딥클렌징. 캡슐 폼은 2025.03 출시.',
          growth: [],
          news: [],
        },
        {
          id: 'zero-oneday',
          name: '제로 원데이 세럼·크림·엑소좀 샷',
          role: '모공 축소 기능성. 농도 2000/7500/25000.',
          growth: [],
          news: [],
        },
      ],
    },
    {
      id: 'red',
      name: '레드라인',
      brief: '여드름·트러블·흔적. 시카·바디로 확장.',
      concern: '트러블 · 흔적',
      growth: [
        {
          label: '부문 매출 YoY',
          value: '라인 단독 공시 없음 (확인 불가)',
          kind: 'qualitative',
          source: '추정',
        },
      ],
      news: [],
      products: [
        {
          id: 'red-core',
          name: '레드 트러블 토너·세럼·크림 2.0',
          role: '여드름성 피부 데일리 루틴. 플러스는 대용량.',
          growth: [],
          news: [],
        },
        {
          id: 'red-succinic',
          name: '석시닉 애씨드 패드·필·흔적세럼',
          role: '스케일링·흔적 색소.',
          growth: [],
          news: [],
        },
        {
          id: 'red-erasing',
          name: '레드 이레이징 크림 2.0',
          role: '과색소·흔적. 공식몰 검색 상위.',
          growth: [],
          news: [],
        },
        {
          id: 'red-body',
          name: '레드 아크네 바디워시 2.0',
          role: '등드름. 화해 1위 표기(회사 몰).',
          hit: true,
          growth: [],
          news: [],
        },
      ],
    },
    {
      id: 'txa',
      name: 'TXA · 기미',
      brief: '트라넥삼산 기미 토닝. PDRN과 별 카테고리.',
      concern: '기미 · 잡티',
      growth: [
        {
          label: '부문 매출 YoY',
          value: '라인 단독 공시 없음 (확인 불가)',
          kind: 'qualitative',
          source: '추정',
        },
      ],
      news: [],
      products: [
        {
          id: 'txa-serum',
          name: '트라넥삼산 기미토닝 세럼·캡슐크림',
          role: '멜라닌 타깃 72시간 토닝(회사 카피).',
          growth: [],
          news: [],
        },
      ],
    },
    {
      id: 'ager',
      name: '에이지알 (기기)',
      brief: '홈케어 디바이스. 브랜드 인지도의 얼굴이나 매출 증가율은 화장품보다 낮음.',
      concern: '흡수 · 탄력 · 윤곽',
      growth: [
        {
          label: '2025 부문 매출',
          value: '4,070억 · +30%',
          kind: 'yoy',
          source: '회사 실적 설명',
          href: 'https://www.mk.co.kr/news/business/11952480',
        },
        {
          label: '글로벌 누적 대수',
          value: '600만 대+ (해외 60%+)',
          kind: 'units',
          source: '에이피알 보도',
          href: 'https://apr-blog.com/device-6million',
        },
      ],
      news: [
        {
          title: '디바이스 글로벌 누적 600만 대',
          href: 'https://apr-blog.com/device-6million',
        },
        {
          title: '500만 대 · 부스터 프로 200만 대',
          date: '2025-10',
          href: 'https://www.fnnews.com/news/202510221410429273',
        },
      ],
      products: [
        {
          id: 'booster-pro',
          name: '부스터 프로 / 프로 X2',
          role: '올인원 9-in-1. 기기 절대 1등.',
          hit: true,
          growth: [
            {
              label: '누적 판매',
              value: '200만 대+',
              kind: 'units',
              source: '파이낸셜뉴스',
              href: 'https://www.fnnews.com/news/202510221410429273',
            },
          ],
          news: [
            {
              title: 'APEC 정상 배우자 선물로 부스터 프로',
              href: 'https://apr-blog.com/device-6million',
            },
          ],
        },
        {
          id: 'hifu',
          name: '하이 포커스 샷 / 플러스',
          role: 'HIFU 집속 초음파. 윤곽·처진 라인. 의료기기 아님.',
          growth: [],
          news: [
            {
              title: '브랜드 최초 HIFU 디바이스 출시',
              href: 'https://apr-blog.com/medicube-hifu-device',
            },
          ],
        },
        {
          id: 'ultratune',
          name: '울트라튠 40.68',
          role: 'RF 고주파, 진피 약 3mm. HIFU와 깊이로 나눔.',
          growth: [],
          news: [],
        },
        {
          id: 'ager-heads',
          name: '브이 롤러 · 진동 클렌저 헤드',
          role: '부스터 본체에 붙이는 액세서리 유니버스.',
          growth: [],
          news: [],
        },
      ],
    },
  ],
  sources: [
    { label: '서울경제 2025 실적', href: 'https://www.sedaily.com/article/20004698' },
    { label: '매일경제 부문·지역', href: 'https://www.mk.co.kr/news/business/11952480' },
    { label: '바이라인 미국·일본', href: 'https://byline.network/2026/02/04_298742/' },
    { label: 'ZDNet 2026 2Q', href: 'https://zdnet.co.kr/view/?no=20260805154631' },
    { label: 'PDRN 5,000만', href: 'https://apr-blog.com/medicube-pdrn' },
    { label: '디바이스 600만', href: 'https://apr-blog.com/device-6million' },
  ],
};
