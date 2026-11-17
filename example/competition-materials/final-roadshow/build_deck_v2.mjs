/** Logic-first visual revision. Native diagrams remain editable in Slides and PPTX. */
export async function buildVisualBatch({presentation,input}){
 const fs=await import('node:fs/promises');
 const data=JSON.parse(await fs.readFile(input.dataPath,'utf8'));
 const root=input.repo.replaceAll('\\','/');
 const C={navy:'#102A43',ink:'#18364B',teal:'#087F70',mint:'#58D3BF',paper:'#F5F8FA',cream:'#FAF7EF',white:'#FFFFFF',muted:'#536C7C',line:'#CCDCE1',pale:'#E1F1EA',gold:'#AE762D',sand:'#F6E8CF'};
 function text(s,x,y,w,h,v,size=27,color=C.ink,bold=false,align='left'){
  const a=s.shapes.add({geometry:'textbox',name:v.slice(0,40),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});a.text=v;a.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',autoFit:'none',insets:0};return a;
 }
 function rect(s,x,y,w,h,fill,line='none'){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:line,width:line==='none'?0:1}});}
 function rule(s,x,y,w,color=C.line){return rect(s,x,y,w,2,color);}
 function node(s,x,y,w,h,label,fill=C.white,size=27,color=C.ink){const n=rect(s,x,y,w,h,fill);n.text=label;n.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold:true,alignment:'center',verticalAlignment:'middle',autoFit:'none',insets:12};return n;}
 function arrow(s,a,b,from='right',to='left',color=C.teal,kind='straight',both=false){return s.shapes.connect(a,b,{kind,fromSide:from,toSide:to,line:{fill:color,width:3},...(both?{head:{type:'triangle',width:'med',length:'med'}}:{}),tail:{type:'triangle',width:'med',length:'med'}});}
 async function image(s,path,x,y,w,h,alt,fit='contain'){
  const src=input.embedImages?{blob:new Uint8Array(await fs.readFile(root+'/'+path)),contentType:'image/png'}:{path:root+'/'+path};
  return s.images.add({...src,position:{left:x,top:y,width:w,height:h},fit,alt});
 }
 function base(i,{dark=false,cream=false}={}){
  const s=presentation.slides.add({width:1280,height:720});s.background.fill=dark?C.navy:cream?C.cream:C.paper;
  if(i!==1&&i!==12){text(s,64,52,1150,74,data.slides[i-1].title,37,dark?C.white:C.navy,true);rule(s,64,145,1152,dark?'#3E5A6E':C.line);text(s,1168,666,46,28,String(i).padStart(2,'0'),17,dark?'#B5CED8':C.muted,false,'right');}
  return s;
 }
 function notes(s,i){const d=data.slides[i-1];s.speakerNotes.text=`第${i}页  ${d.seconds}秒\n\n${d.speech}\n\n动作提示\n${d.cue}\n\n材料来源\n${d.sources.join('\n')}`;}
 for(let i=input.start;i<=input.end;i++){
  let s;
  if(i===1){
   s=base(i,{dark:true});await image(s,'example/competition-materials/final-roadshow/assets/skill-learning-journey.png',0,0,1280,720,'课程与作答连接成持续学习路径的概念背景','cover');
   text(s,68,112,610,90,'学途智伴',68,C.white,true);
   text(s,72,237,590,108,'大学生长期\n自适应学习智能体',36,'#DCECEB',true);
   text(s,73,402,585,62,'自适应教学 Skill 技能包',29,C.mint,true);
   text(s,74,604,550,40,'重邮FFBond  ·  决赛路演',23,'#D1E2E5');
  }else if(i===2){
   s=base(i,{cream:true});await image(s,'example/competition-materials/final-roadshow/assets/skill-learning-motivation.png',661,176,555,493,'学生在课程、练习、资料和答疑中持续学习的场景');
   text(s,70,179,579,105,'希望AI像学习私教一样\n接着我的进度继续教',37,C.navy,true);
   const rows=[['01','系统课程','把资料组织成学习路线'],['02','了解学情','从作答与疑问看当前理解'],['03','动态安排','根据学习情况决定下一步']];
   rows.forEach((r,k)=>{const y=326+k*102;text(s,72,y,62,50,r[0],30,C.gold,true);text(s,156,y,450,43,r[1],29,C.teal,true);text(s,157,y+45,475,43,r[2],25,C.muted);});
  }else if(i===3){
   s=base(i);text(s,71,170,1110,55,'“我想学习Agent开发与安全，请先评估我的基础。”',30,C.teal,true);
   const n=[['导入 Skill','提出学习目标'],['访谈与评估','明确学习起点'],['学习当前课','阅读、作答、答疑'],['依据记录续课','正式课与按需补充']].map((r,k)=>node(s,70+k*296,259,250,94,r.join('\n'),k===3?C.pale:C.white,25));
   for(let k=0;k<3;k++)arrow(s,n[k],n[k+1]);
   await image(s,'example/competition-materials/rc12/assets/course-home.png',72,394,526,247,'智鉴Agent真实课程首页');
   text(s,662,405,538,51,'学生得到自己的课程工作区',31,C.navy,true);
   text(s,664,480,525,106,'图解与讲解  ·  题后练习\n一手资料  ·  课内随时答疑',27,C.muted);
   text(s,664,602,525,45,'学完请求继续，教学按记录接续',26,C.teal,true);
  }else if(i===4){
   s=base(i,{dark:true});text(s,72,166,1130,53,'Skill提供：教学规则  ·  课程模板  ·  本地工具',29,C.mint,true);
   const host=node(s,74,276,315,108,'教学 AI\n宿主中调用 Skill','#21455B',28,C.white);
   const page=node(s,484,276,315,108,'课程网页\n阅读、练习与资料','#E4F3EF',28,C.navy);
   const tutor=node(s,894,276,314,108,'课内答疑模型\n结合教材和最新作答','#21455B',27,C.white);
   arrow(s,host,page,'right','left',C.mint);arrow(s,page,tutor,'right','left',C.mint,'straight',true);
   text(s,393,233,88,36,'生成',23,'#C9DEDE',false,'center');text(s,803,233,87,36,'问答',23,'#C9DEDE',false,'center');
   const workspace=node(s,483,526,555,92,'课程工作区\n目标、课文、答案、聊天与疑难','#E4F3EF',27,C.navy);
   arrow(s,page,workspace,'bottom','top',C.mint,'elbow');text(s,855,438,350,45,'本地服务同步保存',24,'#D6E7E7');
   arrow(s,workspace,host,'left','bottom',C.mint,'elbow');text(s,74,648,1080,45,'请求继续：教学 AI 读取课程工作区，安排后续教学',26,'#D6E7E7');
  }else if(i===5){
   s=base(i);text(s,74,175,1090,50,'把今天留下的回答与问题，变成下次教学的起点',30,C.teal,true);
   const a=node(s,73,363,275,92,'这一次学习',C.white,30);
   rect(s,485,268,116,26,'#9DCEC1');const b=node(s,485,292,306,234,'课程工作区',C.pale,31);b.text='';text(s,508,307,261,49,'课程工作区',30,C.teal,true,'center');
   ['目标与路线','已生成的课程','作答、聊天与疑难'].forEach((v,k)=>{text(s,514,377+k*43,252,38,v,25,C.ink,false,'center');});
   const c=node(s,930,363,278,92,'下一次继续',C.white,30);arrow(s,a,b);arrow(s,b,c);
   text(s,75,487,302,92,'理解消息与推理循环\n留下具体疑问',26,C.muted);
   text(s,928,487,282,92,'读取已有学习记录\n回应疑问，安排新课',26,C.muted);
   rule(s,74,595,1130);text(s,75,616,1110,46,'学习目录持续积累，新会话从已有进度接着教',29,C.navy,true);
  }else if(i===6){
   s=base(i);text(s,73,175,1110,53,'可观察的学习表现，连接到具体的教学支持',30,C.teal,true);
   const answer=node(s,73,341,290,115,'学生的实际作答\n解释、应用与迁移',C.white,27);
   const judge=s.shapes.add({geometry:'diamond',position:{left:451,top:299,width:279,height:196},fill:C.pale,line:{fill:'none',width:0}});judge.text='学情\n判断';judge.text.style={typeface:'Microsoft YaHei',fontSize:30,bold:true,color:C.teal,alignment:'center',verticalAlignment:'middle',insets:18};
   const advanced=node(s,897,266,310,104,'关键关系说清楚\n变式与迁移任务',C.white,27);
   const support=node(s,897,463,310,104,'继续理解具体关系\n换例解释与分步练习',C.sand,26);
   arrow(s,answer,judge);arrow(s,judge,advanced,'right','left',C.teal,'elbow');arrow(s,judge,support,'right','left',C.gold,'elbow');
   text(s,74,608,1100,47,'写完即可围绕本题提问，最新作答随问题进入答疑上下文',27,C.navy,true);
  }else if(i===7){
   s=base(i);text(s,73,177,1110,50,'智鉴 Agent：主线学习与具体难点同步照顾',29,C.teal,true);
   const a=node(s,73,286,285,104,'第 1 课\n消息与调用',C.white,28),b=node(s,491,286,285,104,'第 2 课\n推理循环',C.white,28),c=node(s,907,286,300,104,'第 3 课\n安全工具调用契约',C.pale,27);arrow(s,a,b);arrow(s,b,c);
   const add=node(s,491,491,399,95,'关联补充课\n外部文本与工具决策',C.sand,27);arrow(s,b,add,'bottom','top',C.gold);
   text(s,944,492,262,91,'集中解释\n个人理解中的难点',25,C.gold,true);
   text(s,74,621,1125,43,'正式课推进新目标，补充课回应具体疑难，分别记录学习表现',27,C.navy,true);
  }else if(i===8){
   s=base(i);await image(s,'example/competition-pages/assets/tutor-preview.png',66,188,920,441,'真实课程中的课内两轮答疑界面');
   text(s,1024,186,188,81,'60秒',57,C.teal,true);
   ['确定起点','图解与资料','作答和答疑','主线与补充'].forEach((v,k)=>text(s,1026,312+k*73,186,51,v,25,C.navy,k===3));
   const l=text(s,74,637,820,34,'完整操作演示（备用）',22,C.teal,true);l.hyperlink={uri:'https://roamerfly.github.io/teach-pro-skill/assets/demo.mp4',isExternal:true};
  }else if(i===9){
   s=base(i);text(s,74,170,1120,52,'校园消费：原始数据 10、20、30、100 元，中位数25元',29,C.teal,true);
   text(s,74,276,235,98,'替换最大值\n仍是4人',28,C.navy,true);
   [10,20,30,1000].forEach((v,k)=>node(s,340+k*125,292,110,66,String(v),k===1||k===2?C.sand:C.white,31));
   rule(s,467,377,231,C.gold);text(s,469,389,235,39,'两个中间值取平均',22,C.muted,false,'center');text(s,997,282,212,82,'中位数\n25元',30,C.gold,true,'center');
   rule(s,74,448,1130);
   text(s,74,489,235,99,'新增一条记录\n变为5人',28,C.navy,true);
   [10,20,30,100,1000].forEach((v,k)=>node(s,340+k*125,504,110,66,String(v),k===2?C.pale:C.white,31));
   text(s,575,581,147,39,'第3个值',22,C.muted,false,'center');text(s,997,494,212,82,'中位数\n30元',30,C.teal,true,'center');
   text(s,75,636,1110,40,'解释清楚：迁移练习       继续理解排序位置：补充讲解与计算支持',25,C.navy,true);
  }else if(i===10){
   s=base(i);text(s,74,176,1110,49,'教学机制对应到操作、记录和后续产物',30,C.teal,true);
   const n=['页面操作','学习记录','课程产物'].map((v,k)=>node(s,74+k*416,267,300,70,v,k===1?C.pale:C.white,29));arrow(s,n[0],n[1]);arrow(s,n[1],n[2]);
   const rows=[['保存与恢复','新浏览器会话恢复本地作答'],['最新作答进入答疑','核对提问携带的答案与题目位置'],['正式课与补充课','查看具体疑难对应的两类教学产物']];
   rows.forEach((r,k)=>{const y=391+k*87;text(s,76,y,345,49,r[0],28,C.navy,true);text(s,464,y,735,49,r[1],26,C.muted);rule(s,75,y+66,1125);});
  }else if(i===11){
   s=presentation.slides.add({width:1280,height:720});s.background.fill=C.cream;
   await image(s,'example/competition-materials/final-roadshow/assets/skill-campus-scenes.png',0,0,1280,720,'同一个teach-pro技能包连接自学、统计学备考和项目课程工作区的概念插画','cover');
   text(s,64,52,1150,74,data.slides[i-1].title,37,C.navy,true);rule(s,64,145,1152);
   ['系统自学','课程备考','项目技能'].forEach((v,k)=>text(s,70+k*416,174,306,52,v,32,C.navy,true,'center'));
   text(s,74,685,1110,32,'下一阶段：扩展学科案例，结合大学生试用打磨教学体验',23,C.white,true);
   text(s,1168,686,46,28,'11',17,C.white,false,'right');
  }else if(i===12){
   s=base(i,{dark:true});await image(s,'example/competition-materials/final-roadshow/assets/skill-learning-journey.png',0,0,1280,720,'课程与作答连接成持续学习路径的概念背景','cover');
   text(s,70,87,600,65,'学途智伴',45,C.white,true);
   text(s,70,199,640,155,'让下一次教学\n接着这一次学习',49,C.white,true);
   text(s,74,413,551,105,'课程工作区接续学情\n实际作答参与教学决策\n正式课与补充课协同推进',27,'#C9E9E3');
   text(s,75,611,514,39,'重邮FFBond  ·  欢迎提问',23,'#D1E2E5');
  }
  notes(s,i);
 }
 return {slides:presentation.slides.items.length,batch:[input.start,input.end],edition:data.edition};
}
