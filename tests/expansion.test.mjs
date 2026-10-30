import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurface,vertexKey,lineCells,directionalNeighbor} from '../dist/shapes.mjs';
import {CubeGame,PuzzleGame,makeTopology} from '../dist/engine.mjs';
import {PUZZLES,CHAPTERS} from '../dist/puzzles.mjs';
import {nextDeduction,solvePuzzle,playerEvidence,visibleOpening} from '../dist/deduction.mjs';
import {isConsecutive,arrangements} from '../dist/puzzle-rules.mjs';

test('the cube retains its original neighbors and every touching ring follows physical edges',()=>{
 for(const n of [3,4,5,6,8]){
  const surface=createSurface(n),old=makeTopology(n);
  for(const cell of surface.cells){
   assert.deepEqual(cell.neighbors,[...old[cell.id].neighbors].sort((a,b)=>a-b));
   assert.deepEqual([...cell.ring].sort((a,b)=>a-b),cell.neighbors);
   assert.ok([7,8].includes(cell.ring.length));
   for(let i=0;i<cell.ring.length;i++){
    const a=surface.cells[cell.ring[i]],b=surface.cells[cell.ring[(i+1)%cell.ring.length]];
    const shared=a.vertices.filter(p=>b.vertices.some(q=>vertexKey(p)===vertexKey(q)));
    assert.equal(shared.length,2,'Consecutive positions in the ring must share a physical edge');
   }
   for(const direction of [[1,0],[-1,0],[0,1],[0,-1]])assert.equal(surface.cells[directionalNeighbor(surface,cell.id,direction)].face,cell.face);
  }
 }
});

test('consecutive means one circular run, including the wraparound position',()=>{
 assert.equal(isConsecutive([1,1,0,0,0,0,0,1]),true);
 assert.equal(isConsecutive([0,1,1,1,0,0,0,0]),true);
 assert.equal(isConsecutive([1,1,0,0,1,0,0,0]),false);
 assert.equal(isConsecutive([1,0,1,0,0,0,0,0]),false);
 assert.equal(isConsecutive([0,0,0,0,0,0,0]),false);
 assert.equal(isConsecutive([1,1,1,1,1,1,1]),true);
});

test('special-clue candidates match an independent connectivity check for every possible ring',()=>{
 for(const n of [7,8])for(let count=2;count<n;count++)for(const kind of ['together','apart']){
  const actual=new Set(arrangements(n,count,kind)),expected=new Set();
  for(let mask=0;mask<2**n;mask++){
   const mines=Array.from({length:n},(_,i)=>i).filter(i=>mask&(1<<i));if(mines.length!==count)continue;
   const remaining=new Set(mines);let components=0;
   while(remaining.size){components++;const stack=[remaining.values().next().value];while(stack.length){const id=stack.pop();if(!remaining.delete(id))continue;for(const next of [(id+1)%n,(id+n-1)%n])if(remaining.has(next))stack.push(next);}}
   if(kind==='together'?components===1:components>1)expected.add(mask);
  }
  assert.deepEqual(actual,expected);
 }
});

test('all 12 fixed puzzles contain truthful, face-local line counts and valid special clues',()=>{
 assert.equal(PUZZLES.length,12);assert.equal(Object.keys(CHAPTERS).length,4);assert.equal(new Set(PUZZLES.map(p=>p.id)).size,12);
 for(const chapter of Object.keys(CHAPTERS))assert.equal(PUZZLES.filter(p=>p.chapter===chapter).length,3);
 for(const spec of PUZZLES){
  const game=new PuzzleGame(spec);assert.equal(game.revealedCount,spec.givens.length);assert.ok(spec.givens.length>=2&&spec.givens.length<=6);
  assert.equal(game.startedAt,null);assert.deepEqual(game.cells.filter(c=>c.mine).map(c=>c.id),spec.mines);
  for(const line of game.lines){
   assert.equal(line.ids.length,game.size);assert.deepEqual(line.ids,lineCells(game.surface,line.face,line.axis,line.index));
   assert.equal(line.count,line.ids.filter(id=>game.cells[id].mine).length);
  }
  for(const [id,kind]of Object.entries(game.clueKinds)){
   const c=game.cells[id];assert.ok(!c.mine&&c.count>=2);
   assert.equal(isConsecutive(c.ring.map(n=>game.cells[n].mine)),kind==='together');
  }
 }
});

