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
   text(s,55,325,540,105,'系统自学    课程备考\n项目技能学习',28,'#DCECEB',true);
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
   text(s,52,184,620,112,'资料找到之后\n今天学什么，明天怎样接着学？',35,C.teal,true);
   const rows=[['学习路线','把资源组织成逐步学习的课程'],['学习反馈','从解释与作答了解当前理解'],['持续陪伴','疑问随时讨论，下次接着学习']];
   rows.forEach((r,k)=>{text(s,54,337+k*105,580,43,r[0],29,C.navy,true);text(s,54,385+k*105,580,38,r[1],25,C.muted);});
   await image(s,'03-journey.png',697,194,535,418);
  }else if(i===4){
   text(s,50,172,1150,48,'从一句学习目标开始，逐步建立课程',31,C.teal,true);
   await image(s,'03-journey.png',195,232,880,245);
   const labels=[['说出目标','想学什么、用来做什么'],['了解起点','基础、时间、入门评估'],['生成当前课','路线规划与逐课讲解'],['学习后继续','作答、疑难与后续安排']];
   let prev;labels.forEach((r,k)=>{const x=48+k*302,n=rect(s,x,490,278,132,k%2?C.pale:'#F1EADB');text(s,x+16,501,246,40,r[0],29,C.navy,true);text(s,x+16,550,246,53,r[1],22);if(prev)arrow(s,prev,n);prev=n;});
   text(s,50,649,1150,34,'@teach-pro 我想学习大学课程：高等数学。',25,C.teal,true);
  }else if(i===5){
   await image(s,'04-architecture.png',780,174,452,440);
   const rows=[['教学规则','怎样评估、讲解、练习与续课'],['课程模板','课程首页、图解、原位练习与答疑'],['本地工具','保存记录、恢复进度、连接课内模型']];
   rows.forEach((r,k)=>{text(s,52,193+k*144,676,45,r[0],31,C.teal,true);text(s,52,251+k*144,676,48,r[1],26,C.ink);if(k<2)rule(s,52,317+k*144,674);});
   text(s,52,652,1160,35,'在支持Skill的宿主中导入，按学习目标启动教学流程',26,C.navy,true);
  }else if(i===7){
   text(s,49,174,1180,44,'教学AI、课程网页与课程工作区协作',31,C.teal,true);
   const nodes=[];
   [['教学 AI','读取Skill，生成课程'],['课程网页','阅读、作答、课内答疑'],['课程工作区','目标、课文、答案与疑难']].forEach((r,k)=>{const x=49+k*415,n=rect(s,x,260,350,126,C.pale);text(s,x+18,273,314,43,r[0],31,C.navy,true);text(s,x+18,328,314,40,r[1],24,C.muted);nodes.push(n);});
   arrow(s,nodes[0],nodes[1]);arrow(s,nodes[1],nodes[2]);
   await image(s,'04-architecture.png',440,414,374,260);
   text(s,50,454,350,108,'学习时\n网页记录回答和问题',27,C.ink,true);
   text(s,879,454,350,108,'请求继续时\n教学AI读取记录',27,C.teal,true);
  }else if(i===8){
   await image(s,'05-records.png',48,198,690,400);
   text(s,793,186,437,45,'这一次学习留下什么',30,C.teal,true);
   text(s,793,257,437,125,'学习目标与路线\n已生成课程\n练习答案、疑难与聊天',27);
   rule(s,793,417,437);
   text(s,793,445,437,45,'下一次教学读取什么',30,C.teal,true);
   text(s,793,517,437,112,'恢复上次进度\n回应问题，安排后续课程',27);
   text(s,49,650,1177,36,'课程工作区在本地持续积累，支持跨会话接续',27,C.navy,true);
  }else if(i===9){
   text(s,49,174,1180,47,'看答案，也看学生怎样解释',32,C.teal,true);
   const a=rect(s,50,316,310,135,C.pale);text(s,68,332,274,43,'学生作答',31,C.navy,true);text(s,68,391,274,43,'解释、应用与提问',25);
   const b=rect(s,858,240,370,125,C.pale);text(s,877,253,332,42,'理解清楚',29,C.navy,true);text(s,877,308,332,42,'增加变式与迁移任务',25,C.teal);
   const c=rect(s,858,447,370,125,C.sand);text(s,877,460,332,42,'需要支持',29,C.navy,true);text(s,877,515,332,42,'换例解释与分步练习',25,C.gold);
   for(const n of[b,c])s.shapes.connect(a,n,{kind:'elbow',fromSide:'right',toSide:'left',line:{fill:C.teal,width:3},tail:{type:'triangle',width:'med',length:'med'}});
   await image(s,'06-adaptation.png',419,245,363,340);
   text(s,50,650,1170,37,'教学支持随作答调整，下一课有具体的学情依据',27,C.teal,true);
  }else if(i===10){
   const a=rect(s,52,221,495,154,C.pale);text(s,72,237,455,49,'第1课 函数图像与交点',31,C.navy,true);text(s,72,303,455,44,'讲解、示范与即时练习',26);
   const b=rect(s,731,221,495,154,C.pale);text(s,751,237,455,49,'第2课 接近一点的函数值',31,C.navy,true);text(s,751,303,455,44,'进入极限的新目标',26);
   arrow(s,a,b);
   rect(s,52,446,495,147,C.sand);text(s,72,461,455,49,'关联补充课',31,C.gold,true);text(s,72,522,455,44,'平移后的对称轴',27);
   text(s,731,443,495,134,'正式课继续推进\n补充课回应个人难点\n分别保留后续作答',28,C.teal,true);
   text(s,52,651,1170,36,'以上课节来自本轮零基础高等数学实际运行',26,C.navy,true);
  }else if(i===12){
   await image(s,'../calculus-run/00-dialogue-record.png',48,166,925,516);
   text(s,1006,203,224,98,'一句需求\n启动访谈',30,C.teal,true);
   text(s,1006,344,224,144,'目标\n高中基础\n每周时间',28);
   text(s,1006,553,224,83,'Codex宿主\n模拟大一新生',22,C.muted);
  }else if(i===13){
   await image(s,'../calculus-run/02-entry-answer.png',48,169,862,510);
   text(s,946,191,284,43,'评估已有基础',28,C.teal,true);
   text(s,946,256,284,118,'代数、函数代入\n图像与三角比值',25);
   rule(s,946,403,284);
   text(s,946,425,284,43,'据作答选择首课',28,C.teal,true);
   text(s,946,492,284,143,'本次发现\n交点遗漏\n坐标与函数值混淆',25);
  }else if(i===14){
   await image(s,'../calculus-run/03-first-diagram.png',48,169,862,510);
   text(s,945,191,284,48,'第1课',31,C.teal,true);
   text(s,945,263,284,103,'函数图像上的\n点与交点',29,C.navy,true);
   rule(s,945,405,284);
   text(s,945,430,284,192,'原创图解\n完整例题\n原位练习\n课后资料与疑难记录',26);
  }else if(i===15){
   await image(s,'../calculus-run/05-course-directory.png',48,181,784,425);
   text(s,874,184,350,42,'学生仍有疑问',29,C.navy,true);
   text(s,874,244,350,108,'“式子里有x−1时，\n对称轴到底怎么判断？\n我总想沿用y轴。”',25);
   rule(s,874,382,350);
   text(s,874,405,350,42,'补充课回应难点',27,C.gold,true);
   text(s,874,458,350,39,'平移后的对称轴',25);
   text(s,874,523,350,42,'正式课推进新目标',27,C.teal,true);
   text(s,874,576,350,39,'接近一点时的函数值',25);
   text(s,48,655,1180,36,'实际交付  2节正式课、1节关联补充课，课程安排对应已保存作答',24,C.teal,true);
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

