/**
 * DART 원본 필드명 → 한글 라벨 사전.
 *
 * 설계 원칙 (2026-07-25 논의 확정):
 *   원본 키를 절대 개명하지 않는다. `aqpln_prc_ostk` 는 DB에도 UI 코드에도 그대로 남고,
 *   사람이 보는 문자열만 이 사전이 공급한다. 그래야 OpenDART 개발가이드와 1:1 대조가
 *   되고, 번역 과정에서 생기는 버그 자체가 존재할 수 없다.
 *
 * 라벨은 창작이 아니라 DART 개발가이드의 항목명을 옮겨 적은 것이다.
 * unit 은 표시 계층의 포매터가 쓴다 — DB는 항상 원본 문자열/원 단위를 보관한다.
 */

export type FieldUnit = "won" | "shares" | "percent" | "ratio" | "date" | "text" | "count";

export interface FieldSpec {
  label: string;
  unit?: FieldUnit;
  note?: string;
}

/** 여러 공시 유형에 공통으로 나타나는 필드 */
export const COMMON_FIELDS: Record<string, FieldSpec> = {
  rcept_no: { label: "접수번호", unit: "text" },
  corp_name: { label: "회사명", unit: "text" },
  corp_code: { label: "고유번호", unit: "text" },
  stock_code: { label: "종목코드", unit: "text" },
  corp_cls: { label: "법인구분", unit: "text" },
  report_nm: { label: "보고서명", unit: "text" },
  flr_nm: { label: "제출인", unit: "text" },
  rcept_dt: { label: "접수일자", unit: "date" },
  bddd: { label: "이사회결의일", unit: "date" },
  od_a_at_t: { label: "사외이사 참석", unit: "count" },
  od_a_at_b: { label: "사외이사 불참", unit: "count" },
  adt_a_atn: { label: "감사(위원) 참석여부", unit: "text" },
};

/**
 * 주요사항보고서 유형별 필드. events.event_type 이 판별자다.
 * 파일럿 두 종목에 실제로 등장한 유형부터 채운다 — 전 상장사로 확장하며 늘린다.
 */
