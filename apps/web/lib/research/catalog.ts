import type { ResearchBoard } from './types';

/**
 * 리서치 보드 시드.
 * 보드 = 바깥 RGL 하나. 그 칸 = 그룹. 그룹 안 = nested RGL.
 * 숫자는 산업 카탈로그에 이미 적힌 문장만 옮긴다.
 */
export const RESEARCH_BOARDS: ResearchBoard[] = [
  {
    slug: 'ecopro-bm-industry',
    title: '에코프로비엠 산업분석',
    tagline: '이차전지 사슬에서 양극재 자리를 그룹으로 펼친 보드',
    theme: 'stocks',
    relatedStockCode: '247540',
    relatedIndustrySlug: '이차전지',
    groups: [
      {
        id: 'ev-growth',
        title: '전기차산업 성장분석',
        summary: '시장규모·점유율·이익률 세 국면을 한 그룹에 둔다.',
        layout: { i: 'ev-growth', x: 0, y: 0, w: 6, h: 16, minW: 4, minH: 10 },
        widgets: [
          {
            id: 'ev-market-phase',
            kind: 'note',
            title: '시장규모 — 캐즘을 넘었는가',
            layout: { i: 'ev-market-phase', x: 0, y: 0, w: 6, h: 5, minW: 3, minH: 3 },
            body:
              '세계 xEV 배터리 사용량 H1 +20.0%, 중국 제외 +21.8%. 미국 EV 판매는 교재가 가정한 -10%가 아니라 실측 -23.8%(점유율 11%→6%). 산식 구조는 유효하고 입력값이 낙관적이었다.',
            source: '산업 카탈로그 이차전지 · 2026-08-06 국면 ①',
          },
          {
            id: 'ev-share-phase',
            kind: 'note',
            title: '점유율 — 경쟁국 대비 이기는가',
            layout: { i: 'ev-share-phase', x: 6, y: 0, w: 6, h: 5, minW: 3, minH: 3 },
            body:
              '비중국 한국 3사 합산 37.1% → 28.4%(-8.7%p). 유럽 단독 70%(2020) → 35%(2025). 46파이는 한국 독점으로 남고, LFP가 글로벌 양극재의 72%라 "세계 1위"는 세그먼트를 밝혀야 한다.',
            source: '산업 카탈로그 이차전지 · 2026-08-06 국면 ②',
          },
          {
            id: 'ev-margin-phase',
            kind: 'metric',
            title: '이익률 국면',
            layout: { i: 'ev-margin-phase', x: 0, y: 5, w: 4, h: 4, minW: 3, minH: 3 },
            metric: {
              value: '가동률',
              caption: '2026 Q2 셀 3사 동시 흑자전환. 이익률이 매출보다 먼저 반등했다.',
            },
            source: '산업 카탈로그 이차전지 · 2026-08-06 국면 ③',
          },
          {
            id: 'ev-growth-news',
            kind: 'news',
            title: '성장 관련 1차 자료',
            layout: { i: 'ev-growth-news', x: 4, y: 5, w: 8, h: 4, minW: 4, minH: 3 },
            items: [
              {
                title: '산업해부 — 밸류체인·채찍효과·국면 3문',
                note: '리서치/산업/이차전지/분석/2026-08-06-산업해부.md',
              },
              {
                title: '정량스크린 — 2021~2025 매출·이익률·ROE·부채비율',
                note: '리서치/산업/이차전지/스크리닝/2026-08-06-정량스크린.md',
              },
            ],
          },
        ],
      },
      {
        id: 'ev-value-chain',
        title: '전기차산업 밸류체인',
        summary: '광물에서 양극재·셀까지, 같은 뉴스가 단계마다 다른 이유.',
        layout: { i: 'ev-value-chain', x: 6, y: 0, w: 6, h: 16, minW: 4, minH: 10 },
        widgets: [
          {
            id: 'chain-map',
            kind: 'link',
            title: '이차전지 밸류체인 지도',
            layout: { i: 'chain-map', x: 0, y: 0, w: 5, h: 5, minW: 3, minH: 3 },
            body: '종목이 아니라 사슬로 봐야 리튬 가격이 광물 회사와 장비 회사에 다르게 닿는다.',
            href: '/stocks/macro/industries/%EC%9D%B4%EC%B0%A8%EC%A0%84%EC%A7%80',
            hrefLabel: '산업 지도에서 열기',
            source: '산업 카탈로그 이차전지',
          },
          {
            id: 'chain-stages',
            kind: 'note',
            title: '사슬 단계',
            layout: { i: 'chain-stages', x: 5, y: 0, w: 7, h: 5, minW: 4, minH: 3 },
            body:
              '광물·자원 → 소재(양극재·음극재·분리막·전해액) → 셀 → 완성차. 에코프로비엠은 소재 축의 양극재. 다운턴에서 소재는 광물보다 늦게, 셀보다 먼저 맞는다.',
            source: '산업 카탈로그 이차전지 단계 정의',
          },
          {
            id: 'chain-ecopro',
            kind: 'link',
            title: '에코프로비엠 기업정보',
            layout: { i: 'chain-ecopro', x: 0, y: 5, w: 4, h: 4, minW: 3, minH: 3 },
            body: '양극재 자리의 숫자와 공시는 종목 분석으로 내려가 본다.',
            href: '/stocks/analysis/247540',
            hrefLabel: 'Snapshot 열기',
          },
          {
            id: 'chain-news',
            kind: 'news',
            title: '밸류체인 뉴스 슬롯',
            layout: { i: 'chain-news', x: 4, y: 5, w: 8, h: 4, minW: 4, minH: 3 },
            items: [
              {
                title: '종합판정 — 28개사 채 0~4단계',
                note: '리서치/산업/이차전지/2026-08-06-종합판정.md',
              },
              {
                title: '차트·헤드라인은 이 칸에 붙인다',
                note: '시드 보드 — 실제 피드 연동 전',
              },
            ],
          },
        ],
      },
    ],
  },
];

export function getResearchBoard(slug: string): ResearchBoard | undefined {
  return RESEARCH_BOARDS.find((board) => board.slug === slug);
}

export function listResearchBoards(): ResearchBoard[] {
  return RESEARCH_BOARDS;
}
