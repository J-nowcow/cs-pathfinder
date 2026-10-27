# -*- coding: utf-8 -*-
"""Reproducible stats teaching supplement; no claim of production-grade inference."""
from pathlib import Path
from html import escape as e
from statistics import NormalDist
import math,json,hashlib,subprocess,sys
W=Path(__file__).parent
SOURCES=[
 dict(id='diff-prop-ci',title='NIST Dataplot · Difference of Proportions Confidence Interval',url='https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/diffprop.htm',published='2001-06-05',updated='2023-12-11',checked='2026-10-27',kind='통계 방법의 기술 문서',note='두 비율 차이의 Wald 근사식·피복률 한계와 조정 Wald 등 대안. 2001-06-05 공개·2023-12-11 최종 갱신, 2026-10-27 원문 확인. 표본·수치·해설은 자체 제작.'),
 dict(id='asa-p-values',title='ASA · Statement on Statistical Significance and P-Values',url='https://www.amstat.org/asa/files/pdfs/P-ValueStatement.pdf',published='2016-03-07',checked='2026-10-27',kind='통계 학회의 공식 성명 발표 자료',note='p값은 가설이 참일 확률이나 효과 크기가 아니며 임계값 하나로 사업·정책 결정을 하지 않는다는 원칙. 2016-03-07 발표, 2026-10-27 원문 확인.')
]

def cases():
 z=NormalDist().inv_cdf(.975);rows=[]
 for n in [100,1000,10000]:
  a,b=int(n*.60),int(n*.65);pa,pb=a/n,b/n;se=math.sqrt(pa*(1-pa)/n+pb*(1-pb)/n);delta=pb-pa
  rows.append(dict(n=n,a=a,b=b,delta=delta*100,se=se*100,low=(delta-z*se)*100,high=(delta+z*se)*100,z=z))
 return rows

def chart_input():return dict(rows=cases(),range=[-10,20],threshold=2,method='two-independent-proportion Wald normal approximation, two-sided 95 percent')
def signature():return hashlib.sha256(json.dumps(chart_input(),sort_keys=True).encode()).hexdigest()

def plot():
 import matplotlib
 matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 from io import StringIO
 plt.rcParams.update({'svg.fonttype':'none','font.family':'DejaVu Sans','font.size':16,'svg.hashsalt':'pmp-ci-2.3'})
 rows=cases();fig,ax=plt.subplots(figsize=(6,4.4));fig.patch.set_alpha(0);ax.patch.set_alpha(0)
 for i,r in enumerate(rows):ax.errorbar(r['delta'],2-i,xerr=[[r['delta']-r['low']],[r['high']-r['delta']]],fmt='o',color='#9de1bb',capsize=6,elinewidth=3,markersize=7)
 ax.axvline(0,color='#a2b2a9',ls='--',lw=1.5);ax.axvline(2,color='#e1c28f',ls=':',lw=1.8)
 ax.set_yticks([2,1,0],['n = 100','n = 1,000','n = 10,000']);ax.set_ylim(-.6,2.6);ax.set_xlim(-10,20);ax.set_xticks([-10,0,10,20]);ax.set_xlabel('B - A (%p)',color='#eef2e8',labelpad=12);ax.tick_params(colors='#eef2e8',length=0,pad=9)
 ax.grid(axis='x',color='#30423c',alpha=.7);ax.set_axisbelow(True)
 for spine in ax.spines.values():spine.set_visible(False)
 fig.tight_layout(pad=1.5);s=StringIO();fig.savefig(s,format='svg',transparent=True,metadata={'Date':None});plt.close(fig)
 svg=s.getvalue();svg=svg[svg.index('<svg'):];svg=svg.replace('<svg ','<svg class="uncertainty-plot" role="img" aria-label="각 집단 표본 100·1000·10000에서 같은 관측 차이 5%p의 근사 95% 신뢰구간. 0 기준선과 실무 기준 2%p를 비교합니다. 정확한 값은 아래 카드에 있습니다." ',1)
 for old,new in [('#9de1bb','var(--accent,#9de1bb)'),('#a2b2a9','var(--muted,#a2b2a9)'),('#e1c28f','var(--gold,#e1c28f)'),('#eef2e8','var(--ink,#eef2e8)'),('#30423c','var(--line,#30423c)')]:svg=svg.replace(old,new)
 svg=svg.replace('<style type="text/css">','<style type="text/css">.uncertainty-plot{background:var(--surface,#162321)}')
 svg=svg.replace('*{stroke-linejoin:', '.uncertainty-plot *{stroke-linejoin:')
 import re
 svg=re.sub(r'width="[0-9.]+pt" height="[0-9.]+pt"','',svg,count=1)
 (W/'uncertainty-plot.svg').write_text(svg);(W/'uncertainty-plot.json').write_text(json.dumps({'signature':signature(),'data':chart_input()},indent=2))

