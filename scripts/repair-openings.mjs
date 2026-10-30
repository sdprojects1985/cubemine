import fs from 'node:fs';
import {PuzzleGame} from '../dist/engine.mjs';
import {nextDeduction,solvePuzzle,visibleOpening} from '../dist/deduction.mjs';
import {PUZZLES,CHAPTERS} from '../dist/puzzles.mjs';
const puzzles=structuredClone(PUZZLES);
for(const spec of puzzles){
 spec.faceTotals=false;
 if(spec.chapter==='basics'){
  const model=new PuzzleGame(spec);let selected=null;
  for(let count=3;count<=10&&!selected;count++){
   for(const seed of model.cells.filter(c=>!c.mine)){
    const candidates=model.cells.filter(c=>c.face===seed.face&&!c.mine).sort((a,b)=>Math.abs(a.row-seed.row)+Math.abs(a.col-seed.col)-Math.abs(b.row-seed.row)-Math.abs(b.col-seed.col)||a.id-b.id);
    if(candidates.length<count)continue;
    const givens=candidates.slice(0,count).map(c=>c.id);
    // A mix of visible numbers makes a useful introduction, rather than an
    // isolated clue or an already-completed face.
    if(!givens.some(id=>model.cells[id].count>0))continue;
    const candidate={...spec,givens,openingFace:seed.face},game=new PuzzleGame(candidate);
    const opening=nextDeduction(game,{visibleFaces:[seed.face],targetFaces:[seed.face]});
    if(!opening||opening.rule!=='number')continue;
    const solved=solvePuzzle(candidate);
    if(solved.complete&&solved.steps.length>=6){selected=candidate;break;}
   }
  }
  if(!selected)throw new Error(`No usable opening for ${spec.title}`);
  Object.assign(spec,selected);
  spec.brief=[
   'Start with the revealed cluster on this face. A 0 has no neighboring mines: every touching covered tile is safe. You can click the 0 to open them.',
   'The revealed cluster already gives a move on this face. Follow its numbers, then continue across the cube edges.',
   'Compare the revealed clues on this face. Begin with a move you can prove, then follow the openings around the cube.'
  ][spec.number-1];
 }
 const game=new PuzzleGame(spec),opening=visibleOpening(game);
 if(!opening)throw new Error(`No visible first deduction: ${spec.title}`);
 spec.openingFace=opening.face;
 console.log(`${spec.number}: ${spec.givens.length} starting clues; opens ${opening.face}; ${opening.step.reason}; complete ${solvePuzzle(spec).complete}`);
}
fs.writeFileSync(new URL('../dist/puzzles.mjs',import.meta.url),'// Fixed cube puzzles with full deduction proofs and visible opening checks.\nexport const CHAPTERS = '+JSON.stringify(CHAPTERS,null,2)+';\nexport const PUZZLES = '+JSON.stringify(puzzles,null,2)+';\n');
