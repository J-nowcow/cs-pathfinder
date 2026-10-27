# -*- coding: utf-8 -*-
"""A fictional AI triage decision: counts, workload, evaluation and oversight."""
from html import escape as e
SOURCES=[
 dict(id='classification-metrics',title='Google ML Crash Course · Accuracy, recall, precision',url='https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall',published=None,updated='2026-01-12',checked='2026-10-27',kind='기계학습 기초의 공식 기술 교육',note='정확도·재현율·분류 정밀도·오탐률의 정의와 불균형 자료·0 분모의 한계 참고. 원문 최초 발행일은 확인되지 않음. 페이지 최종 갱신 2026-01-12 UTC, 2026-10-27 원문 확인. 아래 수치·사례는 창작.'),
 dict(id='ai-rmf-core',title='NIST AI RMF 1.0 · Core',url='https://airc.nist.gov/airmf-resources/airmf/5-sec-core/',published='2023',edition='AI RMF 1.0',checked='2026-10-27',kind='자발적으로 적용하는 AI 위험관리 프레임워크',note='사용 맥락·시험 자료·운영 유사 조건의 검증·감시·사람의 감독·대응을 참고. 2023년 1.0 판의 발췌. 2026-10-27 원문은 개정 작업 진행을 안내하며, 이를 확정 개정판 발행으로 해석하지 않음. 순서가 고정된 일회성 체크리스트가 아님.'),
 dict(id='genai-profile',title='NIST AI 600-1 · Generative AI Profile',url='https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence',paper_url='https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf',published='2024-07-26',edition='July 2024 / NIST AI 600-1',landing_page_updated='2026-04-08',checked='2026-10-27',kind='생성형 AI에 대한 AI RMF 동반 자료',note='환각·사람의 과신·생성 결과의 출처 검증·배포 전과 운영 중 평가 참고. 문서 July 2024·발행 2024-07-26, 소개 페이지 갱신 2026-04-08은 PDF 개정일과 구분. 2026-10-27 소개 페이지와 원문 §2.2·MS-2.5-003 등을 확인.')
]
DATA={
 'sample':1000,'actual_positive':10,'actual_negative':990,'daily_volume':1000,'minutes_per_review':4,'review_capacity_minutes':120,'max_validation_misses':2,
 'models':[{'id':'A','title':'아무 경보도 내지 않는 기준','tp':0,'fn':10,'fp':0,'tn':990},{'id':'B','title':'더 많은 대상을 경보하는 후보','tp':8,'fn':2,'fp':42,'tn':948},{'id':'C','title':'경보를 더 적게 내는 후보','tp':7,'fn':3,'fp':13,'tn':977}]
}

def metrics(m):
 total=sum(m[k] for k in ['tp','fn','fp','tn']);flags=m['tp']+m['fp'];actual=m['tp']+m['fn']
 return dict(total=total,flags=flags,accuracy=(m['tp']+m['tn'])/total*100,recall=m['tp']/actual*100 if actual else None,precision=m['tp']/flags*100 if flags else None,fpr=m['fp']/(m['fp']+m['tn'])*100 if m['fp']+m['tn'] else None,review_minutes=flags/total*DATA['daily_volume']*DATA['minutes_per_review'])

def pct(v):return '계산 불가 (0/0)' if v is None else f'{v:g}%'

