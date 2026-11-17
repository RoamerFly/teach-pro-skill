/** Export the approved 12-slide layout as an editable local PowerPoint. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {buildBatch} from './build_deck.mjs';
const [runtimeModules,output]=process.argv.slice(2);
if(!runtimeModules||!output)throw new Error('Usage: node export_local_pptx.mjs RUNTIME_NODE_MODULES OUTPUT');
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(runtimeModules,'@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const presentation=Presentation.create({slideSize:{width:1280,height:720}});
const slide=presentation.slides.add();slide.background.fill='#102A43';
function text(x,y,w,h,value,size,color,bold=false){
 const s=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 s.text=value;s.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold,verticalAlignment:'middle',autoFit:'none',insets:0};return s;
}
text(78,112,700,100,'学途智伴',64,'#FFFFFF',true);
text(82,236,730,80,'大学生长期自适应学习智能体',32,'#FFFFFF');
text(82,357,700,52,'自适应教学 Skill 技能包',29,'#58D3BF',true);
text(82,594,600,36,'重邮FFBond  ·  决赛路演',23,'#C4D5E0');
['课程','作答','续课'].forEach((label,i)=>{
 slide.shapes.add({geometry:'rect',position:{left:924,top:195+i*134,width:234,height:82},fill:['#E9F3F4','#9EE5D4','#58D3BF'][i],line:{fill:'none',width:0}});
 text(948,215+i*134,190,45,label,29,'#18364B',true);
});
await buildBatch({presentation,input:{start:1,end:12,repo,dataPath:path.join(here,'路演内容.json')}});
// Local PowerPoint needs embedded bytes rather than session-managed image paths.
for(const [index,relative] of [[2,'example/competition-materials/rc12/assets/course-home.png'],[7,'example/competition-pages/assets/tutor-preview.png']]){
 const image=presentation.slides.getItem(index).images.items[0];
 image.replace({blob:new Uint8Array(await fs.readFile(path.join(repo,relative))),contentType:'image/png',fit:'contain'});
}
await fs.mkdir(path.dirname(output),{recursive:true});
await (await PresentationFile.exportPptx(presentation)).save(output);
console.log(JSON.stringify({slides:presentation.slides.items.length,path:output}));
