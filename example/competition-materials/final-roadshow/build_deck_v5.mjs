/** Sixteen-slide, three-chapter finals deck with editable labels and diagrams. */
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
for(let i=1;i<=16;i++){
 const s=deck.slides.add({width:1280,height:720});s.background.fill=C.paper;
 if(i===1||i===16){
  await image(s,i===1?'01-cover.png':'12-closing.png',0,0,1280,720,'cover');rect(s,0,0,650,720,C.navy);
  if(i===1){
   text(s,55,115,570,100,'学途智伴',68,C.white,true);
   text(s,57,241,555,110,'大学生长期\n自适应学习智能体',37,'#DCECEB',true);
   text(s,57,412,555,50,'自适应教学 Skill 技能包',29,'#58D3BF',true);
   text(s,57,615,560,35,'重邮FFBond  决赛路演',23,'#D1E2E5');
  }else{
   text(s,52,104,560,150,'让下一次教学\n接着这一次学习',43,C.white,true);
   text(s,55,315,540,155,'学途智伴将教学、课程网页和学情记录\n组织成可复用的Skill，支持系统自学、\n课程备考和项目学习。',26,'#DCECEB');
   text(s,55,494,540,55,'课程工作区持续积累学情',26,'#58D3BF',true);
   text(s,55,618,540,35,'重邮FFBond  谢谢各位评委',23,'#D1E2E5');
  }
 }else if([2,6,11].includes(i)){
  const art={2:'02-motivation.png',6:'04-architecture.png',11:'11-use-cases.png'}[i];
  await image(s,art,610,90,650,550);rect(s,0,0,610,720,C.navy);
  text(s,53,105,505,100,{2:'01',6:'02',11:'03'}[i],77,'#58D3BF',true);
  text(s,55,245,520,90,data.slides[i-1].title,43,C.white,true);
  text(s,57,397,500,120,{2:'把资料组织成课程\n从目标与基础开始',6:'留下学习记录\n依据作答安排下一课',11:'模拟零基础大一学生\n真实对话、课程与续课'}[i],29,'#DCECEB');
  rule(s,55,579,470,'#3D6375');
  text(s,55,608,485,45,i===11?'Codex实际调用Teach Pro':'学途智伴  自适应教学 Skill',21,'#D1E2E5');
 }else{
  top(s,i,i<6?'第一章 设计初衷':i<11?'第二章 教学机制':'第三章 演示与价值');
  if(i===3){
   text(s,52,179,650,92,'资料找到之后，\n今天学什么，明天怎样接着学？',33,C.teal,true);
   const rows=[
    ['我的学习期待','AI帮助我快速找到资料，我还希望\n这些资料能组织成适合自己的系统课程。'],
    ['让学习情况可见','把讲解、习题和答疑放进网页，\n让学生在学习时留下答案与疑问。'],
    ['让后续安排有依据','教学AI读取这些记录，了解哪里已经\n理解、哪里需要支持，再安排下一课。']
   ];
   rows.forEach((r,k)=>{text(s,54,303+k*126,635,42,r[0],28,C.navy,true);text(s,54,349+k*126,635,77,r[1],26,C.ink);});
   await image(s,'03-journey.png',731,214,500,383);
  }else if(i===4){
   text(s,50,172,1150,48,'从一句学习目标开始，逐步建立课程',31,C.teal,true);
   await image(s,'03-journey.png',195,225,880,190);
   const labels=[['说出目标','学生先说想学什么，\n以及希望用来做什么。'],['了解起点','Agent先了解基础，\n再评估学习起点。'],['生成当前课','先提供学习路线，\n再完整讲授当前一课。'],['学习后继续','学生作答并记录疑难，\nAI据此安排后续课程。']];
   let prev;labels.forEach((r,k)=>{const x=48+k*302,n=rect(s,x,431,278,200,k%2?C.pale:'#F1EADB');text(s,x+16,444,246,40,r[0],29,C.navy,true);text(s,x+16,496,246,116,r[1],23);if(prev)arrow(s,prev,n);prev=n;});
   text(s,50,649,1150,34,'@teach-pro 我想学习大学课程：高等数学。',25,C.teal,true);
  }else if(i===5){
   await image(s,'04-architecture.png',780,174,452,440);
   const rows=[['教学规则','宿主教学AI读取SKILL.md和配套教学规范，\n按约定完成评估、选课、讲解和续课。'],['课程模板','把课程首页、图解、原位练习和课内答疑\n放进统一的网页课堂，方便学生连续学习。'],['本地工具','将答案、疑难和聊天保存在课程目录，\n让后续教学可以恢复并参考已有记录。']];
   rows.forEach((r,k)=>{text(s,52,193+k*144,676,45,r[0],31,C.teal,true);text(s,52,247+k*144,676,82,r[1],25,C.ink);if(k<2)rule(s,52,317+k*144,674);});
   text(s,52,652,1160,35,'在支持Skill的宿主中导入，按学习目标启动教学流程',26,C.navy,true);
  }else if(i===7){
   await image(s,'../workflow/teach-pro-workflow-architecture.png',120,157,1040,541);
  }else if(i===8){
   text(s,49,171,1180,45,'教学AI按Skill执行一次“读取信息、组织教学、生成页面”的过程',29,C.teal,true);
   const nodes=[];
   const rows=[
    ['读取教学输入','学生的目标、基础与时间，\n以及入门评估中的原始回答，\n共同确定当前学习起点。'],
    ['组织当前一课','选定一个紧密目标，\n组织讲解、图解与例题，\n安排练习并核验参考资料。'],
    ['生成课程产物','使用模板生成HTML课程页，\n复用共享样式与交互组件，\n同步首页、路线和教学记录。']
   ];
   rows.forEach((r,k)=>{const x=49+k*415,n=rect(s,x,249,350,221,C.pale);text(s,x+18,267,314,44,r[0],29,C.navy,true);text(s,x+18,330,314,119,r[1],24,C.ink);nodes.push(n);});
   arrow(s,nodes[0],nodes[1]);arrow(s,nodes[1],nodes[2]);
   text(s,52,510,1176,153,'课程工作区集中保存学习目标、学习者画像、路线与课程文件。\n教学AI每次完整生成当前一课，页面提供讲解、图解、习题与资料，\n完成链接、输入框与目录结构检查后，交给学生学习和作答。',27,C.ink);
  }else if(i===9){
   text(s,49,171,1180,45,'学生请求继续时，教学AI读取记录，再决定下一步怎样教',29,C.teal,true);
   const nodes=[];
   const rows=[
    ['读取学习证据','读取本地保存的练习答案，\n并结合本课疑难、学习记录\n和已有的课内讨论。'],
    ['审阅当前理解','核对回答的课节和题目，\n审阅解释、应用与迁移，\n找出仍需支持的具体关系。'],
    ['续课并同步状态','选择下一节正式课的新目标，\n按需生成独立补充课，\n更新首页、路线和教学记录。']
   ];
   rows.forEach((r,k)=>{const x=49+k*415,n=rect(s,x,249,350,221,k===1?C.sand:C.pale);text(s,x+18,267,314,44,r[0],29,C.navy,true);text(s,x+18,330,314,119,r[1],24,C.ink);nodes.push(n);});
   arrow(s,nodes[0],nodes[1]);arrow(s,nodes[1],nodes[2]);
   text(s,52,508,1176,158,'本地服务在学习时持续保存答案，宿主教学AI在续课时读取这些文件。\n正式课推进新的学习目标，补充课回应上一课的具体疑难。\n学生完成新一轮学习后，再以新的作答和问题进入下一次教学。',27,C.ink);
  }else if(i===10){
   const a=rect(s,52,221,495,154,C.pale);text(s,72,237,455,49,'第1课 函数图像与交点',31,C.navy,true);text(s,72,302,455,61,'首课用图解、示范与练习，\n讲清函数值、坐标点和交点。',25);
   const b=rect(s,731,221,495,154,C.pale);text(s,751,237,455,49,'第2课 接近一点的函数值',31,C.navy,true);text(s,751,302,455,61,'新正式课从图像和数值表出发，\n带学生进入极限直觉。',25);
   arrow(s,a,b);
   rect(s,52,446,495,147,C.sand);text(s,72,461,455,49,'关联补充课',31,C.gold,true);text(s,72,518,455,65,'针对学生对平移函数的疑问，\n补充讲解并复核对称轴。',25);
   text(s,731,443,495,134,'正式课围绕新目标完整教学，\n补充课集中回应个人难点。\n两类课程分别保留作答，\n共同影响后续安排。',26,C.teal,true);
   text(s,52,637,1170,66,'宿主教学AI负责生成与更新课程；课内答疑模型结合教材与最新作答，支持学习中的讨论。',25,C.navy,true);
  }else if(i===12){
   await image(s,'../calculus-run/00-dialogue-record.png',48,166,803,516);
   text(s,888,185,341,49,'一句需求，启动访谈',29,C.teal,true);
   text(s,888,262,341,353,'学生最初只说想学大学高数。\nAgent接着询问学习目标、\n高中基础和每周可用时间。\n\n学生自述高数零基础，\n每周可学五小时，\n喜欢先看图再学公式。\n这些信息成为后续评估与\n课程安排的起点。',25,C.ink);
   text(s,888,633,341,40,'Codex实际执行  模拟学员',20,C.muted);
  }else if(i===13){
   await image(s,'../calculus-run/02-entry-answer.png',48,169,818,510);
   text(s,902,186,327,49,'用作答确定教学起点',28,C.teal,true);
   text(s,902,264,327,370,'Agent先用代数、函数代入、\n图像和三角比值核对基础。\n\n学生能完成部分计算，\n但遗漏了另一个横轴交点，\n也分不清坐标与函数值。\n\n因此，第一课先把函数图像\n上的点与交点讲明白。',25,C.ink);
  }else if(i===14){
   await image(s,'../calculus-run/03-first-diagram.png',48,169,818,510);
   text(s,902,186,327,86,'第一课把计算结果\n连接到图上的点',29,C.teal,true);
   text(s,902,309,327,341,'学生沿图解理解输入、\n函数值和坐标点的关系，\n再跟着完整例题找交点。\n\n每道练习后都有原位回答框。\n学生边学边写答案，\n课末还可以记录疑难，\n为下一次教学留下依据。',25,C.ink);
  }else if(i===15){
   await image(s,'../calculus-run/05-course-directory.png',48,181,770,425);
   text(s,857,181,371,49,'作答改变了后续安排',28,C.teal,true);
   text(s,857,253,371,358,'学生已能找全交点，\n但仍混淆平移后的对称轴。\n\nAgent读取保存的答案与疑难，\n生成对应的对称轴补充课。\n同时，新正式课继续推进，\n开始学习接近一点时的函数值。\n\n个人难点获得支持，\n系统学习也继续向前。',25,C.ink);
   text(s,48,655,1180,36,'本轮已实际交付2节正式课和1节关联补充课，目录与原始作答相互对应。',24,C.teal,true);

  }
 }
 s.speakerNotes.text=data.slides[i-1].speech;
}
await (await PresentationFile.exportPptx(deck)).save(output);
console.log(JSON.stringify({slides:deck.slides.items.length,output}));
const preview=process.env.PITCH_PREVIEW_DIR;
if(preview){
 await fs.mkdir(preview,{recursive:true});
 for(let i=0;i<16;i++){
  const png=await deck.export({slide:deck.slides.items[i],format:'png',scale:1});
  await fs.writeFile(path.join(preview,'slide-'+String(i+1).padStart(2,'0')+'.png'),new Uint8Array(await png.arrayBuffer()));
 }
}
