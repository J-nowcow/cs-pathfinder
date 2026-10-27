# -*- coding: utf-8 -*-
"""Exact discrete scenarios for dependence, deadline forecasts and response lead time."""
from html import escape as e
from fractions import Fraction
SOURCES=[
 dict(id='gao-schedule-risk',title='U.S. GAO · Schedule Assessment Guide',url='https://www.gao.gov/products/gao-16-89g',paper_url='https://www.gao.gov/assets/d1689G.pdf',edition='GAO-16-89G / December 2015',published='2015-12-22',checked='2026-10-27',kind='일정 평가 지침 · Best Practice8',note='인쇄 쪽 115–117의 상관관계·위험 동인·일정 여유 설명을 확인. 공통 원인이 여러 활동에 미치는 영향을 모델링하는 관점 참고.2015-12-22 발행,2026-10-27 원문 확인. 원문 건설 사례·그림을 복제하지 않은 별도 이산 확률 예제이며 특정 P80을 모든 프로젝트의 의무 기준으로 삼지 않음.'),
 dict(id='nasa-risk-triggers',title='NASA SE Handbook · 6.4 Technical Risk Management',url='https://www.nasa.gov/reference/6-4-technical-risk-management/',edition='SE Handbook §6.4.1.2.4–7',page_updated='2023-07-26',checked='2026-10-27',kind='NASA 기술 위험관리의 대응·감시 지침',note='대응 실행 한도·관련자·감시 주기·효과 및 잔여 위험·기록을 참고. 웹 절 갱신 2023-07-26,2026-10-27 원문 확인. 기존 SE Handbook 절이며 최신 NASA 전체 위험관리 지침이라고 소개하지 않음. 아래 실행 시점·기간·예산 한도는 창작 가정.')
]
DATA={
 'base_days':10,'delay_days':3,'deadline_days':13,'percentile':80,
 'states':[[0,0],[1,0],[0,1],[1,1]],
 'models':[{'id':'independent','title':'지연이 서로 독립인 모형','weights':[49,21,21,9]},{'id':'common','title':'공통 원인으로 함께 지연되는 모형','weights':[70,0,0,30]}],
 'response':{'target_day':13,'prepare_days':3,'verify_days':2,'early_check_day':6,'late_signal_day':11,'cost':40,'owner_limit':20}
}
def distribution(model,d=DATA):
 result={day:Fraction(0) for day in [d['base_days'],d['base_days']+d['delay_days'],d['base_days']+2*d['delay_days']]}
 for state,weight in zip(d['states'],model['weights']):result[d['base_days']+d['delay_days']*sum(state)]+=Fraction(weight,100)
 return result

def summary(model,d=DATA):
 dist=distribution(model,d);mean=sum(day*p for day,p in dist.items());cum=Fraction(0);q=None
 for day,p in sorted(dist.items()):
  cum+=p
  if q is None and cum>=Fraction(d['percentile'],100):q=day
 return dict(mean_days=float(mean),on_time_percent=float(sum(p for day,p in dist.items() if day<=d['deadline_days'])*100),p80_days=q)