export const EVENT_FIELDS: Record<string, Record<string, FieldSpec>> = {
  자기주식취득결정: {
    aqpln_stk_ostk: { label: "취득예정 보통주식(주)", unit: "shares" },
    aqpln_stk_estk: { label: "취득예정 기타주식(주)", unit: "shares" },
    aqpln_prc_ostk: { label: "취득예정금액 보통주식", unit: "won" },
    aqpln_prc_estk: { label: "취득예정금액 기타주식", unit: "won" },
    aqexpd_bgd: { label: "취득예상 시작일", unit: "date" },
    aqexpd_edd: { label: "취득예상 종료일", unit: "date" },
    hdexpd_bgd: { label: "보유예상 시작일", unit: "date" },
    hdexpd_edd: { label: "보유예상 종료일", unit: "date" },
    aq_pp: { label: "취득목적", unit: "text" },
    aq_mth: { label: "취득방법", unit: "text" },
    cs_iv_bk: { label: "위탁투자중개업자", unit: "text" },
  },
  자기주식처분결정: {
    dppln_stk_ostk: { label: "처분예정 보통주식(주)", unit: "shares" },
    dppln_stk_estk: { label: "처분예정 기타주식(주)", unit: "shares" },
    dpstk_prc_ostk: { label: "처분 단가 보통주식", unit: "won" },
    dpstk_prc_estk: { label: "처분 단가 기타주식", unit: "won" },
    dppln_prc_ostk: { label: "처분예정금액 보통주식", unit: "won" },
    dppln_prc_estk: { label: "처분예정금액 기타주식", unit: "won" },
    dpprpd_bgd: { label: "처분예상 시작일", unit: "date" },
    dpprpd_edd: { label: "처분예상 종료일", unit: "date" },
    dp_pp: { label: "처분목적", unit: "text" },
    dp_m: { label: "처분방법", unit: "text" },
    cs_iv_bk: { label: "위탁투자중개업자", unit: "text" },
  },
  // 신탁계약 — 자사주를 신탁으로 취득/해지. 실제 소각 여부 추적의 출발점.
  자기주식신탁계약체결결정: {
    ctr_prc: { label: "계약금액", unit: "won" },
    ctr_pd_bgd: { label: "계약기간 시작일", unit: "date" },
    ctr_pd_edd: { label: "계약기간 종료일", unit: "date" },
    ctr_pp: { label: "계약목적", unit: "text" },
    ctr_cns_int: { label: "계약체결기관", unit: "text" },
    ctr_cns_prd: { label: "계약체결 예정일자", unit: "date" },
    cs_iv_bk: { label: "위탁투자중개업자", unit: "text" },
    eaq_ostk: { label: "계약체결 전 자기주식 보통주(주)", unit: "shares" },
    eaq_ostk_rt: { label: "계약체결 전 자기주식 보통주 비율", unit: "percent" },
    eaq_estk: { label: "계약체결 전 자기주식 기타주(주)", unit: "shares" },
    eaq_estk_rt: { label: "계약체결 전 자기주식 기타주 비율", unit: "percent" },
    aq_wtn_div_ostk: { label: "배당가능이익 범위 취득한도 보통주(주)", unit: "shares" },
    aq_wtn_div_ostk_rt: { label: "배당가능이익 범위 취득한도 보통주 비율", unit: "percent" },
    aq_wtn_div_estk: { label: "배당가능이익 범위 취득한도 기타주(주)", unit: "shares" },
    aq_wtn_div_estk_rt: { label: "배당가능이익 범위 취득한도 기타주 비율", unit: "percent" },
  },
  자기주식신탁계약해지결정: {
    ctr_prc_bfcc: { label: "해지 전 계약금액", unit: "won" },
    ctr_prc_atcc: { label: "해지 후 계약금액", unit: "won" },
    ctr_pd_bfcc_bgd: { label: "해지 전 계약기간 시작일", unit: "date" },
    ctr_pd_bfcc_edd: { label: "해지 전 계약기간 종료일", unit: "date" },
    cc_pp: { label: "해지목적", unit: "text" },
    cc_prd: { label: "해지예정일자", unit: "date" },
    cc_int: { label: "해지기관", unit: "text" },
    tp_rm_atcc: { label: "해지 후 신탁재산 반환방법", unit: "text" },
    eaq_ostk: { label: "해지 전 자기주식 보통주(주)", unit: "shares" },
    eaq_ostk_rt: { label: "해지 전 자기주식 보통주 비율", unit: "percent" },
    eaq_estk: { label: "해지 전 자기주식 기타주(주)", unit: "shares" },
    eaq_estk_rt: { label: "해지 전 자기주식 기타주 비율", unit: "percent" },
    aq_wtn_div_ostk: { label: "배당가능이익 범위 취득한도 보통주(주)", unit: "shares" },
    aq_wtn_div_ostk_rt: { label: "배당가능이익 범위 취득한도 보통주 비율", unit: "percent" },
    aq_wtn_div_estk: { label: "배당가능이익 범위 취득한도 기타주(주)", unit: "shares" },
    aq_wtn_div_estk_rt: { label: "배당가능이익 범위 취득한도 기타주 비율", unit: "percent" },
  },
  // 유상+무상 동시 결정 — 필드가 piic_(유상)/fric_(무상) 접두사로 갈린다.
  유무상증자결정: {
    piic_nstk_ostk_cnt: { label: "[유상] 신주 보통주식(주)", unit: "shares" },
    piic_nstk_estk_cnt: { label: "[유상] 신주 기타주식(주)", unit: "shares" },
    piic_fv_ps: { label: "[유상] 1주당 액면가액", unit: "won" },
    piic_bfic_tisstk_ostk: { label: "[유상] 증자전 발행주식총수 보통주", unit: "shares" },
    piic_bfic_tisstk_estk: { label: "[유상] 증자전 발행주식총수 기타주", unit: "shares" },
    piic_fdpp_fclt: { label: "[유상] 자금조달 — 시설자금", unit: "won" },
    piic_fdpp_bsninh: { label: "[유상] 자금조달 — 영업양수자금", unit: "won" },
    piic_fdpp_op: { label: "[유상] 자금조달 — 운영자금", unit: "won" },
    piic_fdpp_dtrp: { label: "[유상] 자금조달 — 채무상환자금", unit: "won" },
    piic_fdpp_ocsa: { label: "[유상] 자금조달 — 타법인증권취득자금", unit: "won" },
    piic_fdpp_etc: { label: "[유상] 자금조달 — 기타자금", unit: "won" },
    piic_ic_mthn: { label: "[유상] 증자방식", unit: "text" },
    fric_nstk_ostk_cnt: { label: "[무상] 신주 보통주식(주)", unit: "shares" },
    fric_nstk_estk_cnt: { label: "[무상] 신주 기타주식(주)", unit: "shares" },
    fric_fv_ps: { label: "[무상] 1주당 액면가액", unit: "won" },
    fric_bfic_tisstk_ostk: { label: "[무상] 증자전 발행주식총수 보통주", unit: "shares" },
    fric_bfic_tisstk_estk: { label: "[무상] 증자전 발행주식총수 기타주", unit: "shares" },
    fric_nstk_asstd: { label: "[무상] 신주배정 기준일", unit: "date" },
    fric_nstk_ascnt_ps_ostk: { label: "[무상] 1주당 신주배정 보통주", unit: "ratio" },
    fric_nstk_ascnt_ps_estk: { label: "[무상] 1주당 신주배정 기타주", unit: "ratio" },
    fric_nstk_dividrk: { label: "[무상] 신주 배당기산일", unit: "date" },
    fric_nstk_dlprd: { label: "[무상] 신주권 교부예정일", unit: "date" },
    fric_nstk_lstprd: { label: "[무상] 신주 상장예정일", unit: "date" },
    fric_bddd: { label: "[무상] 이사회결의일", unit: "date" },
    fric_od_a_at_t: { label: "[무상] 사외이사 참석", unit: "count" },
    fric_od_a_at_b: { label: "[무상] 사외이사 불참", unit: "count" },
    fric_adt_a_atn: { label: "[무상] 감사(위원) 참석여부", unit: "text" },
    ssl_at: { label: "공매도 해당여부", unit: "text" },
    ssl_bgd: { label: "공매도 제한 시작일", unit: "date" },
    ssl_edd: { label: "공매도 제한 종료일", unit: "date" },
  },
  유상증자결정: {
    nstk_ostk_cnt: { label: "신주 보통주식(주)", unit: "shares" },
    nstk_estk_cnt: { label: "신주 기타주식(주)", unit: "shares" },
    fv_ps: { label: "1주당 액면가액", unit: "won" },
    bfic_tisstk_ostk: { label: "증자전 발행주식총수 보통주", unit: "shares" },
    fdpp_fclt: { label: "자금조달 목적 — 시설자금", unit: "won" },
    fdpp_bsninh: { label: "자금조달 목적 — 영업양수자금", unit: "won" },
    fdpp_op: { label: "자금조달 목적 — 운영자금", unit: "won" },
    fdpp_dtrp: { label: "자금조달 목적 — 채무상환자금", unit: "won" },
    fdpp_ocsa: { label: "자금조달 목적 — 타법인증권취득자금", unit: "won" },
    fdpp_etc: { label: "자금조달 목적 — 기타자금", unit: "won" },
    ic_mthn: { label: "증자방식", unit: "text" },
    ssl_at: { label: "공매도 해당여부", unit: "text" },
  },
  전환사채발행결정: {
    bd_tm: { label: "사채의 종류 — 회차", unit: "count" },
    bd_knd: { label: "사채의 종류 — 종류", unit: "text" },
    bd_fta: { label: "사채의 권면(전자등록)총액", unit: "won" },
    bd_intr_ex: { label: "표면이자율", unit: "percent" },
    bd_intr_sf: { label: "만기이자율", unit: "percent" },
    bd_mtd: { label: "사채만기일", unit: "date" },
    cv_prc: { label: "전환가액", unit: "won" },
    cv_rt: { label: "전환비율", unit: "percent" },
    cv_prd_bgd: { label: "전환청구 시작일", unit: "date" },
    cv_prd_edd: { label: "전환청구 종료일", unit: "date" },
    act_mktprcfl_cvprc_lwtrsprc: { label: "시가하락 시 전환가액 최저조정가액", unit: "won" },
  },
  회사합병결정: {
    mg_mth: { label: "합병방법", unit: "text" },
    mg_stn: { label: "합병형태", unit: "text" },
    mg_pp: { label: "합병목적", unit: "text" },
    mg_rt: { label: "합병비율", unit: "ratio" },
    mg_rt_bs: { label: "합병비율 산출근거", unit: "text" },
    ex_sm_r: { label: "외부평가 요약", unit: "text" },
    mgnstk_ostk_cnt: { label: "합병신주 보통주식(주)", unit: "shares" },
    mgnstk_cstk_cnt: { label: "합병신주 종류주식(주)", unit: "shares" },
    // 합병상대회사
    mgptncmp_cmpnm: { label: "합병상대회사 — 회사명", unit: "text" },
    mgptncmp_mbsn: { label: "합병상대회사 — 주요사업", unit: "text" },
    mgptncmp_rl_cmpn: { label: "합병상대회사 — 회사와의 관계", unit: "text" },
    // 상대회사 최근 사업연도 재무 (rbsnfdtl_*)
    rbsnfdtl_tast: { label: "상대회사 — 자산총계", unit: "won" },
    rbsnfdtl_tdbt: { label: "상대회사 — 부채총계", unit: "won" },
    rbsnfdtl_teqt: { label: "상대회사 — 자본총계", unit: "won" },
    rbsnfdtl_cpt: { label: "상대회사 — 자본금", unit: "won" },
    rbsnfdtl_sl: { label: "상대회사 — 매출액", unit: "won" },
    rbsnfdtl_nic: { label: "상대회사 — 당기순이익", unit: "won" },
    // 신설(존속)회사 (ffdtl_* = 합병 후 재무)
    nmgcmp_cmpnm: { label: "신설회사 — 회사명", unit: "text" },
    nmgcmp_mbsn: { label: "신설회사 — 주요사업", unit: "text" },
    nmgcmp_nbsn_rsl: { label: "신설회사 — 신규사업 내용", unit: "text" },
    nmgcmp_rlst_atn: { label: "신설회사 — 재상장 신청 여부", unit: "text" },
    ffdtl_std: { label: "합병 후 재무 — 기준일", unit: "date" },
    ffdtl_tast: { label: "합병 후 — 자산총계", unit: "won" },
    ffdtl_tdbt: { label: "합병 후 — 부채총계", unit: "won" },
    ffdtl_teqt: { label: "합병 후 — 자본총계", unit: "won" },
    ffdtl_cpt: { label: "합병 후 — 자본금", unit: "won" },
    // 일정 (mgsc_*)
    mgsc_mgctrd: { label: "합병계약일", unit: "date" },
    mgsc_shddstd: { label: "주주확정기준일", unit: "date" },
    mgsc_shclspd_bgd: { label: "주주명부 폐쇄 시작일", unit: "date" },
    mgsc_shclspd_edd: { label: "주주명부 폐쇄 종료일", unit: "date" },
    mgsc_mgop_rcpd_bgd: { label: "합병반대의사 접수 시작일", unit: "date" },
    mgsc_mgop_rcpd_edd: { label: "합병반대의사 접수 종료일", unit: "date" },
    mgsc_gmtsck_prd: { label: "주주총회 예정일", unit: "date" },
    mgsc_aprskh_expd_bgd: { label: "매수청구권 행사 시작일", unit: "date" },
    mgsc_aprskh_expd_edd: { label: "매수청구권 행사 종료일", unit: "date" },
    mgsc_cdobprpd_bgd: { label: "채권자 이의제출 시작일", unit: "date" },
    mgsc_cdobprpd_edd: { label: "채권자 이의제출 종료일", unit: "date" },
    mgsc_osprpd_bgd: { label: "구주권 제출 시작일", unit: "date" },
    mgsc_osprpd_edd: { label: "구주권 제출 종료일", unit: "date" },
    mgsc_trspprpd_bgd: { label: "매매거래 정지 시작일", unit: "date" },
    mgsc_trspprpd_edd: { label: "매매거래 정지 종료일", unit: "date" },
    mgsc_mgdt: { label: "합병기일", unit: "date" },
    mgsc_ergmd: { label: "종료보고 총회일", unit: "date" },
    mgsc_mgrgsprd: { label: "합병등기 예정일", unit: "date" },
    mgsc_nstkdlprd: { label: "신주권 교부예정일", unit: "date" },
    mgsc_nstklstprd: { label: "신주 상장예정일", unit: "date" },
    // 매수청구권
    aprskh_ctref: { label: "매수청구권 — 근거 규정", unit: "text" },
    aprskh_plnprc: { label: "매수예정가격", unit: "won" },
    aprskh_pym_plpd_mth: { label: "매수청구 대금 지급 예정시기·방법", unit: "text" },
    // 기타 판단 플래그
    bdlst_atn: { label: "우회상장 해당 여부", unit: "text" },
    otcpr_bdlst_sf_atn: { label: "상대법인 우회상장 요건 충족 여부", unit: "text" },
    exevl_atn: { label: "외부평가기관 평가 여부", unit: "text" },
    exevl_bs_rs: { label: "외부평가 근거·사유", unit: "text" },
    exevl_intn: { label: "외부평가기관명", unit: "text" },
    exevl_pd: { label: "외부평가 기간", unit: "text" },
    eadtat_op: { label: "외부감사인 의견", unit: "text" },
    eadtat_intn: { label: "외부감사인명", unit: "text" },
    rs_sm_atn: { label: "증권신고서 제출대상 여부", unit: "text" },
    popt_ctr_atn: { label: "풋옵션 등 계약 체결 여부", unit: "text" },
    popt_ctr_cn: { label: "풋옵션 등 계약 내용", unit: "text" },
  },
  회사분할결정: {
    dv_mth: { label: "분할방법", unit: "text" },
    dv_impef: { label: "분할의 중요영향 및 효과", unit: "text" },
    dv_rt: { label: "분할비율", unit: "ratio" },
    dvfjcmp_cmpnm: { label: "분할신설회사 — 회사명", unit: "text" },
    dvfjcmp_tast: { label: "분할신설회사 — 자산총계", unit: "won" },
    dvsc_dvdt: { label: "분할기일", unit: "date" },
  },
  타법인주식양수결정: {
    iscmp_cmpnm: { label: "발행회사 — 회사명", unit: "text" },
    iscmp_mbsn: { label: "발행회사 — 주요사업", unit: "text" },
    inh_stk_cnt: { label: "양수 주식수", unit: "shares" },
    inh_prc: { label: "양수금액", unit: "won" },
    tast: { label: "자산총액", unit: "won" },
    atinh_eqrt: { label: "양수후 소유주식 지분비율", unit: "percent" },
    inh_pp: { label: "양수목적", unit: "text" },
    inh_dt: { label: "양수일자", unit: "date" },
  },
  주식교환이전결정: {
    extr_mth: { label: "주식교환·이전 방법", unit: "text" },
    extr_pp: { label: "주식교환·이전 목적", unit: "text" },
    extr_rt: { label: "주식교환·이전 비율", unit: "ratio" },
    extrptncmp_cmpnm: { label: "상대회사 — 회사명", unit: "text" },
    extrsc_extrdt: { label: "주식교환·이전일", unit: "date" },
  },
};

