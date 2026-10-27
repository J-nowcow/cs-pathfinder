# -*- coding: utf-8 -*-
"""Authored supplement; one HTML renderer for interactive and no-JS readers."""
from html import escape as e

SOURCES=[
 dict(id='product-risks',title='SVPG · The Four Big Risks',url='https://www.svpg.com/four-big-risks/',published='2017-12-04',checked='2026-10-27',kind='원저자의 제품 발견 프레임워크',note='Marty Cagan의 가치·사용성·구현 가능성·사업 적합성 구분. 특정 제품 방법론이며 PMI 공식 시험 목차나 모든 조직의 역할 규정이 아님. 2017-12-04 발행, 2026-10-27 원문 확인.'),
 dict(id='research-interview',title='GOV.UK · Using in-depth interviews',url='https://www.gov.uk/service-manual/user-research/using-in-depth-interviews',published='2017-02-21',checked='2026-10-27',kind='공공 서비스 실무 지침',note='사용자 맥락·실제 경험과 열린 중립 질문의 활용. 인터뷰 발언을 전체 사용자 비율이나 구매 행동의 보장으로 확장하지 않음. 2017-02-21 발행, 2026-10-27 원문 확인.'),
 dict(id='research-usability',title='GOV.UK · Using moderated usability testing',url='https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing',published='2017-02-21',updated='2017-10-03',checked='2026-10-27',kind='공공 서비스 실무 지침',note='목표 과제를 주고 수행을 관찰해 사용성 문제를 찾는 방법. 정답 유도·설명 개입을 기록한다. 2017-02-21 발행·2017-10-03 갱신, 2026-10-27 원문 확인.'),
 dict(id='experiment-trust',title='Microsoft Research · Pre-Experiment Trustworthiness',url='https://www.microsoft.com/en-us/research/articles/patterns-of-trustworthy-experimentation-pre-experiment-stage/',published='2020-07-31',checked='2026-10-27',kind='실험 플랫폼 운영 경험 기반 지침',note='반증 가능한 가설·성공 지표·가드레일·자료 품질과 무작위화 단위의 설계 참고. Microsoft의 운영 지침이며 무작위 배정만으로 모든 편향이 사라진다는 뜻이 아님. 2020-07-31 발행, 2026-10-27 원문 확인.')
]
DATA={
 'title':'만들기 전에, 무엇을 알아야 할까요?',
 'intro':'발견(Discovery)은 사용자 문제와 해결안의 불확실성을 줄이는 활동입니다. 전달(Delivery)은 결과를 신뢰할 수 있게 만들고 운영하는 활동입니다. 둘은 피드백을 주고받으며 반복할 수 있습니다. 사용자 스토리나 일정표를 상세하게 써도 수요·사용성·사업성이 자동으로 검증되지는 않습니다.',
 'risks':[
  ('가치 · Value','누가 어떤 문제 때문에 실제로 이 해결안을 선택할까?','현재 대안·문제의 빈도와 비용을 조사하고, 적절한 조건에서 실제 선택·재사용을 관찰한다. 칭찬만으로 지불·채택 의사를 확정하지 않는다.'),
  ('사용성 · Usability','필요한 사람이 도움 없이 과제를 끝낼 수 있을까?','대상 사용자가 모형이나 서비스를 사용하는 과정을 관찰한다. 과제 성공·막힘·도움 여부를 기록한다. 조작 성공이 시장 수요를 증명하지는 않는다.'),
  ('구현 가능성 · Feasibility','현재 역량·기술·시간 제약에서 만들고 운영할 수 있을까?','가장 불확실한 기술 경계를 작은 기술 검증으로 확인한다. 성공한 데모와 운영 부하·복구·보안 요건 충족을 구분한다.'),
  ('사업 적합성 · Viability','비용·계약·판매 경로·운영 책임 안에서 지속할 수 있을까?','원가·지원 부담·수익 구조와 조직 제약을 관계자와 검토한다. 사용자가 좋아해도 운영 비용이나 의무를 충족하지 못할 수 있다.')
 ],
 'methods':[
  ('인터뷰·관찰','현재 행동·맥락·대안·문제의 원인을 탐색','최근 실제 사례를 묻고 관찰 사실과 해석을 분리한다. 모집 대상·빠진 집단·반대 사례를 기록한다.','“좋다”는 답을 전체 시장의 수요율이나 실제 사용 행동으로 읽지 않는다.'),
  ('과제 기반 사용성 테스트','주어진 해결안의 이해·조작 장벽을 탐색','목표만 주고 과정을 관찰한다. 진행자가 설명하거나 도왔다면 무도움 성공과 구분한다.','적은 참가자의 성공률을 모집단의 확정 성공률로 보거나, 조작 성공으로 사업성을 결론내리지 않는다.'),
  ('작은 실제 운영 실험','문제 상황에서 선택·완료·재사용과 운영 부담을 관찰','최소 범위와 필수 품질, 관측 기간, 담당자, 중단 조건을 정한다. 사용자에게 제공하는 범위를 명확히 한다.','작은 범위의 운영 성공을 모든 환경의 적합성으로 확대하지 않는다. 전후 변화에는 계절·모집 차이 등이 섞일 수 있다.'),
  ('무작위 대조 A/B 실험','정의한 대상·기간에서 변경의 효과를 비교','실험 단위·가설·주 지표·가드레일·표본과 종료·분석 계획을 미리 정한다. 배정·노출·로그 품질과 집단 간 간섭을 확인한다.','관측 차이를 확정 효과로 단정하거나, 유리한 지표·기간만 골라 출시하지 않는다. 통계적 불확실성과 실무적 크기를 함께 본다.')
 ],
 'hypothesis':[
  ('대상과 문제','최근 한 달 안에 신청을 시작했지만 중도 이탈한 사용자. 어려운 용어 때문에 다음 행동을 알기 어렵다는 가설.'),
  ('변경과 작동 원리','용어 설명과 단계 안내를 바꾸면 이해 부담이 줄어 신청 완료가 늘어날 것으로 예상한다. 기능 목록보다 원인을 명시한다.'),
  ('측정·중단·결정','첫 신청을 시작한 사용자 중 7일 안에 완료한 비율을 주 지표로 정한다. 같은 사용자에 고정 배정하고 양쪽의 완료 관측 기간을 채운다. 오류 사용자율 2% 초과 시 확대를 보류한다는 운영 기준을 먼저 정한다.'),
  ('실험의 전제','가상 실험에서 사용자 2,000명을 A/B 각 1,000명으로 무작위 배정했고 모두 노출·관측됐다고 가정한다. 원래 계획한 분석 시점의 값이며, 간섭·중복·누락·동시 변경 여부는 실제로 별도 확인해야 한다.')
 ],
 'variants':[{'id':'A','name':'기존 안내 A','users':1000,'completed':600,'errors':10},{'id':'B','name':'새 안내 B','users':1000,'completed':650,'errors':35}],
 'guardrail':2,
 'reflection':[
  ('인터뷰 8명 중 7명이 “좋다”고 말했다. 이제 수요를 검증했다고 할까?','이 모집 집단에서 긍정적인 발언이 관찰됐다고 말할 수 있다. 시장 전체의 선택률·구매·지속 사용까지 확정할 수는 없다. 최근 문제 경험과 현재 대안을 더 확인하고, 비용·위험이 작은 조건에서 실제 선택 행동을 관찰한다. 8명은 이 창작 사례의 표본이며 권장 표본 수가 아니다.'),
  ('프로토타입 과제는 10명 중 6명이 도움 없이 완료했다. 무엇을 고칠까?','관측한 무도움 완료는 6/10이다. 나머지 참가자가 막힌 단계·이유·진행자 도움을 분석하고, 표현과 흐름을 수정해 다시 관찰한다. 전체 사용자의 성공률이 60%로 확정됐거나 수요가 60%라는 뜻은 아니다.'),
  ('완료율은 올랐지만 오류 사용자율이 3.5%다. 바로 확대할까?','사전에 정한 2% 보류 기준을 넘었으므로 이 가상 정책에서는 확대를 보류한다. 로그와 오류 원인·심각도를 검토하고 수정 후 재검증 계획을 세운다. 불편한 지표를 숨기거나 결과를 본 뒤 임계값을 바꿔 성공으로 만들지 않는다.'),
  ('결과를 프로젝트 계획과 어떻게 연결할까?','가설·관측 사실·한계·결정·담당자·다음 검증을 결정 기록에 남긴다. 다음 작업의 범위·수용 기준·위험·의존성과 예측을 갱신하고, 승인된 기준선 변경은 정해진 통제를 따른다. 학습 결과가 모든 변경 권한을 대신하지 않는다.')
 ],
 'limit':'이 내용은 특정 제품 발견 프레임워크와 연구·실험 지침을 프로젝트 판단에 연결한 심화 자료입니다. 네 위험이 공식 PMP 시험 영역이라는 뜻은 아닙니다. 사례·수치·2% 보류 기준은 자체 제작한 가정이며 보편적 기준이 아닙니다. 이 예제는 신뢰구간·검정력·다중 검정 등을 계산하지 않으므로 통계적 유의성이나 장기 효과를 판정하지 않습니다.'
}

