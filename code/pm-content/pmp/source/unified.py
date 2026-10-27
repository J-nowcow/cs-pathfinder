# -*- coding: utf-8 -*-
"""Single-DOM offline edition: static reader first, interactive shell after successful boot."""
import re

CONTROLLER=r'''
(function(){
 'use strict';
 const app=document.getElementById('pmp-interactive'),reader=document.getElementById('pmp-reader');
 let ready=false,lastRoute='#home';
 const isReader=()=>location.hash.startsWith('#reader-');
 function show(mode){const reading=mode==='reader';reader.hidden=!reading;app.hidden=reading;document.documentElement.dataset.documentMode=mode;if(reading)document.title='PMP 통합 자습서 · 전체 읽기';}
 function jumpReader(){requestAnimationFrame(()=>{if(!isReader())return;let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if(!target)return;for(let parent=target.parentElement;parent&&parent!==reader;parent=parent.parentElement){if(parent.tagName==='DETAILS')parent.open=true;}target.scrollIntoView({block:'start',behavior:'instant'});const focus=target.tagName==='DETAILS'?target.querySelector('summary'):target;if(focus){if(focus.tagName!=='SUMMARY')focus.tabIndex=-1;focus.focus({preventScroll:true});}});}
 function toReader(){const raw=location.hash;let target='#reader-contents';if(raw.startsWith('#lesson/')){const parts=raw.slice(8).split('/');target='#reader-'+parts[0]+(parts[1]==='case'?'-case-body':'');}else if(raw==='#scope/cases')target='#reader-deep-library';else if(raw.startsWith('#case/')||raw==='#lab/cases')target='#reader-cases';else if(raw.startsWith('#glossary'))target='#reader-terms';else if(raw==='#sources')target='#reader-sources';else if(raw==='#lab/float')target='#reader-n44';else if(raw==='#home'||!raw)target='#reader-top';location.hash=target;}
 function toApp(){let h=location.hash,target=lastRoute;const lesson=h.match(/^#reader-(n\d{2})(?:-|$)/);if(lesson)target='#lesson/'+lesson[1]+(h==='#reader-'+lesson[1]+'-case-body'?'/case':'');else if(h==='#reader-deep-library')target='#scope/cases';else if(h==='#reader-contents')target='#path';else if(h==='#reader-terms')target='#glossary';else if(h==='#reader-cases')target='#lab/cases';else if(h==='#reader-framework'||h==='#reader-sources')target='#sources';location.hash=target;}
 window.PMP_DOCUMENT={
  handleRoute(){if(isReader()){show('reader');jumpReader();return true;}lastRoute=location.hash||'#home';if(ready)show('interactive');return false;},
  ready(){ready=true;document.querySelectorAll('[data-document-mode]').forEach(el=>el.hidden=false);show(isReader()?'reader':'interactive');if(isReader())jumpReader();},
  failed(){show('reader');document.getElementById('document-status').hidden=false;}
 };
 document.addEventListener('click',event=>{const skip=event.target.closest('[data-document-skip]');if(skip){event.preventDefault();document.getElementById('main').focus();return;}const control=event.target.closest('[data-document-mode]');if(!control||!ready)return;if(control.dataset.documentMode==='reader')toReader();else toApp();});
})();
'''
STYLE='''
#pmp-interactive[hidden],#pmp-reader[hidden],[data-document-mode][hidden],#document-status[hidden]{display:none!important}
.document-mode-button{min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;font-size:12px;line-height:1.5;cursor:pointer;white-space:nowrap}
.document-mode-button:hover{border-color:var(--accent);color:var(--accent)}
#pmp-reader .header-inner{gap:12px}#pmp-reader .brand{font-size:16px}#pmp-reader .header nav{margin-left:auto}
#document-status{max-width:800px;margin:20px auto;padding:18px;border:1px solid var(--line);border-radius:12px;font-size:14px;line-height:1.9}
@media(max-width:780px){#pmp-interactive .header-inner{gap:8px}#pmp-interactive .brand{margin-right:auto}#pmp-reader .header nav{margin-left:-20px}#pmp-reader .brand{margin-right:auto}}
@media print{.document-mode-button,#document-status{display:none!important}}
'''

