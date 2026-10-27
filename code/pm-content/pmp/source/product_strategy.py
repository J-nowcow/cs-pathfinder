# -*- coding: utf-8 -*-
"""Authored strategy-to-execution case; shared static/interactive supplement."""
from html import escape as e
SOURCES=[
 dict(id='product-strategy',title='Melissa Perri · What is Good Product Strategy?',url='https://melissaperri.com/blog/2016/07/14/what-is-good-product-strategy',published='2016-07-14',checked='2026-10-27',kind='제품 전략에 대한 원저자의 과거 견해',note='목표·현재 상태·실험과 제품 활동의 연결에 대한 2016-07-14 글. 원문은 저자가 후속 책·강의에서 관점을 발전시켰음을 명시한다. 역사적 기초 관점으로 사용하며 최신 통일 표준으로 제시하지 않는다. 2026-10-27 원문 확인.'),
 dict(id='opportunity-tree',title='Teresa Torres · Opportunity Solution Trees',url='https://www.producttalk.org/opportunity-solution-trees/',published='2023-12-06',checked='2026-10-27',kind='기회·해결안 탐색 방법의 원저자 해설',note='성과·고객의 필요/불편·대안·가정 검증의 관계를 참고. 2023-12-06 발행, 2026-10-27 원문 확인. 아래 그림·사례는 자체 제작한 축약 예제이며 원문 도표·전체 절차를 복제하지 않음.'),
 dict(id='goal-roadmap',title='Roman Pichler · GO Product Roadmap and Checklist',url='https://www.romanpichler.com/downloads/tools/GO-Product-Roadmap-with-Checklist.pdf',edition='01/2023',published='2023-01',checked='2026-10-27',kind='목표 중심 로드맵의 원저자 도구·설명',note='성과 목표·측정·시간 범위와 상위 기능의 정합성을 보는 관점을 참고. PDF 표시 판본 01/2023, 2026-10-27 원문 확인. 원본 양식을 복제·번역한 것이 아닌 독립 설명과 자체 로드맵 사례.')
]
DATA={
 'capacity':12,'mandatory':4,
 'options':[{'id':'A','name':'서류·용어 안내 개선','days':4,'opportunity':'O1','hypothesis':'설명 부담을 줄이면 서류 단계에서 올바른 다음 행동을 알 수 있다.','test':'필수 서류를 찾고 신청을 진행하는 과제를 주어 막힘·도움을 관찰한 뒤, 제한된 운영 검증을 설계한다.'},{'id':'B','name':'입력 임시 저장','days':6,'opportunity':'O2','hypothesis':'중단 후 돌아와도 입력을 유지하면 재입력 부담과 이탈이 줄어든다.','test':'중단·복귀 상황의 실제 맥락을 확인하고 저장·복원·개인정보 보호 조건을 기술·사용성 검증한다.'},{'id':'C','name':'운영 상태 대시보드','days':8,'opportunity':None,'hypothesis':'운영팀이 문제를 더 빨리 발견하면 신청 실패 대응이 빨라질 수 있다.','test':'어떤 운영 결정이 늦는지와 기존 로그·알림으로 부족한 점을 확인한다. 현재 사용자 문제와의 연결은 아직 약하다.'}],
 'allocation':[{'name':'필수 통제 로그 수정','days':4},{'name':'A의 제한된 개선·검증','days':4},{'name':'측정·자료 품질 점검','days':2},{'name':'명시한 잔여 여력','days':2}]
}

