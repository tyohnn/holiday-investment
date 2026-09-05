import type { CompanyMenuId } from './catalog';
import {
  SHAREHOLDER_GROUPS,
  kv,
  r0,
  r1,
  r2,
  type GuidePageDef,
  type GuideRowDef,
  type GuideSectionDef,
} from './guide-model';
import {
  MULTIFACTOR_AXES,
  balanceSheetRows,
  cashFlowRows,
  incomeStatementRows,
  investValueRows,
  ratioAnnualRows,
  ratioQuarterRows,
  snapshotHighlightRows,
} from './guide-statements';

function shareholderGroupRows(prefix: string): GuideRowDef[] {
  return SHAREHOLDER_GROUPS.map((group) => r1(`${prefix}-${group.id}`, group.label));
}

function consensusLine(id: string, label: string, bind?: GuideRowDef['bind']): GuideRowDef {
  return r0(id, label, bind, [
    r1(`${id}-yoy`, '전년동기대비 (%)', undefined, undefined, { unit: 'pct' }),
    r1(`${id}-vs`, '컨센서스대비 (%)', undefined, undefined, { unit: 'pct' }),
  ]);
}

function sectorBlock(
  id: string,
  title: string,
  left: string,
  right: string,
  bind?: GuideRowDef['bind'],
  leftBind?: GuideRowDef['bind'],
  rightBind?: GuideRowDef['bind'],
): GuideSectionDef {
  return {
    kind: 'tree-table',
    id,
    title,
    columns: 'sector',
    rows: [
      r0(`${id}-co`, '종목', bind, [r2(`${id}-co-a`, left, leftBind), r2(`${id}-co-b`, right, rightBind)]),
      r0(`${id}-wi`, 'WI26', undefined, [r2(`${id}-wi-a`, left), r2(`${id}-wi-b`, right)]),
      r0(`${id}-ind`, '업종', undefined, [r2(`${id}-ind-a`, left), r2(`${id}-ind-b`, right)]),
      r0(`${id}-mkt`, 'KOSPI', undefined, [r2(`${id}-mkt-a`, left), r2(`${id}-mkt-b`, right)]),
    ],
  };
}