def render(index,reader_body,reader_css,licenses,data_js,app_js):
 # Keep a single set of CSS/font assets. Prefix static reader IDs and every local reference.
 head=index.split('<body>',1)[0].replace('<title>PMP 길라잡이 · 판단의 지도</title>','<title>PMP 통합 자습서 · 읽기와 학습</title>')
 head=head.replace('</head>','<style>'+reader_css.replace('html{scroll-behavior:auto}','')+STYLE+'</style></head>')
 app_body=index.split('<body>',1)[1].rsplit('</body>',1)[0]
 app_body=re.sub(r'<script\b[^>]*>.*?</script>','',app_body,flags=re.S)
 app_body=re.sub(r'<noscript>.*?</noscript>','',app_body,flags=re.S)
 app_button='<button type="button" class="document-mode-button" data-document-mode="reader" hidden>전체 읽기</button>'
 app_body=app_body.replace('href="#main"','href="#main" data-document-skip',1)
 app_body=app_body.replace('<button id="settings-btn"',app_button+'<button id="settings-btn"',1)
 ids=re.findall(r'(?<![\w-])id="([^"]+)"',reader_body)
 assert len(ids)==len(set(ids)), 'Reader IDs must be unique before prefixing'
 static=re.sub(r'(?<![\w-])id="([^"]+)"',lambda m:'id="reader-'+m[1]+'"',reader_body)
 static=re.sub(r'\bhref="#([^"]*)"',lambda m:'href="#reader-'+m[1]+'"',static)
 static=re.sub(r'url\(#([^)]*)\)',lambda m:'url(#reader-'+m[1]+')',static)
 static=static.replace('PMP 길라잡이 · 개념서 확장판</a>','PMP 통합 자습서</a>',1)
 static=static.replace('<nav aria-label="빠른 이동">','<button type="button" class="document-mode-button" data-document-mode="interactive" hidden>학습 모드</button><nav aria-label="빠른 이동">',1)
 static=static.replace('이 파일은 스크립트 없이 모든 내용을 읽도록 만들었습니다. 진도·메모·채점·계산 실험은 ‘PMP_개념서_확장판_학습지도.html’을 사용하세요.','전체 읽기는 스크립트 없이도 동작하며 진도·메모·채점 기록을 저장하지 않습니다. 검색·진도·메모·채점·계산 실험은 상단 ‘학습 모드’에서 사용하세요. 버튼이 보이지 않으면 현재 뷰어가 스크립트를 실행하지 않는 상태일 수 있습니다.')
 static=static.replace('· 오프라인 읽기','· 통합 파일의 전체 읽기')
 # Existing router is guarded only in this edition; old standalone files stay compatible.
 needle='function route(focus=true){'
 assert app_js.count(needle)==1
 app_js=app_js.replace(needle,needle+'if(window.PMP_DOCUMENT.handleRoute())return;',1)
 safe=lambda source:source.replace('</script','<\\/script')
 script="'use strict';\n"+safe(CONTROLLER)+'\n'+safe(data_js)+'\ntry{\n'+safe(app_js)+'\nwindow.PMP_DOCUMENT.ready();\n}catch(error){window.PMP_DOCUMENT.failed();}'
 return head+'<body><div id="pmp-interactive" hidden>'+app_body+'</div><div id="pmp-reader"><a class="skip" href="#reader-top">읽기 본문으로 건너뛰기</a><div id="document-status" role="status" hidden>학습 기능을 시작하지 못해 전체 읽기로 열었어요. 아래의 모든 수업과 문제·해설은 계속 읽을 수 있습니다.</div>'+static+'</div>'+licenses+'<script>'+script+'</script></body></html>'
