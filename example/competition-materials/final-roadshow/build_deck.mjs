/** Build the saved Slides artifact in small batches using its connected presentation. */
export async function buildBatch({ presentation, input }) {
  const fs = await import('node:fs/promises');
  const data = JSON.parse(await fs.readFile(input.dataPath, 'utf8'));
  const root = input.repo.replaceAll('\\', '/');
  const C = {navy:'#102A43',teal:'#087F70',mint:'#58D3BF',ink:'#18364B',muted:'#536C7C',paper:'#F5F8FA',line:'#CDDDE4',gold:'#C78330',white:'#FFFFFF',pale:'#E3F3EF'};
  function text(s,x,y,w,h,value,size=26,color=C.ink,bold=false,align='left') {
    const shape=s.shapes.add({geometry:'textbox',name:value.slice(0,32),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
    shape.text=value;
    shape.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',autoFit:'none',insets:0};
    return shape;
  }
  function rect(s,x,y,w,h,fill,stroke='none',radius=0) {
    return s.shapes.add({geometry:radius?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:stroke==='none'?0:1},...(radius?{borderRadius:radius}:{})});
  }
  function rule(s,x,y,w,color=C.line){return rect(s,x,y,w,2,color);}
  function node(s,x,y,w,h,label,color=C.pale,fontsize=25){const n=rect(s,x,y,w,h,color);n.text=label;n.text.style={typeface:'Microsoft YaHei',fontSize:fontsize,color:C.ink,bold:true,alignment:'center',verticalAlignment:'middle',insets:12};return n;}
  function connect(s,a,b,from='right',to='left',color=C.teal){return s.shapes.connect(a,b,{kind:'straight',fromSide:from,toSide:to,line:{fill:color,width:3},tail:{type:'triangle',width:'med',length:'med'}});}
  function image(s,path,x,y,w,h,alt){return s.images.add({path:root+'/'+path,position:{left:x,top:y,width:w,height:h},fit:'contain',alt});}
  function base(i,dark=false){const s=presentation.slides.add({width:1280,height:720});s.background.fill=dark?C.navy:C.paper;if(!dark){text(s,64,47,1150,68,data.slides[i-1].title,38,C.navy,true);rule(s,64,138,1152);text(s,1166,665,48,25,String(i).padStart(2,'0'),16,C.muted,false,'right');}return s;}
  function notes(s,i){const d=data.slides[i-1];s.speakerNotes.text=`第${i}页  ${d.seconds}秒\n\n${d.speech}\n\n动作提示\n${d.cue}\n\n材料来源\n${d.sources.join('\n')}`;}
  function evidenceRow(s,y,title,detail,label){text(s,78,y,285,46,title,30,C.teal,true);text(s,388,y,680,70,detail,25);text(s,1078,y,120,40,label,20,C.muted,false,'right');rule(s,78,y+100,1120);}
  for(let i=input.start;i<=input.end;i++){
    let s;
    if(i===1){s=presentation.slides.getItem(0);notes(s,i);continue;}
    if(i===2){
      s=base(i);text(s,76,176,1120,108,'把快速获取的资料\n组织成适合自己的系统学习',42,C.navy,true);
      const labels=['课程网页','作答与提问','动态续课'];const nodes=labels.map((v,k)=>node(s,78+k*394,342,330,90,v,k===2?'#B8E9DC':C.white,29));connect(s,nodes[0],nodes[1]);connect(s,nodes[1],nodes[2]);
      text(s,80,460,330,100,'讲解、习题和资料\n围绕同一个学习目标',25,C.muted);text(s,474,460,330,100,'在学习中留下回答\n持续了解当前学情',25,C.muted);text(s,868,460,330,100,'像学习私教一样\n安排合适的下一步',25,C.muted);
    }else if(i===3){
      s=base(i);text(s,76,172,670,47,'在支持 Skill 的宿主中调用',25,C.teal,true);rect(s,76,237,596,122,C.navy);text(s,100,255,540,84,'@teach-pro\n我想学Agent开发与安全。\n请先评估我的基础。',27,C.white);
      const rows=[['教学规则','访谈、评估、讲解与续课'],['课程模板','图解、练习与答疑入口'],['本地工具','同步作答，保存学习记录']];rows.forEach((r,k)=>{const y=399+k*69;text(s,78,y,164,45,r[0],27,C.teal,true);text(s,258,y,410,45,r[1],25);rule(s,78,y+55,594);});image(s,'example/competition-materials/rc12/assets/course-home.png',716,190,490,398,'智鉴Agent课程首页');text(s,745,604,430,42,'生成自己的课程工作区',26,C.navy,true,'center');
    }else if(i===4){
      s=base(i);const names=['目标与评估','当前一课','作答与提问','读取记录','续课安排','新正式课\n按需补充课'];const nodes=names.map((v,k)=>node(s,64+k*194,203,172,84,v,k>3?'#B8E9DC':C.white,k===5?22:24));for(let k=0;k<5;k++)connect(s,nodes[k],nodes[k+1]);
      text(s,70,321,1120,48,'学生请求继续，教学 AI 读取记录并安排后续课程',29,C.teal,true);
      const rows=[['教学 AI','调用 Skill，生成课程与续课'],['课程网页与本地服务','阅读、作答，同步学习记录'],['课内答疑模型','结合教材、当前课和作答解释问题']];rows.forEach((r,k)=>{const y=414+k*68;text(s,78,y,340,42,r[0],26,C.navy,true);text(s,446,y,730,42,r[1],26);rule(s,78,y+53,1120);});
    }else if(i===5){
      s=base(i);const a=node(s,77,241,270,100,'这一次学习',C.white,30);const b=node(s,503,207,274,174,'课程工作区',C.pale,31);const c=node(s,933,241,270,100,'再次请求继续',C.white,30);connect(s,a,b);connect(s,b,c);
      text(s,78,397,285,150,'当前课\n自己的回答\n课末疑难',28);text(s,493,411,310,135,'目标与路线\n课文与学习记录',28,C.teal,true,'center');text(s,925,397,285,150,'读取当前进度\n回应未解问题\n安排新的讲解',28);
      rule(s,78,589,1120);text(s,78,610,1100,43,'学习记录随课程积累，新会话接着已有进度教学',29,C.navy,true);
    }else if(i===6){
      s=base(i);text(s,77,177,1100,49,'从解释、应用与迁移表现，选择合适的教学支持',29,C.teal,true);
      const a=node(s,78,282,439,103,'能说清关键关系',C.white,30), b=node(s,744,282,455,103,'增加变式与迁移任务',C.pale,29);connect(s,a,b);
      const c=node(s,78,447,439,103,'某个关系需要继续理解',C.white,29), d=node(s,744,447,455,103,'换例解释，逐步展开',C.pale,29);connect(s,c,d);
      text(s,81,602,1110,50,'课内答疑同步读取当前页最新作答，写完即可提问',28,C.navy,true);
    }else if(i===7){
      s=base(i);text(s,79,177,1090,46,'以智鉴 Agent 的课程安排为例',26,C.muted);
      const a=node(s,78,290,283,105,'第 1 课\n消息与调用',C.white,26);const b=node(s,479,290,286,105,'第 2 课\n推理循环',C.white,26);const c=node(s,884,290,317,105,'第 3 课\n安全工具调用契约',C.pale,26);connect(s,a,b);connect(s,b,c);
      const d=node(s,479,480,440,88,'关联补充\n外部文本与工具决策', '#F9EBDD',25);connect(s,b,d,'bottom','top',C.gold);text(s,965,484,239,90,'集中解释\n具体难点',25,C.gold,true);
      text(s,80,613,1100,44,'正式课推进新目标，补充课回应具体疑问',29,C.navy,true);
    }else if(i===8){
      s=base(i);image(s,'example/competition-pages/assets/tutor-preview.png',74,173,864,455,'智鉴Agent课程的两轮答疑界面');
      const stages=[['先评估','明确基础与目标'],['再学习','图解、资料与练习'],['随时问','结合教材讨论'],['接着教','正式课与补充课']];stages.forEach((r,k)=>{const y=190+k*112;text(s,974,y,234,41,r[0],30,C.teal,true);text(s,974,y+44,234,48,r[1],22);});
      const link=text(s,80,641,840,30,'完整操作演示（备用）',22,C.teal,true);link.hyperlink={uri:'https://roamerfly.github.io/teach-pro-skill/assets/demo.mp4',isExternal:true};
    }else if(i===9){
      s=base(i);text(s,77,169,1120,42,'校园消费作答对照案例',25,C.teal,true);text(s,79,227,1117,55,'四人消费  10、20、30、100 元    中位数 25 元',31,C.navy,true);
      rule(s,78,310,1120);text(s,79,337,466,45,'替换最大值',29,C.navy,true);text(s,79,399,501,62,'10、20、30、1000',30);text(s,80,490,446,60,'仍是 4 人 · 中位数 25 元',27,C.teal,true);
      rect(s,631,335,2,222,C.line);text(s,700,337,490,45,'新增一条记录',29,C.navy,true);text(s,700,399,504,62,'10、20、30、100、1000',29);text(s,700,490,496,60,'变为 5 人 · 中位数 30 元',27,C.teal,true);
      text(s,79,596,1120,60,'解释清楚 → 迁移练习       继续理解排序位置 → 补充讲解与计算支持',25,C.navy,true);
    }else if(i===10){
      s=base(i);evidenceRow(s,213,'作答保存与恢复','新浏览器会话恢复本地答案','交互记录');evidenceRow(s,365,'最新作答进入答疑','提问时带入本题回答与位置','上下文验证');evidenceRow(s,517,'正式课与补充课','从具体疑难连接两类教学产物','续课案例');
    }else if(i===11){
      s=base(i);const cols=[['系统自学','从个人基础出发\n逐步建立理解'],['课程备考','围绕目标组织练习\n追踪需要巩固的知识'],['项目技能','理解原理与代码\n走向具体应用']];cols.forEach((r,k)=>{const x=78+k*395;rect(s,x,222,6,235,k===2?C.gold:C.teal);text(s,x+27,236,335,63,r[0],35,C.navy,true);text(s,x+27,336,330,126,r[1],28,C.muted);});rule(s,78,537,1120);text(s,79,565,1100,81,'下一阶段\n扩展学科案例，结合大学生试用优化教学体验',27,C.teal,true);
    }else if(i===12){
      s=base(i,true);text(s,79,93,1120,82,'学途智伴',58,C.white,true);text(s,81,216,1100,130,'让下一次教学\n接着这一次学习',56,C.white,true);text(s,82,400,1100,48,'自适应教学 Skill 技能包',31,C.mint,true);
      const labels=['跨会话接续','依据作答调整','主线与补充协同'];labels.forEach((v,k)=>text(s,82+k*391,515,362,54,v,28,'#E3F3EF',true));text(s,83,628,700,34,'重邮FFBond  ·  欢迎提问',23,'#C4D5E0');
    }
    notes(s,i);
  }
  return {slides:presentation.slides.items.length,batch:[input.start,input.end]};
}