/** 정기보고서 주요정보 항목별 필드 */
export const REPORT_ITEM_FIELDS: Record<string, Record<string, FieldSpec>> = {
  배당: {
    se: { label: "구분", unit: "text" },
    thstrm: { label: "당기", unit: "text" },
    frmtrm: { label: "전기", unit: "text" },
    lwfr: { label: "전전기", unit: "text" },
    stock_knd: { label: "주식 종류", unit: "text" },
  },
  최대주주: {
    nm: { label: "성명", unit: "text" },
    relate: { label: "관계", unit: "text" },
    stock_knd: { label: "주식 종류", unit: "text" },
    bsis_posesn_stock_co: { label: "기초 소유 주식수", unit: "shares" },
    bsis_posesn_stock_qota_rt: { label: "기초 지분율", unit: "percent" },
    trmend_posesn_stock_co: { label: "기말 소유 주식수", unit: "shares" },
    trmend_posesn_stock_qota_rt: { label: "기말 지분율", unit: "percent" },
  },
  직원: {
    fo_bbm: { label: "사업부문", unit: "text" },
    sexdstn: { label: "성별", unit: "text" },
    rgllbr_co: { label: "정규직 수", unit: "count" },
    cnttk_co: { label: "계약직 수", unit: "count" },
    sm: { label: "합계", unit: "count" },
    avrg_cnwk_sdytrn: { label: "평균 근속연수", unit: "text" },
    fyer_salary_totamt: { label: "연간 급여 총액", unit: "won" },
    jan_salary_am: { label: "1인평균 급여액", unit: "won" },
  },
  타법인출자: {
    inv_prm: { label: "법인명", unit: "text" },
    frst_acqs_de: { label: "최초 취득일자", unit: "date" },
    invstmnt_purps: { label: "출자 목적", unit: "text" },
    frst_acqs_amount: { label: "최초 취득금액", unit: "won" },
    trmend_blce_qota_rt: { label: "기말잔액 지분율", unit: "percent" },
    trmend_blce_acntbk_amount: { label: "기말잔액 장부가액", unit: "won" },
    recent_bsns_year_fnnr_sttus_tot_assets: { label: "최근사업연도 총자산", unit: "won" },
  },
  감사의견: {
    bsns_year: { label: "사업연도", unit: "text" },
    adtor: { label: "감사인", unit: "text" },
    adt_opinion: { label: "감사의견", unit: "text" },
    adt_reprt_spcmnt_matter: { label: "감사보고서 특기사항", unit: "text" },
    emphs_matter: { label: "강조사항", unit: "text" },
    core_adt_matter: { label: "핵심감사사항", unit: "text" },
  },
};

