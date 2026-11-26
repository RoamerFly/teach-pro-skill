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
  await image(s,i===1?'01-cover.png':'12-closing.png',0,0,1280,720,'cover');rect(s,0,0,650,720,C.navy);
  if(i===1){
   text(s,55,115,570,100,'学途智伴',68,C.white,true);
   text(s,57,241,555,110,'大学生长期\n自适应学习智能体',37,'#DCECEB',true);
   text(s,57,412,555,50,'自适应教学 Skill 技能包',29,'#58D3BF',true);
   text(s,57,615,560,35,'重邮FFBond  总决赛现场路演',23,'#D1E2E5');
  }else{
   text(s,52,95,560,145,'让下一次教学\n接着这一次学习',43,C.white,true);
   text(s,55,282,540,47,'本轮高数模拟学员实测',28,'#58D3BF',true);
   text(s,55,342,540,100,'4轮教学对话\n2节正式课 + 1节关联补充课',29,'#DCECEB',true);
   text(s,55,481,540,96,'后续：打磨学情判断与学科模板\n场景：系统自学、课程备考、项目学习',24,'#DCECEB');
   text(s,55,625,540,35,'重邮FFBond  谢谢各位评委',23,'#D1E2E5');
  }
 }else if([2,6,11].includes(i)){
  const art={2:'02-motivation.png',6:'04-architecture.png',11:'11-use-cases.png'}[i];
  await image(s,art,610,90,650,550);rect(s,0,0,610,720,C.navy);
  text(s,53,105,505,100,{2:'01',6:'02',11:'03'}[i],77,'#58D3BF',true);
  text(s,55,245,520,90,data.slides[i-1].title,43,C.white,true);
  text(s,57,397,500,120,{2:'把资料组织成课程\n从目标与基础开始',6:'留下学习记录\n依据作答安排下一课',11:'现场操作 60 秒\n评估、作答、答疑与续课目录'}[i],29,'#DCECEB');
  rule(s,55,579,470,'#3D6375');
  text(s,55,608,485,45,i===11?'案例来源：Codex实际调用Teach Pro':'学途智伴  自适应教学 Skill',21,'#D1E2E5');
 }else{
  top(s,i,i<6?'第一章 设计初衷':i<11?'第二章 教学机制':'第三章 演示与价值');
  if(i===3){
   await image(s,'../infographics/motivation-and-design.png',80,156,1120,479);
   text(s,49,650,1182,47,'我的初衷是把快速找到的资料组织成课程，通过作答和疑问，让教学持续贴合学习情况。',24,C.navy,true);
  }else if(i===4){
   await image(s,'../infographics/learner-journey.png',80,156,1120,479);
   text(s,49,650,1182,47,'从一句学习目标开始，先了解基础、再逐课学习；学完请求继续，AI读取记录安排后续课程。',24,C.navy,true);
  }else if(i===5){
   await image(s,'../infographics/skill-package-components.png',80,156,1120,479);
   text(s,49,650,1182,47,'把教学方法、网页模板和保存工具打包交给AI，学生就能从自己的目标开始学。',24,C.navy,true);
  }else if(i===7){
   await image(s,'../workflow/teach-pro-workflow-architecture.png',120,157,1040,541);
  }else if(i===8){
   await image(s,'../infographics/first-lesson-generation.png',80,156,1120,479);
   text(s,49,650,1182,47,'先了解目标和基础，再把当前要学的一点讲清楚：有图解、有例题，也有可以直接作答的练习。',24,C.navy,true);
  }else if(i===9){
   await image(s,'../infographics/evidence-and-continuation.png',80,156,1120,479);
   text(s,49,650,1182,47,'学完请求继续，AI读取答案和疑问：新正式课推进主线，补充课帮助理解个人难点。',24,C.navy,true);
  }else if(i===10){
   const rows=[
    ['教学方法可以复用','SKILL.md组织目标访谈、基础评估、逐课讲授和续课决策。','规则 → 教学行为'],
    ['答案和问题自动保存','课程网页承载图解、原位作答与答疑，本地文件接续跨会话学情。','学习 → 学情记录'],
    ['根据答案安排下一课','新正式课推进学习路线，关联补充课回应个人难点。','作答 → 后续课程']
   ];
   rows.forEach((r,k)=>{const y=180+k*157;rect(s,48,y,8,132,C.teal);text(s,78,y+2,330,48,r[0],30,C.teal,true);text(s,78,y+61,775,66,r[1],26,C.ink);text(s,910,y+32,310,62,r[2],24,C.navy,true);if(k<2)rule(s,78,y+145,1150);});
  }else if(i===12){
   await image(s,'../calculus-run/00-dialogue-record.png',48,166,803,516);
   text(s,888,185,341,49,'一句需求，启动访谈',29,C.teal,true);
   text(s,888,260,341,353,'学生最初只说想学大学高数。\nAgent接着询问学习目标、\n高中基础和每周可用时间。\n\n学生自述高数零基础，\n每周可学五小时，\n喜欢先看图再学公式。\n这些信息成为后续评估与\n课程安排的起点。',25,C.ink,false,'left','top');
   text(s,888,633,341,40,'Codex实际执行  模拟学员',20,C.muted);
  }else if(i===13){
   await image(s,'../calculus-run/02-entry-answer.png',48,169,818,510);
   text(s,902,186,327,49,'用作答确定教学起点',28,C.teal,true);
   text(s,902,264,327,370,'评估用代数、函数代入、\n图像和三角比值核对基础。\n\n学生能完成计算，\n但图像题遗漏交点，\n坐标与函数值仍易混淆。\n\n因此，首课先讲明白\n函数图像上的点与交点。',25,C.ink,false,'left','top');
  }else if(i===14){
   await image(s,'../calculus-run/03-first-diagram.png',48,169,818,510);
   text(s,902,186,327,86,'第一课把计算结果\n连接到图上的点',29,C.teal,true);
   text(s,902,309,327,341,'首课通过图解与完整例题，\n把输入、函数值和坐标点\n连接起来。\n\n学生在题目后原位作答，\n课末记录疑难。\n答案与问题自动保存，\n成为后续教学的依据。',25,C.ink,false,'left','top');
  }else if(i===15){
   await image(s,'../calculus-run/05-course-directory.png',48,181,770,425);
   text(s,857,181,371,49,'作答改变了后续安排',28,C.teal,true);
   text(s,857,253,371,358,'学生已能找全交点，\n仍不确定平移后的对称轴。\n\nAgent读取作答，\n生成对称轴补充课，\n同时交付新正式课，\n进入极限直觉。\n\n目录呈现新目标与个人难点\n各自对应的学习入口。',25,C.ink,false,'left','top');
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
