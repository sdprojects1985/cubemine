import {PuzzleGame} from './engine.mjs';
import {t,quantity,cellName,lineName} from './i18n.mjs';
import {arrangements,clueText} from './puzzle-rules.mjs';

// This is the same evidence the interface may show: no mine booleans, no
// covered numbers, and no unopened special clues. A face mask models the
// initial camera view, excluding clues on faces the player has not inspected.
export function playerEvidence(game,visibleFaces=null){
  const visible=new Set(visibleFaces??game.faces.map(f=>f.key));
  const cells=game.cells.map(c=>{
    const revealed=visible.has(c.face)&&c.revealed,flagged=visible.has(c.face)&&c.flagged;
    return {id:c.id,face:c.face,row:c.row,col:c.col,neighbors:c.neighbors,ring:c.ring,revealed,flagged,count:revealed?c.count:null};
  });
  return {cells,faces:game.faces,mineCount:game.mineCount,flagCount:cells.filter(c=>c.flagged).length,lines:(game.lines??[]).filter(l=>visible.has(l.face)),clueKinds:Object.fromEntries(Object.entries(game.clueKinds??{}).filter(([id])=>cells[id]?.revealed))};
}

// Only revealed numbers, visible clue kinds/totals, and established flags enter
// these constraints. Hidden mine locations are never consulted by this solver.
export function nextDeduction(game,{patterns=true,lines=true,omitKind=null,visibleFaces=null,targetFaces=null,language='en'}={}){
  const text=(key,values={})=>t(key,values,language);
  game=playerEvidence(game,visibleFaces);
  const targets=ids=>targetFaces?ids.filter(id=>targetFaces.includes(game.cells[id].face)):ids;
  const constraints=[],keys=new Set();
  const add=(ids,count,label,sources=[],lineSources=[],rule='number')=>{
    ids=[...ids].sort((a,b)=>a-b);if(!ids.length||count<0||count>ids.length)return;
    const key=ids.join(',')+':'+count;if(keys.has(key))return;keys.add(key);
    constraints.push({ids,count,label,sources,lineSources,rule,set:new Set(ids)});
  };
  const known=(ids,count,label,sources=[],lineSources=[],rule='number')=>{
    const flagged=ids.filter(id=>game.cells[id].flagged).length;
    add(ids.filter(id=>!game.cells[id].revealed&&!game.cells[id].flagged),count-flagged,label,sources,lineSources,rule);
  };
  for(const cell of game.cells)if(cell.revealed){
    known(cell.neighbors,cell.count,cellName(game,cell.id,language),[cell.id]);
  }
  if(lines)for(const line of game.lines??[])known(line.ids,line.count,text('lineTotal',{line:lineName(line,language)}),[],[line.id],'line');
  known(game.cells.map(c=>c.id),game.mineCount,text('wholeCube'),[],[],'total');
  const result=c=>{
    if(c.count!==0&&c.count!==c.ids.length)return null;
    const value=c.count===0?'safe':'mine',ids=targets(c.ids);if(!ids.length)return null;
    return {ids,value,sources:c.sources,lineSources:c.lineSources,rule:c.rule,reason:c.explanation??text('deductionCount',{label:c.label,mineCount:quantity(c.count,'mine',language),coveredCount:quantity(c.ids.length,'covered',language),conclusion:text(value==='safe'?'safeConclusion':'mineConclusion')})};
  };
  // Use ordinary count deductions before invoking a special clue.
  constraints.sort((a,b)=>a.ids.length-b.ids.length);
  for(const c of constraints){const step=result(c);if(step)return step;}
  if(patterns)for(const cell of game.cells)if(cell.revealed&&game.clueKinds?.[cell.id]&&game.clueKinds[cell.id]!==omitKind){
    const kind=game.clueKinds[cell.id],ring=cell.ring;
    const valid=arrangements(ring.length,cell.count,kind).filter(mask=>ring.every((id,i)=>game.cells[id].flagged?Boolean(mask&(1<<i)):game.cells[id].revealed?!(mask&(1<<i)):true));
    if(!valid.length)continue;
    for(const value of ['safe','mine']){
      const ids=targets(ring.filter((id,i)=>!game.cells[id].revealed&&!game.cells[id].flagged&&valid.every(mask=>Boolean(mask&(1<<i))===(value==='mine'))));
      if(ids.length)return {ids,value,sources:[cell.id],lineSources:[],rule:kind,reason:text('deductionPattern',{clue:clueText(cell.count,kind),cell:cellName(game,cell.id,language),pattern:text(kind==='together'?'patternTogether':'patternApart'),value:text(value==='safe'?'safeValue':'mineValue')})};
    }
  }
  for(let pass=0;pass<4;pass++){
    constraints.sort((a,b)=>a.ids.length-b.ids.length);
    const count=constraints.length;
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
      const a=constraints[i],b=constraints[j];if(a.ids.length>=b.ids.length||!a.ids.every(id=>b.set.has(id)))continue;
      const ids=b.ids.filter(id=>!a.set.has(id)),remaining=b.count-a.count;if(remaining<0||remaining>ids.length)continue;
      const sources=[...new Set([...a.sources,...b.sources])],lineSources=[...new Set([...a.lineSources,...b.lineSources])];
      const c={ids,count:remaining,sources,lineSources,rule:lineSources.length?'line':'subset',explanation:text('deductionSubset',{a:a.label,b:b.label,tileCount:quantity(ids.length,'tile',language),mineCount:quantity(remaining,'mine',language),conclusion:text(remaining===0?'safeConclusion':'mineConclusion')})};
      const step=result(c);if(step)return step;
      if(constraints.length<650)add(ids,remaining,text('minusLabel',{b:b.label,a:a.label}),sources,lineSources,c.rule);
    }
    if(constraints.length===count)break;
  }
  return null;
}
export function solvePuzzle(spec,options={}){
  const game=new PuzzleGame(spec),steps=[];
  for(let guard=0;guard<1000&&game.status!=='won';guard++){
    const step=nextDeduction(game,options);if(!step)break;steps.push(step);
    const before=game.revealedCount+game.flagCount;
    for(const id of step.ids){if(game.cells[id].revealed||game.cells[id].flagged)continue;if(step.value==='safe')game.reveal(id);else game.flag(id);}
    if(game.mistakes||before===game.revealedCount+game.flagCount)break;
  }
  return {complete:game.status==='won',steps,game};
}

// A usable opening needs both its evidence and at least one forced move on the
// camera-facing face. The full-board proof alone is not an opening check.
export function visibleOpening(game,preferredFace=game.spec?.openingFace){
  const faces=[...game.faces].sort((a,b)=>(b.key===preferredFace)-(a.key===preferredFace));
  for(const face of faces){
    const step=nextDeduction(game,{visibleFaces:[face.key],targetFaces:[face.key]});
    if(step)return {face:face.key,step,focusId:step.sources[0]??step.ids[0]};
  }
  return null;
}
