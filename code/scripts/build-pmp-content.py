"""Rebuild and validate the retained PMP archive; never publish offline assets."""
from pathlib import Path
import json,shutil,subprocess,sys,hashlib,zipfile
C=Path(__file__).resolve().parents[1];P=C/'pm-content/pmp';D=P/'dist';O=P/'downloads'
shutil.copytree(P/'template',D,dirs_exist_ok=True)
subprocess.run([sys.executable,str(P/'source/expand.py')],check=True)
subprocess.run([sys.executable,str(P/'source/package.py')],check=True)
course=json.loads((P/'source/course.json').read_text());review=json.loads((P/'validated-release.json').read_text())
if course['version']!=review['version'] or course['stats']!=review['stats']:raise RuntimeError('Generated content does not match reviewed release; review content before publishing')
for name,metadata in review['original_outputs'].items():
 if hashlib.sha256((O/name).read_bytes()).hexdigest()!=metadata['sha256']:
  # ZIP member timestamps differ across workspaces; compare member bytes instead below.
  if not name.endswith('.zip'):raise RuntimeError('Reviewed output changed: '+name)
archive=O/'PMP_개념서_확장판_오프라인.zip'
with zipfile.ZipFile(archive) as z:
 if z.testzip() is not None:raise RuntimeError('Offline archive is corrupt')
 expected={name:(O/name).read_bytes() for name in review['original_outputs'] if not name.endswith('.zip')}
 expected.update({'fonts-licenses/'+f.name:f.read_bytes() for f in (D/'assets').glob('*LICENSE.txt')})
 if set(z.namelist())!=set(expected) or any(z.read(name)!=data for name,data in expected.items()):raise RuntimeError('Offline ZIP members differ from reviewed HTML/readme/fonts')
print('PMP retained archive validated:',course['version'],'(not published)')