def render():
 d=DATA;remaining=d['capacity']-d['mandatory']
 out='<section class="article-section strategy-study"><span class="eyebrow">STRATEGY → OPPORTUNITY → ROADMAP</span><h2>무엇을 먼저 만들지, 문제에서 출발해 볼까요?</h2><p class="strategy-lead">전략을 세울 때는 대상 사용자·현재 문제·원하는 변화·집중할 선택과 그 이유를 연결합니다. 로드맵은 그 선택을 시간 범위와 학습·전달 방향으로 소통하고, 백로그는 실행 후보와 구체적인 작업을 다룹니다. 하나의 점수가 모든 선택을 대신하지는 않습니다.</p><div class="strategy-levels">'
 for title,q,example in [
 ('제품 전략','누구의 어떤 문제에 집중하며, 왜 이 방향인가?','첫 신청자의 서류 이해 장벽을 먼저 낮춰 올바른 제출과 편익 실현을 돕는다는 선택. 다른 문제에 대한 가정·대안·근거도 남긴다.'),
 ('성과 목표','어떤 행동·상태를 언제까지 얼마나 바꾸려는가?','가상 목표: 첫 신청 시작자의 7일 내 제출률을 같은 측정 정의로 8주 후 60%→70%로 개선. 오류율·필수 동의 기록도 함께 확인.'),
 ('로드맵','어떤 성과를 어떤 순서·범위·조건으로 추구하는가?','지금은 이해 장벽을 검증하고, 다음은 중단·복귀 문제를 검토한다. 확신이 낮은 먼 항목은 상세 기능·날짜 약속을 줄인다.'),
 ('백로그·수용 기준','다음 전달을 위해 무엇을 구체화하고 확인할까?','안내 문구·접근성·예외 경로·측정 작업을 작게 나누고 완료·수용 조건을 정한다. 운영 확대는 별도 조건에 따른다.'),
 ('승인된 기준선·약속','어떤 범위·예산·일정을 누가 통제하는가?','계약·외부 승인·고정 기한을 명시한다. 로드맵을 바꿨다는 사실만으로 승인된 기준선이 자동 변경되지는 않는다.')]:
  out+='<article><h3>'+e(title)+'</h3><b>'+e(q)+'</b><p>'+e(example)+'</p></article>'
 out+='</div><h3>성과·기회·해결안·검증을 구분하는 가상 지도</h3><p>“기회”는 여기서 고객의 필요·불편·욕구를 뜻합니다. “임시 저장 버튼이 필요하다”처럼 특정 기능을 먼저 고정한 문장은 해결안과 문제를 섞을 수 있습니다. 아래 연결은 조사로 확인할 <b>가설</b>이며 모든 인과가 검증됐다는 뜻이 아닙니다.</p><div class="strategy-map"><div class="strategy-goal"><span class="eyebrow">OUTCOME / 공통 목표</span><h4>처음 신청한 사용자가 올바른 제출을 마치도록 돕기</h4><p>관측 기준 600/1,000명=60% · 가상 목표 8주 후 70%<br>오류 사용자율 2% 초과 시 확대 보류 · 필수 동의 기록 누락은 허용하지 않는다는 사례 조건</p></div><div class="strategy-branches">'
 for id,title,observation,interpretation in [
 ('O1','필요한 서류와 용어를 이해하기 어렵다','인터뷰에서 “어떤 서류가 해당하는지 모르겠다”는 실제 경험을 들었다고 가정. 로그에서 해당 단계의 이탈을 관측했다고 가정.','서류 이해의 어려움이 이탈에 기여할 수 있다. 로그만으로 이유를 확정하거나 일부 발언을 전체 비율로 바꾸지 않는다.'),
 ('O2','중단 후 돌아오면 입력을 다시 해야 한다','복귀 사용자가 재입력 부담을 설명했고 기존 동작에서도 입력이 유지되지 않는다고 가정.','중단·복귀가 중요한 이탈 원인인지, 대상 사용자의 빈도·영향과 다른 원인을 더 확인한다.')]:
  out+='<article class="strategy-opportunity"><span class="eyebrow">'+id+' / OPPORTUNITY</span><h4>'+e(title)+'</h4><dl><dt>가상 관측 사실</dt><dd>'+e(observation)+'</dd><dt>해석·남은 가정</dt><dd>'+e(interpretation)+'</dd></dl><div class="strategy-solutions">'
  matches=[x for x in d['options'] if x['opportunity']==id]
  if id=='O1':matches=matches+[dict(id='A2',name='서류 준비 체크리스트',hypothesis='신청 전 필요한 준비를 끝낼 수 있으면 중간 막힘이 줄 수 있다.',test='사용자가 자신의 상황에 맞는 준비 항목을 고를 수 있는지 관찰한다. 기존 안내 개선과 서로 다른 가정을 비교한다.')]
  for x in matches:out+='<div><b>대안 '+e(x['id'])+' · '+e(x['name'])+'</b><p>'+e(x['hypothesis'])+'</p><small>가장 먼저 확인할 것 · '+e(x['test'])+'</small></div>'
  out+='</div></article>'
 out+='</div><div class="strategy-unlinked"><b>연결을 더 확인할 후보 C · 운영 상태 대시보드</b><p>'+e(d['options'][2]['hypothesis'])+' '+e(d['options'][2]['test'])+'</p></div></div><p class="muted small">Teresa Torres의 기회·해결안 탐색 관점을 참고한 자체 축약 그림입니다. 목표나 고객의 불편을 AI가 지어내 실제 조사 결과처럼 쓰지 않습니다. 이 사례는 전부 창작입니다. A2는 비교할 검증 아이디어이며 아직 개발 작업량을 추정하거나 현재 배분에 포함하지 않았습니다.</p><h3>제약을 먼저 확인하고, 선택의 대가를 설명해요.</h3><div class="strategy-capacity"><p>이번 검토 구간의 가용량은 <b>12인일</b>, 반드시 해야 한다고 정한 통제 로그 수정은 <b>4인일</b>입니다. A는 4인일, B는 6인일, C는 8인일로 추정했다고 가정합니다. 모두 같은 단위지만 필요한 역량·의존성과 추정 오차는 따로 확인합니다.</p><p class="formula">필수 작업 뒤 잔여량 = 12 − 4 = <b>'+str(remaining)+'인일</b><br>A+B = 4+6 = <b>10인일</b> → 잔여량 8인일 초과<br>필수 작업+A+B = <b>14인일</b> → 전체 12인일 초과</p><p>이 근거에서는 O1을 더 작게 배울 수 있는 A를 먼저 검증하는 선택이 가능합니다. B가 더 큰 문제라는 새 증거가 나오면 결론은 달라질 수 있습니다. A를 고르면 B의 잠재 효과를 이번 구간에 검증하지 못하는 기회비용이 생깁니다. 효과·확신이 불명확한 후보의 점수를 더해 확정 편익처럼 보고하지 않습니다.</p><h4>가능한 한 가지 배분 · 합계 12인일</h4><div class="strategy-allocation" role="img" aria-label="필수 통제 로그 수정 4인일, A 개선·검증 4인일, 측정·자료 점검 2인일, 명시한 잔여 여력 2인일. 합계 12인일.">'
 for i,a in enumerate(d['allocation']):out+=f'<span class="allocation-{i}" style="flex:{a["days"]}">{a["days"]}</span>'
 out+='</div><ul class="strategy-allocation-legend">'+''.join('<li><i class="allocation-'+str(i)+'"></i>'+e(a['name'])+' <b>'+str(a['days'])+'인일</b></li>' for i,a in enumerate(d['allocation']))+'</ul><p class="small">잔여 여력은 아직 끝낸 일이나 추가 편익이 아닙니다. 이 배분은 선택 예시입니다. 인일 합계가 맞아도 병렬 수행·전문 역량·선행 작업·달력을 확인해야 하므로 종료일을 보장하지 않습니다.</p></div><h3>로드맵에 확신과 재검토 조건을 함께 적어요.</h3><div class="strategy-roadmap">'
 for title,goal,status,condition in [
 ('지금','첫 신청자의 이해 장벽을 줄일 수 있는지 검증','A의 작은 개선·측정과 필수 통제 작업을 현재 구간에서 계획. 실제 완료일은 의존성과 가용성을 확인해 예측.','확대 조건: 과제 막힘 개선·자료 품질·오류 기준·필수 기록·운영 준비를 검토. 목표 70%는 보장된 결과가 아님.'),
 ('다음','중단·복귀의 재입력 장벽 검토','B는 조사·기술 가정을 더 확인할 후보. 이번 구간의 개발 완료 약속으로 표시하지 않음.','재검토 조건: A 뒤에도 복귀 이탈이 중요하거나, 새로운 자료에서 O2의 빈도·영향이 더 크다고 판단될 때.'),
 ('이후','운영 대응의 관측 공백을 확인','C는 운영 의사결정과 목표의 연결이 더 필요함. 상세 화면·납기 약속을 먼저 확정하지 않음.','재검토 조건: 기존 로그·알림으로 결정이 늦는 원인을 확인하고 기대 효과·운영 비용·담당자가 정해질 때.')]:
  out+='<article><span class="eyebrow">'+e(title)+'</span><h4>'+e(goal)+'</h4><p>'+e(status)+'</p><p class="strategy-condition">'+e(condition)+'</p></article>'
 out+='</div><p class="small">이 표는 자체 로드맵 예제입니다. “지금/다음/이후”가 모든 조직의 필수 형식은 아닙니다. 확정된 계약·통제 기한은 명시하고 역산 계획·승인 책임을 함께 관리합니다.</p><h3>결정 기록 · 나중에 선택 이유를 복원할 수 있게</h3><dl class="strategy-decision">'
 for label,body in [
 ('현재 결정','필수 로그 수정과 A의 작은 개선·검증을 계획한다. 측정 2인일과 잔여 여력 2인일을 구분한다. 검증 전 전체 사용자 확대는 약속하지 않는다.'),
 ('근거와 불확실성','O1에 관한 가상 인터뷰·동작 관찰·이탈 자료가 있으나 인과·시장 전체 빈도·목표 효과는 아직 확인하지 않았다. A와 A2의 주요 가정을 비교한다.'),
 ('미룬 대안과 이유','B는 이번 총량 안에서 A와 함께 넣기 어렵고 추가 근거가 필요하다. C는 현재 목표와의 연결이 약하다. 제외는 영구 폐기를 뜻하지 않는다.'),
 ('담당·측정·중단','가상 제품 담당자는 목표와 선택, 개발 담당자는 기술·추정, 연구/분석 담당자는 과제·자료 품질을 확인한다. 실제 책임·결정권은 조직과 합의한다. 사례의 오류 2% 기준·필수 기록·운영 조건을 유지한다.'),
 ('다시 볼 조건','정한 관측 기간과 분석 계획을 채운 뒤 평가한다. 고객 문제의 새로운 증거·추정 변화·가드레일 위반·필수 작업 증가 시 권한자와 대안을 다시 비교한다.'),
 ('프로젝트와 연결','선택한 범위·수용 조건·의존성·위험·측정 작업을 구체화한다. 로드맵·백로그·예측과 승인된 기준선을 구별하고 필요한 변경 결정을 기록한다.')]:out+='<dt>'+e(label)+'</dt><dd>'+e(body)+'</dd>'
 out+='</dl><p class="muted small">비채점 회상·적용 연습</p>'
 for q,a in [
 ('“대시보드 화면 5개 출시”를 성과 목표로 써도 될까요?','출시한 화면 수는 산출물 지표입니다. 누가 어떤 결정을 더 잘 하거나 어떤 사용자 행동이 개선되는지, 기준값·기간·품질 조건을 함께 정의해 성과로 연결합니다. 화면 출시는 그 가설을 위한 한 대안일 수 있습니다.'),
 ('WSJF 점수가 높은 C가 필수 통제 로그 수정을 밀어내도 될까요?','이 사례에서 로그 수정은 반드시 해야 하는 제약입니다. 우선순위 점수는 제약을 면제하지 않습니다. 기준·권한·위험을 확인하고, 필수 작업 뒤 남은 대안을 비교합니다. C의 높은 점수 자체도 입력 근거와 현재 목표의 정합성을 검토합니다.'),
 ('가용량 12인일이니 A+B+필수 작업을 모두 넣어도 될까요?','4+6+4=14인일로 한도를 넘습니다. 일부 작업의 범위를 다시 나누거나 대안을 선택해야 합니다. 합계가 12 이하가 돼도 일정·역량·품질의 실현 가능성은 따로 검토합니다.'),
 ('A가 기대보다 약하면 목표 지표를 유리하게 바꾸면 될까요?','측정 오류를 고치는 근거 있는 정의 수정과 성공을 꾸미는 사후 변경을 구분합니다. 원래 가설·계획·결과·한계를 남기고, 문제 선택·해결안·다음 검증을 재검토합니다. 새 정의를 쓰면 전후 비교 가능성도 확인합니다.')]:out+='<details class="think-box strategy-reflection"><summary>'+e(q)+'</summary><p>'+e(a)+'</p></details>'
 out+='<aside class="notice">제품 전략·기회 탐색·목표 중심 로드맵의 서로 다른 저자 관점을 프로젝트 판단에 연결한 심화 자료입니다. PMI의 단일 공식 절차나 모든 조직의 역할 규정이 아닙니다. 목표 70%·오류 2%·작업량·담당·관측 사실은 학습용 가정이며 실제 회사 자료·예측·최적해를 뜻하지 않습니다.</aside><p class="evidence-links"><a class="text-link" href="pmp-lesson:n68">가설·검증 방법 →</a><a class="text-link" href="pmp-lesson:n69">편익·지표 →</a><a class="text-link" href="pmp-lesson:n47">사업성·기회비용 →</a><a class="text-link" href="pmp-lesson:n44">의존성과 일정 계산 →</a></p><details class="evidence-source-details"><summary>출처·시점·방법론의 적용 범위</summary><ul class="source-list">'
 for s in SOURCES:out+='<li><a href="'+e(s['url'])+'" target="_blank" rel="noopener">'+e(s['title'])+'</a><p>'+e(s['note'])+'</p></li>'
 return out+'</ul></details></section>'
