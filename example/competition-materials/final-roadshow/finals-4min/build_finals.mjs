/** Sixteen-slide, three-chapter finals deck with editable labels and diagrams. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const [modules,output]=process.argv.slice(2);
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(modules,'@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const here=path.dirname(fileURLToPath(import.meta.url));
const assetRoot=path.resolve(here,'..');
const data=JSON.parse(await fs.readFile(path.join(here,'路演内容.json'),'utf8'));
const deck=Presentation.create({slideSize:{width:1280,height:720}});
const C={navy:'#102A43',ink:'#18364B',teal:'#087F70',paper:'#FAF7EF',white:'#FFFFFF',muted:'#536C7C',line:'#CCDCE1',pale:'#E1F1EA',gold:'#AE762D',sand:'#F6E8CF'};
function rect(s,x,y,w,h,fill){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
function text(s,x,y,w,h,value,size=26,color=C.ink,bold=false,align='left',vertical='middle'){
 const n=rect(s,x,y,w,h,'none');n.text=value;n.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold,alignment:align,verticalAlignment:vertical,autoFit:'none',insets:0};return n;
}
async function image(s,file,x,y,w,h,fit='contain'){return s.images.add({blob:new Uint8Array(await fs.readFile(path.join(assetRoot,'assets/per-slide',file))),contentType:'image/png',position:{left:x,top:y,width:w,height:h},fit,alt:file});}
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
  await image(s,i===1?'01-cover.png':'12-closing.png',0,0,1280,720,'cover');rect(s,0,0,650,720,C.paper);
  if(i===1){
   text(s,55,115,570,100,'学途智伴',68,C.teal,true);
   text(s,57,241,555,110,'大学生长期\n自适应学习智能体',37,C.navy,true);
   text(s,57,412,555,50,'自适应教学 Skill 技能包',29,C.teal,true);
   text(s,57,615,560,35,'重邮FFBond  总决赛现场路演',23,C.muted);
  }else{
   text(s,52,95,560,145,'把零散提问连成持续学习\n让每次投入都有积累',42,C.navy,true);
   text(s,55,282,540,47,'学途智伴 · 自适应教学 Skill',28,C.teal,true);
   text(s,55,350,540,100,'从自己的学习目标开始\n依据实际作答安排后续课程',29,C.ink,true);
   text(s,55,489,540,90,'学生专注理解、练习与提问\nAI根据学习记录持续安排教学',25,C.muted);
   text(s,55,625,540,35,'重邮FFBond  刘飞扬  谢谢各位评委',23,C.muted);
  }
 }else if([2,6,11].includes(i)){
  const art={2:'02-motivation.png',6:'04-architecture.png',11:'11-use-cases.png'}[i];
  await image(s,art,610,90,650,550);rect(s,0,0,610,720,C.paper);
  text(s,53,105,505,100,{2:'01',6:'02',11:'03'}[i],77,C.teal,true);
  text(s,55,245,520,90,data.slides[i-1].title,43,C.navy,true);
  text(s,57,397,500,120,{2:'资料找到以后\n怎样把学习持续下去',6:'目标决定教学起点\n作答影响后续课程',11:'用一位零基础模拟新生\n串起评估、学习与续课'}[i],29,C.ink);
  if(i===11){
   const button=s.shapes.add({name:'Open demo video',geometry:'roundRect',borderRadius:12,position:{left:57,top:539,width:326,height:58},fill:C.teal,line:{fill:'none',width:0},hyperlink:{uri:data.video_button.target,isExternal:true}});
   button.text=data.video_button.label;button.text.style={typeface:'Microsoft YaHei',fontSize:26,bold:true,color:C.white,alignment:'center',verticalAlignment:'middle',insets:0};
  }
  rule(s,55,i===11?622:579,470,C.line);
  text(s,55,i===11?650:608,485,38,i===11?'案例：实际运行记录 · 模拟学员':'学途智伴  自适应教学 Skill',21,C.muted);
 }else{
  top(s,i,i<6?'第一章 设计初衷':i<11?'第二章 工作流程':'第三章 高数案例');
  if(i===3){
   await image(s,'../infographics/chat-to-course-comparison.png',48,158,1184,477);
   text(s,49,650,1182,47,'让学习目标、课程内容与作答记录接起来，后续教学才有持续参考的学情。',24,C.navy,true);
  }else if(i===4){
   await image(s,'../infographics/learner-journey.png',80,156,1120,479);
   text(s,49,650,1182,47,'目标访谈 → 入门诊断 → 规划路线 → 逐课学习 → 依据作答续课',24,C.navy,true);
  }else if(i===5){
   await image(s,'../infographics/skill-package-components.png',80,156,1120,479);
   text(s,49,650,1182,47,'教学规则决定怎样教，网页模板承载怎样学，本地工具保存学过什么、哪里仍有疑问。',24,C.navy,true);
  }else if(i===7){
   await image(s,'../workflow/teach-pro-workflow-architecture.png',120,153,1040,503);
   text(s,49,658,1182,40,'课程Agent负责备课与续课，课内AI及时答疑，本地文件持续保存学习记录。',24,C.navy,true);
  }else if(i===8){
   await image(s,'../infographics/first-lesson-generation.png',80,156,1120,479);
   text(s,49,650,1182,47,'目标与评估选定当前一课，图解、例题、练习与精选资料共同服务这一目标。',24,C.navy,true);
  }else if(i===9){
   await image(s,'../infographics/python-adaptive-comparison.png',48,158,1184,477);
   text(s,49,650,1182,47,'自适应体现在后续怎么教：根据解释、新题表现与疑问，调整内容、难度和提示。',24,C.navy,true);
  }else if(i===10){
   const rows=[
    ['教学流程可复用','将访谈、诊断、讲解与续课组织成Skill，供Agent按流程执行。','教学规则 → Agent行动'],
    ['学习状态跨会话延续','目标、路线、作答与聊天保存在课程目录，继续学习时重新读取。','本地学情 → 持续教学'],
    ['学习证据决定怎样教','依据解释与新题表现调整教学，\n正式课推进主线，补充课回应难点。','学习表现 → 课程调整']
   ];
   rows.forEach((r,k)=>{const y=180+k*157;rect(s,48,y,8,132,C.teal);text(s,78,y+2,775,48,r[0],30,C.teal,true);text(s,78,y+61,775,66,r[1],26,C.ink);text(s,910,y+32,310,62,r[2],23,C.navy,true);if(k<2)rule(s,78,y+145,1150);});
  }else if(i===12){
   await image(s,'../calculus-run/00-dialogue-record.png',48,166,803,516);
   text(s,888,185,341,49,'先了解这位学生',29,C.teal,true);
   text(s,888,260,341,353,'学生只说：想学大学高数。\nAI主动了解目标与基础。\n\n目标：跟上大学课程\n基础：高数零基础\n高中函数图像有些生疏\n时间：每周五小时\n偏好：先看图和例子\n\n据此安排基础评估。',25,C.ink,false,'left','top');
   text(s,888,633,341,40,'Codex实际执行  模拟学员',20,C.muted);
  }else if(i===13){
   await image(s,'../calculus-run/02-entry-answer.png',48,169,818,510);
   text(s,902,186,327,49,'从回答中找到起点',28,C.teal,true);
   text(s,902,264,327,370,'评估检查代数、函数和图像。\n\n已表现：基本计算正确\n待讲清：图像题漏掉一个交点\n\n所以，首课先讲函数图像\n上的点与交点，再逐步进入\n大学高数的极限内容。',25,C.ink,false,'left','top');
  }else if(i===14){
   await image(s,'../calculus-run/03-first-diagram.png',48,169,818,510);
   text(s,902,186,327,86,'把概念变成能做的题',29,C.teal,true);
   text(s,902,309,327,341,'先看图解和完整例题，\n理解输入、函数值与坐标点。\n\n再在每道题后直接作答，\n遇到疑问就打开课内答疑。\n\n作答与疑问自动保存，\n下一次备课就有了依据。',25,C.ink,false,'left','top');
  }else if(i===15){
   await image(s,'../calculus-run/05-course-directory.png',48,181,770,425);
   text(s,857,181,371,49,'同一份作答，两种安排',28,C.teal,true);
   text(s,857,253,371,358,'本课表现：交点已经找全，\n平移后的对称轴仍有疑问。\n\n补充课：讲清平移与对称\n正式课：继续学习极限直觉\n\n个人难点得到专门讲解，\n学习主线也继续向前。',25,C.ink,false,'left','top');
   text(s,48,655,1180,36,'本轮实际交付：2节正式课 + 1节关联补充课。课程安排与模拟学员的实际作答对应。',24,C.teal,true);

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
