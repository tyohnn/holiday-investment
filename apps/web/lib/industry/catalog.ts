import type { ChainMember, Industry, Verdict } from './types';

/**
 * 산업 카탈로그 정본 — 산업의 경계와 밸류체인 단계는 여기서만 정의된다.
 *
 * 왜 DB가 아니라 상수인가: 산업 경계는 수집되는 사실이 아니라 **감독의 판단**이다.
 * AGENTS.md 가 "후보 풀은 KSIC 접두로 넓게 긁고, 최종 peer set 은 감독이 손으로 확정한다"
 * 로 못박은 바로 그 확정이 이 파일이다. 손으로 쓴 판단은 손으로 쓴 파일에 있어야 리뷰가
 * 되고, git 이 변경 이력을 담는다. 스키마가 굳고 산업이 여러 개로 늘면 DB로 승격한다.
 *
 * 여기에 숫자를 적지 않는다. 매출·이익률·ROE는 fin_periods 에서 읽는다 — 적어 두면
 * 반드시 낡고, 낡은 줄도 모른 채 인용된다.
 */

export const INDUSTRIES: Industry[] = [
  {
    slug: '이차전지',
    name: '이차전지',
    tagline: '광물에서 완성차까지 — 값과 물량이 갈리는 사슬',
    summary:
      '종목이 아니라 사슬로 봐야 같은 뉴스가 회사마다 다른 의미를 갖는다는 것이 보인다. ' +
      '리튬 가격 폭락은 광물 회사에는 재앙이지만 장비 회사에는 거의 무관하다. ' +
      '2026-08-06 실행에서 정량 스크린 28개사에 채 0~4단계를 적용했다.',
    // KSIC 로는 한 덩어리가 아니다 — 실제 28개사가 일곱 중분류로 흩어져 있다.
    // 이 접두들은 후보를 놓치지 않으려고 넓게 던진 그물이고, 그물에는 이차전지와
    // 무관한 회사가 대량으로 걸린다(20 화학 171개사, 26 전자부품 293개사).
    ksicPrefixes: ['19', '20', '24', '26', '28', '29', '64'],
    sieveStage: 4,
    asOf: '2026-08-06',
    sources: [
      { label: '종합판정 — 28개사 채 0~4단계', path: '리서치/산업/이차전지/2026-08-06-종합판정.md' },
      { label: '산업해부 — 밸류체인·채찍효과·국면 3문', path: '리서치/산업/이차전지/분석/2026-08-06-산업해부.md' },
      { label: '정량스크린 — 2021~2025 매출·이익률·ROE·부채비율', path: '리서치/산업/이차전지/스크리닝/2026-08-06-정량스크린.md' },
      { label: 'QC 로그 — 걸러낸 결함과 도구 수정', path: '리서치/산업/이차전지/2026-08-06-QC로그.md' },
    ],
    textbooks: [
      { label: '1권 12장 산업 분석 프레임', href: '/docs/book1/B3' },
      { label: '1권 11장 경제적 해자와 가격결정권', href: '/docs/book1/B2' },
      { label: '2권 13장 밸류체인 지도와 채찍효과', note: '2권 비공개' },
    ],
    phase: [
      {
        question: '① 시장규모 — 캐즘을 넘었는가',
        verdict: '교재 판정 유지, 단 미국은 가정보다 나쁘다',
        detail:
          '세계 xEV 배터리 사용량 H1 +20.0%, 중국 제외 +21.8%. 그러나 미국 EV 판매는 ' +
          '교재가 가정한 -10%가 아니라 실측 -23.8%였다(점유율 11%→6%). 산식 구조는 유효하고 ' +
          '입력값이 낙관적이었다.',
      },
      {
        question: '② 점유율 — 경쟁국 대비 이기는가',
        verdict: '하향 수정 — 이번 실행의 가장 중요한 갱신',
        detail:
          '비중국 한국 3사 합산 37.1% → 28.4%(-8.7%p), 유럽 단독 70%(2020) → 35%(2025). ' +
          '다만 46파이는 여전히 한국 독점이고, 이 GWh 통계는 xEV 전용이라 ESS가 빠져 있다. ' +
          'LFP가 글로벌 양극재의 72%이고 출하 톱10이 전부 중국이라 "세계 1위"는 세그먼트를 ' +
          '밝히지 않으면 오도다.',
      },
      {
        question: '③ 이익률 — 가동률·원자재·가격결정권 중 어디가 눌렀나',
        verdict: '가동률 문제 — 교재 판정 유지',
        detail: '2026 Q2 셀 3사 동시 흑자전환으로 확인됐다. 2023→2024 매출 급감은 사이클이고, 이익률이 매출보다 먼저 반등했다.',
      },
    ],
    stages: [
      // ── 물질 축 ─────────────────────────────────────────────
      {
        id: 'resource',
        name: '광물·자원',
        axis: 'material',
        role: '리튬·니켈 등 채굴과 정제',
        downturnRank: 1,
        recoveryRank: 4,
        pricing: 'metal',
        members: [
          {
            name: '고려아연',
            stockCode: '010130',
            verdict: '범위밖',
            verdictNote: '이번 범위 밖. 5년 내내 흑자면서 매출이 오히려 늘어 다음 분석 1순위로 지목됐다',
          },
          {
            name: 'POSCO홀딩스',
            stockCode: '005490',
            conglomerate: true,
            verdict: '판정보류',
            verdictNote: '매출 대부분이 철강이라 배터리 부문이 분리되지 않는다',
          },
          { name: '앨버말 · 중국 제련사', role: '해외', verdictNote: '국내 상장 종목이 아니다' },
        ],
      },
      {
        id: 'precursor',
        name: '전구체',
        axis: 'material',
        role: '니켈·코발트·망간 화합물 합성',
        pricing: 'metal',
        note: '2023→2024 매출 -68.5%로 사슬 전체에서 가장 깊게 무너졌다 — 자원에 가까울수록 깊다는 채찍효과의 실측',
        members: [
          {
            name: '에코프로머티',
            stockCode: '450080',
            verdict: '판정보류',
            verdictNote: '연결(CFS)이 없어 별도(OFS) 기준. 2024·2025 연속 영업적자',
          },
          { name: 'CNGR', role: '해외', verdictNote: '국내 상장 종목이 아니다' },
        ],
      },
      {
        id: 'cathode',
        name: '양극재',
        axis: 'material',
        role: '활물질 — 셀 원가의 최대 항목',
        downturnRank: 2,
        recoveryRank: 3,
        pricing: 'metal',
        members: [
          { name: '포스코퓨처엠', stockCode: '003670', verdict: '판정보류', verdictNote: 'PER 495배 — 해자는 남았는데 가격이 회복을 선반영했다' },
          { name: '에코프로비엠', stockCode: '247540', verdict: '판정보류', verdictNote: 'PER 86.8배' },
          {
            name: '엘앤에프',
            stockCode: '066970',
            verdict: '실패',
            verdictNote: '테슬라 계약 99% 감액 → 전환비용 해자 실증 실패, 2년 연속 적자',
          },
          {
            name: 'LG화학',
            stockCode: '051910',
            conglomerate: true,
            verdict: '판정보류',
            verdictNote: '보통주는 LG엔솔 지분가치(50% 할인 후 31.16조) 대비 시총 18.04조로 42.1% 쌈',
          },
          {
            name: 'LG화학우',
            role: '우선주',
            verdict: '통과',
            verdictNote:
              '괴리율 52.3%로 교재 C5의 40%선 초과. 우선주는 DART 법인이 아니라 종목 페이지가 없다',
          },
        ],
      },
      {
        id: 'materials',
        name: '기타 소재',
        axis: 'material',
        role: '음극재·전해액·분리막·도전재·동박',
        pricing: 'metal',
        note: '한 단계처럼 보이지만 제품마다 시장이 다르다 — 흔한 제품과 독점 제품이 같은 칸에 있다',
        members: [
          { name: '나노신소재', stockCode: '121600', role: 'CNT 도전재', verdict: '통과철회', verdictNote: '탄소도전재 독점은 사실이나 ROE가 5년 내내 10% 미만(15% 충족 0회). forward PER 19배는 이익 7.5배 증가 가정' },
          { name: '대주전자재료', stockCode: '078600', role: '실리콘 음극재', verdict: '판정보류', verdictNote: 'PER 81배' },
          { name: 'SKC', stockCode: '011790', role: '동박', verdict: '범위밖', verdictNote: '이번 범위 밖' },
          { name: '솔루스첨단소재', stockCode: '336370', role: '동박', verdict: '실패', verdictNote: '흔한 제품 + 만성 적자' },
          { name: '엔켐', stockCode: '348370', role: '전해액', verdict: '실패', verdictNote: '흔한 제품 + 만성 적자' },
          { name: 'SK아이이테크놀로지', stockCode: '361610', role: '분리막', verdict: '실패', verdictNote: '교재가 직접 인용한 "10분의 1 토막" 실증 사례' },
          { name: '천보', stockCode: '278280', role: '전해질 첨가제', verdict: '실패', verdictNote: '교재가 직접 인용한 "10분의 1 토막" 실증 사례' },
          { name: '이수스페셜티케미컬', stockCode: '457190', role: '황화리튬', verdict: '실패', verdictNote: '교재가 명시한 "테마 단타" 그 자체. PER 1,378배' },
        ],
      },
      {
        id: 'cell',
        name: '셀',
        axis: 'material',
        role: '전극 → 조립 → 활성화로 배터리 제조',
        downturnRank: 3,
        recoveryRank: 2,
        pricing: 'metal',
        note: '셀 3사가 동시에 CAPEX를 접고 있다(LG엔솔 2026 -40% 이상, SK온 "대폭 축소", 삼성SDI "소폭 감소"). 다만 투자가 사라진 게 아니라 EV 증설에서 ESS·46파이로 재배치되는 중이다',
        members: [
          { name: 'LG에너지솔루션', stockCode: '373220', verdict: '판정보류' },
          { name: '삼성SDI', stockCode: '006400', verdict: '판정보류', verdictNote: '2025 영업이익률 -13.0%' },
          {
            name: 'SK이노베이션',
            stockCode: '096770',
            role: 'SK온 모회사',
            conglomerate: true,
            verdict: '실패',
            verdictNote: 'FY2025 영업이익 +4,487억인데 순손실 -5조 4,364억. 배터리를 사려면 정유 사이클을 함께 떠안는 비효율 경로',
          },
          { name: '금양', stockCode: '001570', verdict: '실패', verdictNote: '2024·2025 연속 감사의견 거절 — 회계법인이 재무제표 자체를 부정' },
        ],
      },
      {
        id: 'pack',
        name: '팩·모듈',
        axis: 'material',
        role: '셀을 묶어 차 한 대분으로',
        members: [{ name: '셀사 및 완성차', verdictNote: '별도 상장 종목으로 분리되지 않는다' }],
      },
      {
        id: 'oem',
        name: '완성차',
        axis: 'material',
        role: '전기차 생산·판매 — 최종 수요',
        members: [{ name: '테슬라 · GM · 현대차 · 기아', verdictNote: '이 산업 경계 밖의 최종 수요다' }],
      },

      // ── 장비 축 ─────────────────────────────────────────────
      // 교재 D1: 장비는 리튬 값에 연동되지 않아 값 하락 없이 물량만 움직인다.
      // 그래서 침체에도 실적이 유지되고, 회복 국면에서 가장 먼저 발주가 재개된다.
      {
        id: 'eq-electrode',
        name: '장비 — 전극',
        axis: 'equipment',
        role: '기술 난도·부가가치 서열 1위 공정',
        capexShare: 30,
        downturnRank: 4,
        recoveryRank: 1,
        pricing: 'volume',
        members: [
          {
            name: '피엔티',
            stockCode: '137400',
            verdict: '통과',
            verdictNote:
              '5년 내내 영업이익률 12~19%로 28개사 중 유일. ROE 15% 충족 3회로 최다. 부채비율 146.1%는 표면값이고 부채의 54%가 계약부채(선수금)라 실질 66.7%',
          },
          {
            name: 'SFA넥셀',
            stockCode: '222080',
            role: '구 씨아이에스',
            verdict: '실패',
            verdictNote: '2등인데 더 비쌈 + 2025 수주 0건 + 해외계약 줄취소(브리티시볼트 청산·노스볼트 파산)',
          },
          {
            name: '윤성에프앤씨',
            stockCode: '372170',
            verdict: '판정보류',
            verdictNote: 'SK온 종속 — CAPEX를 가장 크게 깎은 고객이다',
          },
        ],
      },
      {
        id: 'eq-formation',
        name: '장비 — 활성화',
        axis: 'equipment',
        role: '충방전으로 셀을 깨우는 공정',
        capexShare: 29,
        downturnRank: 4,
        recoveryRank: 1,
        pricing: 'volume',
        members: [
          {
            name: '다원시스',
            stockCode: '068240',
            verdict: '실패',
            verdictNote: '완전자본잠식(자본총계 -5,156억), 2026-08-02 거래소 상장폐지 의결',
          },
        ],
      },
      {
        id: 'eq-inspection',
        name: '장비 — 검사·후공정',
        axis: 'equipment',
        role: '검사 장비와 셀투팩 조립 자동화',
        capexShare: 24,
        downturnRank: 4,
        recoveryRank: 1,
        pricing: 'volume',
        members: [
          {
            name: '우신시스템',
            stockCode: '017370',
            verdict: '판정보류',
            verdictNote: '고객이 셀사가 아니라 완성차·팩(HL그린파워·현대모비스·Rivian)이라 다른 사이클을 탄다',
          },
          { name: '엔시스', stockCode: '333620', verdict: '판정보류' },
        ],
      },
      {
        id: 'eq-assembly',
        name: '장비 — 조립',
        axis: 'equipment',
        role: '전극을 셀 형태로 조립',
        capexShare: 17,
        downturnRank: 4,
        recoveryRank: 1,
        pricing: 'volume',
        members: [{ name: '엠플러스', stockCode: '259630', verdict: '판정보류' }],
      },

      // ── 지주·기타 ───────────────────────────────────────────
      {
        id: 'holding',
        name: '지주·기타',
        axis: 'holding',
        role: '체인 위에 얹힌 지배구조와 인접 사업',
        members: [
          {
            name: '에코프로',
            stockCode: '086520',
            role: '지주',
            verdict: '실패',
            verdictNote: '사다리 역전 — 지분가치 2.81조인데 시총 11.17조로 3.98배 프리미엄',
          },
          { name: '에코프로에이치엔', stockCode: '383310', role: '환경', verdict: '범위밖', verdictNote: '이번 범위 밖' },
        ],
      },
    ],
  },
];

