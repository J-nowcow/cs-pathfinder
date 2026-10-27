# -*- coding: utf-8 -*-
"""Fixed, independently checked EVM example; chart scales do not vary by row."""
from html import escape as e

SOURCES=[
 dict(id='forecast',title='PMI · Budd & Budd — Earned value: the good, the bad, and the ugly',url='https://www.pmi.org/learning/library/earned-value-controlling-forecasting-performance-7653',published='2003-09-25',checked='2026-10-27',kind='역사적 기술 논문 · PMI Global Congress 2003',note='Budd & Budd, 2003-09-25. Earned Value Defined의 CPI·SPI·ETC·EAC·TCPI 관계를2026-10-27 원문 확인. 최신 시험 정책 근거가 아니며 본문의 수치·그림·질문은 독립 창작.'),
 dict(id='tcpi',title='PMI · Scott — TCPI: the tower of power',url='https://www.pmi.org/learning/library/2019/04/07/15/23/to-complete-performance-index-tcpi-6009',published='2012-10-23',checked='2026-10-27',kind='역사적 기술 논문 · PMI Global Congress 2012',note='Scott, 2012-10-23. 남은 작업 가치/가용 자금, BAC·EAC 목표의 TCPI 및 잔여 위험·자원 등에 따른 달성 가능성 판단을2026-10-27 원문 확인. URL의2019년 경로를 발행일로 쓰지 않음. 기술 개념의 참고이며 당시 시험 언급을 현행 정책으로 적용하지 않음.')]
DATA={'bac':100,'pv':50,'ev':40,'ac':50,'unit':'백만 원','axisMax':160,'forecasts':[
 {'id':'plan','label':'남은 작업은 원래 효율','formula':'AC + (BAC − EV)','etc':60,'eac':110,'vac':-10,'assumption':'과거 편차는 반복되지 않고 남은 작업은 예산 가치60을 비용60으로 수행한다는 가정입니다.'},
 {'id':'cost','label':'현재 원가 효율 지속','formula':'AC + (BAC − EV) / CPI = BAC / CPI','etc':75,'eac':125,'vac':-25,'assumption':'남은 작업도 현재 CPI=0.8의 원가 효율로 수행한다는 가정입니다.'},
 {'id':'both','label':'원가·일정 복합 효율','formula':'AC + (BAC − EV) / (CPI × SPI)','etc':93.75,'eac':143.75,'vac':-43.75,'assumption':'남은 비용에 CPI×SPI=0.64를 적용하는 모형입니다. 일정 지연이 원가에 영향을 준다는 가정을 검토해야 하며, 지연이면 항상 이 식을 쓰는 것은 아닙니다.'}
]}