def render():
 d=DATA;b=d['models'][1]
 out='<section class="article-section ai-study"><span class="eyebrow">AI EVALUATION → HUMAN WORK → RELEASE DECISION</span><h2>99% 정확해도, 필요한 위험을 전부 놓칠 수 있어요.</h2><p class="ai-lead">가상 프로젝트에서 AI가 일정·의존성 메모를 보고 긴급 검토 대상을 표시한다고 해 봅시다. 목적은 사람의 검토 순서를 돕는 것입니다. AI의 무경보를 “문제없음”으로 자동 승인하는 권한은 주지 않습니다.</p><div class="ai-assumptions"><h3>비교의 분모와 기준부터 맞춰요.</h3><p>별도의 검증 메모 1,000건 중 사전에 합의한 기준으로 긴급 검토 대상이 10건, 아닌 것이 990건이라고 가정합니다. 분야 담당자가 독립 검토·이견 조정으로 기준 레이블을 정했다고 가정하며, 레이블의 오류·모호함과 대상 대표성은 실제로 확인해야 합니다. 세 후보를 같은 자료·같은 기준으로 비교합니다.</p><p>검증·선택용 자료와 마지막 평가용 자료를 구분하고, 동일 프로젝트·중복 문서·미래 정보가 경계를 넘어 성능을 부풀리지 않게 점검합니다. 아래 표본 크기와 구성은 설명을 위한 것이며 실제 도입에 충분하다는 뜻은 아닙니다.</p></div><h3>B의 혼동행렬 · 기준 레이블과 AI 경보를 교차하기</h3><div class="ai-matrix-wrap"><table class="ai-matrix"><caption>가상 검증 1,000건 · 행은 기준, 열은 AI 경보</caption><thead><tr><th scope="col">기준 레이블</th><th scope="col">AI 경보 있음</th><th scope="col">AI 경보 없음</th></tr></thead><tbody><tr><th scope="row">긴급 대상 10건</th><td class="ai-hit"><b>TP '+str(b['tp'])+'</b><span>맞게 발견</span></td><td class="ai-miss"><b>FN '+str(b['fn'])+'</b><span>놓친 긴급 대상</span></td></tr><tr><th scope="row">긴급 아님 990건</th><td class="ai-false"><b>FP '+str(b['fp'])+'</b><span>불필요한 경보</span></td><td><b>TN '+str(b['tn'])+'</b><span>맞게 무경보</span></td></tr></tbody></table></div><div class="ai-definitions">'
 for title,formula,question in [
 ('정확도 · Accuracy','(TP+TN) ÷ 전체','전체에서 맞은 비율. 다수인 비긴급을 잘 맞혀 긴급 누락을 가릴 수 있다.'),
 ('재현율 · Recall','TP ÷ (TP+FN)','기준상 실제 긴급 대상 중 얼마나 발견했나? 누락 위험과 연결한다.'),
 ('분류 정밀도 · Precision','TP ÷ (TP+FP)','경보를 낸 것 중 얼마나 실제 긴급인가? 검토 효율과 연결한다.')]:out+='<article><h4>'+e(title)+'</h4><b>'+e(formula)+'</b><p>'+e(question)+'</p></article>'
 out+='</div><p class="small muted">이 절의 분류 정밀도는 계측에서 반복 측정의 흩어짐을 말하는 정밀도와 맥락이 다릅니다. 모든 지표는 정한 분류 기준·운영 지점에 의존합니다.</p><h3>같은 1,000건으로 세 후보를 비교하면</h3><div class="ai-models">'
 for m in d['models']:
  r=metrics(m);passes_miss=m['fn']<=d['max_validation_misses'];passes_load=r['review_minutes']<=d['review_capacity_minutes']
  out+=f'<article data-ai-model="{m["id"]}"><span class="eyebrow">CANDIDATE {m["id"]}</span><h4>{e(m["title"])}</h4><p class="ai-counts">TP {m["tp"]} · FN {m["fn"]} · FP {m["fp"]} · TN {m["tn"]}</p><dl>'
  for key,label,value in [('accuracy','정확도',pct(r['accuracy'])),('recall','재현율',pct(r['recall'])),('precision','경보 적중률',pct(r['precision'])),('flags','경보 건수',str(r['flags'])+'건'),('misses','검증셋 미탐',str(m['fn'])+'건'),('review_minutes','하루 검토 추정',f'{r["review_minutes"]:g}분')]:out+=f'<div><dt>{label}</dt><dd data-ai-value="{key}">{e(value)}</dd></div>'
  out+='</dl><p class="ai-verdict">'+('미탐 조건 충족' if passes_miss else '미탐 조건 미충족')+' · '+('검토량 조건 충족' if passes_load else '검토량 조건 미충족')+'</p></article>'
 out+='</div><details class="think-box"><summary>B의 숫자를 직접 계산해 볼까요?</summary><div class="ai-calculations"><p>정확도=(8+948)/1000=95.6%</p><p>재현율=8/(8+2)=80% · 경보 적중률=8/(8+42)=16%</p><p>오탐률 FPR=42/(42+948)≈4.24%<br>경보 중 틀린 비율=42/(8+42)=84%<br><b>분모가 다르므로 두 비율을 혼동하지 않습니다.</b></p><p>경보 50건 × 건당 검토 4분 = 200분</p></div></details><aside class="notice">A는 경보가 없으므로 분류 정밀도의 분모가 0입니다. 이를 “100% 적중”으로 표시하지 않습니다. B의 재현율 80%는 <b>8/10건</b>에서 나온 관측값입니다. 긴급 사례가 10건뿐인 이 수치를 미래 발견률의 보장으로 읽지 않습니다. 대상 분포가 달라지면 정밀도·검토량도 달라질 수 있습니다.</aside><h3>성능과 검토 여력을 동시에 만족할까요?</h3><div class="ai-capacity"><p>사례의 사전 비교 조건: <b>같은 검증셋에서 미탐 최대 2건</b>, <b>예상 경보 검토 120분/일 이하</b>입니다. 실제 도입에는 이 두 조건 외에도 사용 목적·위험·표본 불확실성·필수 통제의 검토가 필요합니다.</p><p>하루 1,000건이 이 검증셋과 같은 경보 비율을 갖고, 모든 경보를 평균 4분씩 검토한다고 <b>가정</b>하면 B는 200분, C는 80분입니다. 검토 인력·처리시간과 입력 분포가 바뀌면 이 부하 예측도 달라집니다.</p><p class="formula">B: 미탐 2건 → 조건 충족 · 200분 &gt; 120분 → 여력 초과<br>C: 80분 ≤ 120분 → 여력 내 · 미탐 3건 &gt; 2건 → 누락 조건 미충족</p><p><b>이 가정에서는 B와 C 모두 곧바로 운영 확대할 후보가 아닙니다.</b> 경보 기준·자료·업무 흐름·검토 역량·비AI 대안을 다시 비교합니다. 결과를 본 뒤 편한 기준으로 바꾸는 대신 결정 이유와 새 검증 계획을 남깁니다.</p><p class="small">120분은 사례의 경보 검토 여력이며 모든 운영 업무를 처리할 총 여력이 아닙니다. 무경보 표본의 별도 점검·이의 제기·후속 조치에도 자원이 필요합니다. 사람이 검토한다는 사실만으로 모든 오류가 사라지지는 않습니다.</p></div><h3>생성형 AI의 요약·답변은 다른 평가도 필요해요.</h3><div class="ai-generation">'
 for title,body in [
 ('원문과 주장의 일치','분류 재현율만으로 요약의 사실 충실성을 평가하지 않습니다. 원문에 없는 날짜·담당자·위험을 덧붙였는지, 중요한 예외를 빠뜨렸는지, 출처가 실제 주장을 뒷받침하는지 대조합니다.'),
 ('보류와 에스컬레이션','필수 정보가 없거나 자료가 충돌할 때 확인 요청·보류·사람에게 전달하는 동작을 설계합니다. 유창한 “95% 확신” 문장은 검증된 확률이나 승인 근거를 대신하지 않습니다.'),
 ('시스템 전체와 버전','모델·프롬프트·검색 자료·도구·권한이 함께 결과를 만듭니다. 허용 자료와 버전을 기록하고 변경 후 대표·경계·실패 사례로 다시 평가합니다. 사실성뿐 아니라 정보 접근과 부적절한 실행도 별도 확인합니다.')]:out+='<article><h4>'+e(title)+'</h4><p>'+e(body)+'</p></article>'
 out+='</div><h3>PM이 운영 판단에 연결할 기록</h3><ol class="ai-operations">'
 for title,body in [
 ('사용 범위와 책임','지원할 판단·금지된 자동 결정·허용 자료·승인권자와 검토자를 합의합니다. 모델 제공자의 점수와 실제 업무 적합성을 구분합니다.'),
 ('평가 계획과 수용 증거','정답 기준·자료 출처·분할·하위 집단·관측 단위·지표·오류 영향·보류 기준을 정합니다. 모형만이 아니라 사람이 쓰는 흐름에서 누락·경보 피로·처리 지연을 관찰합니다.'),
 ('단계적 검증과 대응','기존 판단에 영향을 주지 않는 비교, 제한된 사용 등 목적에 맞는 검증을 선택합니다. 확대 조건·문제 보고·중지·대체 절차와 책임을 실제로 확인합니다.'),
 ('운영 감시와 변경','버전·입력 분포·오류 심각도·검토 대기·이의 제기·사람이 뒤집은 판단을 기록합니다. 품질 저하·사용 범위 이탈 시 중지·재평가·복구 결정을 연결합니다.')]:out+='<li><b>'+e(title)+'</b><p>'+e(body)+'</p></li>'
 out+='</ol><p class="muted small">비채점 회상·적용 연습</p>'
 for q,a in [
 ('경보 50건 중 진짜가 8건이니 재현율도 16%인가요?','8/50=16%는 경보 적중률입니다. 재현율은 실제 긴급 10건 중 발견 8건이므로 80%입니다. 경보 집단과 기준상 긴급 집단의 분모를 구분합니다.'),
 ('검토 120분이면 B의 경보 중 30건만 보면 되나요?','50건×4분=200분인데 120분으로 모두 처리할 수는 없습니다. 30건만 보고 나머지를 조용히 미확인 상태로 남기면 검증한 업무 흐름과 달라집니다. 우선순위·대기·지원 여력·미검토 처리·중지 기준을 설계하고 전체 흐름을 검증해야 합니다.'),
 ('모델이 갱신됐지만 이름이 같으면 평가도 재사용할까요?','모델 버전·설정·검색 자료·도구 등의 변화를 확인하고 영향에 맞게 재평가합니다. 이전 근거를 현재 시스템의 성능 보장으로 자동 승계하지 않습니다.'),
 ('전체 정확도가 높으면 하위 집단 점검은 생략해도 될까요?','문서 유형·언어·업무 조건 등 실제 영향이 다른 집단의 성능과 오류를 확인합니다. 표본 수·레이블 품질·불확실성을 함께 보고 평균에 가려진 실패를 찾습니다. 작은 하위 집단 수치도 확정 사실처럼 일반화하지 않습니다.')]:out+='<details class="think-box ai-reflection"><summary>'+e(q)+'</summary><p>'+e(a)+'</p></details>'
 out+='<aside class="notice">학습용 가상 분류 사례이며 실제 모델·회사 자료·AI 도입 인증이 아닙니다. 표본·정답 기준·검토 4분·미탐 2건·120분은 창작 가정입니다. 비용과 위험을 단일 점수로 환산해 안전성을 보장하지 않습니다. NIST 자료는 자발적 위험관리 지침이며 이 사례의 숫자 기준을 규정하지 않습니다.</aside><p class="evidence-links"><a class="text-link" href="pmp-lesson:n52">표본과 불확실성 →</a><a class="text-link" href="pmp-lesson:n68">가설·가드레일 →</a><a class="text-link" href="pmp-lesson:n74">운영 전환·잔여 책임 →</a></p><details class="evidence-source-details"><summary>출처·판본·현재 상태 확인</summary><ul class="source-list">'
 for s in SOURCES:
  out+='<li><a href="'+e(s['url'])+'" target="_blank" rel="noopener">'+e(s['title'])+'</a><p>'+e(s['note'])+'</p>'
  if s.get('paper_url'):out+='<a href="'+e(s['paper_url'])+'" target="_blank" rel="noopener">검토한 July 2024 원문 PDF</a>'
  out+='</li>'
 return out+'</ul></details></section>'