for(const spec of PUZZLES)test(`${spec.number}. ${spec.title}: every safe tile has a deduction-only path`,()=>{
 const solved=solvePuzzle(spec);assert.equal(solved.complete,true);assert.equal(solved.game.mistakes,0);assert.equal(solved.game.revealedCount,solved.game.safeCount);
 assert.ok(solved.steps.length>=6);
 if(spec.chapter==='lines'&&spec.rank>0){assert.equal(new Set(spec.lines.map(l=>l.axis)).size,2);assert.ok(solved.steps.some(step=>step.lineSources.some(id=>spec.lines.some(l=>`${l.face}-${l.axis}-${l.index}`===id&&l.count>0))));}
 if(spec.chapter==='lines'){assert.equal(solvePuzzle(spec,{lines:false}).complete,false);assert.ok(solved.steps.some(s=>s.rule==='line'));}
 if(spec.chapter==='together'){assert.equal(solvePuzzle(spec,{patterns:false}).complete,false);assert.ok(solved.steps.some(s=>s.rule==='together'));}
 if(spec.chapter==='apart'){assert.equal(solvePuzzle(spec,{omitKind:'apart'}).complete,false);assert.ok(solved.steps.some(s=>s.rule==='apart'));}
});

test('every hint along every proof is independent of hidden mine locations and hidden numbers',()=>{
 for(const spec of PUZZLES){
  const game=new PuzzleGame(spec);
  while(game.status!=='won'){
   const expected=nextDeduction(game);assert.ok(expected,'The proof must never require a guess');
   for(const id of expected.sources)assert.equal(game.cells[id].revealed,true);
   const original=game.cells.map(c=>[c.mine,c.count]);
   for(const c of game.cells)if(!c.revealed){c.mine=!c.mine;c.count=999;}
   assert.deepEqual(nextDeduction(game),expected);
   game.cells.forEach((c,i)=>{[c.mine,c.count]=original[i];});
   for(const id of expected.ids){if(game.cells[id].revealed||game.cells[id].flagged)continue;assert.equal(game.cells[id].mine,expected.value==='mine');if(expected.value==='mine')game.flag(id);else game.reveal(id);}
  }
  assert.equal(game.mistakes,0);
 }
});

test('puzzle mistakes are nonfatal, flags remain truthful, and fixed mines never move',()=>{
 for(const spec of PUZZLES){
  const game=new PuzzleGame(spec),mine=spec.mines[0],safe=game.cells.find(c=>!c.mine&&!c.revealed).id,before=game.revealedCount;
  game.reveal(mine);game.flag(safe);assert.equal(game.mistakes,2);assert.equal(game.status,'playing');assert.equal(game.revealedCount,before);assert.equal(game.flagCount,0);
  game.flag(mine);assert.equal(game.flagCount,1);game.flag(mine);assert.equal(game.flagCount,0);
  assert.deepEqual(game.cells.filter(c=>c.mine).map(c=>c.id),spec.mines);
 }
});