function snapshotPage(): GuidePageDef {
  return {
    id: 'snapshot',
    title: 'Snapshot',
    sections: [
      {
        kind: 'chart',
        id: 'snap-price',
        title: '주가추이 · 내부자거래',
        series: ['주가추이 (1개월 / 1년 / 3년)', '내부자거래 (1개월 / 1년 / 3년)'],
      },
      {
        kind: 'chart',
        id: 'snap-flow',
        title: '외국인 지분율 · 시가총액',
        series: ['외국인 지분율 (1년)', '시가총액 (1년)'],
      },
      {
        kind: 'chart',
        id: 'snap-rel',
        title: '상대수익률 1Y',
        series: ['상대수익률 (조회시작일=100)'],
      },
      {
        kind: 'kv',
        id: 'snap-quote',
        title: '시세현황',
        items: [
          kv('q-close', '종가'),
          kv('q-chg', '전일대비'),
          kv('q-ret', '수익률'),
          kv('q-vol', '거래량'),
          kv('q-val', '거래대금'),
          kv('q-52h', '52주 최고가'),
          kv('q-52l', '52주 최저가'),
          kv('q-r1m', '수익률 1M'),
          kv('q-r3m', '수익률 3M'),
          kv('q-r6m', '수익률 6M'),
          kv('q-r1y', '수익률 1Y'),
          kv('q-frgn', '외국인지분율', undefined, 'pct'),
          kv('q-mcap-all', '시가총액 (상장예정포함)'),
          kv('q-mcap', '시가총액 (보통주)'),
          kv('q-beta', '52주베타'),
          kv('q-par', '액면가'),
          kv('q-sh-c', '발행주식수 (보통주)', undefined, 'shares'),
          kv('q-sh-p', '발행주식수 (우선주)', undefined, 'shares'),
          kv('q-nxt-p', '종가(NXT)'),
          kv('q-nxt-v', '거래량/거래대금(NXT)'),
          kv('q-free', '유동주식수 / 비율 (보통주)'),
        ],
      },
      {
        kind: 'kv',
        id: 'snap-issue',
        title: '실적이슈',
        items: [
          kv('iss-date', '확정실적 발표일'),
          kv('iss-op', '확정실적(영업이익)', 'operating_income', 'won'),
          kv('iss-vs', '예상실적대비(%)', undefined, 'pct'),
          kv('iss-yoy', '전년동기대비(%)', 'yoy:operating_income', 'pct'),
        ],
      },
      {
        kind: 'records',
        id: 'snap-funds',
        title: '운용사별 보유 현황',
        columns: [
          { id: 'name', label: '운용사명' },
          { id: 'shares', label: '보유수량' },
          { id: 'value', label: '시가평가액' },
          { id: 'mkt', label: '상장주식수내비중' },
          { id: 'fund', label: '운용사내비중' },
        ],
        source: 'empty',
        emptyRows: 10,
        note: '공모펀드 분기말, 보유수량 상위 10',
      },
      {
        kind: 'records',
        id: 'snap-holders',
        title: '주주현황',
        columns: [
          { id: 'item', label: '항목' },
          { id: 'common', label: '보통주' },
          { id: 'ratio', label: '지분율' },
          { id: 'asof', label: '최종변동일' },
        ],
        source: 'empty',
        emptyRows: 5,
        note: 'DART 지분공시, 보통주 상위. 그룹 행은 구성원 툴팁(주주명^지분율)',
      },
      {
        kind: 'records',
        id: 'snap-holder-class',
        title: '주주구분 현황',
        columns: [
          { id: 'class', label: '주주구분' },
          { id: 'common', label: '보통주' },
          { id: 'ratio', label: '지분율' },
          { id: 'asof', label: '최종변동일' },
        ],
        source: 'empty',
        emptyRows: SHAREHOLDER_GROUPS.length,
        note: '구분 간 지분율은 중복되지 않음',
      },
      {
        kind: 'kpis',
        id: 'snap-opinion',
        title: '투자의견 컨센서스',
        items: [
          kv('op-buy', 'Buy 게이지 (1=Sell … 5=S/Buy)'),
          kv('op-view', '투자의견'),
          kv('op-tp', '목표주가'),
          kv('op-eps', 'EPS'),
          kv('op-per', 'PER'),
          kv('op-n', '추정기관수'),
        ],
      },
      {
        kind: 'chart',
        id: 'snap-tp-ts',
        title: '투자의견 및 목표주가',
        series: ['투자의견', '목표주가'],
      },
      {
        kind: 'kv',
        id: 'snap-op-dist',
        title: '투자의견 분포',
        items: [
          kv('od-ssell', '강력매도'),
          kv('od-sell', '매도'),
          kv('od-hold', '중립'),
          kv('od-buy', '매수'),
          kv('od-sbuy', '강력매수'),
          kv('od-chg', '1개월 전 대비'),
        ],
      },
      {
        kind: 'note',
        id: 'snap-biz',
        title: 'Business Summary',
        text: '애널리스트 요약 문단 — 적재 전',
      },
      {
        kind: 'tree-table',
        id: 'snap-sector',
        title: '업종 비교',
        columns: 'snap-sector',
        note: '열: 종목 · WI26 · 업종 · 시장. 차트 토글 슬롯은 아래.',
        rows: [
          r0('ss-mcap', '시가총액'),
          r0('ss-rev', '매출액', 'revenue'),
          r0('ss-op', '영업이익', 'operating_income'),
          r0('ss-eps', 'EPS'),
          r0('ss-per', 'PER'),
          r0('ss-eve', 'EV/EBITDA'),
          r0('ss-roe', 'ROE', 'roe_pct', undefined, { unit: 'pct' }),
          r0('ss-div', '현금배당수익률', undefined, undefined, { unit: 'pct' }),
          r0('ss-beta', '52주베타'),
        ],
      },
      {
        kind: 'chart',
        id: 'snap-sector-chart',
        title: '업종 비교 차트',
        series: ['EPS', 'PER', 'EV/EBITDA', 'ROE', '현금배당수익률'],
      },
      {
        kind: 'chart',
        id: 'snap-per-band',
        title: 'PER Band',
        series: ['PER Band (연결 / 별도)'],
      },
      {
        kind: 'chart',
        id: 'snap-pbr-band',
        title: 'PBR Band',
        series: ['PBR Band (연결 / 별도)'],
      },
      {
        kind: 'kv',
        id: 'snap-supply',
        title: '주가 및 수급현황',
        items: [kv('sup-lend', '대차잔고비중', undefined, 'pct'), kv('sup-short', '차입공매도비중', undefined, 'pct')],
      },
      {
        kind: 'tree-table',
        id: 'snap-highlight',
        title: 'Financial Highlight',
        columns: 'highlight',
        rows: snapshotHighlightRows(),
        note: '토글 슬롯: 주재무제표 · 연결/별도 · 전체/연간/분기. 열: 연간 3기 + 최근분기.',
      },
    ],
  };
}