def render():
 d=DATA
 out='<section class="article-section evidence-study" aria-label="제품 발견과 실험 근거"><span class="eyebrow">DISCOVERY → EVIDENCE → DECISION</span><h2>'+e(d['title'])+'</h2><p class="evidence-intro">'+e(d['intro'])+'</p><div class="evidence-flow" aria-label="가설과 결정을 잇는 피드백 순환"><span>가정 찾기</span><i>→</i><span>맞는 방법 선택</span><i>→</i><span>근거와 한계</span><i>→</i><span>결정·다음 가설 ↺</span></div><h3>다른 위험에는 다른 근거가 필요해요.</h3><p class="muted small">Marty Cagan의 네 위험 구분을 적용한 자체 설명입니다. 실제 팀의 역할·방법은 상황에 맞게 합의합니다.</p><div class="evidence-risks">'
 for name,q,body in d['risks']:out+='<article><span class="eyebrow">'+e(name)+'</span><h4>'+e(q)+'</h4><p>'+e(body)+'</p></article>'
 out+='</div><h3>방법을 고를 때: 알아낼 수 있는 것과 남는 질문</h3><div class="evidence-methods">'
 for name,goal,procedure,limit in d['methods']:out+='<article><h4>'+e(name)+'</h4><dl><dt>배울 것</dt><dd>'+e(goal)+'</dd><dt>설계·관찰</dt><dd>'+e(procedure)+'</dd><dt>추론의 한계</dt><dd>'+e(limit)+'</dd></dl></article>'
 out+='</div><div class="evidence-case"><span class="eyebrow">FICTIONAL CASE / 신청 안내를 바꾸면?</span><h3>가설을 검증 가능한 계획으로 바꿔 봐요.</h3><dl>'
 for label,body in d['hypothesis']:out+='<dt>'+e(label)+'</dt><dd>'+e(body)+'</dd>'
 out+='</dl><h4>가상 관측 결과 · 각 집단 1,000명</h4>'
 for key,label,maxv in [('completed','7일 내 신청 완료 사용자율',100),('errors','관측 기간 중 오류 경험 사용자율',5)]:
  out+=f'<figure class="evidence-chart" data-evidence-chart="{key}"><figcaption>{label} · 축 0~{maxv}%</figcaption>'
  for v in d['variants']:
   rate=v[key]/v['users']*100
   out+=f'<div class="evidence-bar"><span>{v["id"]}</span><div class="evidence-track"><i style="width:{rate/maxv*100:.6f}%"></i>'+(f'<b class="evidence-threshold" style="left:{d["guardrail"]/maxv*100:.6f}%" aria-hidden="true"></b>' if key=='errors' else '')+f'</div><strong>{rate:g}%</strong></div><p class="small">{e(v["name"])} · {v[key]:,}/{v["users"]:,}명</p>'
  out+='<div class="evidence-axis"><span>0%</span><span>'+str(maxv)+'%</span></div>'
  if key=='errors':out+='<p class="small">세로 점선: 사전 확대 보류 기준 2%. 한 사용자가 오류를 여러 번 겪어도 한 명으로 집계합니다. 신청 완료와 오류 경험은 겹칠 수 있습니다.</p>'
  out+='</figure>'
 a,b=d['variants'];pa=a['completed']/a['users'];pb=b['completed']/b['users'];delta=(pb-pa)*100;rel=(pb/pa-1)*100
 out+=f'<p class="formula" data-evidence-summary>완료율: 60% → 65%<br>절대 변화 = 65 − 60 = <b>+{delta:.0f}%p</b><br>상대 변화 = (65 − 60) ÷ 60 × 100 ≈ <b>+{rel:.1f}%</b><br>오류 사용자율: 1% → 3.5% · 보류 기준 2% 초과</p><p class="small">두 그래프의 축 범위가 다릅니다. 완료율과 오류율의 막대 길이를 서로 직접 비교하지 마세요. 위 값은 관측 차이이며 통계적 효과 확정이 아닙니다.</p></div><h3>먼저 판단하고, 근거를 펼쳐 보세요.</h3><p class="muted small">비채점 회상·적용 연습 · 창작 사례</p>'
 for q,answer in d['reflection']:out+='<details class="think-box evidence-reflection"><summary>'+e(q)+'</summary><p>'+e(answer)+'</p></details>'
 out+='<aside class="notice">'+e(d['limit'])+'</aside><p class="evidence-links"><a class="text-link" href="pmp-lesson:n65">사용자 스토리·우선순위 →</a><a class="text-link" href="pmp-lesson:n69">편익·지표·사업 검토 →</a><a class="text-link" href="pmp-lesson:n59">위험 대응 →</a><a class="text-link" href="pmp-lesson:n52">표본·신뢰구간의 뜻 →</a></p><details class="evidence-source-details"><summary>출처·시점·근거의 성격 확인</summary><ul class="source-list">'
 for s in SOURCES:out+='<li><a target="_blank" rel="noopener" href="'+e(s['url'])+'">'+e(s['title'])+'</a><p>'+e(s['note'])+'</p></li>'
 return out+'</ul></details></section>'