def render():
 d=DATA
 out='<section class="article-section dependence-study"><span class="eyebrow">DEPENDENCE → DISTRIBUTION → TIMELY RESPONSE</span><h2>같은 평균이어도, 약속한 날짜의 확률은 달라져요.</h2><p>서로 겹치지 않는 순차 작업 A·B의 기본 합계가 10일인 가상 일정입니다. 각 작업은 30% 확률로 3일씩 늘어난다고 가정합니다. 작업별 확률이 같아도, 둘이 함께 늘어나는 방식이 다르면 전체 종료 분포가 달라집니다.</p><aside class="notice"><b>같은 대기를 두 번 더하지 않아요.</b><p>여기서는 공통 설계 문제가 A와 B 각각에 별도의 3일 재작업을 만든다고 가정합니다. 한 번의 3일 공통 대기를 6일로 중복 계산한 것이 아닙니다. 병렬 작업·자원·달력·다른 불확실성은 생략했습니다.</p></aside><div class="dependence-models">'
 for model in d['models']:
  s=summary(model);dist=distribution(model)
  out+=f'<article data-risk-model="{model["id"]}"><h3>{e(model["title"])}</h3><p class="small muted">'+('A의 지연 여부가 B의 지연 확률을 바꾸지 않는다고 가정합니다.' if model['id']=='independent' else '30% 확률로 두 작업이 각각 3일 늘어나고,70% 확률로 둘 다 늘어나지 않습니다. 완전한 동반 지연이라는 극단적 가정입니다.')+'</p><figure class="dependence-chart"><figcaption>정확히 그날 완료될 확률 · 두 그림 모두 0–100%</figcaption><div class="dependence-axis" aria-hidden="true"><span>0</span><span>50</span><span>100%</span></div>'
  for day,p in dist.items():out+=f'<div class="dependence-row" data-risk-day="{day}"><span>{day}일</span><div class="dependence-track" aria-hidden="true"><i style="width:{float(p*100):g}%"></i></div><b>{float(p*100):g}%</b></div>'
  out+=f'</figure><dl class="dependence-summary"><div><dt>평균 종료</dt><dd data-risk-stat="mean">{s["mean_days"]:g}일</dd></div><div><dt>13일 이내 완료</dt><dd data-risk-stat="ontime">{s["on_time_percent"]:g}%</dd></div><div><dt>이 모형의 P80</dt><dd data-risk-stat="p80">{s["p80_days"]}일</dd></div></dl></article>'
 out+='</div><p>두 모형의 평균은 모두 11.8일입니다. 하지만 13일 이내 완료할 확률은 91%와 70%로 달라집니다. 평균 11.8일은 이 예제의 실제 가능한 종료일 10·13·16일 중 하나도 아니에요. 평균 하나를 약속 날짜나 납기 확률로 바꿔 읽으면 안 됩니다.</p><p class="small muted">P80은 이산 분포에서 누적확률이 처음 80% 이상이 되는 가장 이른 날로 정의했습니다. 그래서 독립 모형은 누적 91%인 13일, 공통 원인 모형은 누적 100%인 16일입니다. 정확히 80%가 그날 끝난다는 뜻이나 실무 납기 보장이 아닙니다.</p>'
 out+='<details class="think-box dependence-math"><summary>네 가지 경우로 직접 계산하기</summary><div class="dependence-table-wrap" tabindex="0" aria-label="가상 결합확률 표"><table class="dependence-table"><thead><tr><th scope="col">A 지연</th><th scope="col">B 지연</th><th scope="col">독립</th><th scope="col">공통 원인</th></tr></thead><tbody>'
 for i,state in enumerate(d['states']):out+='<tr>'+''.join('<td>'+('있음' if bit else '없음')+'</td>' for bit in state)+f'<td>{d["models"][0]["weights"][i]}%</td><td>{d["models"][1]["weights"][i]}%</td></tr>'
 out+='</tbody></table></div><p>독립 모형의 동시 지연은 0.3×0.3=0.09입니다. 공통 원인 모형은 동시 지연 자체를 0.30으로 가정합니다. 각 모형의 네 확률 합은 100%이고, A와 B 각각의 주변 지연 확률은 모두 30%입니다.</p><div class="formula">총 기간 D = 10 + 3×A지연지시자 + 3×B지연지시자<br>평균 = 10 + 3×0.3 + 3×0.3 = 11.8일<br>13일 이내 확률 = 1 − 두 작업이 함께 지연될 확률<br>독립:1 − 0.09 = 0.91 / 공통 원인:1 − 0.30 = 0.70</div><p>기대값의 합은 이처럼 같은 주변 확률에서 독립 여부와 관계없이 같습니다. 독립 가정이 필요한 것은 두 지연 확률을 곱해 결합확률을 구하는 부분입니다. 공통 원인 모형에 0.3×0.3을 적용하지 않습니다.</p></details>'
 out+='<h3>상관이 있으면 모든 날짜의 확률이 나빠질까요?</h3><p>그렇게 일반화하지 않습니다. 이 예제에서 10일 이내 완료 확률은 독립 49%, 공통 원인 70%입니다. 반면 13일 이내 확률은 독립이 더 높습니다. 함께 잘되거나 함께 늦어지는 분포를 어떤 목표 날짜에서 읽는지에 따라 답이 달라집니다. 실제 데이터 없이 독립이나 완전한 동반 지연을 확정하지 마세요.</p><p class="small muted">이 수치는 창작 결합확률의 모든 경우를 정확히 합산한 결과입니다. 무작위 표본을 뽑은 몬테카를로 시뮬레이션 결과가 아닙니다. 실제 모형에는 지연 원인·의존 관계·자료 품질·자원·재작업·범위 변경과 가정을 검토해야 합니다.</p>'
 out+='<h3>실행 신호는 “얼마나 늦었나”만 보면 부족해요.</h3><div class="dependence-response"><p><b>별도의 가상 대응 일정</b> · 목표는시점 13일, 입력의 원래 약속은시점 8일이며, 그 입력 없이 별도 자료로 준비할 대안은 준비 3일과 그 뒤 검증 2일이 순차로 필요합니다. 시점 0부터 센 연속 시간이며 휴일·승인 대기·자원 충돌은 없다고 단순화합니다. 위 두 모형의 확률을 이 대안에 그대로 적용하지 않습니다.</p><div class="dependence-deadline"><b>13 − (3 + 2) = 8</b><span>가정상 늦어도 시점 8일에 착수해야 목표 13일에 맞출 수 있어요.</span></div><ol>'
 for title,body in [
 ('앞선 확인 시점 정하기','시점 6일에 필요한 입력·인력·대안 준비 가능 여부를 확인합니다. 아직 확정되지 않았다면 시점 8일을 넘기기 전에 필요한 선택과 승인을 요청합니다.6일은 이 예제의 관찰 시점이지 보편 규칙이 아닙니다.'),
 ('뒤늦은 신호와 비교하기','시점 11일의 “이미 3일 지연”만 실행 신호로 두면,5일짜리 대안의 가정상 종료는 16일입니다. 목표 13일을 지키는 근거가 되지 않습니다. 필요한 대응 시간과 결정 시간을 앞당겨 설계합니다.'),
 ('실행 권한과 예산 연결하기','대안 비용 40, 담당자의 승인 한도 20이라는 창작 조건이면 담당자 혼자 집행할 수 없습니다. 신호가 나타났다고 승인권이 생기지는 않습니다. 한도 밖 결정과 자원 확보를 정한 권한자에게 연결합니다.'),
 ('이슈·잔여 위험·효과 확인하기','입력이 이미 늦었다면 이슈의 조치·책임·기한을 추적합니다. 대안 자체의 검증 실패·인계 지연 같은 2차 위험과 남은 납기 위험을 살피고, 실행 결과가 효과를 냈는지 확인합니다.')]:out+='<li><b>'+e(title)+'</b><p>'+e(body)+'</p></li>'
 out+='</ol></div><h3>직접 설명해 보기</h3><p class="small muted">비채점 적용 연습 · 기존 채점 문제와 별개입니다.</p>'
 for q,a in [
 ('작업별 지연 확률이 30%씩이면 동시 지연은 언제 9%인가요?','이 예제처럼 두 지연이 독립이라고 가정할 때 0.3×0.3=9%입니다. 공통 원인으로 함께 발생하는 모형에서는 30%라고 별도 정의했습니다. 주변 확률만으로 결합확률이 정해지지 않습니다.'),
 ('평균이 같으니 대응도 같게 해도 될까요?','납기 날짜의 누적확률·꼬리 결과·실제 영향·대응 비용·권한을 함께 봅니다. 이 예제는 13일 내 확률이 91%와 70%로 다릅니다. 어떤 수준을 받아들일지는 별도의 프로젝트 기준이지 이 수업이 정하는 합격선이 아닙니다.'),
 ('시점 8일을 아직 안 넘겼으니 승인 대기는 상관없나요?','8일은 승인 대기가 없다는 단순 가정의 마지막 착수 시점입니다. 실제 승인·계약·환경 준비에 시간이 들면 그 시간도 포함해 더 일찍 결정을 시작해야 합니다. 산술상의 여유와 실행 가능성을 구분합니다.'),
 ('보험이나 다른 공급자를 정하면 위 확률은 자동으로 줄어들까요?','대안의 작동 조건·가용 자원·리드타임·검증·계약 범위를 확인해야 합니다. 금전 손실 전가와 일정 회복은 다릅니다. 대체 공급자도 같은 공통 원인에 노출될 수 있으므로 잔여·새 위험과 전체 모형을 다시 검토합니다.')]:out+='<details class="think-box dependence-reflection"><summary>'+e(q)+'</summary><p>'+e(a)+'</p></details>'
 out+='<p class="evidence-links"><a class="text-link" href="pmp-lesson:n59">위험 대응과 실행 신호 →</a><a class="text-link" href="pmp-lesson:n26">이미 발생한 이슈 →</a><a class="text-link" href="pmp-lesson:n46">일정 단축과 재작업 →</a></p><details class="evidence-source-details"><summary>출처·판본·수치의 가정</summary><ul class="source-list">'
 for s in SOURCES:
  out+='<li><a href="'+e(s['url'])+'" target="_blank" rel="noopener">'+e(s['title'])+'</a><p>'+e(s['note'])+'</p>'
  if s.get('paper_url'):out+='<a href="'+e(s['paper_url'])+'" target="_blank" rel="noopener">검토한 공식 PDF</a>'
  out+='</li>'
 return out+'</ul><p class="small muted">두 결합확률·기간·기한·P80 비교·대안 리드타임·비용과 해설은 창작입니다. 실제 납기 확률·최적 대응·조직 승인 기준을 추정하거나 보장하지 않습니다.</p></details></section>'
