# -*- coding: utf-8 -*-
"""Authored procurement cost boundary and sensitivity example, not market prices."""
from html import escape as e

SOURCE=dict(id='nz-tco',title='NZ Government Procurement · Total Cost of Ownership',url='https://www.procurement.govt.nz/assets/procurement-property/documents/guide-total-cost-ownership.pdf',published='2013-10',checked='2026-10-27',edition='표지·판권의 First Published October2013',kind='정부 조달의 역사적 실무 안내',note='MBIE, October2013. 원문 인쇄1~4쪽의 생애 비용·기간·반복/일회 비용·전환/처분 관점을2026-10-27 확인. 검색 결과의 최근 수집·게시 추정일을 발행일로 쓰지 않음. 원문의 냉장고·계약관리시스템 수치와 도표를 복제하지 않은 별도 창작 예제. 뉴질랜드 지침의 규정·회계 처리나 평가 방식을 한국 계약·모든 조직의 의무로 적용하지 않음.')
DATA={'years':3,'axisMax':200,'unit':'백만 원','categories':[
 {'id':'initial','label':'공급자 초기도입','x':40,'y':80},
 {'id':'integration','label':'구매자 연계·교육','x':20,'y':10},
 {'id':'running','label':'3년 운영·유지','x':90,'y':60},
 {'id':'exit','label':'종료·전환','x':30,'y':10}],
 'annual':{'x':30,'y':20},'totals':{'x':180,'y':160},'exitScenarios':[0,10,30,40]}

