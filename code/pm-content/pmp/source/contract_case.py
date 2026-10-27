# -*- coding: utf-8 -*-
"""Fictional incentive formulas; fee bounds and total-price ceilings differ."""
from html import escape as e

SOURCES=[
 dict(id='contracts',title='PMI · Zuberi — Contract/Procurement Management',url='https://www.pmi.org/learning/library/2019/04/07/15/46/contract-procurement-management-9101',published='1987-08',checked='2026-10-27',kind='역사적 조달 개요 · PM Network1(3),41–44',note='Zuberi, August1987. 조달 환경·위험·계약 유형·선정·관리의 개요를2026-10-27 원문 확인. URL의2019년 경로를 발행일로 보지 않음. 현행 법규·오늘의 계약 전문이나 세부 한도 산식의 유일한 근거로 쓰지 않음.'),
 dict(id='far-cpif',title='Acquisition.gov · FAR16.405-1 Cost-plus-incentive-fee contracts',url='https://www.acquisition.gov/far/16.405-1',edition='표시 FAC2026-01',effective='2026-03-13',checked='2026-10-27',kind='미국 연방조달 규정의 특정 계약 구조',note='2026-10-27 공식 웹 조문(a)를 확인. 페이지 표시 FAC2026-01·효력일2026-03-13은 해당 페이지의 판본 표시이며 이 계약 유형의 최초 도입일이 아님. 목표 원가·목표 보수·최소/최대 보수와 정산 원가에 따른 조정 구조를 참고. 한국·민간 계약에 이 조문을 자동 적용하지 않음.'),
 dict(id='far-fpif',title='Acquisition.gov · FAR16.403-1 Fixed-price incentive (firm target) contracts',url='https://www.acquisition.gov/far/16.403-1',edition='표시 FAC2026-01',effective='2026-03-13',checked='2026-10-27',kind='미국 연방조달 규정의 특정 계약 구조',note='2026-10-27 공식 웹 조문(a)를 확인. 목표 원가·목표 이익·가격 상한과 이익 조정 구조, 다른 조항에 따른 상한 조정 예외를 참고. 아래 가상식은 그 예외를 제외하며 실제 지급청구권·자금 한도·계약 해석을 판정하지 않음.')]

DATA={'targetCost':100,'targetFee':10,'sellerShare':0.2,'buyerShare':0.8,'feeMin':4,'feeMax':14,'priceCeiling':120,'unit':'백만 원','costs':[60,90,100,112.5,120,140],'xDomain':[60,140],'yDomain':[60,150]}

def values(cost):
 raw=10+(100-cost)*0.2
 fee=max(4,min(14,raw))
 price=min(120,cost+raw)
 return {'cost':cost,'raw':round(raw,4),'fee':round(fee,4),'cpif':round(cost+fee,4),'fpif':round(price,4),'profit':round(price-cost,4)}

def num(x):return str(int(x)) if x==int(x) else str(x)

def chart():
 # Shared linear axes. Polyline breakpoints include every kink exactly.
 x=lambda c:70+(c-60)/80*600
 y=lambda p:315-(p-60)/90*245
 costs=[60,80,90,100,112.5,120,130,140]
 out='<svg class="contract-plot" viewBox="0 0 730 380" role="img" aria-label="가상 원가60~140백만 원에서 CPIF 지급은74에서144로 증가하고, FPIF 가격은78에서120으로 증가한 뒤 원가112.5부터120에 머뭅니다. 두 선은 같은 가로·세로 축을 사용합니다."><title>같은 원가에서 다른 지급 구조</title><desc>CPIF는 보수4~14를 제한합니다. FPIF는 총가격120을 제한합니다. 표에 정확한 수치가 있습니다.</desc>'
 for p in [60,90,120,150]:out+=f'<path class="plot-grid" d="M70 {y(p)}H670"/><text x="55" y="{y(p)+5}" text-anchor="end">{p}</text>'
 for c in [60,80,100,120,140]:out+=f'<path class="plot-grid" d="M{x(c)} 70V315"/><text x="{x(c)}" y="340" text-anchor="middle">{c}</text>'
 out+='<text x="70" y="30">구매자 지급액 · 백만 원</text><text x="670" y="370" text-anchor="end">정산 원가 C · 백만 원</text>'
 for key,cls in [('cpif','contract-cpif'),('fpif','contract-fpif')]:
  pts=' '.join(f'{x(c)},{y(values(c)[key])}' for c in costs)
  out+=f'<polyline class="{cls}" points="{pts}"/>'
 out+=f'<circle class="contract-kink" cx="{x(112.5)}" cy="{y(120)}" r="5"/><text x="{x(112.5)-10}" y="{y(120)-16}" text-anchor="end">가격 상한 도달 C112.5</text>'
 return out+'</svg>'

