import fs from 'node:fs';
import {createSurface,CUBE_FACES,lineCells} from '../dist/shapes.mjs';
import {isConsecutive} from '../dist/puzzle-rules.mjs';
import {solvePuzzle,visibleOpening} from '../dist/deduction.mjs';
import {PuzzleGame} from '../dist/engine.mjs';
import {PUZZLES as previous} from '../dist/puzzles.mjs';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const shuffle=(values,random)=>{const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const chapters={basics:'01 · Around the cube',lines:'02 · Read the lines',together:'03 · In one piece',apart:'04 · Mind the gaps'};
const puzzles=previous.filter(p=>p.chapter==='basics').map(p=>structuredClone(p));
if(puzzles.length!==3)throw new Error('Keep the three original cube puzzles');
const plans=[
 ['lines',4,'Read between','An outside number counts the mines in its row or column. Choose a face, then tap a number to trace its line.'],
 ['lines',5,'Crosscurrents','Combine row and column totals with the open clues. Lines stop at the edge of their face.'],
 ['lines',6,'Every direction','Follow the line totals across all six faces. A completed line can unlock the next face.'],
 ['together',4,'In one piece','{n} means all n neighboring mines form one unbroken run around the clue. Tap an open clue to inspect its ring.'],
 ['together',5,'Around the bend','A run can continue across a cube edge. The first and last positions in the touching ring also meet.'],
 ['together',6,'Follow the thread','Use the empty tiles to narrow down where a whole run can fit.'],
 ['apart',5,'Mind the gap','-n- means the neighboring mines form at least two separate groups. One continuous run is ruled out.'],
 ['apart',6,'Separate ways','Combine {n}, -n-, and line totals. Some deductions depend on where mines cannot form a run.'],
 ['apart',8,'All six sides','A full 8 × 8 cube. Every safe tile follows from the clues; take it one deduction at a time.']
];
for(const [chapter,size,title,brief]of plans){
 const surface=createSurface(size),number=puzzles.length+1,rank=plans.filter(p=>p[0]===chapter).findIndex(p=>p[2]===title);
 let chosen;const rejected={incomplete:0,givens:0,lines:0,rule:0,short:0};
 for(let trial=0;trial<180&&!chosen;trial++){
  const random=rng(9137+number*17239+trial*317),all=shuffle(surface.cells.map(c=>c.id),random),count=Math.round(all.length*((chapter==='lines'?[.12,.155,.185]:[.19,.21,.22])[rank]));
  const mines=all.slice(0,count).sort((a,b)=>a-b),mineSet=new Set(mines),clueKinds={};
  const counts=surface.cells.map(c=>c.neighbors.filter(id=>mineSet.has(id)).length);
  if(chapter!=='lines'){
   const eligible=shuffle(surface.cells.filter(c=>!mineSet.has(c.id)&&counts[c.id]>=2&&counts[c.id]<=5),random);
   for(const c of eligible){
    const kind=isConsecutive(c.ring.map(id=>mineSet.has(id)))?'together':'apart';
    if(chapter==='together'&&kind!=='together')continue;
    clueKinds[c.id]=kind;if(Object.keys(clueKinds).length>=size*5)break;
   }
  }
  const starters=all.filter(id=>!mineSet.has(id)&&counts[id]>0);
  const featured=starters.find(id=>clueKinds[id]===(chapter==='apart'?'apart':'together'));
  const givens=featured===undefined?starters.slice(0,2):[featured,starters.find(id=>id!==featured)];
  const lines=[];
  for(const face of CUBE_FACES)for(const axis of ['row','col']){
   const index=Math.floor(random()*size),ids=lineCells(surface,face,axis,index);
   lines.push({face,axis,index,count:ids.filter(id=>mineSet.has(id)).length});
  }
  const spec={id:`cube-${chapter}-${rank+1}`,size,rank,number,chapter,title,brief,faceTotals:false,mines,givens,lines,clueKinds};
  let solved=solvePuzzle(spec);
  for(let extra=0;extra<5&&!solved.complete;extra++){
   const options=solved.game.cells.filter(c=>!c.mine&&!c.revealed);
   options.sort((a,b)=>{
    const score=c=>c.neighbors.filter(id=>!solved.game.cells[id].revealed&&!solved.game.cells[id].flagged).length/(c.count+1)+(clueKinds[c.id]?1.5:0);
    return score(b)-score(a)||a.id-b.id;
   });
   if(!options.length)break;spec.givens.push(options[0].id);solved=solvePuzzle(spec);
  }
  if(!solved.complete){rejected.incomplete++;continue;}
  // Remove redundant entry clues and line totals, retaining a small set of givens.
  for(const id of [...spec.givens])if(spec.givens.length>2&&id!==featured){const reduced={...spec,givens:spec.givens.filter(v=>v!==id)};if(solvePuzzle(reduced).complete)spec.givens=reduced.givens;}
  if(spec.givens.length>6){rejected.givens++;continue;}
  for(const line of shuffle(spec.lines,random)){
   if(spec.lines.length<=(rank?2:1))break;
   const reduced={...spec,lines:spec.lines.filter(v=>v!==line)};
   if(rank&&!reduced.lines.some(l=>l.count>0&&l.count<size))continue;
   if(chapter==='lines'&&rank&&new Set(reduced.lines.map(l=>l.axis)).size<2)continue;
   if(solvePuzzle(reduced).complete)spec.lines=reduced.lines;
  }
  if(!spec.lines.length){rejected.lines++;continue;}
  solved=solvePuzzle(spec);
  if(chapter==='lines'&&solvePuzzle(spec,{lines:false}).complete)continue;
  if(chapter==='lines'&&rank&&!solved.steps.some(step=>step.lineSources.some(id=>spec.lines.some(l=>`${l.face}-${l.axis}-${l.index}`===id&&l.count>0))))continue;
  if(chapter==='together'&&(!solved.steps.some(s=>s.rule==='together')||solvePuzzle(spec,{patterns:false}).complete)){rejected.rule++;continue;}
  if(chapter==='apart'&&(!solved.steps.some(s=>s.rule==='apart')||solvePuzzle(spec,{omitKind:'apart'}).complete)){rejected.rule++;continue;}
  if(solved.steps.length<12)continue;
  const opening=visibleOpening(new PuzzleGame(spec));if(!opening)continue;spec.openingFace=opening.face;
  chosen=spec;
  console.log(`${number}. ${title}: ${surface.cells.length} cells, ${mines.length} mines, ${spec.givens.length} givens, ${spec.lines.length} lines, ${Object.keys(clueKinds).length} special clues; ${solved.steps.length} deductions (${solved.steps.filter(s=>s.rule==='together'||s.rule==='apart').map(s=>s.rule).join(',')}); trial ${trial}`);
 }
 if(!chosen)throw new Error(`Could not curate ${title}: ${JSON.stringify(rejected)}`);
 puzzles.push(chosen);
}
fs.writeFileSync(new URL('../dist/puzzles.mjs',import.meta.url),'// Fixed cube puzzles. Each has a complete evidence-only deduction proof.\nexport const CHAPTERS = '+JSON.stringify(chapters,null,2)+';\nexport const PUZZLES = '+JSON.stringify(puzzles,null,2)+';\n');
