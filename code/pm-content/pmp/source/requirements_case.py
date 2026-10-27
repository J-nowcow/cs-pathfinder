# -*- coding: utf-8 -*-
"""Authored traceability/evidence case; no real project or normative thresholds."""
from html import escape as e
SOURCES=[
 dict(id='nasa-requirements',title='NASA SE Handbook · 6.2 Requirements Management',url='https://www.nasa.gov/reference/6-2-requirements-management/',edition='NASA/SP-2016-6105 Rev 2',publication_metadata_url='https://ntrs.nasa.gov/citations/20170001761',published='2017-02-17 (NTRS 기록)',page_updated='2023-07-26',checked='2026-10-27',kind='NASA 시스템 공학의 요구 관리 지침',note='요구 출처·양방향 추적·변경 영향·승인된 기준선과 검증 결과 연결을 참고. Rev2의 NTRS 발행 기록은2017-02-17, 웹 절 갱신은2023-07-26로 구분.2026-10-27 원문 확인. NASA의 단계·승인 조직을 모든 소프트웨어 프로젝트의 의무 절차로 적용하지 않음.'),
 dict(id='nasa-verification-validation',title='NASA SE Handbook · 2.4 Verification and Validation',url='https://www.nasa.gov/reference/2-0-fundamentals-of-systems-engineering/',edition='NASA SE Handbook §2.4',page_updated='2025-01-09',checked='2026-10-27',kind='시스템 공학의 목적 구분',note='제품이 명세를 충족하는지와 의도한 환경에서 목적에 맞는지를 구분하는 설명 참고. 웹 페이지 갱신2025-01-09,2026-10-27 §2.4 원문 확인. NASA의 product validation을 PMP의 공식 범위 수용이나 계약 승인과 같은 뜻으로 사용하지 않음.'),
 dict(id='govuk-stories',title='GOV.UK Service Manual · Writing user stories',url='https://www.gov.uk/service-manual/agile-delivery/writing-user-stories',published='2016-02-16 (페이지 표시)',history_first_guidance='2016-01-05 (업데이트 이력)',updated='2016-05-23',checked='2026-10-27',kind='영국 정부 디지털 서비스의 실무 지침',note='사용자·필요·목적과 항목별 수용 기준·증거 연결을 참고. 페이지 발행2016-02-16·갱신2016-05-23, 이력의 최초 지침2016-01-05는 별도로 기록.2026-10-27 원문 확인. 양식이나 예제를 복제하지 않은 창작 사례이며 특정 국가의 서비스 지침을 PMP 공식 규칙으로 제시하지 않음.')
]
def check(id,title,automated,status):return dict(id=id,title=title,automated=automated,status=status)
DATA={
 'requirements_version':'v1.2','build':'B-07','validation':'예정 · 업무 사용자와 실제에 가까운 흐름 점검 미완료','acceptance':'대기 · 이 사례에서 정한 인수 권한자의 승인 기록 없음',
 'requirements':[
 dict(id='R-01',title='재시도 중복 신청 방지',source='SRC-01 · 신청자 관찰',goal='불안정한 응답 때문에 다시 눌러도 같은 요청이 중복 접수되지 않게 한다.',criterion='같은 요청 키에는 신청 한 건만 만들고, 다른 요청 키는 별도 신청으로 처리한다.',work='W-01 · 접수 처리',checks=[check('T-01a','같은 키 재시도',True,'PASS'),check('T-01b','응답 시간 초과 후 재시도',True,'PASS'),check('T-01c','같은 키 동시 요청',True,'PASS'),check('T-01d','다른 키의 별도 신청',True,'PASS')]),
 dict(id='R-02',title='유효한 위임의 단건 승인',source='SRC-02 · 승인 업무 워크숍',goal='승인자 부재 중에도 합의된 위임 범위에서 단건 업무를 처리한다.',criterion='유효 기간의 지정 대리인만 단건 승인하며, 다른 사람과 만료된 위임은 허용하지 않는다.',work='W-02 · 위임 확인',checks=[check('T-02a','기간 내 지정 대리인 허용',True,'PASS'),check('T-02b','다른 사람의 요청 거절',True,'PASS'),check('T-02c','만료 위임 거절',True,'NOT RUN')]),
 dict(id='R-03',title='키보드로 신청 완료',source='SRC-03 · 사용자 업무 관찰',goal='마우스 없이도 정해진 신청 흐름을 끝낼 수 있게 한다.',criterion='합의한 브라우저·입력 자료에서 키보드만으로 항목 입력·오류 수정·제출·결과 확인이 가능하다.',work='W-03 · 화면 상호작용',checks=[check('T-03','합의한 흐름을 키보드로 점검',False,'NOT RUN')]),
 dict(id='R-04',title='운영 인계와 복구 연습',source='SRC-04 · 운영자 인터뷰',goal='오류 발생 시 담당자가 복구 절차와 연락 경로를 사용할 수 있게 한다.',criterion='합의한 인계 문서를 검토하고 모의 오류를 대상으로 복구 연습 결과를 남긴다.',work='W-04 · 운영 준비',checks=[check('T-04a','인계 문서 검토',False,'PASS'),check('T-04b','합의한 모의 복구 연습',False,'NOT RUN')])
 ]
}
def metrics(d=DATA):
 rs=d['requirements'];checks=[c for r in rs for c in r['checks']];auto=[c for c in checks if c['automated'] and c['status']!='NOT RUN']
 linked=sum(bool(r['source'] and r['work'] and r['checks']) for r in rs);complete=sum(all(c['status']=='PASS' for c in r['checks']) for r in rs)
 return [dict(id='linked',label='출처·작업·검증 항목이 연결된 요구',numerator=linked,denominator=len(rs)),dict(id='auto',label='실행한 자동 시험 중 통과',numerator=sum(c['status']=='PASS' for c in auto),denominator=len(auto)),dict(id='verified',label='지정 검증을 모두 마친 요구',numerator=complete,denominator=len(rs))]