test('progress restores completion and statistics; restart restores the fixed starting clues',()=>{
 for(const spec of PUZZLES){
  const won=solvePuzzle(spec).game;won.hints=3;won.mistakes=2;
  const restored=new PuzzleGame(spec,JSON.parse(JSON.stringify(won.serialize())));
  assert.equal(restored.status,'won');assert.equal(restored.hints,3);assert.equal(restored.mistakes,2);
  const fresh=new PuzzleGame(spec);assert.equal(fresh.revealedCount,spec.givens.length);assert.equal(fresh.flagCount,0);
  const invalid=new PuzzleGame(spec,{revealed:spec.mines,flagged:spec.givens,seconds:-3,mistakes:-4});
  assert.equal(invalid.revealedCount,spec.givens.length);assert.equal(invalid.flagCount,0);assert.equal(invalid.elapsed,0);assert.equal(invalid.mistakes,0);
 }
});

test('Random remains the default cube game with no puzzle-only clues',()=>{
 const game=new CubeGame();assert.equal(game.kind,'random');assert.equal(game.level,'classic');assert.equal(game.size,6);assert.equal(game.mineCount,36);
 assert.equal(game.lines,undefined);assert.equal(game.clueKinds,undefined);assert.equal(game.faceTotals,undefined);
});


test('regression: the isolated 1 from the screenshot does not supply a visible opening',()=>{
 const old=new PuzzleGame({...PUZZLES[0],givens:[13,19],openingFace:'right'});
 assert.equal(old.cells[13].count,1);
 old.faceTotals={front:0,right:1,back:1,left:1,top:2,bottom:1};
 assert.equal(nextDeduction(old,{visibleFaces:['right'],targetFaces:['right']}),null);
 assert.equal(visibleOpening(old),null,'An unseen face total must not pass the opening check');
});

test('the verifier receives only renderable clue evidence, with private state removed',()=>{
 for(const spec of PUZZLES){
  const game=new PuzzleGame(spec),evidence=playerEvidence(game,[spec.openingFace]);
  assert.equal(evidence.faceTotals,undefined);
  for(const c of evidence.cells){
   assert.equal(Object.hasOwn(c,'mine'),false);
   if(!c.revealed)assert.equal(c.count,null);
   if(c.face!==spec.openingFace){assert.equal(c.revealed,false);assert.equal(c.flagged,false);}
  }
  assert.ok(evidence.lines.every(l=>l.face===spec.openingFace));
  assert.ok(Object.keys(evidence.clueKinds).every(id=>evidence.cells[id].revealed));
 }
});

test('every initial camera face contains both the evidence and an actionable first deduction',()=>{
 for(const spec of PUZZLES){
  const game=new PuzzleGame(spec),opening=visibleOpening(game);
  assert.ok(opening,`${spec.title} needs a visible first move`);assert.equal(opening.face,spec.openingFace);
  assert.ok(opening.step.ids.length>0);
  for(const id of opening.step.ids){assert.equal(game.cells[id].face,opening.face);assert.equal(game.cells[id].revealed,false);assert.equal(game.cells[id].mine,opening.step.value==='mine');}
  for(const id of opening.step.sources){assert.equal(game.cells[id].face,opening.face);assert.ok(spec.givens.includes(id));}
  for(const id of opening.step.lineSources)assert.equal(game.lines.find(l=>l.id===id).face,opening.face);
  assert.notEqual(opening.step.rule,'face');
  if(spec.chapter==='basics'){
   assert.ok(spec.givens.every(id=>game.cells[id].face===opening.face));
   assert.equal(opening.step.rule,'number');assert.deepEqual(game.faceTotals,{});
  }
 }
});

test('an already-open puzzle zero opens its safe neighbors when clicked',()=>{
 for(const spec of PUZZLES.filter(p=>p.chapter==='basics')){
  const game=new PuzzleGame(spec),opening=visibleOpening(game),zero=opening.step.sources.find(id=>game.cells[id].count===0);
  assert.notEqual(zero,undefined);const before=game.revealedCount;
  assert.equal(game.reveal(zero),true);assert.ok(game.revealedCount>before);assert.equal(game.mistakes,0);
  assert.ok(game.cells.filter(c=>c.revealed).every(c=>!c.mine));
 }
});