function profilePage(): GuidePageDef {
  return {
    id: 'profile',
    title: '기업개요',
    sections: [
      {
        kind: 'kv',
        id: 'gi',
        title: 'General Information',
        items: [
          kv('gi-addr', '본사주소'),
          kv('gi-home', '홈페이지'),
          kv('gi-en', '회사영문명'),
          kv('gi-tel', '대표전화'),
          kv('gi-ir', 'IR 담당자'),
          kv('gi-ceo', '대표이사', 'company.ceo'),
          kv('gi-group', '계열'),
          kv('gi-est', '설립일', 'company.established'),
          kv('gi-list', '상장일'),
          kv('gi-vent-on', '벤처기업지정일'),
          kv('gi-vent-off', '벤처기업해제(예정)일'),
          kv('gi-audit', '감사인'),
          kv('gi-opin', '감사의견'),
          kv('gi-emp', '종업원수', undefined, 'count'),
          kv('gi-old', '구기업명'),
          kv('gi-bank', '주거래은행'),
          kv('gi-exdiv', '배당락일'),
          kv('gi-name', '회사명', 'company.name'),
          kv('gi-code', '종목코드', 'company.stock_code'),
          kv('gi-mkt', '시장', 'company.market'),
          kv('gi-sec', '업종', 'company.sector'),
          kv('gi-fy', '결산월', 'company.fiscal_month'),
        ],
      },
      {
        kind: 'records',
        id: 'hist',
        title: '최근연혁',
        columns: [
          { id: 'date', label: '날짜' },
          { id: 'kind', label: '구분' },
          { id: 'text', label: '내용' },
        ],
        source: 'empty',
        emptyRows: 5,
      },
      {
        kind: 'chart',
        id: 'mix-chart',
        title: '매출비중 추이',
        series: ['부문별 매출 비중 (%)'],
      },
      {
        kind: 'records',
        id: 'mix',
        title: '매출비중 추이 (표)',
        columns: [
          { id: 'seg', label: '부문' },
          { id: 'y0', label: '최근연' },
          { id: 'y1', label: '전년' },
          { id: 'y2', label: '전전년' },
        ],
        source: 'empty',
        emptyRows: 5,
      },
      {
        kind: 'records',
        id: 'share',
        title: '주요제품 시장점유율',
        columns: [
          { id: 'product', label: '주요제품' },
          { id: 'share', label: '시장점유율' },
        ],
        source: 'empty',
        emptyRows: 3,
      },
      {
        kind: 'chart',
        id: 'cost-sga',
        title: '판관비율추이',
        series: ['판관비율'],
      },
      {
        kind: 'chart',
        id: 'cost-cogs',
        title: '매출원가추이',
        series: ['매출원가율'],
      },
      {
        kind: 'tree-table',
        id: 'cost-table',
        title: '비용구성',
        columns: 'highlight',
        rows: [
          r0('cost-sga', '판관비율', undefined, undefined, { unit: 'pct' }),
          r0('cost-cogs', '매출원가율', undefined, undefined, { unit: 'pct' }),
        ],
        note: '연결 / 별도 토글 슬롯',
      },
      {
        kind: 'tree-table',
        id: 'rnd',
        title: '연구개발비 지출 현황',
        columns: 'highlight',
        rows: [
          r0('rnd-total', 'R&D 투자 총액'),
          r0('rnd-total-pct', 'R&D 투자 / 매출액 비중', undefined, undefined, { unit: 'pct' }),
          r0('rnd-ia', '무형자산 처리'),
          r0('rnd-ia-pct', '무형자산 처리 / 매출액 비중', undefined, undefined, { unit: 'pct' }),
          r0('rnd-exp', '당기비용 처리'),
          r0('rnd-exp-pct', '당기비용 처리 / 매출액 비중', undefined, undefined, { unit: 'pct' }),
          r0('rnd-fs', '회계기준 (연결/별도)'),
        ],
      },
      {
        kind: 'tree-table',
        id: 'headcount',
        title: '인원 현황',
        columns: 'staff',
        rows: [
          r0('hc-perm', '기간의정함이없는근로자(계)', undefined, [
            r1('hc-perm-m', '기말인원 남', undefined, undefined, { unit: 'count' }),
            r1('hc-perm-f', '기말인원 여', undefined, undefined, { unit: 'count' }),
            r1('hc-perm-t', '기말인원 총계', undefined, undefined, { unit: 'count' }),
            r1('hc-perm-pay', '당기급여 총액'),
            r1('hc-perm-ten', '평균근속연수'),
            r1('hc-perm-avg', '1인 평균급여'),
          ]),
          r0('hc-temp', '기간제 근로자(계)', undefined, [
            r1('hc-temp-m', '기말인원 남', undefined, undefined, { unit: 'count' }),
            r1('hc-temp-f', '기말인원 여', undefined, undefined, { unit: 'count' }),
            r1('hc-temp-t', '기말인원 총계', undefined, undefined, { unit: 'count' }),
            r1('hc-temp-pay', '당기급여 총액'),
            r1('hc-temp-ten', '평균근속연수'),
            r1('hc-temp-avg', '1인 평균급여'),
          ]),
          r0('hc-all', '총계', undefined, [
            r1('hc-all-t', '기말인원 총계', undefined, undefined, { unit: 'count' }),
            r1('hc-all-pay', '당기급여 총액'),
          ]),
        ],
      },
      {
        kind: 'tree-table',
        id: 'pf-holders',
        title: '주주 구분별 지분현황',
        columns: 'highlight',
        rows: shareholderGroupRows('pf-hc'),
        note: '주주구분 × 시점 (연초 3점 + 최근일)',
      },
      {
        kind: 'records',
        id: 'credit-bond',
        title: '신용등급 변동내역 · Bond',
        columns: [
          { id: 'date', label: '일자' },
          { id: 'agency', label: '평가사' },
          { id: 'rating', label: '등급' },
        ],
        source: 'empty',
        emptyRows: 3,
      },
      {
        kind: 'records',
        id: 'credit-cp',
        title: '신용등급 변동내역 · CP',
        columns: [
          { id: 'date', label: '일자' },
          { id: 'agency', label: '평가사' },
          { id: 'rating', label: '등급' },
        ],
        source: 'empty',
        emptyRows: 3,
      },
      {
        kind: 'records',
        id: 'capital',
        title: '자본금 변동내역',
        columns: [
          { id: 'change', label: '변동일' },
          { id: 'list', label: '상장일' },
          { id: 'kind', label: '종류' },
          { id: 'shares', label: '변동주식수' },
          { id: 'after', label: '변동후자본금' },
        ],
        source: 'empty',
        emptyRows: 3,
      },
      {
        kind: 'records',
        id: 'affiliates',
        title: '관계사 현황',
        columns: [
          { id: 'name', label: '관계사' },
          { id: 'ratio', label: '지분율' },
        ],
        source: 'empty',
        emptyRows: 6,
        note: '정기보고서 결산, 연 1회',
      },
      {
        kind: 'records',
        id: 'consol',
        title: '연결대상 회사 현황',
        columns: [
          { id: 'name', label: '연결대상회사' },
          { id: 'biz', label: '주요사업' },
          { id: 'est', label: '설립일' },
          { id: 'assets', label: '자산' },
        ],
        source: 'empty',
        emptyRows: 6,
        note: '분·반기·결산, 연 4회',
      },
    ],
  };
}