def render():
 d=DATA
 out='<section class="article-section trace-study"><span class="eyebrow">NEED ↔ REQUIREMENT ↔ EVIDENCE ↔ DECISION</span><h2>시험이 전부 통과해도, 미검증 요구가 남을 수 있어요.</h2><p>가상 신청 서비스의 승인된 요구 집합은 <b>v1.2</b>, 확인한 결과물은 <b>B-07</b>입니다. 아래 네 요구와 각 요구의 지정 검증 항목이 이번 예제의 전체 범위라고 가정합니다. 실제 회사 자료·Jira 연결·접근성 인증 사례가 아닙니다.</p>'
 out+='<div class="trace-map" role="group" aria-label="양방향 추적 관계. 고정된 단계별 승인 순서가 아닙니다."><span>사용자·업무 목적</span><i aria-hidden="true">↔</i><span>요구·수용 기준</span><i aria-hidden="true">↔</i><span>설계·작업·결과물</span><i aria-hidden="true">↔</i><span>검증·사용 증거</span></div><p class="small muted">앞으로는 “어떤 증거로 이 요구를 확인할까?”, 뒤로는 “이 시험·작업은 어떤 필요 때문에 존재할까?”를 묻습니다. 연결은 갱신할 관계이며 일회성 순서도가 아닙니다. 사용자 목적에 대한 확인은 설계·개발 중에도 반복할 수 있습니다.</p>'
 out+='<h3>숫자 셋의 분모부터 읽어 보세요.</h3><figure class="trace-chart"><figcaption>같은 기록에서 나온 세 비율 · 0–100% 동일 눈금</figcaption><div class="trace-axis" aria-hidden="true"><span>0</span><span>50</span><span>100%</span></div>'
 for m in metrics():
  pct=m['numerator']/m['denominator']*100
  out+=f'<div class="trace-metric" data-trace-metric="{m["id"]}"><div><span>{e(m["label"])}</span><b>{m["numerator"]}/{m["denominator"]} · {pct:g}%</b></div><div class="trace-track" aria-hidden="true"><i style="width:{pct:g}%"></i></div></div>'
 out+='</figure><p class="small muted">두 번째 비율은 <b>실행한 자동 시험</b>만 분모에 넣었습니다. 미실행 자동 시험 1건과 수동 확인은 포함하지 않았습니다. 첫 번째는 연결의 존재, 세 번째는 이 사례가 지정한 요구별 검증 완료입니다. 서로 다른 지표를 평균 내어 “전체 품질 점수”로 만들지 않습니다. 1/4는 모든 위험이25% 해결됐다는 뜻도 아닙니다.</p><div class="trace-requirements">'
 for r in d['requirements']:
  passed=sum(c['status']=='PASS' for c in r['checks']);done=passed==len(r['checks']);label='지정 검증 완료' if done else ('일부 검증 · 미완료' if passed else '검증 미실행')
  out+=f'<article data-trace-requirement="{r["id"]}"><div class="trace-card-head"><span>{r["id"]} · {e(r["work"])}</span><strong>{e(label)}</strong></div><h3>{e(r["title"])}</h3><dl><dt>필요의 출처</dt><dd>{e(r["source"])}</dd><dt>업무 목적</dt><dd>{e(r["goal"])}</dd><dt>항목별 확인 기준</dt><dd>{e(r["criterion"])}</dd></dl><ul class="trace-checks">'
  for c in r['checks']:out+=f'<li data-trace-check="{c["id"]}"><span><b>{c["id"]}</b> {e(c["title"])} <small>({"자동" if c["automated"] else "수동"})</small></span><strong>{"통과" if c["status"]=="PASS" else "미실행"}</strong></li>'
  out+=f'</ul><p class="small muted">증거 묶음 · 요구v1.2 / 결과물B-07 / 지정 검증 {passed}/{len(r["checks"])} 완료. 미실행은 통과도 실패도 아닙니다.</p></article>'
 out+='</div><aside class="notice"><b>지정 검증 완료도 사용 적합성·인수 완료와 구분해요.</b><p>R-01은 이 예제가 정한 네 검증을 마쳤습니다. 모든 입력·기기·장애 상황에서 문제없다는 뜻은 아닙니다. 업무 사용자와 의도한 환경의 흐름 점검은 아직 예정이고, 이 사례에서 정한 공식 인수 승인도 대기 상태입니다. R-03은 특정 업무 흐름의 키보드 점검일 뿐 전체 접근성 표준 충족을 판정하지 않습니다.</p></aside>'
 out+='<h3>서로 다른 질문을 같은 “통과”로 합치지 않기</h3><div class="trace-decisions">'
 for title,body in [
 ('Verification · 명세 적합성','정해진 요구에 맞게 만들어졌는지 증거를 확인합니다. 시험만이 아니라 분석·검사·시연도 목적에 맞는 방법이 될 수 있습니다. 결과물·요구·환경·방법의 버전을 함께 봅니다.'),
 ('Validation · 사용 목적 적합성','의도한 사용자와 환경에서 실제 목적에 맞는지 확인합니다. 자동 시험 통과만으로 이 판단을 끝내지 않습니다. 여기서는 NASA의 product validation 의미로 사용하며 프로젝트의 공식 범위 수용과 같은 명칭으로 취급하지 않습니다.'),
 ('Acceptance · 합의된 인수 판단','이 사례의 합의 조건·결과물·남은 이슈를 정해진 권한자가 확인하고 기록하는 판단입니다. 구체적인 권한과 절차는 프로젝트의 합의에 따릅니다. 이 예제는 계약상 권리나 법적 효력을 해석하지 않습니다.'),
 ('Done · Scrum의 공통 품질 기준','Scrum을 적용할 때 완료 정의는 Increment의 품질 기준입니다. 충족하지 않은 작업을 완료된 Increment로 세지 않습니다. Sprint Review는 결과·변화를 함께 검토해 다음 적응을 논의하는 자리이며 출시를 위한 고정 승인 관문으로 두지 않습니다. 일반 프로젝트의 인수 절차와 구분합니다.')]:out+='<article><h4>'+e(title)+'</h4><p>'+e(body)+'</p></article>'
 out+='</div><h3>변경 요청이 오면 연결을 따라 영향을 찾아요.</h3><div class="trace-change"><p><b>CR-01 · 대량 승인도 추가해 주세요.</b> 기존 합의는 지정 대리인의 단건 승인입니다. 새 요청이 기존 요구의 해석·누락인지 추가 범위인지 먼저 문서와 당사자에게 확인합니다. 아래는 추가 범위로 확인됐다는 가정입니다.</p><ol>'
 for title,body in [
 ('영향 후보 찾기','요구 R-02의 위임·승인 동작과 R-04의 운영 대응부터 추적합니다. 화면·설계·자료·오류 처리·검증·운영 문서와 다른 요구의 영향도 확인합니다. 이 목록은 완전한 영향 분석 결과가 아닌 시작점입니다.'),
 ('권한과 접근법에 맞게 결정','승인된 기준선의 변경은 정한 변경 결정 경로로 보냅니다. 적응형 백로그의 우선순위 조정도 예산·계약·품질 제약을 자동 변경하지는 않습니다. 모든 조직에 NASA의 CCB 구조를 그대로 요구하는 것은 아닙니다.'),
 ('승인된 변경과 증거 버전 갱신','승인되면 요구·설계·작업·시험·수용 기록의 관계를 갱신합니다. 기존 B-07/v1.2의 증거를 새 버전의 완료 근거로 자동 승계하지 않습니다. 영향을 받은 검증과 회귀 범위를 정하고, 재사용 가능한 증거는 근거를 기록합니다.')]:out+='<li><b>'+e(title)+'</b><p>'+e(body)+'</p></li>'
 out+='</ol></div><h3>자료를 보고 판단해 보기</h3><p class="small muted">비채점 적용 연습 · 기존 채점 문제와 별개입니다.</p>'
 for q,a in [
 ('자동 시험 통과율100%인데 왜 R-02는 미완료인가요?','6/6은 실행된 자동 시험만의 통과율입니다. R-02의 필수 만료 위임 검증 T-02c가 실행되지 않았습니다. 요구별 지정 검증 완료율의 분모는4개 요구이고, 모두 끝난 것은R-01뿐이라1/4입니다.'),
 ('T-02c가 미실행이면 결함이라고 보고할까요?','지금 확정할 수 있는 것은 검증 공백입니다. 결과가 없으니 통과도 결함도 단정하지 않습니다. 실행 조건·담당·시점을 정하고 결과에 따라 결함 수정이나 다른 조치를 판단합니다.'),
 ('새 작업에 요구의 부모 링크가 없으면 바로 삭제할까요?','연결 누락인지, 설계·운영에서 정당하게 도출된 필요인지, 승인 없이 더한 범위인지 먼저 확인합니다. 목적·근거·결정 권한을 추적하고 기록을 고칩니다. 링크가 없다는 사실만으로 작업의 가치나 불필요성을 확정하지 않습니다.'),
 ('Done이면 인수와 출시도 자동 완료인가요?','Scrum의 Done은 공통 품질 기준 충족을 나타냅니다. 이 프로젝트의 인수 권한·별도 출시 준비·운영 조건은 해당 합의로 확인합니다. Sprint Review를 일률적인 출시 승인 관문으로 삼거나, 인수 대기를 이유로 미완료 작업을 Done이라고 바꾸지 않습니다.')]:out+='<details class="think-box trace-reflection"><summary>'+e(q)+'</summary><p>'+e(a)+'</p></details>'
 out+='<p class="evidence-links"><a class="text-link" href="pmp-lesson:n18">품질과 공식 수용 →</a><a class="text-link" href="pmp-lesson:n34">완료와 피드백 →</a><a class="text-link" href="pmp-lesson:n25">변경 통제 →</a><a class="text-link" href="pmp-lesson:n54">품질 갈등 대화 →</a></p><details class="evidence-source-details"><summary>출처·판본·적용 범위</summary><ul class="source-list">'
 for s in SOURCES:out+='<li><a href="'+e(s['url'])+'" target="_blank" rel="noopener">'+e(s['title'])+'</a><p>'+e(s['note'])+'</p></li>'
 out+='<li><a href="https://scrumguides.org/scrum-guide.html" target="_blank" rel="noopener">Scrum Guide · November2020</a><p>2026-10-27 공식 영문 원문의 Increment·완료 정의·Sprint Review를 확인. 특정 프레임워크의 규칙이며 인수 계약 전체를 정의하지 않습니다.</p></li>'
 return out+'</ul><p class="small muted">관계도·요구·검증 목록·비율·변경 요청·연습 해설은 독립 창작입니다. 정해진4개 요구와 지정 검증만을 다루며 실제 서비스의 검증 완전성·PMP 합격을 보장하지 않습니다.</p></details></section>'
