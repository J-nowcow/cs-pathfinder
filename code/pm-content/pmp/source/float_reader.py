# -*- coding: utf-8 -*-
"""Static no-JS counterpart to the authored CPM experiment."""
from html import escape as e

def calculate(f,d):
 rows={};succ={id:[] for id in f['order']}
 for id in f['order']:
  for p in f['predecessors'][id]:succ[p].append(id)
  es=max([0]+[rows[p]['ef'] for p in f['predecessors'][id]])
  rows[id]={'es':es,'ef':es+d[id]}
 total=max(r['ef'] for r in rows.values())
 for id in reversed(f['order']):
  r=rows[id];r['lf']=min([rows[n]['ls'] for n in succ[id]] or [total]);r['ls']=r['lf']-d[id]
  r['tf']=r['ls']-r['es'];r['ff']=min([rows[n]['es'] for n in succ[id]] or [total])-r['ef']
 return rows,total

def render(C):
 f=C['floatLab'];d=f['defaults'];rows,total=calculate(f,d)
 pos={'A':(180,30),'B':(65,140),'C':(295,115),'E':(295,215),'D':(180,300)}
 svg='<svg class="float-network" viewBox="0 0 360 335" role="img" aria-label="A 다음 B 또는 C·E, 양쪽 완료 후 D. 기본값 임계 경로 A→B→D, 전체 12일. 실선은 임계 연결, 점선은 여유가 있는 연결."><defs><marker id="reader-float-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="var(--muted)"/></marker></defs>'
 for a,b in [('A','B'),('A','C'),('C','E'),('B','D'),('E','D')]:
  x,y=pos[a];xx,yy=pos[b];crit=' is-critical' if (a,b) in [('A','B'),('B','D')] else ''
  svg+=f'<path class="float-edge{crit}" marker-end="url(#reader-float-arrow)" d="M{x} {y+25} L{xx} {yy-26}"/>'
 for id,(x,y) in pos.items():
  crit='is-critical' if rows[id]['tf']==0 else ''
  svg+=f'<rect class="{crit}" x="{x-52}" y="{y-25}" width="104" height="50" rx="13"/><text x="{x}" y="{y+6}" text-anchor="middle">{id} · {d[id]}일</text>'
 svg+='</svg>'
 cards='<div class="float-cards">'
 for id in f['order']:
  r=rows[id];crit='is-critical' if r['tf']==0 else ''
  cards+=f'<article class="float-activity {crit}" data-float-row="{id}"><h3>{id} <small>'+('임계 작업' if crit else '여유 있음')+'</small></h3><dl>'
  for key,label in [('es','조기 시작 ES'),('ef','조기 종료 EF'),('ls','지연 시작 LS'),('lf','지연 종료 LF'),('tf','총 여유 TF'),('ff','자유 여유 FF')]:cards+=f'<div><dt>{label}</dt><dd data-value="{key}">{r[key]}일</dd></div>'
  cards+='</dl></article>'
 cards+='</div>'
 out='<section class="article-section float-reader"><span class="eyebrow">FIVE ACTIVITIES / 그림으로 계산하기</span><h3>다음 일은 밀려도, 끝나는 날은 같을 수 있어요.</h3><p>'+e(f['assumptions'])+'</p>'+svg+'<p class="small">실선: 임계 연결 · 점선: 여유가 있는 연결. 기본 전체 기간 12일. 아래 숫자는 모두 일 단위입니다.</p>'+cards
 out+='<p class="formula">ES=max(선행 EF), EF=ES+기간<br>LF=min(후속 LS), LS=LF−기간<br>TF=LS−ES · FF=min(후속 ES)−EF<br>끝 작업 D의 LF는 전체 조기 종료, FF도 이 종료 기준입니다.</p><h3 style="margin-top:25px">먼저 예측하고, 풀이를 펼쳐 보세요.</h3>'
 for p in f['presets'][1:]:
  r,t=calculate(f,p['durations']);crit=['→'.join(ids) for ids in f['paths'] if sum(p['durations'][id] for id in ids)==t]
  out+='<details class="think-box"><summary>'+e(p['label'])+'이면 E의 시작과 전체 종료는?</summary><p>'+f'C의 EF {r["C"]["ef"]}일 → E의 ES {r["E"]["es"]}일, EF {r["E"]["ef"]}일 → D의 ES {r["D"]["es"]}일 → 전체 {t}일. 임계 경로: '+', '.join(crit)+'.</p></details>'
 out+='<ol class="float-guide">'+''.join('<li>'+e(g)+'</li>' for g in f['guide'])+'</ol><p class="notice">'+e(f['limits'])+'</p><p class="small">정의·계산: PMI · Kramer·Jenkins (2006), 원문 확인 2026.10.27. 기초 계산 참고이며 최신 시험 정책 근거가 아닙니다. 이 예제와 그림은 자체 제작입니다.</p></section>'
 return out