function financialsPage(): GuidePageDef {
  return {
    id: 'financials',
    title: '재무제표',
    sections: [
      {
        kind: 'chart',
        id: 'is-chart-items',
        title: '주요 재무항목',
        series: ['매출액', '영업이익', '세전이익', '당기순이익'],
        filled: 'financial',
      },
      {
        kind: 'chart',
        id: 'is-chart-growth',
        title: '성장성 지표 [전년동기대비]',
        series: ['매출액증가율', '영업이익증가율', 'EBITDA증가율', '순이익증가율'],
      },
      {
        kind: 'tree-table',
        id: 'is',
        title: '포괄손익계산서',
        columns: 'fin-is',
        rows: incomeStatementRows(),
        note: '단위 억원. 최근 3개 연간 · 최근분기 · 전년동기 · 전년동기대비(%). 연결/별도 · 연간/분기 토글 슬롯.',
      },
      {
        kind: 'chart',
        id: 'bs-chart-items',
        title: '주요 재무항목',
        series: ['자산총계', '부채총계', '자본총계', '지배주주지분'],
      },
      {
        kind: 'chart',
        id: 'bs-chart-stable',
        title: '안정성 지표',
        series: ['유동비율', '부채비율'],
      },
      {
        kind: 'tree-table',
        id: 'bs',
        title: '재무상태표',
        columns: 'fin-bs',
        rows: balanceSheetRows(),
        note: '최근 3개 연간 · 최근분기',
      },
      {
        kind: 'chart',
        id: 'cf-chart-ic',
        title: 'Invested Capital',
        series: ['당기순이익', '현금유출없는비용가산', '현금유입없는수익차감', '영업활동으로인한자산및부채변동'],
      },
      {
        kind: 'chart',
        id: 'cf-chart-fcf',
        title: 'Free Cash Flow',
        series: ['영업활동현금흐름', '투자활동현금흐름', '재무활동현금흐름'],
      },
      {
        kind: 'tree-table',
        id: 'cf',
        title: '현금흐름표',
        columns: 'fin-bs',
        rows: cashFlowRows(),
        note: '최근 3개 연간 · 최근분기',
      },
    ],
  };
}