/** 지분공시 */
export const OWNERSHIP_FIELDS: Record<string, Record<string, FieldSpec>> = {
  majorstock: {
    repror: { label: "대표보고자", unit: "text" },
    stkqy: { label: "보유 주식등의 수", unit: "shares" },
    stkqy_irds: { label: "보유 주식등의 수 증감", unit: "shares" },
    stkrt: { label: "보유 비율", unit: "percent" },
    stkrt_irds: { label: "보유 비율 증감", unit: "percent" },
    report_resn: { label: "보고 사유", unit: "text" },
  },
  elestock: {
    repror: { label: "보고자", unit: "text" },
    isu_exctv_rgist_at: { label: "임원 등기여부", unit: "text" },
    isu_exctv_ofcps: { label: "직위", unit: "text" },
    isu_main_shrholdr: { label: "주요주주 구분", unit: "text" },
    sp_stock_lmp_cnt: { label: "특정증권등 소유수", unit: "shares" },
    sp_stock_lmp_irds_cnt: { label: "특정증권등 소유증감수", unit: "shares" },
  },
};

/** 필드 라벨 조회 — 사전에 없으면 원본 키를 그대로 돌려준다(정보 손실 없음). */
export function fieldSpec(
  domain: "event" | "report_item" | "ownership",
  kind: string,
  field: string,
): FieldSpec {
  const table =
    domain === "event"
      ? EVENT_FIELDS[kind]
      : domain === "report_item"
        ? REPORT_ITEM_FIELDS[kind]
        : OWNERSHIP_FIELDS[kind];
  return table?.[field] ?? COMMON_FIELDS[field] ?? { label: field };
}

