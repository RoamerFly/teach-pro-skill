/** Export the approved 12-slide layout as an editable local PowerPoint. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {buildVisualBatch} from './build_deck_v2.mjs';
const [runtimeModules,output]=process.argv.slice(2);
if(!runtimeModules||!output)throw new Error('Usage: node export_local_pptx.mjs RUNTIME_NODE_MODULES OUTPUT');
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(runtimeModules,'@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const presentation=Presentation.create({slideSize:{width:1280,height:720}});
await buildVisualBatch({presentation,input:{start:1,end:12,repo,dataPath:path.join(here,'路演内容.json'),embedImages:true}});
await fs.mkdir(path.dirname(output),{recursive:true});
await (await PresentationFile.exportPptx(presentation)).save(output);
console.log(JSON.stringify({slides:presentation.slides.items.length,path:output}));