function ratiosPage(): GuidePageDef {
  return {
    id: 'ratios',
    title: '재무비율',
    sections: [
      {
        kind: 'chart',
        id: 'ratio-growth',
        title: 'Growth Ratio',
        series: ['매출액증가율', '영업이익증가율', 'EPS증가율'],
      },
      {
        kind: 'chart',
        id: 'ratio-profit',
        title: 'Profitability Ratio',
        series: ['ROA', '자기자본현금흐름율(보통주현금흐름)', '영업이익률'],
      },
      {
        kind: 'tree-table',
        id: 'ratio-a',
        title: '재무비율 [연간]',
        columns: 'ratio-a',
        rows: ratioAnnualRows(),
        note: '최근 4개 연간 + 최근분기. + 는 산식 구성 계정.',
      },
      {
        kind: 'tree-table',
        id: 'ratio-q',
        title: '재무비율 [3개월]',
        columns: 'ratio-q',
        rows: ratioQuarterRows(),
        note: '최근 5개 분기. 안정성·활동성 없음.',
      },
    ],
  };
}

function indicatorsPage(): GuidePageDef {
  return {
    id: 'indicators',
    title: '투자지표',
    sections: [
      {
        kind: 'kpis',
        id: 'mf',
        title: '멀티팩터 스타일 분석',
        items: MULTIFACTOR_AXES.map((label, i) => kv(`mf-${i}`, label)),
      },
      {
        kind: 'chart',
        id: 'inv-ps-chart',
        title: 'Per Share 지표',
        series: ['EPS', 'BPS', 'EBITDAPS', '보통주DPS'],
      },
      {
        kind: 'chart',
        id: 'inv-mult-chart',
        title: 'Multiple 지표',
        series: ['PER', 'EV/EBITDA', 'PBR'],
      },
      {
        kind: 'tree-table',
        id: 'inv-price',
        title: '주가관련 지표',
        columns: 'invest-price',
        rows: [
          r0('ip-price', '주가(원)'),
          r0('ip-mcap', '시가총액'),
          r0('ip-per', 'PER'),
          r0('ip-pbr', 'PBR'),
        ],
        note: '열: 연도마다 최고 / 최저 (최근 연·분기는 최고·최저만)',
      },
      {
        kind: 'tree-table',
        id: 'inv-value',
        title: '기업가치 지표',
        columns: 'invest',
        rows: investValueRows(),
      },
    ],
  };
}