/** 사전 커버리지 — 드리프트 리포트가 쓴다. */
export function knownFields(domain: "event" | "report_item" | "ownership", kind: string): Set<string> {
  const table =
    domain === "event"
      ? EVENT_FIELDS[kind]
      : domain === "report_item"
        ? REPORT_ITEM_FIELDS[kind]
        : OWNERSHIP_FIELDS[kind];
  return new Set([...Object.keys(table ?? {}), ...Object.keys(COMMON_FIELDS)]);
}

/**
 * 업종코드(KSIC 표준산업분류) → 업종명.
 * DART `induty_code` 는 코드만 주므로 UI가 "업종코드 28202"를 노출하던 문제(A3 발견)를 푼다.
 * 파일럿 종목의 코드부터 채우고, 전 상장사 확장 시 KSIC 전량 테이블로 승격한다.
 */
export const SECTOR_NAMES: Record<string, string> = {
  "5821": "게임 소프트웨어 개발 및 공급업",
  "5822": "시스템·응용 소프트웨어 개발 및 공급업",
  "6201": "컴퓨터 프로그래밍 서비스업",
  "6312": "포털 및 기타 인터넷 정보매개 서비스업",
  "26110": "전자집적회로 제조업",
  "26410": "유선 통신장비 제조업",
  "27111": "의료용 기기 제조업",
  "28202": "축전지 제조업",
  "20111": "기초 유기화학물질 제조업",
  "20129": "기타 기초무기화학물질 제조업",
  "24290": "기타 1차 비철금속 제조업",
  "30310": "자동차 엔진용 부품 제조업",
  "30320": "자동차 차체용 부품 제조업",
  "10794": "면류·마카로니 및 유사식품 제조업",
  "21102": "의약품 제조업",
  "35111": "화력 발전업",
  "64992": "지주회사",
  "68112": "비주거용 건물 임대업",
};

/** 업종코드 → 표시용 이름. 사전에 없으면 코드를 그대로 보여준다(정보 손실 없음). */
export function sectorName(code: string | null | undefined): string | null {
  if (!code) return null;
  return SECTOR_NAMES[code] ?? `업종코드 ${code}`;
}