def render():
 out='<section class="contract-study"><span class="eyebrow">FEE LIMIT ≠ PRICE CEILING</span><h2>무엇의 상한인가요?<br>보수와 총가격을 나누어 읽어요.</h2><div class="notice"><b>서로 다른 두 가상 계약 · 모든 금액은 백만 원</b><p>목표 원가100, 목표 보수/이익10, 원가 차이의 구매자/판매자 몫80/20을 가정합니다. C는 CPIF에서는 정산 대상으로 인정된 허용 원가, FPIF에서는 최종 합의 원가를 나타냅니다. 같은 숫자의 C로 구조를 비교하는 것이며 원가 인정 절차까지 같다는 뜻은 아닙니다.</p><p>CPIF 보수는 최소4·최대14, FPIF 총가격 상한은120입니다. 범위 변경·상한 조정·세금·다른 인센티브·공제는 제외합니다. 필요한 자금 승인과 다른 이행 조건도 충족한 것으로 가정합니다. 실제 계약의 지급 가능액을 이 식만으로 결정하지 않습니다.</p></div><h3>조정 전 보수/이익을 먼저 구해요</h3><div class="contract-formula"><p>조정 전 값 = 10 + (100 − C) × 20%</p><p>절감이면 판매자 몫을 더하고, 초과면 뺍니다.<br>구매자/판매자80/20에서 식에 넣는 판매자 몫은20%입니다.</p></div><div class="contract-rules"><section><h4>CPIF · 보수에 한도 적용</h4><p>최종 보수 = 조정 전 값을4~14 안으로 제한<br>총 지급액 = C + 최종 보수</p><p>보수 상한14가 총 지급액 상한14나120을 뜻하지는 않습니다.</p></section><section><h4>FPIF · 총가격에 상한 적용</h4><p>상한 전 가격 = C + 조정 전 이익<br>최종 가격 = 상한 전 가격과120 중 작은 값<br>판매자 이익 = 최종 가격 − C</p><p>이 가상 FPIF에는 별도의 이익 하한·상한을 두지 않았습니다. 가격 상한 이후 원가가 더 늘면 이익이 줄고 손실이 날 수 있습니다.</p></section></div><h3>동일한 원가 축에서 지급액 비교</h3><p>초록 실선은 CPIF 총 지급액, 금색 점선은 FPIF 총가격입니다. 보수/이익 자체를 그린 선이 아닙니다. 두 선 모두 원가60~140, 지급액60~150의 같은 축입니다.</p><div class="contract-chart"><div class="contract-legend"><span><i class="legend-cpif"></i>CPIF · 총 지급액</span><span><i class="legend-fpif"></i>FPIF · 총가격</span></div>'+chart()+'</div><div class="contract-table-scroll"><table class="contract-values"><caption>위 가상식의 정확한 값 · 금액 단위: 백만 원</caption><thead><tr><th scope="col">원가 C</th><th scope="col">CPIF 보수</th><th scope="col">CPIF 지급액</th><th scope="col">FPIF 가격</th><th scope="col">FPIF 이익</th></tr></thead><tbody>'
 for c in DATA['costs']:
  v=values(c);out+='<tr data-contract-cost="'+num(c)+'"><th scope="row">'+num(c)+'</th>'+''.join('<td>'+num(v[k])+'</td>' for k in ['fee','cpif','fpif','profit'])+'</tr>'
 out+='</tbody></table></div><h3>한도에 닿은 뒤를 따라 계산해 봐요</h3><ol class="decision-steps"><li><b>C=60:</b> 조정 전 값은10+40×0.2=18입니다. CPIF는 보수 상한14를 적용해 지급74입니다. FPIF는 별도 이익 상한이 없고 총가격78이 가격 상한120보다 작아, 가격78·이익18입니다.</li><li><b>C=90:</b> 조정 전 값12가 CPIF 한도 안에 있고 FPIF도 가격 상한 전입니다. 두 지급액은 모두102입니다. 같은 한 점의 결과가 같다고 계약 구조가 같은 것은 아닙니다.</li><li><b>C=140:</b> 조정 전 값2입니다. CPIF는 최소 보수4를 적용해 지급144입니다. FPIF의 상한 전 가격은142지만 상한120을 적용하므로 판매자 이익은120−140=−20입니다.</li></ol><h3>가격 상한 도달과 손익분기는 다른 지점이에요</h3><div class="contract-points"><section><h4>가격 상한에 닿는 원가112.5</h4><p>C + 10 + (100−C)×0.2 = 120<br>0.8C + 30 = 120 → C=112.5</p><p>그때 FPIF 이익은120−112.5=7.5입니다. 아직 손실이 아닙니다.</p></section><section><h4>판매자 이익이0인 원가120</h4><p>상한 이후 가격120 고정 가정에서<br>이익 = 120−C</p><p>C=120이면 이익0, 더 큰 원가에서는 손실입니다. 이 손익분기 계산은 위 가상식의 범위 안에서만 성립합니다.</p></section></div><p>CPFF가 고정 보수10을 더하는 별도 조건이라면, 허용 원가90의 총 지급액은100, 원가140이면150입니다. 고정된 것은 보수이며 총 지급액은 아닙니다. 실제 원가보상은 허용 원가·자금 한도·통지 등 해당 조건을 함께 확인해야 합니다.</p><h3>계약 유형 이름 다음에 확인할 것</h3><ol class="decision-steps"><li>대상 범위·완료와 인수 조건, 원가 인정·검증 자료와 변경 권한을 확인합니다.</li><li>비율의 구매자/판매자 순서, 보수의 한도와 총가격의 한도, 다른 조항에 의한 조정 가능성을 나눠 읽습니다.</li><li>비용 절감과 함께 품질·일정·운영 인계가 유지되는지 봅니다. 낮은 비용 수치만으로 납품 수용을 확정하지 않습니다.</li><li>예상 초과·새 범위·계약 해석 이견이 생기면 합의한 통지·변경·검토 절차와 근거를 확인합니다. 이 예제를 실제 분쟁의 결론으로 적용하지 않습니다.</li></ol><h3>숫자와 가정을 함께 설명해 보기</h3><p class="small muted">비채점 창작 연습 · 기존 채점 문제의 수치·정답을 바꾸지 않습니다.</p>'
 for q,a in [
 ('CPIF의 최대 보수가14면 구매자 지급액도14 이내인가요?','아닙니다. 이 예제에서는 지급액=C+한도 적용 보수입니다. C60에서는 보수14·지급74, C140에서는 보수4·지급144입니다. 보수 범위와 총가격 상한은 다른 조건입니다.'),
 ('C90에서 두 유형 모두102니까 C140에서도 같을까요?','아닙니다. C140에서 CPIF는 보수 하한 적용 후144, FPIF는 총가격 상한 적용 후120입니다. 한 점의 지급액이 같아도 원가 변화에 따른 위험 배분은 다릅니다.'),
 ('112.5가 상한 도달 원가면 판매자 이익도0인가요?','그때 가격은120이고 원가는112.5라 이익7.5입니다. 이 가상식의 이익0 지점은 원가120입니다. 어떤 금액·지점을 계산했는지 이름을 붙여 설명합니다.'),
 ('가격 상한이 있으니 구매자가 새 기능을 무료로 요청할 수 있나요?','이 예제는 동일 범위와 상한 조정 없음의 계산입니다. 새 기능은 범위·수용·일정·원가·권한 영향을 확인하고 정해진 변경 경로로 다룹니다. 고정가나 상한이라는 이름만으로 추가 범위의 무상 이행을 단정하지 않습니다.')]:
  out+='<details class="think-box contract-reflection"><summary>'+e(q)+'</summary><p>'+e(a)+'</p></details>'
 out+='<nav class="evidence-links" aria-label="계약 계산과 연결된 수업"><a class="text-link" href="pmp-lesson:n62">선정·인수·변경 통제 →</a><a class="text-link" href="pmp-lesson:n48">예산과 자금 →</a><a class="text-link" href="pmp-lesson:n25">변경 결정 →</a><a class="text-link" href="pmp-lesson:n18">품질과 수용 →</a></nav><details class="evidence-source-details"><summary>출처·판본·적용 범위</summary><ul class="source-list">'
 for s in SOURCES:out+='<li><a href="'+e(s['url'])+'" target="_blank" rel="noopener">'+e(s['title'])+'</a><p>'+e(s['note'])+'</p></li>'
 return out+'</ul><p class="small muted">목표·비율·한도·원가·그래프·경계점·연습은 독립 창작입니다. FAR의 특정 구조를 비교 학습에 사용했으며 실제 계약·한국 조달·지급청구권·법률 판단을 대신하지 않습니다.</p></details></section>'