def render():
 out='<section class="forecast-study"><span class="eyebrow">SAME ACTUALS / DIFFERENT ASSUMPTIONS</span><h2>이미 쓴 돈은 같아요.<br>달라지는 것은 남은 일의 가정.</h2><div class="notice"><b>기존 풀이 예제와 같은 가상 수치</b><p>BAC=100, PV=50, EV=40, AC=50. 금액 단위는 모두 백만 원이며 CPI=SPI=0.8입니다. 동일 범위·동일 기준일·동일 기준선의 집계로 가정합니다. 아래 숫자는 세 프로젝트의 관측 결과가 아니라 같은 실적에서 비교한 세 예측입니다.</p></div>'
 out+='<h3>남은 일의 가치60 ≠ 남은 예산50</h3><div class="forecast-pair">'
 for title,left,right,a,b in [('작업의 예산 가치','완료한 일 EV','남은 일 BAC−EV',40,60),('원 BAC 목표의 비용 한도','이미 쓴 비용 AC','남은 비용 한도 BAC−AC',50,50)]:
  out+='<section><h4>'+title+'</h4><div class="forecast-value-bar" role="img" aria-label="'+e(f'{left} {a}, {right} {b}, 합계100백만 원')+'"><span style="width:'+str(a)+'%">'+str(a)+'</span><i style="width:'+str(b)+'%">'+str(b)+'</i></div><p>'+e(left)+' <b>'+str(a)+'</b><br>'+e(right)+' <b>'+str(b)+'</b></p></section>'
 out+='</div><p>EV와 BAC−EV는 작업을 예산 단가로 평가한 가치입니다. AC와 BAC−AC는 원 BAC 목표를 기준으로 이미 쓴 돈과 남은 돈입니다. 남은 작업의 예산 가치60을 미래 실제 원가라고 자동 취급하면 효율 가정을 숨기게 됩니다. 여기서 남은 예산은 목표−AC로 계산한 비용 한도이며, 실제 현금 잔액·자금 공급 일정과는 별개입니다.</p><h3>가정을 바꾸면, 남은 비용과 총비용도 달라져요</h3><p>아래 세 막대는 모두 0~160백만 원의 같은 축입니다. 실선 구간은 이미 발생한 AC=50, 줄무늬 구간은 예측 ETC입니다. 세로 점선은 원 BAC=100입니다.</p><div class="forecast-chart"><div class="forecast-axis" aria-hidden="true">'+''.join('<span style="left:'+str(x/160*100)+'%">'+str(x)+'</span>' for x in [0,40,80,120,160])+'</div>'
 for row in DATA['forecasts']:
  out+='<section class="forecast-row" data-forecast="'+row['id']+'"><h4>'+e(row['label'])+'<b>EAC '+str(row['eac'])+'</b></h4><div class="forecast-stack" role="img" aria-label="'+e(f"{row['label']}: AC50 + ETC{row['etc']} = EAC{row['eac']}백만 원. 원 BAC100")+'"><span class="forecast-actual" style="width:31.25%"></span><span class="forecast-remaining" style="width:'+str(row['etc']/160*100)+'%"></span><i class="forecast-bac"></i></div><p class="forecast-values">AC 50 + ETC '+str(row['etc'])+' = EAC '+str(row['eac'])+' · VAC '+str(row['vac'])+'</p><p class="forecast-formula">'+e(row['formula'])+'</p><p>'+e(row['assumption'])+'</p></section>'
 out+='</div><aside class="concept-trap"><b>이미 쓴 비용까지 다시 나누지 않기</b><p>복합 효율 예측은 50+60/0.64=143.75입니다. BAC/(CPI×SPI)=100/0.64=156.25로 바꾸면 과거 비용까지 다시 조정해 이 모형과 달라집니다. 원가 효율만 지속할 때 AC+(BAC−EV)/CPI와 BAC/CPI가 같은 것은 CPI=EV/AC 관계에 따른 항등식이며, 이를 복합 모형에 그대로 옮길 수는 없습니다.</p></aside><h3>TCPI는 예측이 아니라 “목표에 필요한 효율”</h3><div class="forecast-tcpi">'
 for title,formula,meaning in [('원 BAC100 목표','(100−40)/(100−50) = 1.2','남은 예산50으로 예산 가치60의 일을 해야 합니다. 현재 누적 CPI0.8보다 높은 효율이 필요하지만, 이 비율이 달성 가능성을 증명하지는 않습니다.'),('EAC125를 목표로 검토','(100−40)/(125−50) = 0.8','남은 자금75로 같은 예산 가치60의 일을 한다는 뜻입니다. 현재 효율 지속 EAC125에서 역산했으므로 같은0.8이 나오는 것은 독립된 예측 검증이 아닙니다.')]:
  out+='<section><h4>'+e(title)+'</h4><p class="forecast-formula">'+e(formula)+'</p><p>'+e(meaning)+'</p></section>'
 out+='</div><p>예측 EAC를 계산하는 일과 추가 예산·자금·기준선 변경을 승인하는 일은 다릅니다. 남은 작업의 성격·자료·자원·위험·일정을 검토하고 조직의 결정 권한을 따릅니다. 새 상향식 잔여 추정이 더 타당하면 EAC=AC+새 ETC로 설명할 수 있습니다.</p><h3>분모가 사라지면 “좋은 효율”을 표시하지 않아요</h3><p>별도 가정으로 BAC100·EV80·AC100이면 남은 작업 가치는20인데 BAC−AC=0입니다. BAC 목표 TCPI는 20/0이라 정의되지 않습니다. AC110이면20/(−10)=−2라는 산술값이 나오지만, 음수 가용 예산을 정상 필요 효율로 해석하지 않습니다. 원 목표를 유지할 수 있는지와 잔여 추정·대안을 재검토할 신호입니다. 이 설명은 양수 비용이 드는 잔여 작업을 가정하며, 환급·범위 변경 등 다른 조건은 별도로 검토합니다.</p><h3>식을 가리고 먼저 말해 보기</h3><p class="small muted">비채점 적용 연습 · 원래 수업의 채점 문항은 그대로 유지합니다.</p>'
 for q,a in [
 ('왜 남은 작업60이 곧 앞으로 쓸 돈60은 아닌가요?','60은 BAC−EV로 계산한 잔여 작업의 예산 가치입니다. ETC60은 미래 효율1.0을 가정한 비용이고, 효율0.8을 가정하면 ETC75입니다. 두 단위가 모두 금액이어도 측정 대상과 의미가 다릅니다.'),
 ('세 EAC 중 가장 큰143.75를 고르면 항상 안전한가요?','값의 크기만으로 모형의 타당성을 정하지 않습니다. 원가·일정 효율이 잔여 비용에 함께 영향을 미치는지, 남은 작업이 과거와 비슷한지 등을 확인합니다. 더 큰 점예측도 신뢰구간이나 납기·비용 초과 확률을 뜻하지 않습니다.'),
 ('TCPI0.8이 CPI0.8과 같으니 EAC125를 입증했나요?','아닙니다. 현재 효율을 지속한다고 계산한 EAC를 같은 관계식에 다시 넣은 결과입니다. 잔여 작업 추정과 실제 자료로 가정을 평가해야 합니다.'),
 ('총비용 목표가 바뀌면 TCPI의 분자도 EAC−EV로 바꾸나요?','이 예제의 동일 범위·기준선에서는 잔여 작업의 예산 가치는 BAC−EV=60으로 유지합니다. 목표 비용에 따라 바뀌는 것은 분모의 목표−AC입니다. 범위·기준선 자체가 승인 변경되면 새 정의와 자료를 일관되게 다시 확인합니다.')]:
  out+='<details class="think-box forecast-reflection"><summary>'+e(q)+'</summary><p>'+e(a)+'</p></details>'
 out+='<nav class="evidence-links" aria-label="예측과 연결된 수업"><a class="text-link" href="pmp-lesson:n35">CPI·SPI 기초 →</a><a class="text-link" href="pmp-lesson:n48">예산·예비비·자금 →</a><a class="text-link" href="pmp-lesson:n60">평균과 불확실성 →</a></nav><details class="evidence-source-details"><summary>출처·발행일·적용 범위</summary><ul class="source-list">'
 for s in SOURCES:out+='<li><a href="'+e(s['url'])+'" target="_blank" rel="noopener">'+e(s['title'])+'</a><p>'+e(s['note'])+'</p></li>'
 return out+'</ul><p class="small muted">그림·수치·추론·연습은 독립 제작입니다. 공식 원문의 그림과 사례를 복제하지 않았습니다. 확률 모형·실제 비용 자료·최신 시험 출제 비중을 제공하는 사례가 아닙니다.</p></details></section>'