def ensure_plot():
 p=W/'uncertainty-plot.json'
 if p.exists() and json.loads(p.read_text()).get('signature')==signature() and (W/'uncertainty-plot.svg').exists():return
 try:plot()
 except ImportError:
  runtime=W/'plot-env/bin/python'
  if not runtime.exists():raise RuntimeError('Chart runtime missing. Install matplotlib in work/pmp-pathfinder-v2/plot-env; run uncertainty.py --plot before expand.py.')
  subprocess.run([str(runtime),str(Path(__file__).resolve()),'--plot'],check=True)

def render():
 ensure_plot();rows=cases()
 s='<section class="article-section uncertainty-study"><span class="eyebrow">SAMPLE → UNCERTAINTY → DECISION</span><h2>같은 5%p 차이인데, 결론도 같을까요?</h2><p class="uncertainty-lead">표본에서 본 차이는 추정값입니다. 비교 대상을 공정하게 구성했는지와 추정의 불확실성을 함께 봐야 합니다. 여기서는 수업68의 완료율 60%→65%를 유지한 세 가지 창작 표본으로 원리를 비교합니다.</p><div class="uncertainty-cards">'
 for title,body in [
  ('누구를 골랐나요?','모집·표집은 결과를 누구에게 일반화할지와 연결됩니다. 열성 사용자만 모집한 자료를 전체 사용자로 넓히면 선택 편향이 생길 수 있습니다. 큰 표본도 이런 편향을 자동으로 없애지는 않습니다.'),
  ('어떻게 나눴나요?','무작위 배정은 실험 안에서 A/B를 비교하는 설계입니다. 무작위 표집과 목적이 다릅니다. 팀 구성원이 서로 영향을 주면 개인 대신 팀 단위를 검토하는 등 배정 단위와 분석 단위를 맞춰야 합니다.'),
  ('무엇을 한 번 셌나요?','같은 사용자의 클릭 100건을 독립 사용자 100명처럼 세지 않습니다. 이 예제는 각 사용자의 7일 내 완료 여부를 한 번만 집계하고 집단 간 독립을 가정합니다. 실제 로그는 중복·누락·노출 상태도 확인합니다.')]:s+='<article><h3>'+e(title)+'</h3><p>'+e(body)+'</p></article>'
 s+='</div><h3>표본만 바꾸고, 관측률은 같게 둔 학습용 비교</h3><p>각 집단의 A 완료율=60%, B 완료율=65%, 차이 B−A=+5%p입니다. 아래는 서로 다른 세 가지 가상 연구입니다. 실제로 표본을 늘렸을 때 완료율이 그대로 유지된다는 예측이나 권장 표본 수가 아닙니다.</p><figure class="uncertainty-figure">'+(W/'uncertainty-plot.svg').read_text()+'<figcaption>가로선: 두 비율 차이의 근사 95% 신뢰구간 · 점: 관측 차이 +5%p<br>회색 파선: 차이 0 · 금색 점선: 사전에 정했다고 가정한 실무 기준 +2%p<br>모든 행은 같은 −10~+20%p 축을 사용합니다. n은 <b>집단당</b> 사용자 수입니다.</figcaption></figure><div class="uncertainty-values">'
 for r in rows:s+=f'<article data-ci-n="{r["n"]}"><h4>집단당 {r["n"]:,}명</h4><p>A {r["a"]:,}/{r["n"]:,}명 · B {r["b"]:,}/{r["n"]:,}명</p><strong>{r["low"]:+.2f} ~ {r["high"]:+.2f}%p</strong><p>'+('0도 포함합니다. 양의 효과가 확정됐다고 읽지 않습니다.' if r['low']<0 else '0보다는 높은 구간이지만, 실무 기준 2%p 아래도 포함합니다.' if r['low']<2 else '이 근사 구간 전체가 실무 기준 2%p보다 높습니다. 다른 조건도 검토합니다.')+'</p></article>'
 r=rows[1]
 s+='</div><details class="think-box"><summary>집단당 1,000명 예제를 직접 계산하기</summary><div class="ci-formula"><p>관측 비율 p̂A=600/1000=0.60, p̂B=650/1000=0.65</p><p>차이 d=p̂B−p̂A=0.05=5%p</p><p>SE=√[0.60×0.40/1000 + 0.65×0.35/1000]<br>≈ 0.02162 = 2.162%p</p><p>근사 95% 구간=d ± 1.95996×SE<br>≈ 0.05 ± 0.04238<br>≈ <b>+0.76 ~ +9.24%p</b></p></div></details><aside class="notice">계산법은 독립된 두 이항 비율의 <b>Wald 정규 근사</b>입니다. 고정한 표본·분석 계획, 집단 간 및 사용자 간 독립, 각 집단의 충분한 성공·실패 관측 등을 가정합니다. Wald 방식은 실제 피복률이 명목 95%보다 낮을 수 있고 희귀 사건·작은 표본·경계 비율에서 특히 주의가 필요합니다. NIST 문서는 조정 Wald 등 대안도 다룹니다. 반복 측정·군집·순차 실험에 이 식을 그대로 적용하지 않습니다.</aside><h3>해석을 세 번 나누면, 판단이 명확해져요.</h3><ol class="uncertainty-decisions"><li><b>방향과 불확실성:</b> 구간이 0을 포함하는지와 가능한 효과 범위를 봅니다. 0을 포함한다고 “차이가 없다”가 증명된 것은 아닙니다.</li><li><b>실무적으로 충분한가:</b> 집단당 1,000명 구간은 +0.76~+9.24%p입니다. 이 예제의 최소 실무 기준 +2%p를 확실히 넘겼다고 주장하기 어렵습니다. 2%p는 창작한 사업 판단 기준이며 보편 기준이 아닙니다.</li><li><b>출시 조건을 지켰는가:</b> 수업68에서는 오류 사용자율 3.5%가 사전 보류 기준 2%를 넘었습니다. 완료율의 긍정적 차이만으로 확대하지 않습니다. 자료 품질·위험·비용·운영 책임도 함께 봅니다.</li></ol><h3>95%와 p값을 이렇게 읽지 않아요.</h3><div class="uncertainty-cards">'
 for title,body in [
  ('95%의 의미','같은 절차를 같은 조건에서 반복해 구간을 만들 때, 유효한 모형과 방법 아래 그 절차의 구간이 고정된 참 차이를 포함하는 비율이 약 95%라는 뜻입니다. 이번에 계산한 특정 구간 안에 참값이 있을 확률이 95%라고 바로 읽는 빈도주의 해석은 아닙니다. 근사법의 피복률 한계도 남습니다.'),
  ('p값의 의미','정한 통계 모형·귀무가설 아래 관측만큼 또는 더 극단적인 통계량이 나올 확률을 말합니다. 가설이 참일 확률이나 개선 효과의 크기·경제적 중요도를 뜻하지 않습니다. 여기서는 p값을 계산하지 않습니다.'),
  ('표본 수와 검정력','표본 계획에는 검출하려는 효과, 오류 허용, 원하는 검정력, 기준 비율, 배정 단위와 이탈 등이 필요합니다. 검정력은 정한 대립 효과가 실제 있을 때 해당 검정이 귀무가설을 기각할 확률입니다. 표본이 크다는 말만으로 실험 계획을 대신하지 않습니다.')]:s+='<article><h4>'+e(title)+'</h4><p>'+e(body)+'</p></article>'
 s+='</div><details class="think-box ci-reflection"><summary>오답 진단 · 같은 사람의 요청을 10배로 늘리면 표본도 10배인가요?</summary><p>독립 사용자 수가 그대로라면 이 예제의 n은 늘지 않습니다. 반복 요청은 같은 사용자의 특성을 공유합니다. 사용자·세션·요청 중 어떤 단위를 추정하려는지 정하고, 반복·군집 상관에 맞는 분석이 필요합니다.</p></details><details class="think-box ci-reflection"><summary>결과가 좋아지는 날에만 실험을 끝내면 되나요?</summary><p>결과를 반복 확인해 유리할 때 끝내는 규칙에는 고정 표본 계획의 95% 해석을 그대로 보장할 수 없습니다. 사전에 종료·분석 규칙을 정하고 필요하면 적절한 순차 분석을 설계합니다. 유리한 지표·하위집단만 선택해 보고하지 않습니다.</p></details><details class="think-box ci-reflection"><summary>PM의 결정 기록에는 무엇을 남길까요?</summary><p>가설·배정 단위·대상과 기간·분모·관측 차이·추정 방법과 구간·자료 품질·가드레일·실무 기준을 남깁니다. 계속·수정·보류 중 선택한 이유, 책임자, 다음 검증과 계획 변경도 연결합니다. 표본을 늘리기 전에 실제 질문과 비용·편향의 원인을 확인합니다.</p></details><p class="evidence-links"><a class="text-link" href="pmp-lesson:n68">제품 발견·가드레일 사례 →</a><a class="text-link" href="pmp-lesson:n69">편익과 지표 →</a><a class="text-link" href="pmp-lesson:n73">AI 검증·표본 대표성 →</a></p><details class="evidence-source-details"><summary>출처·판본·계산의 한계</summary><ul class="source-list">'
 for a in SOURCES:s+='<li><a href="'+e(a['url'])+'" target="_blank" rel="noopener">'+e(a['title'])+'</a><p>'+e(a['note'])+'</p></li>'
 return s+'</ul><p>무작위화 단위는 Microsoft Research의 실험 설계 지침(수업68 출처)과 연결합니다. 이 심화 자료는 통계 기초의 독립 설명이며 공식 PMP 시험 출제 비중·기출 또는 실험 설계 전 과정을 대체하지 않습니다. 그래프·표본·실무 기준은 창작입니다.</p></details></section>'

if __name__=='__main__' and '--plot' in sys.argv:plot();print('Generated uncertainty chart',signature())
