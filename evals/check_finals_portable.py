"""Verify the actual finals ZIP in a relocated Windows directory without PATH Python.

Requires only the standard library for launcher checks. Optional browser checks use
an explicitly supplied Node/Playwright runtime as the test client, never the server.
Synthetic answer edits are confined to the extracted test copy.
"""
from pathlib import Path
import argparse, contextlib, hashlib, json, os, re, shutil, subprocess, time, urllib.request, zipfile

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--zip',type=Path,required=True)
    ap.add_argument('--work',type=Path,required=True)
    ap.add_argument('--node',type=Path)
    ap.add_argument('--modules',type=Path)
    ap.add_argument('--browser',type=Path)
    args=ap.parse_args()
    assert os.name=='nt','This package targets Windows x64.'
    args.work.mkdir(parents=True,exist_ok=False)
    extract=args.work/'重新解压';extract.mkdir()
    with zipfile.ZipFile(args.zip) as z:
        assert z.testzip() is None
        for name in z.namelist():
            assert (extract/name).resolve().is_relative_to(extract.resolve())
        z.extractall(extract)
    folders=list(extract.iterdir());assert len(folders)==1 and folders[0].is_dir()
    bundle=extract/'改名后的路演包 中文空格';folders[0].rename(bundle)
    course=bundle/'02_现场使用/现场演示课程'
    python=course/'.teach-portable/python.exe'
    assert python.is_file() and not (course/'.teach-runtime').exists()
    assert not (course/'.tutor-settings.json').exists() and not (course/'learner-chats').exists()
    env=dict(os.environ)
    for key in list(env):
        if key.upper().startswith(('PYTHON','PIP_','CONDA')) or key.upper() in {'VIRTUAL_ENV','DASHSCOPE_API_KEY','DEEPSEEK_API_KEY','OPENAI_API_KEY'}:
            env.pop(key,None)
    system=Path(os.environ['SystemRoot'])/'System32'
    env.update(PATH=str(system),PYTHONHOME=str(args.work/'nonexistent'),PYTHONPATH=str(args.work/'nonexistent'),PYTHONNOUSERSITE='1',PYTHONIOENCODING='utf-8',PIP_NO_INDEX='1',PIP_INDEX_URL='http://127.0.0.1:9')
    assert shutil.which('python',path=env['PATH']) is None and shutil.which('py',path=env['PATH']) is None
    probe="import json,sys,platform,ssl,ctypes,sqlite3;from importlib.metadata import version;import keyring;print(json.dumps({'python':platform.python_version(),'executable':sys.executable,'keyring':version('keyring'),'isolated':sys.flags.isolated,'sys_path':sys.path,'backend':type(keyring.get_keyring()).__name__}))"
    runtime=json.loads(subprocess.check_output([str(python),'-X','utf8','-B','-c',probe],cwd=course,env=env,text=True))
    assert Path(runtime['executable']).resolve()==python.resolve()
    assert all(Path(p).resolve().is_relative_to(course.resolve()) for p in runtime['sys_path'])
    report={'date':'2026-11-27','target':'Windows 10/11 x64','actual_zip_extracted':True,
            'source_zip_sha256':hashlib.sha256(args.zip.read_bytes()).hexdigest(),
            'relocated_to_different_directory_with_chinese_and_spaces':True,
            'system_python_discoverable':False,'server_runtime':'packaged .teach-portable/python.exe',
            'bundled_python':runtime['python'],'keyring':runtime['keyring'],'isolated_python':bool(runtime['isolated']),
            'all_python_import_paths_inside_course':True,'keyring_backend':runtime['backend'],
            'paid_model_requests':0,'checks':{},'clean_OS_VM_test':False}
    marker='便携验收：负一是横坐标，负八是函数值。🧮'
    cmd=system/'cmd.exe';ps=system/'WindowsPowerShell/v1.0/powershell.exe'

    @contextlib.contextmanager
    def launched(kind,entry):
        logfile=args.work/(kind+'.log')
        out=logfile.open('w',encoding='utf8')
        argv=[str(cmd),'/d','/c',entry.name,'--no-browser','--port','0']
        if entry.suffix=='.ps1':
            argv=[str(ps),'-NoProfile','-ExecutionPolicy','Bypass','-File',str(entry),'--no-browser','--port','0']
        proc=subprocess.Popen(argv,cwd=entry.parent if entry.suffix=='.cmd' else system,env=env,stdout=out,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            base=None
            for _ in range(150):
                text=logfile.read_text('utf8',errors='replace')
                match=re.search(r'Course ready: (http://127\.0\.0\.1:\d+/)',text)
                if match:base=match[1];break
                if proc.poll() is not None:raise RuntimeError(kind+' failed: '+text[-1600:])
                time.sleep(.1)
            assert base,kind+' did not report ready'
            yield base
        finally:
            subprocess.run([str(system/'taskkill.exe'),'/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            proc.wait(timeout=10);out.close()

    def get(base,path):
        with urllib.request.urlopen(base+path,timeout=6) as response:
            assert response.status==200
            return response.read()

    html=['','settings.html','practice/entry-assessment.html',*[str(p.relative_to(course)).replace('\\','/') for p in sorted((course/'lessons').glob('*.html'))]]
    assets=[str(p.relative_to(course)).replace('\\','/') for p in sorted((course/'assets').rglob('*')) if p.is_file() and p.suffix in {'.js','.css','.png','.jpg','.svg','.woff2'}]
    launches=[('root-cmd',bundle/'打开现场课程.cmd'),('root-powershell-restart',bundle/'start-live-demo.ps1'),('nested-cmd',bundle/'02_现场使用/打开现场课程.cmd'),('course-cmd',course/'start-course.cmd')]
    for i,(kind,entry) in enumerate(launches):
        with launched(kind,entry) as base:
            for route in html+assets:get(base,route)
            bootstrap=json.loads(get(base,'api/tutor/bootstrap'))
            assert bootstrap['credential_storage']['available']
            if i==0:
                if args.node and args.modules and args.browser:
                    out=args.work/'browser-first.json'
                    subprocess.run([str(args.node),str(Path(__file__).with_name('check_finals_browser.mjs')),str(args.modules),str(args.browser),base,str(out),'first'],check=True)
                    report['browser_first']=json.loads(out.read_text('utf8'))
                else:
                    saved=json.loads(get(base,'api/submissions/0001-function-points-and-intercepts'))
                    saved['fields']['lesson-0001-exercise-01']=marker
                    request=urllib.request.Request(base+'api/submissions/0001-function-points-and-intercepts',data=json.dumps({'fields':saved['fields']}).encode(),headers={'Content-Type':'application/json'})
                    assert urllib.request.urlopen(request,timeout=6).status==200
            elif i==1 and args.node and args.modules and args.browser:
                out=args.work/'browser-restart.json'
                subprocess.run([str(args.node),str(Path(__file__).with_name('check_finals_browser.mjs')),str(args.modules),str(args.browser),base,str(out),'restart'],check=True)
                report['browser_restart']=json.loads(out.read_text('utf8'))
            saved=json.loads(get(base,'api/submissions/0001-function-points-and-intercepts'))
            assert saved['fields']['lesson-0001-exercise-01']==marker
            report['checks'][kind]={'startup':'pass','html_routes':len(html),'local_asset_routes':len(assets),'saved_answer_restored':True,'credential_backend_available':True,'pip_install_triggered':False}
    # Repeat one launcher with an audit guard in the disposable copy only.
    wrapper=course/'portable_start.py';original=wrapper.read_bytes()
    wrapper.write_text("import sys\ndef _offline_guard(event,args):\n    if event=='socket.connect' and isinstance(args[1],tuple) and args[1][0] not in ('127.0.0.1','::1'):\n        raise RuntimeError('external sockets blocked by acceptance test')\n    if event=='subprocess.Popen':\n        raise RuntimeError('child installation blocked by acceptance test')\nsys.addaudithook(_offline_guard)\n"+original.decode('utf8'),'utf8')
    try:
        with launched('offline-audit-guard',course/'start-course.cmd') as base:
            for route in html+assets:get(base,route)
            assert json.loads(get(base,'api/tutor/bootstrap'))['credential_storage']['available']
        report['offline_guard']={'external_connections':'blocked','child_install_processes':'blocked','startup_and_all_routes':'pass','instrumentation':'test copy launcher only'}
    finally:wrapper.write_bytes(original)
    report['status']='pass'
    (args.work/'acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
