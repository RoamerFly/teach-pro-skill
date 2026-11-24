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
  const art={2:'02-motivation.png',4:'04-architecture.png',7:'../calculus-run/00-dialogue-record.png'}[i];
  await image(s,art,610,90,650,550,'contain');rect(s,0,0,610,720,C.navy);
  text(s,53,105,505,100,n,77,'#58D3BF',true);
  text(s,55,245,520,90,data.slides[i-1].title,43,C.white,true);
  const desc={2:'把资料组织成课程\n从目标与基础开始',4:'留下学习记录\n依据作答安排下一课',7:'模拟零基础大一学生\n对话、课程与动态续课'}[i];
  text(s,57,397,500,120,desc,29,'#DCECEB');
  rule(s,55,579,470,'#3D6375');
  text(s,55,608,485,45,(i===7?'Codex实际调用Teach Pro':'学途智伴  自适应教学 Skill'),21,'#D1E2E5');
 }else if(i===3){
  top(s,i,'第一章 设计初衷');
  text(s,50,166,660,63,'资料找得快，系统学习还需要安排',31,C.teal,true);
  text(s,50,236,655,116,'把讲解、图解、练习、资料和答疑放进课程网页，\n通过学生留下的回答安排后续教学。',25);
  await image(s,'03-journey.png',739,172,494,305);
  const labels=[['说出目标','想学什么、用来做什么'],['了解起点','基础、时间、入门评估'],['生成当前课','路线规划与逐课讲解'],['学习后继续','作答、疑难与后续安排']];
  let prev;labels.forEach((r,k)=>{let x=48+k*302;const n=rect(s,x,482,278,136,k%2?C.pale:'#F1EADB');text(s,x+16,494,246,40,r[0],29,C.navy,true);text(s,x+16,548,246,53,r[1],22);if(prev)arrow(s,prev,n);prev=n;});
  text(s,50,646,1150,33,'起步提示  @teach-pro 我想学习大学课程：高等数学。',24,C.teal,true);
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
  const names=['第1课 函数图像与交点','第2课 接近一点的函数值','后续课 依据新作答安排'];
  names.forEach((v,k)=>{box(s,48+k*404,451,376,100,v,'新目标、讲解与练习');if(k<2)text(s,430+k*404,474,30,35,'→',29,C.teal,true);});
  rect(s,452,576,376,101,C.sand);
  text(s,470,583,338,38,'关联补充课',27,C.gold,true);
  text(s,470,628,338,37,'平移后的对称轴',24,C.ink);
  text(s,48,597,355,59,'高等数学 实测路径',25,C.muted,true);
  text(s,874,587,350,80,'两类课程的作答\n共同影响后续教学',25,C.teal,true);
 }else if(i===8){
  top(s,i,'第三章 演示与价值');
  await image(s,'../calculus-run/03-first-diagram.png',48,174,855,490);
  text(s,936,183,297,44,'先了解学情',28,C.teal,true);
  text(s,936,240,297,94,'零基础大一学生\n先访谈，再做入门评估',24,C.ink);
  rule(s,936,355,296);
  text(s,936,375,297,44,'再选择首课',28,C.teal,true);
  text(s,936,438,297,126,'评估发现交点遗漏\n首课讲函数图像上的\n点与交点',24,C.ink);
  text(s,49,671,1178,29,'实际生成的课程网页  图解、例题、原位练习与学习记录',23,C.teal,true);
 }else if(i===9){
  top(s,i,'第三章 演示与价值');
  await image(s,'../calculus-run/05-course-directory.png',48,178,770,425);
  text(s,862,181,364,42,'学生的疑问',29,C.navy,true);
  text(s,862,240,364,119,'“式子里有x−1时，\n对称轴到底怎么判断？\n我总想沿用y轴。”',25,C.ink);
  rule(s,862,383,364);
  text(s,862,402,364,44,'补充课回应难点',27,C.gold,true);
  text(s,862,451,364,42,'平移后的对称轴',25,C.ink);
  text(s,862,510,364,44,'正式课推进新目标',27,C.teal,true);
  text(s,862,561,364,42,'接近一点时的函数值',25,C.ink);
  rule(s,48,631,1184);
  text(s,49,654,1180,40,'本轮实际交付  2节正式课、1节关联补充课  根据已保存作答安排',23,C.teal,true);
 }

 const d=data.slides[i-1];
 s.speakerNotes.text=d.speech;
}
await (await PresentationFile.exportPptx(deck)).save(output);
console.log(JSON.stringify({slides:deck.slides.items.length,output}));


const preview=process.env.PITCH_PREVIEW_DIR;if(preview){await fs.mkdir(preview,{recursive:true});for(let i=0;i<10;i++){const png=await deck.export({slide:deck.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(preview,'slide-'+String(i+1).padStart(2,'0')+'.png'),new Uint8Array(await png.arrayBuffer()));}}