function consensusPage(): GuidePageDef {
  return {
    id: 'consensus',
    title: '컨센서스',
    sections: [
      {
        kind: 'chart',
        id: 'cons-vs',
        title: '실적&컨센서스 추이',
        series: ['실적', '추정 — 매출액 / 영업이익 / 당기순이익'],
      },
      {
        kind: 'tree-table',
        id: 'cons-actual',
        title: '실적&컨센서스',
        columns: 'cons-actual',
        rows: [
          consensusLine('ca-rev', '매출액', 'revenue'),
          consensusLine('ca-op', '영업이익', 'operating_income'),
          consensusLine('ca-ni', '당기순이익', 'net_income'),
          r0('ca-ni-ctl', '당기순이익(지배)'),
          r0('ca-ni-nci', '당기순이익(비지배)'),
          r0('ca-assets', '자산총계', 'assets'),
          r0('ca-liab', '부채총계', 'liabilities'),
          r0('ca-eq', '자본총계', 'equity', [r1('ca-eq-ctl', '자본총계(지배)'), r1('ca-eq-nci', '자본총계(비지배)')]),
          r0('ca-cap', '자본금'),
          r0('ca-eps', 'EPS'),
          r0('ca-bps', 'BPS'),
          r0('ca-dps', '현금DPS'),
          r0('ca-per', 'PER'),
          r0('ca-pbr', 'PBR'),
        ],
        note: '토글 슬롯: 연결/별도 · 연간/분기 · 매출액/영업이익/당기순이익',
      },
      {
        kind: 'chart',
        id: 'cons-ts-chart',
        title: '컨센서스 시계열 추이',
        series: ['매출액', '영업이익', '당기순이익', 'EPS', 'PER', 'PER(Fwd.12M)'],
      },
      {
        kind: 'tree-table',
        id: 'cons-ts',
        title: '컨센서스 시계열',
        columns: 'cons-ts',
        rows: [
          r0('cts-rev', '매출액', 'revenue'),
          r0('cts-op', '영업이익', 'operating_income'),
          r0('cts-ni', '당기순이익', 'net_income'),
          r0('cts-eps', 'EPS'),
          r0('cts-per', 'PER'),
          r0('cts-per-fwd', 'PER(Fwd. 12M)'),
          r0('cts-tp', '목표주가'),
          r0('cts-opn', '투자의견(점수)'),
        ],
      },
      {
        kind: 'records',
        id: 'cons-brokers',
        title: '증권사별 적정주가 & 투자의견',
        columns: [
          { id: 'house', label: '추정기관' },
          { id: 'asof', label: '추정일자' },
          { id: 'tp', label: '적정주가' },
          { id: 'tp-prev', label: '직전 적정주가' },
          { id: 'chg', label: '증감율' },
          { id: 'view', label: '투자의견' },
          { id: 'view-prev', label: '직전 투자의견' },
        ],
        source: 'empty',
        emptyRows: 8,
        note: '첫 행 Consensus = 평균',
      },
      {
        kind: 'records',
        id: 'cons-reports',
        title: '리포트 요약',
        columns: [
          { id: 'date', label: '일자' },
          { id: 'summary', label: '종목명-리포트 요약' },
          { id: 'view', label: '투자의견' },
          { id: 'tp', label: '목표주가' },
          { id: 'close', label: '전일종가' },
          { id: 'src', label: '제공처/작성자' },
        ],
        source: 'empty',
        emptyRows: 8,
      },
    ],
  };
}