export const VERDICT_ORDER: Verdict[] = ['통과', '통과철회', '판정보류', '실패', '범위밖'];

export const SIEVE_LABELS: Record<number, string> = {
  0: 'KSIC 접두로 섹터 분할',
  1: '산업 판정 (능력범위·산업 프레임)',
  2: '정량 스크린 (매출성장·이익률·ROE·부채)',
  3: '해자·가격결정권',
  4: '피셔 — 재무제표 밖',
  5: '적정가·매수가 역산',
  6: '1차자료·뉴스 반증',
};

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

/** 이 산업에 속한 상장 종목코드 전부 — 화면이 fin_periods 를 긁을 때 쓴다. */
export function industryStockCodes(industry: Industry): string[] {
  return industry.stages.flatMap((s) =>
    s.members.map((m) => m.stockCode).filter((c): c is string => Boolean(c)),
  );
}

/**
 * 판정은 받았는데 종목 페이지가 없는 멤버 — 우선주처럼 DART 법인이 아닌 것들.
 *
 * 이게 있으면 "판정 건수"와 "상장 종목 수"가 어긋난다. 어긋남 자체는 정상이지만 설명 없이
 * 두면 둘 중 하나가 틀린 것처럼 보이므로, 화면이 이 목록을 그대로 붙인다.
 */
export function unlistedJudged(industry: Industry): ChainMember[] {
  return industry.stages.flatMap((s) => s.members.filter((m) => m.verdict && !m.stockCode));
}

/** 판정별 집계. 카탈로그에서 세므로 문서의 머릿수와 어긋날 일이 없다. */
export function verdictCounts(industry: Industry): Record<Verdict, number> {
  const out = { 통과: 0, 통과철회: 0, 판정보류: 0, 실패: 0, 범위밖: 0 } as Record<Verdict, number>;
  for (const stage of industry.stages) {
    for (const m of stage.members) if (m.verdict) out[m.verdict] += 1;
  }
  return out;
}