def render():
 out='<section class="tco-study"><span class="eyebrow">FROM QUOTE TO COST BOUNDARY</span><h2>견적 바깥의 비용을<br>같은 기간에 모아 봐요.</h2><div class="notice"><b>별도 가상 TCO 사례 · 공급안 X와 Y</b><p>앞의 가중 점수 예제 A/B와 다른 사례입니다. 아래 금액을 그 예제의 가격 점수로 환산하지 않습니다. 단위는 모두 백만 원이며, 같은 기능·사용량·서비스 수준으로3년을 비교한다고 가정합니다.</p><p>도입은1회, 운영·유지는 매년 같은 금액, 종료·전환은3년 끝에1회 발생합니다. 비용 항목은 서로 중복되지 않는 구매자 부담의 추가비용 추정입니다. 가격 변동·세금·할인·잔존가치와 별도 편익은 제외합니다. 실제 견적이나 특정 제품의 가격이 아닙니다.</p></div><h3>필수 조건·점수·비용은 서로 다른 판단이에요</h3><ol class="tco-gates"><li><h4>필수 조건과 증빙</h4><p>충족·미확인·불충족을 구분합니다. 아래 비용 계산은 양쪽이 필수 조건을 충족한다고 놓은 비교입니다.</p></li><li><h4>합의한 평가 기준</h4><p>가격·품질 점수의 척도·가중치·근거를 확인합니다. 좋은 점수가 미충족 필수 조건을 자동 상쇄하지는 않습니다.</p></li><li><h4>동일 경계의 비용과 위험</h4><p>기간·물량·포함 항목을 맞추고 비용 추정과 중요한 미확인 사항을 함께 판단합니다. TCO 최저만으로 전체 가치를 확정하지 않습니다.</p></li></ol><h3>3년 비용 경계를 펼쳐 보기</h3><div class="tco-table-scroll"><table class="tco-values"><caption>기준 시나리오 · 단위: 백만 원</caption><thead><tr><th scope="col">비용과 발생 방식</th><th scope="col">X</th><th scope="col">Y</th></tr></thead><tbody><tr><th scope="row">공급자 초기도입 · 1회</th><td>40</td><td>80</td></tr><tr><th scope="row">구매자 연계·교육 · 1회</th><td>20</td><td>10</td></tr><tr><th scope="row">운영·유지 · 매년 × 3년</th><td>30 × 3 = 90</td><td>20 × 3 = 60</td></tr><tr><th scope="row">종료·전환 · 3년 끝에1회</th><td>30</td><td>10</td></tr><tr class="tco-total"><th scope="row">미할인 합계</th><td>180</td><td>160</td></tr></tbody></table></div><p>초기도입만 보면 X40이 Y80보다 작습니다. 같은3년의 도입·연계·운영·전환을 더하면 X=40+20+90+30=180, Y=80+10+60+10=160입니다. 기준 가정에서는 Y의 합계가20 작습니다. 이것이 실제 추정의 정확성이나 공급자 선정을 입증하는 것은 아닙니다.</p><div class="tco-chart"><p class="small muted">모든 막대는0~200백만 원의 같은 축 · 누적 비용의 구성 비교</p><div class="tco-legend">'
 for cat in DATA['categories']:out+='<span><i class="tco-'+cat['id']+'"></i>'+e(cat['label'])+'</span>'
 out+='</div><div class="tco-axis" aria-hidden="true">'+''.join('<span style="left:'+str(v/2)+'%">'+str(v)+'</span>' for v in [0,50,100,150,200])+'</div>'
 for id,total in [('x',180),('y',160)]:
  desc=' · '.join(cat['label']+str(cat[id]) for cat in DATA['categories'])
  out+='<section class="tco-bar-row" data-tco-offer="'+id+'"><h4>'+id.upper()+' <b>합계 '+str(total)+'</b></h4><div class="tco-bar" role="img" aria-label="'+e(id.upper()+' '+desc+' · 합계'+str(total)+'백만 원')+'">'+''.join('<i class="tco-'+cat['id']+'" style="width:'+str(cat[id]/2)+'%"></i>' for cat in DATA['categories'])+'</div><p>'+e(desc)+'</p></section>'
 out+='</div><h3>전환 비용이 미확인이라면0으로 넣을까요?</h3><p>별도 민감도 분석에서는 X의 종료·전환 비용만 e로 바꾸고 다른 값은 그대로 둡니다. X=40+20+90+e=150+e, Y=160입니다. e가10이면 합계가 같고,10보다 작으면 X가,10보다 크면 Y가 비용상 유리합니다.</p><div class="tco-table-scroll"><table class="tco-sensitivity"><caption>X 전환 비용만 바꾼 가정 비교 · 실제 확률이나 관측값이 아닙니다</caption><thead><tr><th scope="col">X의 e</th><th scope="col">X 합계</th><th scope="col">Y 합계</th><th scope="col">비용만의 비교</th></tr></thead><tbody>'
 for v in DATA['exitScenarios']:
  result='X가10 작음' if v==0 else '같음' if v==10 else 'Y가'+str(v-10)+' 작음'
  out+='<tr data-exit-cost="'+str(v)+'"><th scope="row">'+str(v)+'</th><td>'+str(150+v)+'</td><td>160</td><td>'+result+'</td></tr>'
 out+='</tbody></table></div><aside class="concept-trap"><b>범위는 확률 분포가 아니에요</b><p>e가0~40일 수 있다고만 알면 X의 합계는150~190입니다. 이 범위에 확률이 없으므로 중간값을 기대비용이라고 부르거나 승리 확률을 계산하지 않습니다. 내보내기 요율·데이터 규모·전환 테스트·내부 인력·중단 시간을 확인해 범위와 근거를 좁힙니다. 기준 시나리오의 e30도 확인이 필요한 추정입니다.</p></aside><h3>“충족”과 “아직 모름”을 섞지 않아요</h3><div class="tco-statuses">'
 for title,body in [('충족','예를 들어 사전에 정한 데이터 내보내기 시험의 합의한 증거가 확인된 상태입니다. 어떤 버전·범위·기준의 시험인지 남깁니다.'),('미확인','시험 결과가 없거나 견적 포함 여부가 불명확한 상태입니다. 곧바로 통과·실패·비용0으로 바꾸지 않습니다. 사전에 정한 질의·보완·검증 절차와 시점을 확인합니다.'),('불충족','정한 필수 조건에 실패한 상태입니다. 이 가상 평가 계획에서 해당 실패는 점수 평가 대상 제외 조건이라고 가정합니다. 높은 품질 점수나 낮은 TCO로 덮지 않습니다.')]:
  out+='<section><h4>'+e(title)+'</h4><p>'+e(body)+'</p></section>'
 out+='</div><p>실제 평가의 제외·보완·협상 가능성은 적용되는 규정과 사전 공지된 기준을 확인합니다. 평가 결과를 본 뒤 원하는 공급자가 이기도록 가중치나 필수 조건을 바꾸는 방식으로 사용하지 않습니다.</p><h3>평가 결과를 계약·운영으로 연결하기</h3><ol class="decision-steps"><li>동일 범위·기간·물량·가격 기준인지 확인하고, 견적의 포함/제외와 구매자 내부 비용을 나눠 봅니다. 이미 포함된 교육·유지비를 다시 더하지 않습니다.</li><li>종료·전환의 범위와 단가·지원 시간·자료 형식, 서비스 수준과 인수 증거를 확인합니다. 필수 조건의 검증 책임·방법도 정합니다.</li><li>평가 근거·미확인 비용·민감한 가정을 결정권자에게 제시합니다. 현금 조달 가능성과 시간 가치를 검토할 필요가 있으면 이 미할인 합계와 별도 분석합니다.</li><li>선정 후 약속한 서비스·인수·변경·운영/전환 책임을 계약과 실행 기록에서 확인하고 실제 비용을 추정과 비교합니다. 표의 추정 합계가 자동 지불 승인이나 지급 일정이 되지는 않습니다.</li></ol><h3>같은 식을 다른 질문에 쓰지 않기</h3><p class="small muted">비채점 창작 연습 · 앞의 가중 점수 문제와 별개입니다.</p>'
 for q,a in [
 ('가격 점수70은 가격이70백만 원이라는 뜻인가요?','아닙니다. 앞의 A/B 문제는 정해진 점수 척도의 값입니다. 점수를 금액으로 환산하는 함수가 주어지지 않았으므로 실제 견적·TCO·현금 수요를 역산할 수 없습니다. X/Y 예제의 금액과 섞지 않습니다.'),
 ('기준 시나리오에서 Y가20 작으면 지금 Y를 확정할까요?','그것은 같은3년·같은 조건의 가상 비용 합계 비교입니다. 필수 조건·품질·역량·위험·근거와 결정 권한도 확인합니다. 특히 전환 비용 같은 미확인 가정에 따라 비용 순위도 바뀔 수 있습니다.'),
 ('X의 전환 비용 자료가 없으면0~40의 중간20을 기대비용으로 써도 될까요?','자료가 부족한 범위에 동일 확률을 임의로 부여하지 않습니다.20은 별도 가정의 시나리오로 쓸 수 있지만, 검증된 기대값이라고 부르지 않습니다. 기준·범위·민감도와 무엇을 추가 확인할지 기록합니다.'),
 ('3년 합계160은 첫날 확보해야 할 현금160과 같을까요?','아닙니다. 합계와 시점별 자금 요구는 다른 질문입니다. 이 예제는 도입1회·연간 운영3회·종료1회의 비용을 모은 미할인 값입니다. 실제 지급 조건·현금 시점·할인·불확실성은 별도로 정리합니다.')]:
  out+='<details class="think-box tco-reflection"><summary>'+e(q)+'</summary><p>'+e(a)+'</p></details>'
 out+='<nav class="evidence-links" aria-label="구매 판단과 연결된 수업"><a class="text-link" href="pmp-lesson:n47">현재가치와 사업성 →</a><a class="text-link" href="pmp-lesson:n48">예산과 자금 →</a><a class="text-link" href="pmp-lesson:n61">계약 유형과 한도 →</a><a class="text-link" href="pmp-lesson:n41">요구와 검증 증거 →</a></nav><details class="evidence-source-details"><summary>출처·판본·적용 범위</summary><ul class="source-list"><li><a href="'+e(SOURCE['url'])+'" target="_blank" rel="noopener">'+e(SOURCE['title'])+'</a><p>'+e(SOURCE['note'])+'</p></li></ul><p class="small muted">X/Y·금액·3년 경계·비용 구성·민감도·필수 조건 예시·연습은 독립 제작입니다. 실제 공급자·가격·평가 결과·전환 비용의 분포나 특정 조달 규정의 적용 결론이 아닙니다.</p></details></section>'
 return out