function ownershipPage(): GuidePageDef {
  const detailTabs = SHAREHOLDER_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    sections: [
      {
        kind: 'records' as const,
        id: `own-detail-${group.id}`,
        title: group.label,
        columns: [
          { id: 'name', label: '주주명' },
          { id: 'rel', label: '관계' },
          { id: 'common', label: '보통주' },
          { id: 'ratio', label: '지분율' },
          { id: 'asof', label: '최종변동일' },
        ],
        source: 'empty' as const,
        emptyRows: 5,
      },
    ],
  }));

  return {
    id: 'ownership',
    title: '지분분석',
    sections: [
      {
        kind: 'records',
        id: 'own-class',
        title: '주주 구분 현황',
        columns: [
          { id: 'class', label: '주주구분' },
          { id: 'n', label: '대표주주수' },
          { id: 'common', label: '보통주' },
          { id: 'ratio', label: '지분율' },
          { id: 'asof', label: '최종변동일' },
        ],
        source: 'empty',
        emptyRows: SHAREHOLDER_GROUPS.length,
      },
      { kind: 'tabs', id: 'own-detail', title: '주주 상세', tabs: detailTabs },
      {
        kind: 'records',
        id: 'own-changes',
        title: '주주변동내역 [최근 20건]',
        columns: [
          { id: 'class', label: '주주구분' },
          { id: 'rep', label: '대표주주' },
          { id: 'chg', label: '변동주주' },
          { id: 'date', label: '변동일' },
          { id: 'reason', label: '주요변동사유' },
          { id: 'kind', label: '주식종류' },
          { id: 'before', label: '변동전' },
          { id: 'delta', label: '증감' },
          { id: 'after', label: '변동후' },
          { id: 'ratio', label: '지분율' },
        ],
        source: 'ownership',
        note: '필터 슬롯: 대표주주 · 변동주주 · 변동일',
      },
    ],
  };
}

function sectorPage(): GuidePageDef {
  return {
    id: 'sector',
    title: '업종분석',
    sections: [
      sectorBlock('sec-per', 'PER', '수정주가(기말)', 'EPS'),
      sectorBlock('sec-pbr', 'PBR', '수정주가(기말)', 'BPS'),
      sectorBlock('sec-rev', '매출액 증가율', '당기 매출액', '전기 매출액', 'yoy:revenue', 'revenue'),
      sectorBlock('sec-op', '영업이익 증가율', '당기 영업이익', '전기 영업이익', 'yoy:operating_income', 'operating_income'),
      sectorBlock('sec-ni', '순이익 증가율', '당기 순이익 (지배)', '전기 순이익 (지배)', 'yoy:net_income', 'net_income'),
      sectorBlock('sec-debt', '부채비율', '부채총계', '자본총계', 'debt_ratio_pct', 'liabilities', 'equity'),
    ],
  };
}

function peersPage(): GuidePageDef {
  return {
    id: 'peers',
    title: '경쟁사비교',
    sections: [
      {
        kind: 'kpis',
        id: 'peer-op',
        title: '투자의견',
        items: [
          kv('po-self', '종목 (5점)'),
          kv('po-a', 'Peer A (5점)'),
          kv('po-b', 'Peer B (5점)'),
          kv('po-c', 'Peer C (5점)'),
        ],
      },
      {
        kind: 'chart',
        id: 'peer-mg',
        title: 'Margin & Growth',
        series: ['영업이익률', '매출액증가율', '영업이익증가율'],
      },
      {
        kind: 'chart',
        id: 'peer-ret',
        title: '주가수익률',
        series: ['종목', 'Peer A', 'Peer B', 'Peer C'],
      },
      {
        kind: 'chart',
        id: 'peer-rel',
        title: '수익률 비교',
        series: ['상대수익률 (조회시작일=100, peer 포함)'],
      },
      {
        kind: 'tree-table',
        id: 'peer-fund',
        title: 'Price & Fundamentals',
        columns: 'peers',
        note: '토글: 연결/별도 · 연간/분기. 열: 종목 + peer 자리(통화 병기 슬롯).',
        rows: [
          r0('pf-price', 'Price', undefined, [r1('pf-px', '주가'), r1('pf-mcap', '시가총액')]),
          r0('pf-bs', 'Balance Sheet', undefined, [
            r1('pf-assets', '자산총계', 'assets'),
            r1('pf-liab', '부채총계', 'liabilities'),
            r1('pf-eq', '자본총계', 'equity'),
          ]),
          r0('pf-is', 'Income Statement', undefined, [
            r1('pf-rev', '매출액', 'revenue'),
            r1('pf-op', '영업이익', 'operating_income'),
            r1('pf-ni', '당기순이익', 'net_income'),
            r1('pf-ni-ctl', '지배주주순이익'),
          ]),
          r0('pf-val', 'Valuation', undefined, [r1('pf-per', 'PER'), r1('pf-pbr', 'PBR')]),
          r0('pf-pr', 'Profitability', undefined, [
            r1('pf-roe', 'ROE', 'roe_pct', undefined, { unit: 'pct' }),
            r1('pf-opm', '영업이익률', 'opm_pct', undefined, { unit: 'pct' }),
          ]),
          r0('pf-gr', 'Growth', undefined, [
            r1('pf-g-rev', '매출액증가율', 'yoy:revenue', undefined, { unit: 'pct' }),
            r1('pf-g-op', '영업이익증가율', 'yoy:operating_income', undefined, { unit: 'pct' }),
            r1('pf-g-eps', 'EPS증가율', undefined, undefined, { unit: 'pct' }),
          ]),
        ],
      },
      {
        kind: 'tree-table',
        id: 'peer-staff',
        title: '임직원 정보',
        columns: 'staff',
        rows: [
          r0('st-n', '직원수', undefined, undefined, { unit: 'count' }),
          r0('st-pay', '직원평균연봉'),
          r0('st-dir', '등기이사수', undefined, undefined, { unit: 'count' }),
          r0('st-dir-pay', '등기임원평균보수'),
          r0('st-ratio', '임원/직원보수비율', undefined, undefined, { unit: 'pct' }),
        ],
        note: '최근 결산 연말, 등기이사=사외·감사위원 제외. 국내 업종사 열 슬롯.',
      },
    ],
  };
}

