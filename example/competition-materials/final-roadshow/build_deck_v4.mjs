/** Ten-slide, three-chapter finals deck with editable labels and diagrams. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const [modules,output]=process.argv.slice(2);
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(modules,'@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const data=JSON.parse(await fs.readFile(path.join(here,'路演内容.json'),'utf8'));
const deck=Presentation.create({slideSize:{width:1280,height:720}});
const C={navy:'#102A43',ink:'#18364B',teal:'#087F70',paper:'#FAF7EF',white:'#FFFFFF',muted:'#536C7C',line:'#CCDCE1',pale:'#E1F1EA',gold:'#AE762D',sand:'#F6E8CF'};
function rect(s,x,y,w,h,fill){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
function text(s,x,y,w,h,value,size=26,color=C.ink,bold=false,align='left'){
 const n=rect(s,x,y,w,h,'none');n.text=value;n.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',autoFit:'none',insets:0};return n;
}
async function image(s,file,x,y,w,h,fit='contain'){return s.images.add({blob:new Uint8Array(await fs.readFile(path.join(here,'assets/per-slide',file))),contentType:'image/png',position:{left:x,top:y,width:w,height:h},fit,alt:file});}
function rule(s,x,y,w,color=C.line){rect(s,x,y,w,2,color);}
function box(s,x,y,w,h,title,sub,fill=C.pale){
 rect(s,x,y,w,h,fill);text(s,x+18,y+12,w-36,40,title,27,C.navy,true);text(s,x+18,y+56,w-36,h-62,sub,23,C.muted);
}
function arrow(s,a,b){s.shapes.connect(a,b,{kind:'straight',fromSide:'right',toSide:'left',line:{fill:C.teal,width:3},tail:{type:'triangle',width:'med',length:'med'}});}
function top(s,i,chapter){
 text(s,48,22,1100,28,chapter,18,C.teal,true);
 text(s,48,65,1160,62,data.slides[i-1].title,38,C.navy,true);
 rule(s,48,143,1184);text(s,1182,27,46,26,String(i).padStart(2,'0'),17,C.muted,false,'right');
}
for(let i=1;i<=10;i++){
 const s=deck.slides.add({width:1280,height:720});s.background.fill=C.paper;
 if(i===1||i===10){
  await image(s,i===1?'01-cover.png':'12-closing.png',0,0,1280,720,'cover');
  rect(s,0,0,650,720,C.navy);
  if(i===1){
   text(s,55,115,570,100,'学途智伴',68,C.white,true);
   text(s,57,241,555,110,'大学生长期\n自适应学习智能体',37,'#DCECEB',true);
   text(s,57,412,555,50,'自适应教学 Skill 技能包',29,'#58D3BF',true);
   text(s,57,615,560,35,'重邮FFBond  决赛路演',23,'#D1E2E5');
  }else{
   text(s,52,104,560,150,'让下一次教学\n接着这一次学习',43,C.white,true);
   text(s,55,325,540,105,'系统自学    课程备考\n项目技能学习',28,'#DCECEB',true);
   text(s,55,494,540,55,'课程工作区持续积累学情',26,'#58D3BF',true);
   text(s,55,618,540,35,'重邮FFBond  谢谢各位评委',23,'#D1E2E5');
  }
 }else if([2,4,7].includes(i)){
  const n={2:'01',4:'02',7:'03'}[i];
  const art={2:'02-motivation.png',4:'04-architecture.png',7:'11-use-cases.png'}[i];
  await image(s,art,610,90,650,550,'contain');rect(s,0,0,610,720,C.navy);
  text(s,53,105,505,100,n,77,'#58D3BF',true);
  text(s,55,245,520,90,data.slides[i-1].title,43,C.white,true);
  const desc={2:'把资料组织成课程\n从目标与基础开始',4:'留下学习记录\n依据作答安排下一课',7:'智鉴 Agent 操作演示\n高等数学案例与验证'}[i];
  text(s,57,397,500,120,desc,29,'#DCECEB');
  rule(s,55,579,470,'#3D6375');
  text(s,55,608,485,45,'学途智伴  自适应教学 Skill',21,'#D1E2E5');
 }else if(i===3){
  top(s,i,'第一章 设计初衷');
  text(s,50,166,660,63,'资料找得快，系统学习还需要安排',31,C.teal,true);
  text(s,50,236,655,116,'把讲解、图解、练习、资料和答疑放进课程网页，\n通过学生留下的回答安排后续教学。',25);
  await image(s,'03-journey.png',739,172,494,305);
  const labels=[['说出目标','想学什么、用来做什么'],['了解起点','基础、时间、入门评估'],['生成当前课','路线规划与逐课讲解'],['学习后继续','作答、疑难与后续安排']];
  let prev;labels.forEach((r,k)=>{let x=48+k*302;const n=rect(s,x,482,278,136,k%2?C.pale:'#F1EADB');text(s,x+16,494,246,40,r[0],29,C.navy,true);text(s,x+16,548,246,53,r[1],22);if(prev)arrow(s,prev,n);prev=n;});
  text(s,50,646,1150,33,'起步提示  @teach-pro 我想学习统计学。',24,C.teal,true);
 }else if(i===5){
  top(s,i,'第二章 教学机制');
  text(s,49,167,1180,42,'教学规则、课程模板和本地工具，共同组成 Skill 技能包',29,C.teal,true);
  const a=box(s,49,237,350,116,'教学 AI','读取 Skill，生成课程');
  box(s,464,237,350,116,'课程网页','阅读、作答、课内答疑');
  box(s,879,237,350,116,'课程工作区','目标、课文、答案与疑难');
  text(s,409,267,42,45,'→',31,C.teal,true);text(s,824,267,42,45,'→',31,C.teal,true);
  await image(s,'05-records.png',48,385,552,280);
  text(s,649,394,560,48,'跨会话接续',32,C.navy,true);
  text(s,649,464,560,133,'学习记录自动保存到课程目录。\n再次请求继续时，教学 AI 读取记录，\n回应疑难，安排下一课。',26);
  text(s,649,621,560,42,'课内答疑同步参考当前教材与最新作答',24,C.teal,true);
 }else if(i===6){
  top(s,i,'第二章 教学机制');
  box(s,48,173,342,146,'学生作答','答案、解释、应用与提问');
  box(s,458,173,342,146,'理解清楚','增加变式和迁移任务');
  box(s,870,173,362,146,'需要支持','换例解释与分步练习',C.sand);
  text(s,403,213,42,42,'→',32,C.teal,true);text(s,815,213,42,42,'或',25,C.muted);
  rule(s,48,351,1184);
  text(s,48,373,1150,45,'正式课推进新目标，补充课回应具体疑难',31,C.teal,true);
  const names=['第1课 消息与调用','第2课 推理循环','第3课 安全工具调用'];
  names.forEach((v,k)=>{box(s,48+k*404,451,376,100,v,'新目标、讲解与练习');if(k<2)text(s,430+k*404,474,30,35,'→',29,C.teal,true);});
  rect(s,452,576,376,101,C.sand);
  text(s,470,583,338,38,'关联补充课',27,C.gold,true);
  text(s,470,628,338,37,'外部文本与工具执行权限',24,C.ink);
  text(s,48,597,355,59,'智鉴 Agent 学习示例',25,C.muted,true);
  text(s,874,587,350,80,'两类课程的作答\n共同影响后续教学',25,C.teal,true);
 }else if(i===8){
  top(s,i,'第三章 演示与价值');
  const shot=await fs.readFile(path.join(repo,'example/competition-pages/assets/tutor-preview.png'));
  s.images.add({blob:new Uint8Array(shot),contentType:'image/png',position:{left:48,top:184,width:864,height:423},fit:'contain',alt:'真实课程课内答疑截图'});
  const rows=['入门评估与第一课','阅读图解与资料','课内答疑与即时作答','请求继续与课程更新'];
  rows.forEach((v,k)=>{text(s,945,208+k*93,280,62,v,25,k===3?C.teal:C.ink,k===3);if(k<3)rule(s,945,283+k*93,280);});
  text(s,49,638,850,39,'播放 60 秒课程操作片段，现场同步讲解',26,C.teal,true);
 }else if(i===9){
  top(s,i,'第三章 演示与价值');
  text(s,48,168,710,45,'导数为零，就一定有极值吗？',29,C.teal,true);
  text(s,48,231,710,49,'比较两个函数  驻点与极值有怎样的关系？',24,C.ink,true);
  box(s,48,300,334,122,'f(x) = x³','f′(x) = 3x²\nx = 0 两侧导数均为正',C.pale);
  box(s,408,300,350,122,'g(x) = x³ − 3x','g′(x) = 3x² − 3\nx = 1 处导数由负变正',C.sand);
  text(s,48,443,710,51,'f在0处无极值，g在1处有极小值',27,C.teal,true);
  text(s,48,504,710,34,'结合驻点两侧的导数符号，判断变化趋势',23,C.muted);
  await image(s,'09-statistics.png',803,170,424,180);
  text(s,810,364,412,40,'作答怎样影响教学',28,C.navy,true);
  text(s,810,417,412,54,'只看导数为零  补充反例与符号分析',24,C.gold,true);
  text(s,810,480,412,54,'解释导数变号  进入极值应用题',24,C.teal,true);
  rule(s,48,557,1184);
  text(s,48,577,1184,40,'沿学习过程验证功能',29,C.navy,true);
  const vals=['作答保存与恢复','最新答案进入答疑','续课生成关联补充'];
  vals.forEach((v,k)=>text(s,49+k*402,635,384,40,v,25,C.teal,true));
 }
 const d=data.slides[i-1];
 s.speakerNotes.text=d.speech;
}
await (await PresentationFile.exportPptx(deck)).save(output);
console.log(JSON.stringify({slides:deck.slides.items.length,output}));


const preview=process.env.PITCH_PREVIEW_DIR;if(preview){await fs.mkdir(preview,{recursive:true});for(let i=0;i<10;i++){const png=await deck.export({slide:deck.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(preview,'slide-'+String(i+1).padStart(2,'0')+'.png'),new Uint8Array(await png.arrayBuffer()));}}
