/** Twelve original imagegen scenes with native editable teaching labels and diagrams. */
export async function buildPerSlideBatch({presentation,input}){
 const fs=await import('node:fs/promises');const root=input.repo.replaceAll('\\','/');
 const data=JSON.parse(await fs.readFile(input.dataPath,'utf8'));
 const art=JSON.parse(await fs.readFile(root+'/example/competition-materials/final-roadshow/assets/per-slide/manifest.json','utf8'));
 const C={navy:'#102A43',ink:'#18364B',teal:'#087F70',mint:'#58D3BF',paper:'#FAF7EF',white:'#FFFFFF',muted:'#536C7C',line:'#CCDCE1',pale:'#E1F1EA',gold:'#AE762D',sand:'#F6E8CF'};
 function text(s,x,y,w,h,value,size=27,color=C.ink,bold=false,align='left'){
  const n=s.shapes.add({geometry:'textbox',name:value.slice(0,36),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});n.text=value;n.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',autoFit:'none',insets:0};return n;
 }
 function rect(s,x,y,w,h,fill='none'){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
 function rule(s,x,y,w,color=C.line){return rect(s,x,y,w,2,color);}
 function node(s,x,y,w,h,v,fill=C.white,size=26,color=C.ink){const n=rect(s,x,y,w,h,fill);n.text=v;n.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold:true,alignment:'center',verticalAlignment:'middle',autoFit:'none',insets:8};return n;}
 function arrow(s,a,b,from='right',to='left',color=C.teal,kind='straight',both=false){return s.shapes.connect(a,b,{kind,fromSide:from,toSide:to,line:{fill:color,width:3},...(both?{head:{type:'triangle',width:'med',length:'med'}}:{}),tail:{type:'triangle',width:'med',length:'med'}});}
 function pathArrow(s,x1,y1,x2,y2,color=C.teal,end=true){
  if(x1!==x2&&y1!==y2)throw new Error('Use axis-aligned segments for exact teaching arrows');
  const reverse=x2<x1||y2<y1;
  return s.shapes.add({geometry:'connector',kind:'straight',position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)},line:{fill:color,width:3},...(end?{[reverse?'head':'tail']:{type:'triangle',width:'med',length:'med'}}:{})});
 }
 async function image(s,relative,x,y,w,h,alt,fit='contain',crop){const source=input.embedImages?{blob:new Uint8Array(await fs.readFile(root+'/'+relative)),contentType:'image/png'}:{path:root+'/'+relative};return s.images.add({...source,position:{left:x,top:y,width:w,height:h},fit,alt,...(crop?{crop}:{})});}
 async function base(i){
  const s=presentation.slides.add({width:1280,height:720});s.background.fill=C.paper;
  const relative='example/competition-materials/final-roadshow/assets/per-slide/'+art.pages[i-1].file;
  if(i===4)await image(s,relative,878,179,363,448,'Skill工具包与课程档案协作插画','cover',{left:0.5,top:0,right:0,bottom:0});
  else if(i===9)await image(s,relative,883,170,365,470,'统计学中间位置与学习记录插画','cover',{left:0.68,top:0.15,right:0,bottom:0.03});
  else await image(s,relative,0,0,1280,720,'第'+i+'页专用Teach Pro概念插画','cover');
  if(i!==1&&i!==12){
   rect(s,0,0,1280,i===11?163:154,C.paper);
   text(s,64,44,1100,i===11?62:78,data.slides[i-1].title,37,C.navy,true);rule(s,64,i===11?161:145,1152);text(s,1170,65,45,30,String(i).padStart(2,'0'),17,C.muted,false,'right');
  }
  return s;
 }
 function notes(s,i){const d=data.slides[i-1];s.speakerNotes.text=`第${i}页  ${d.seconds}秒\n\n${d.speech}\n\n动作提示\n${d.cue}\n\n材料来源\n${d.sources.join('\n')}`;}
 for(let i=input.start;i<=input.end;i++){
  const s=await base(i);
  if(i===1){text(s,68,112,610,90,'学途智伴',68,C.white,true);text(s,72,237,590,108,'大学生长期\n自适应学习智能体',36,'#DCECEB',true);text(s,73,402,585,62,'自适应教学 Skill 技能包',29,C.mint,true);text(s,74,604,550,40,'重邮FFBond  ·  决赛路演',23,'#D1E2E5');}
  else if(i===2){
   text(s,65,171,492,87,'希望 AI 像学习私教一样\n接着我的进度继续教',33,C.navy,true);
   const rows=[['01','系统课程','资料组织成学习路线'],['02','了解学情','由作答与疑问了解学情'],['03','动态安排','按学情安排下一步']];
   rows.forEach((r,k)=>{const y=262+k*80;text(s,67,y,59,39,r[0],29,C.gold,true);text(s,145,y,252,37,r[1],28,C.teal,true);text(s,145,y+37,264,34,r[2],22,C.muted);});
  }else if(i===3){
   rect(s,0,154,1280,141,C.paper);rect(s,0,600,1280,120,C.paper);text(s,74,163,1120,49,'“我想学习Agent开发与安全，请先评估我的基础。”',29,C.teal,true);
   const labels=['导入 Skill\n提出学习目标','访谈与评估\n明确学习起点','学习当前课\n阅读、作答、答疑','依据记录续课\n正式课与按需补充'];
   labels.forEach((v,k)=>text(s,63+k*300,225,257,63,v,25,C.navy,true,'center'));for(let k=0;k<3;k++)pathArrow(s,321+k*300,256,363+k*300,256);
   text(s,74,613,1125,44,'学生得到自己的课程工作区，学完请求继续，教学按记录接续',28,C.navy,true);
   text(s,75,661,1110,32,'图解与讲解  ·  题后练习  ·  一手资料  ·  课内随时答疑',24,C.teal);
  }else if(i===4){
   text(s,73,174,795,45,'Skill提供：教学规则、课程模板、本地工具',28,C.teal,true);
   const a=node(s,74,288,205,101,'教学 AI\n调用 Skill',C.navy,26,C.white),b=node(s,335,288,205,101,'课程网页\n阅读与作答',C.pale,26),c=node(s,596,288,205,101,'课内答疑\n教材与作答',C.navy,26,C.white);
   arrow(s,a,b);arrow(s,b,c,'right','left',C.teal,'straight',true);text(s,282,245,49,31,'生成',22,C.muted,false,'center');text(s,542,245,52,31,'问答',22,C.muted,false,'center');
   const d=node(s,335,523,466,88,'课程工作区\n目标、课文、答案、聊天与疑难',C.pale,24);arrow(s,b,d,'bottom','top',C.teal,'elbow');arrow(s,d,a,'left','bottom',C.teal,'elbow');text(s,618,438,250,41,'本地服务同步保存',23,C.muted);
   text(s,74,651,1120,43,'请求继续：教学 AI 读取课程工作区，安排后续教学',27,C.navy,true);
  }else if(i===5){
   rect(s,64,161,437,86,C.paper);rect(s,0,616,1280,104,C.paper);
   text(s,73,170,440,75,'把这一次的回答与问题\n接到下一次教学',31,C.teal,true);
   ['这一次学习','课程工作区','下一次继续'].forEach((v,k)=>text(s,73+k*416,625,300,44,v,28,C.navy,true,'center'));pathArrow(s,373,647,489,647);pathArrow(s,789,647,905,647);
   text(s,76,673,1098,29,'目标与路线、已生成课程、作答与疑难，在本地持续积累',23,C.muted);
  }else if(i===6){
   text(s,73,168,785,43,'从作答判断学情，再选择教学支持',29,C.teal,true);
   const a=text(s,72,625,299,44,'学生作答',28,C.navy,true,'center'),b=text(s,462,625,290,44,'判断当前理解',28,C.navy,true,'center'),c=text(s,859,380,347,43,'变式与迁移任务',27,C.teal,true,'center'),d=text(s,859,625,347,44,'换例解释与分步练习',26,C.gold,true,'center');
   pathArrow(s,371,647,462,647);pathArrow(s,752,647,805,647,C.teal,false);pathArrow(s,805,647,805,402,C.teal,false);pathArrow(s,805,402,859,402);pathArrow(s,805,647,859,647,C.gold);
   text(s,73,679,1100,27,'最新作答随提问进入答疑上下文，围绕本题继续讨论',22,C.muted);
  }else if(i===7){
   const labels=['第 1 课\n消息与调用','第 2 课\n推理循环','第 3 课\n安全工具调用契约'];
   labels.forEach((v,k)=>text(s,157+k*391,284,260,91,v,28,C.navy,true,'center'));
   pathArrow(s,435,338,483,338);pathArrow(s,811,338,875,338);
   text(s,550,540,240,66,'关联补充课\n外部文本与工具决策',23,C.gold,true,'center');pathArrow(s,659,496,659,518,C.gold);
   text(s,329,667,863,36,'正式课推进新目标，补充课回应具体疑难',26,C.navy,true);
  }else if(i===8){
   await image(s,'example/competition-pages/assets/tutor-preview.png',62,202,900,423,'真实课程中的两轮课内答疑');
   text(s,1035,189,176,71,'60秒',52,C.teal,true);
   const l=text(s,73,665,850,30,'完整操作演示（备用）',22,C.teal,true);l.hyperlink={uri:'https://roamerfly.github.io/teach-pro-skill/assets/demo.mp4',isExternal:true};
  }else if(i===9){
   text(s,73,171,798,72,'原始数据：10、20、30、100 元\n中位数为25元',27,C.teal,true);
   text(s,74,280,185,75,'替换最大值\n仍是4人',25,C.navy,true);
   [10,20,30,1000].forEach((v,k)=>node(s,281+k*108,291,94,63,String(v),k===1||k===2?C.sand:C.white,28));
   rule(s,388,373,201,C.gold);text(s,389,387,202,32,'两个中间值取平均',21,C.muted,false,'center');text(s,726,282,146,85,'中位数\n25元',27,C.gold,true,'center');
   rule(s,74,452,793);text(s,74,489,185,78,'新增一条记录\n变为5人',25,C.navy,true);
   [10,20,30,100,1000].forEach((v,k)=>node(s,281+k*108,502,94,63,String(v),k===2?C.pale:C.white,28));
   text(s,488,578,129,32,'第3个值',21,C.muted,false,'center');text(s,75,631,790,47,'解释清楚：迁移练习；继续理解：补充讲解与计算支持',24,C.navy,true);
   text(s,615,578,253,35,'中位数30元',27,C.teal,true,'right');
  }else if(i===10){
   ['页面操作','学习记录','课程产物'].forEach((v,k)=>text(s,75+k*416,511,300,48,v,29,C.teal,true,'center'));pathArrow(s,375,535,491,535);pathArrow(s,791,535,907,535);
   const rows=['作答保存与恢复\n新会话读取本地答案','最新作答进入答疑\n核对答案与题目位置','正式课与补充课\n查看疑难对应的产物'];rows.forEach((v,k)=>text(s,73+k*416,588,312,79,v,24,C.navy,false,'center'));
  }else if(i===11){
   ['系统自学','课程备考','项目技能'].forEach((v,k)=>text(s,164+k*339,119,285,34,v,25,C.navy,true,'center'));
   rect(s,0,674,1280,46,C.navy);
   text(s,74,682,1110,32,'下一阶段：扩展学科案例，结合大学生试用打磨教学体验',23,C.white,true);
  }else if(i===12){
   text(s,70,87,600,65,'学途智伴',45,C.white,true);text(s,70,199,640,155,'让下一次教学\n接着这一次学习',49,C.white,true);text(s,74,413,551,105,'课程工作区接续学情\n实际作答参与教学决策\n正式课与补充课协同推进',27,'#C9E9E3');text(s,75,611,514,39,'重邮FFBond  ·  欢迎提问',23,'#D1E2E5');
  }
  notes(s,i);
 }
 return {slides:presentation.slides.items.length,batch:[input.start,input.end],imageCount:12};
}