function exchangeFilingsPage(): GuidePageDef {
  return {
    id: 'exchange-filings',
    title: '거래소공시',
    sections: [
      {
        kind: 'tabs',
        id: 'ex-tabs',
        tabs: [
          {
            id: 'all',
            label: '전체',
            sections: [
              {
                kind: 'records',
                id: 'ex-all',
                title: '거래소공시',
                columns: [
                  { id: 'no', label: 'No' },
                  { id: 'title', label: '제목' },
                  { id: 'date', label: '작성일자' },
                ],
                source: 'events',
              },
            ],
          },
          {
            id: 'fair',
            label: '공정공시',
            sections: [
              {
                kind: 'records',
                id: 'ex-fair',
                title: '공정공시',
                columns: [
                  { id: 'no', label: 'No' },
                  { id: 'title', label: '제목' },
                  { id: 'date', label: '작성일자' },
                ],
                source: 'empty',
                emptyRows: 3,
              },
            ],
          },
        ],
      },
    ],
  };
}

function fssFilingsPage(): GuidePageDef {
  return {
    id: 'fss-filings',
    title: '금감원공시',
    sections: [
      {
        kind: 'iframe',
        id: 'dart',
        title: '금감원공시',
        srcTemplate: 'https://dart.fss.or.kr/html/search/SearchCompanyIR3_M.html?textCrpNM={stockCode}',
      },
      {
        kind: 'records',
        id: 'dart-local',
        title: '자체 적재 공시',
        columns: [
          { id: 'date', label: '접수일' },
          { id: 'name', label: '보고서명' },
          { id: 'filer', label: '제출인' },
          { id: 'corr', label: '정정' },
        ],
        source: 'filings',
        note: 'FnGuide 화면은 iframe만 있다. 우리가 가진 DART 목록을 같은 페이지에 붙인다.',
      },
    ],
  };
}

export const GUIDE_PAGES: Record<CompanyMenuId, GuidePageDef> = {
  snapshot: snapshotPage(),
  profile: profilePage(),
  financials: financialsPage(),
  ratios: ratiosPage(),
  indicators: indicatorsPage(),
  consensus: consensusPage(),
  ownership: ownershipPage(),
  sector: sectorPage(),
  peers: peersPage(),
  'exchange-filings': exchangeFilingsPage(),
  'fss-filings': fssFilingsPage(),
};

export function getGuidePage(id: CompanyMenuId): GuidePageDef {
  return GUIDE_PAGES[id];
}
