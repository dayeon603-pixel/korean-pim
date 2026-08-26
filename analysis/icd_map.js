/**
 * ICD-9-CM / ICD-10-CM 진단코드 → 한국형 PIM 2018 표2 조건 매핑.
 *
 * 목적: 실제 진료기록의 진단코드를 표2의 18개 조건으로 옮겨 조건부 판정을 돌리기 위한 계층.
 *
 * ⚠ 이 매핑은 논문에 없다. 표2는 조건을 임상 용어("낙상·골절 병력")로만 기술하고
 *   코드 범위를 지정하지 않는다. 아래 코드 범위는 **우리가 정한 조작적 정의**이며,
 *   범위를 넓히거나 좁히면 판정 건수가 달라진다. 임상 검토를 받지 않았다.
 *
 * 원칙
 *  - 접두 일치(prefix match)를 쓴다. I50이면 I50.9, I5043 등이 모두 걸린다.
 *  - 병력(history) 조건은 현 진단과 병력 코드(Z/V)를 함께 본다.
 *  - 애매한 조건은 좁게 잡는다. 넓게 잡으면 판정이 과대추정되기 때문이다.
 *  - 연령 조건(80세 이상 1차 예방)은 진단이 아니므로 여기서 다루지 않고 호출자가 넣는다.
 */
'use strict';

const MAP = {
  // 섬망·치매·인지장애 — Kim 표2는 셋을 한 항목으로 묶는다
  dementia: {
    icd10: ['F00', 'F01', 'F02', 'F03', 'F05', 'G30', 'G31'],
    icd9:  ['290', '2941', '2942', '2948', '3310', '2930'],
    note: '치매(F00-F03, G30), 섬망(F05, 293.0), 기타 인지장애 포함',
  },
  // 낙상·골절·실신·기립성 저혈압 병력
  falls: {
    icd10: ['W00', 'W01', 'W06', 'W07', 'W08', 'W10', 'W18', 'W19', 'Z9181', 'S72', 'R55', 'I951'],
    icd9:  ['E880', 'E881', 'E884', 'E885', 'E888', 'V1588', '820', '7802', '4580'],
    note: '낙상 사건(W00-W19), 낙상 병력(Z91.81), 대퇴골절(S72/820), 실신(R55/780.2), 기립저혈압(I95.1/458.0)',
  },
  insomnia:      { icd10: ['G470', 'F510'],            icd9: ['78052', '30742'], note: '불면' },
  parkinson:     { icd10: ['G20', 'G21'],              icd9: ['3320', '3321'],   note: '파킨슨병·이차성 파킨슨증' },
  hf:            { icd10: ['I50'],                     icd9: ['428'],            note: '심부전' },
  arrhythmia:    { icd10: ['I47', 'I48', 'I49'],       icd9: ['427'],            note: '부정맥(심방세동 포함)' },
  htn:           { icd10: ['I10', 'I11', 'I12', 'I13', 'I15', 'I16'], icd9: ['401', '402', '403', '404', '405'], note: '고혈압' },
  stroke_secondary: { icd10: ['I63', 'I693', 'Z8673'], icd9: ['434', '438', 'V1254'], note: '뇌경색 및 그 병력(2차 예방 대상)' },
  ulcer:         { icd10: ['K25', 'K26', 'K27', 'K28'], icd9: ['531', '532', '533', '534'], note: '위·십이지장 궤양(현증·병력)' },
  constipation:  { icd10: ['K590'],                    icd9: ['5640'],           note: '변비' },
  ckd:           { icd10: ['N18'],                     icd9: ['585'],            note: '만성 콩팥병' },
  bph:           { icd10: ['N40', 'R33'],              icd9: ['600', '78820'],   note: '전립선비대·요저류' },
  hyponatremia:  { icd10: ['E871'],                    icd9: ['2761'],           note: '저나트륨혈증·SIADH' },
  copd:          { icd10: ['J44'],                     icd9: ['496', '4912'],    note: '만성폐쇄성폐질환' },
  bleeding:      { icd10: ['D68', 'D69', 'K922', 'I60', 'I61', 'I62', 'K920'], icd9: ['286', '287', '5789', '430', '431', '432'], note: '응고장애·출혈(현증)' },
  dm:            { icd10: ['E10', 'E11', 'E13'],       icd9: ['250'],            note: '당뇨' },
  glaucoma:      { icd10: ['H40'],                     icd9: ['365'],            note: '녹내장' },
  // age80_primary 는 진단이 아니라 연령 조건이므로 제외
};

/** 진단코드 목록 → 표2 조건 id 배열 */
function conditionsFromIcd(codes) {
  const on = new Set();
  (codes || []).forEach(({ code, version }) => {
    const c = String(code || '').toUpperCase().replace(/\./g, '');
    Object.entries(MAP).forEach(([id, m]) => {
      const list = String(version) === '9' ? m.icd9 : m.icd10;
      if (list.some((p) => c.startsWith(p))) on.add(id);
    });
  });
  return [...on];
}

const coveredConditions = Object.keys(MAP);

module.exports = { MAP, conditionsFromIcd, coveredConditions, ageOnlyConditions: ['age80_primary'] };
