import {CubeGame,PuzzleGame} from './engine.mjs';
import {t,getLanguage,setLanguage,translatePage,faceName,faceLetter,cellName,lineName,puzzleTitle,puzzleBrief} from './i18n.mjs';
import {directionalNeighbor} from './shapes.mjs';
import {clueText} from './puzzle-rules.mjs';
import {PUZZLES,CHAPTERS} from './puzzles.mjs';
import {nextDeduction,visibleOpening} from './deduction.mjs';
import {fromEuler,rotateOnScreen,interpolate,cssTransform,facePoint,projectClue} from './camera.mjs';

const $=id=>document.getElementById(id);
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const cube=$('cube'),viewport=$('board-viewport'),playground=document.querySelector('.playground');
const scene=cube.parentElement,clueLayer=document.createElement('div');
clueLayer.className='clue-layer';clueLayer.setAttribute('aria-hidden','true');scene.append(clueLayer);
let game,tiles=[],view='cube',mode='reveal',kind='random',focusedFace=null;
let orientation=fromEuler(-25,-34),cameraGoal=orientation,zoom=1,zoomGoal=1,cameraAnimation=null;
let clueLabels=[],cameraFrame=null,gesture=null,longPress=null,suppressUntil=0,heldToFlag=false;
let lastStatus='ready',focusId=0,hinted=new Set(),lineHighlights=new Set(),inspected=null,progress={},storageAvailable=true;
try{const stored=JSON.parse(localStorage.getItem('cubemine-puzzles-v1'));if(stored&&typeof stored==='object'&&!Array.isArray(stored))progress=stored;}catch{}
const announce=text=>{$('announcer').textContent=text;};
const setPressed=(id,value)=>$(id).setAttribute('aria-pressed',String(value));
const formatTime=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
const currentSpec=()=>PUZZLES.find(p=>p.id===$('puzzle-level').value)??PUZZLES[0];
function updateHintCounter(){if(game?.kind==='puzzles')$('hint-counter').textContent=`${t(game.hints===1?'hintsOne':'hintsMany',{count:game.hints})} · ${t(storageAvailable?'savedDevice':'savedSession')}`;}
function savePuzzle(){
  if(game?.kind!=='puzzles')return;
  progress[game.spec.id]={...game.serialize(),complete:game.status==='won'};
  try{localStorage.setItem('cubemine-puzzles-v1',JSON.stringify(progress));storageAvailable=true;}catch{storageAvailable=false;}
  updateHintCounter();
}
function puzzleMenu(preferred){
  const previous=preferred??$('puzzle-level').value;$('puzzle-level').replaceChildren();
  for(const [chapter,label]of Object.entries(CHAPTERS)){
    const group=document.createElement('optgroup');group.label=t('chapter.'+chapter);
    for(const spec of PUZZLES.filter(p=>p.chapter===chapter)){
      const option=document.createElement('option');option.value=spec.id;option.textContent=`${String(spec.number).padStart(2,'0')}. ${puzzleTitle(spec)}${progress[spec.id]?.complete?' ✓':''}`;group.append(option);
    }
    $('puzzle-level').append(group);
  }
  if(PUZZLES.some(p=>p.id===previous))$('puzzle-level').value=previous;
}
function tileLabel(cell){
  let state=t(cell.flagged?'flagged':'covered');
  if(cell.revealed)state=cell.mine?t('mine'):cell.count||kind==='puzzles'?t('neighborMines',{count:cell.count}):t('empty');
  if(game.status==='lost'&&cell.mine&&!cell.flagged)state=t('mine');
  if(game.status==='lost'&&cell.flagged&&!cell.mine)state=t('incorrectFlag');
  const special=cell.revealed&&game.clueKinds?.[cell.id];
  return `${cellName(game,cell.id)}: ${state}${special?t(special==='together'?'specialTogether':'specialApart'):''}`;
}
function buildBoard(){
  cube.replaceChildren();clueLayer.replaceChildren();clueLabels=[];tiles=[];cube.style.setProperty('--n',game.size);$('face-navigation').replaceChildren();
  for(const face of game.faces){
    const section=document.createElement('div');section.className=`face face-${face.key}`;section.dataset.face=face.key;section.setAttribute('role','group');section.setAttribute('aria-label',t('faceGroup',{face:faceName(face.key)}));
    const caption=document.createElement('span');caption.className='face-caption';caption.textContent=faceName(face.key).toUpperCase();caption.setAttribute('aria-hidden','true');section.append(caption);
    for(const id of face.cellIds){
      const tile=document.createElement('button');tile.type='button';tile.className='tile';tile.tabIndex=id===focusId?0:-1;tile.dataset.id=id;tile.setAttribute('aria-label',tileLabel(game.cells[id]));section.append(tile);tiles[id]=tile;
      addClueLabel(tile,section,face,id);
    }
    if(kind==='puzzles')for(const axis of ['row','col']){
      const rail=document.createElement('div');rail.className=`line-clues line-${axis}s`;
      for(let i=0;i<game.size;i++){
        const line=game.lines.find(l=>l.face===face.key&&l.axis===axis&&l.index===i);
        const label=document.createElement(line?'button':'span');
        if(line){label.type='button';label.className='line-clue';label.dataset.line=line.id;label.innerHTML=`<span class="line-number">${line.count}</span>`;label.title=t('lineLabel',{line:lineName(line),count:line.count});label.setAttribute('aria-label',label.title+t('highlightLine'));label.addEventListener('click',event=>{event.stopPropagation();inspectLine(line);});addClueLabel(label,section,face,null,line);}
        rail.append(label);
      }
      section.append(rail);
    }
    cube.append(section);
    const button=document.createElement('button');button.id=`face-${face.key}`;button.className='face-nav-button';button.textContent=faceLetter(face.key);button.title=faceName(face.key);
    if(game.lines?.some(l=>l.face===face.key)){button.classList.add('has-lines');button.title+=t('hasLines');}
    button.addEventListener('click',()=>focusFace(face.key));
    button.addEventListener('keydown',event=>{if(event.key==='Tab'&&!event.shiftKey){event.preventDefault();focusFace(face.key);setTileFocus(face.cellIds[0]);}});
    $('face-navigation').append(button);
  }
  for(const key of ['front','back','left','right','top','bottom'])$('face-navigation').append($(`face-${key}`));
}
function configureUI(){
  const puzzle=kind==='puzzles';playground.classList.toggle('puzzle-mode',puzzle);
  setPressed('game-random',!puzzle);setPressed('game-puzzles',puzzle);
  $('difficulty-picker').hidden=puzzle;$('puzzle-picker').hidden=!puzzle;$('puzzle-record').hidden=!puzzle;
  $('puzzle-hint').hidden=!puzzle;$('hint-counter').hidden=!puzzle;$('puzzle-legend').hidden=!puzzle||game.spec.chapter==='basics';
  for(const label of $('puzzle-legend').children)label.hidden=puzzle&&(label.dataset.rule==='together'&&!['together','apart'].includes(game.spec.chapter)||label.dataset.rule==='apart'&&game.spec.chapter!=='apart');
  $('new-game').innerHTML=icon('restart')+t(puzzle?'restartPuzzle':'newGame');
  $('mode-description').textContent=t(puzzle?'modePuzzles':'modeRandom');
  $('intro-copy').textContent=t('intro');
  $('board-size').textContent=`${game.size} × ${game.size}`;
  $('face-help').textContent=t(!puzzle?'faceHelpRandom':game.lines.length?'faceHelpLines':'faceHelpBasics');
  $('tip-label').textContent=t(puzzle?'tipLogic':'tip3d');
  $('tip-number').textContent=puzzle?`${String(game.spec.number).padStart(2,'0')} / ${PUZZLES.length}`:'01 / 01';
  resetTip();
}
function resetTip(){
  $('tip-title').textContent=kind==='puzzles'?puzzleTitle(game.spec):t('tipTitle');
  $('tip-copy').textContent=kind==='puzzles'?puzzleBrief(game.spec):t('tipCopy');
  $('clue-inspector').hidden=true;
}
function startGame(restart=false){
  savePuzzle();stopCameraAnimation();clearTimeout(longPress);heldToFlag=false;gesture=null;hinted.clear();lineHighlights.clear();inspected=null;
  if(kind==='puzzles'){
    const spec=currentSpec();if(restart)delete progress[spec.id];game=new PuzzleGame(spec,progress[spec.id]);
  }else game=new CubeGame($('difficulty').value);
  lastStatus='ready';focusedFace=null;focusId=kind==='puzzles'?game.spec.givens[0]:0;
  orientation=fromEuler(-25,-34);cameraGoal=orientation;zoom=zoomGoal=1;cube.classList.remove('dragging');
  buildBoard();configureUI();
  if(kind==='puzzles'){
    const opening=visibleOpening(game),step=opening?.step??nextDeduction(game);
    focusFace(opening?.face??game.cells[step?.ids[0]??focusId].face,false);
    setTileFocus(opening?.focusId??step?.ids[0]??focusId,false);
  }
  $('safe-total').textContent=game.safeCount;$('progress').setAttribute('aria-valuemax',game.safeCount);$('outcome').hidden=true;
  updateCamera();resize();updateViewCopy();render();savePuzzle();
  announce(kind==='puzzles'?t('newPuzzleAnnouncement',{title:puzzleTitle(game.spec),mines:game.mineCount,givens:game.spec.givens.length}):t('newRandomAnnouncement',{difficulty:t(game.level),tiles:game.cells.length,mines:game.mineCount}));
}
function render(){
  for(const cell of game.cells){
    const tile=tiles[cell.id],showMine=cell.mine&&(cell.revealed||game.status==='lost')&&!cell.flagged,incorrect=game.status==='lost'&&cell.flagged&&!cell.mine;
    const special=cell.revealed&&game.clueKinds?.[cell.id];
    const className=`tile${cell.revealed?' revealed':''}${cell.flagged?' flagged':''}${showMine?' mine':''}${game.exploded===cell.id?' exploded':''}${incorrect?' incorrect':''}${hinted.has(cell.id)?' hinted':''}${game.error===cell.id?' move-error':''}${special?' special-clue':''}${lineHighlights.has(cell.id)?' line-related':''}${inspected===cell.id?' inspected':''}`;
    if(tile.className!==className)tile.className=className;
    const content=incorrect?icon('close'):cell.flagged?icon('flag'):showMine?icon('mine'):cell.revealed&&(cell.count||kind==='puzzles')?`<span class="tile-number" aria-hidden="true">${clueText(cell.count,special)}</span>`:'';
    if(tile.dataset.content!==content){tile.innerHTML=content;tile.dataset.content=content;}
    tile.dataset.count=cell.count;tile.setAttribute('aria-label',tileLabel(cell));
  }
  $('mines-left').textContent=String(game.mineCount-game.flagCount).padStart(3,'0');$('timer').textContent=formatTime(game.elapsed);$('cleared').textContent=game.revealedCount;
  $('progress-fill').style.width=`${game.revealedCount/game.safeCount*100}%`;$('progress').setAttribute('aria-valuenow',game.revealedCount);
  $('live-indicator').textContent=t({ready:'statusReady',playing:'statusPlaying',won:'statusWon',lost:'statusLost'}[game.status]);$('live-indicator').className=`live-indicator ${game.status}`;
  const message={ready:t('stageReady'),playing:t(kind==='puzzles'?'stagePuzzle':'stageRandom'),won:t('stageWon'),lost:t('stageLost')};
  $('stage-status').innerHTML=`<span class="status-dot"></span>${message[game.status]}`;
  let completed=0;
  for(const face of game.faces){
    const all=face.cellIds.map(id=>game.cells[id]),safe=all.filter(c=>!c.mine),count=all.filter(c=>c.revealed&&!c.mine).length;
    const done=game.status!=='ready'&&safe.every(c=>c.revealed);if(done)completed++;
    const btn=$(`face-${face.key}`);btn.classList.toggle('complete',done);btn.setAttribute('aria-pressed',String(focusedFace===face.key));
    btn.setAttribute('aria-label',t('focusFaceLabel',{face:faceName(face.key),count})+(done?t('faceComplete'):'')+(game.lines?.some(l=>l.face===face.key)?t('outsideClues'):''));
  }
  $('face-count').textContent=`${completed} / ${game.faces.length}`;
  if(kind==='puzzles'){
    const solved=PUZZLES.filter(p=>p.id===game.spec.id?game.status==='won':progress[p.id]?.complete).length;
    $('puzzles-solved').textContent=t('solved',{count:solved,total:PUZZLES.length});$('mistakes').textContent=t(game.mistakes===1?'mistakeOne':'mistakeMany',{count:game.mistakes});
    updateHintCounter();
    $('puzzle-hint').disabled=game.status==='won';
  }
  if(game.status!==lastStatus){if(game.status==='lost'||game.status==='won')finish();lastStatus=game.status;}
  syncClueLabels();
}
function finish(){
  const won=game.status==='won';$('outcome').hidden=false;$('outcome').classList.toggle('is-loss',!won);$('outcome-symbol').innerHTML=icon(won?'check':'mine');
  $('outcome-title').textContent=t(won?'wonTitle':'lostTitle');
  $('outcome-description').textContent=won?(kind==='puzzles'?t('puzzleResult',{mistakes:game.mistakes,hints:game.hints,time:formatTime(game.elapsed)}):t('randomResult',{count:game.safeCount,time:formatTime(game.elapsed)})):t('lossResult',{count:game.revealedCount});
  $('play-again').innerHTML=t(kind==='puzzles'?(game.spec.number===PUZZLES.length?'backFirst':'nextPuzzle'):'playAgain')+' <span>↗</span>';
  savePuzzle();if(kind==='puzzles')puzzleMenu(game.spec.id);
  announce(won?t('wonAnnouncement',{faces:game.faces.length,time:formatTime(game.elapsed)}):t('lostAnnouncement',{count:game.revealedCount}));
}
function act(id,flag=mode==='flag'){
  if(!Number.isInteger(id)||!game.cells[id])return;
  const before=game.revealedCount,changed=flag?game.flag(id):game.reveal(id);
  if(!changed){if(flag&&!game.cells[id].flagged&&game.flagCount===game.mineCount&&!['lost','won'].includes(game.status))announce(t('allFlags'));return;}
  hinted.clear();lineHighlights.clear();
  if(inspected!==null&&game.kind==='puzzles')drawRing(inspected);
  render();savePuzzle();
  if(game.kind==='puzzles'&&game.error!==null){
    inspected=null;$('clue-inspector').hidden=true;
    $('tip-title').textContent=t('errorTitle');$('tip-copy').textContent=t(flag?'errorSafe':'errorMine');
    announce($('tip-copy').textContent);const current=game;setTimeout(()=>{if(game===current){game.error=null;render();}},900);return;
  }
  if(['ready','playing'].includes(game.status))announce(flag?t('flagAnnouncement',{tile:tileLabel(game.cells[id]),count:game.mineCount-game.flagCount}):t('revealAnnouncement',{tile:tileLabel(game.cells[id]),opened:game.revealedCount-before,count:game.revealedCount,total:game.safeCount}));
}
function setMode(next){mode=next;setPressed('mode-reveal',mode==='reveal');setPressed('mode-flag',mode==='flag');$('mode-help').textContent=t(mode==='reveal'?'revealHelp':'flagHelp');playground.classList.toggle('flag-mode',mode==='flag');announce(t(mode==='flag'?'modeFlagAnnouncement':'modeRevealAnnouncement'));}
function addClueLabel(anchor,section,face,cellId,line=null){
  const label=document.createElement('span');label.className='clue-label';label.hidden=true;
  if(cellId!==null)label.dataset.cell=cellId;else label.dataset.line=line.id;
  clueLayer.append(label);clueLabels.push({anchor,section,face,cellId,line,label,active:false});
}
function syncClueLabels(){
  for(const entry of clueLabels){
    const cell=entry.cellId===null?null:game.cells[entry.cellId];
    entry.active=Boolean(entry.line||cell?.revealed&&!cell.mine&&(cell.count||kind==='puzzles'));
    const content=entry.line?String(entry.line.count):entry.active?clueText(cell.count,game.clueKinds?.[cell.id]):'';
    if(entry.label.textContent!==content)entry.label.textContent=content;
  }
  measureClueLabels();updateClueLabels();
}
function measureClueLabels(){
  const size=cube.offsetWidth,perspective=getComputedStyle(scene),origin=perspective.perspectiveOrigin.split(' ').map(parseFloat);
  cameraFrame={centerX:cube.offsetLeft+size/2,centerY:cube.offsetTop+cube.offsetHeight/2,originX:origin[0],originY:origin[1],perspective:parseFloat(perspective.perspective)||1250};
  if(view==='net')return;
  for(const entry of clueLabels){
    if(!entry.active)continue;
    let x=entry.anchor.offsetWidth/2,y=entry.anchor.offsetHeight/2,element=entry.anchor;
    while(element&&element!==entry.section){
      x+=element.offsetLeft;y+=element.offsetTop;element=element.offsetParent;
      if(element){x+=element.clientLeft;y+=element.clientTop;}
    }
    Object.assign(entry,facePoint(entry.face,x-size/2,y-size/2,size/2));
    const style=getComputedStyle(entry.anchor);
    entry.label.style.fontSize=style.fontSize;entry.label.style.letterSpacing=style.letterSpacing;entry.label.style.color=style.color;
  }
}
function updateClueLabels(){
  if(view==='net'||!cameraFrame)return;
  for(const entry of clueLabels){
    const projected=entry.active&&entry.point&&(!entry.line||focusedFace===entry.face.key)?projectClue(entry.point,entry.normal,orientation,zoom,cameraFrame):null;
    // Near a silhouette the cells collapse to a sliver. Fade their labels to avoid overlap.
    const opacity=projected?Math.max(0,Math.min(1,(projected.facing-.12)/.23)):0;
    entry.label.hidden=!opacity;
    if(!opacity)continue;
    entry.label.style.left=`${projected.x}px`;entry.label.style.top=`${projected.y}px`;
    entry.label.style.transform=`translate(-50%,-50%) scale(${projected.scale})`;
    entry.label.style.opacity=opacity;
  }
}
function updateCamera(){cube.style.transform=cssTransform(orientation,zoom);updateClueLabels();}
function stopCameraAnimation(){
  if(cameraAnimation!==null)cancelAnimationFrame(cameraAnimation);
  cameraAnimation=null;cameraGoal=orientation;zoomGoal=zoom;
}
function moveCamera(nextOrientation,nextZoom=zoom,animate=true){
  stopCameraAnimation();cameraGoal=nextOrientation;zoomGoal=nextZoom;
  if(!animate||view==='net'||matchMedia('(prefers-reduced-motion: reduce)').matches){orientation=nextOrientation;zoom=nextZoom;updateCamera();return;}
  const from=orientation,startZoom=zoom,started=performance.now();
  const frame=now=>{
    const amount=Math.min(1,(now-started)/420),eased=1-(1-amount)**3;
    orientation=interpolate(from,nextOrientation,eased);zoom=startZoom+(nextZoom-startZoom)*eased;updateCamera();
    cameraAnimation=amount<1?requestAnimationFrame(frame):null;
  };
  cameraAnimation=requestAnimationFrame(frame);
}
function rotateCamera(dx,dy){if(view==='cube'){clearFaceFocus();moveCamera(rotateOnScreen(cameraGoal,dx,dy),zoomGoal);}}
function resize(){
  if(!game)return;const rect=viewport.getBoundingClientRect();let size;
  if(view==='net'){
    const gap=kind==='puzzles'?48:24,padding=kind==='puzzles'?64:40;
    size=kind==='puzzles'?Math.max(192,Math.min((rect.width-180)/4,(rect.height-120)/3,224)):Math.max(136,Math.min((rect.width-112)/4,(rect.height-88)/3,184));
    playground.style.setProperty('--gap',`${gap}px`);
    playground.style.setProperty('--net-width',`${size*4+gap*3+padding}px`);playground.style.setProperty('--net-height',`${size*3+gap*2+padding}px`);
  }else{size=Math.min(306,(rect.width-46)/1.55,(rect.height-56)/1.5);size=Math.max(135,size);}
  playground.style.setProperty('--size',`${size}px`);
  measureClueLabels();updateClueLabels();
}
function updateViewCopy(){
  $('orbit-hint').innerHTML=view==='cube'?`${icon('rotate')}<span>${t('drag')}</span><i></i><span>${t('scrollZoom')}</span>`:`${icon('net')}<span>${t('allFaces',{count:game.faces.length})}</span>`;
  if(view==='net'&&(viewport.scrollWidth>viewport.clientWidth||viewport.scrollHeight>viewport.clientHeight))$('orbit-hint').innerHTML=`${icon('net')}<span>${t('scrollExplore')}</span>`;
}
function setView(next){stopCameraAnimation();view=next;playground.classList.toggle('net-mode',next==='net');setPressed('view-cube',next==='cube');setPressed('view-net',next==='net');if(next==='cube'){viewport.scrollLeft=0;viewport.scrollTop=0;}resize();updateCamera();updateViewCopy();announce(t(next==='net'?'netAnnouncement':'cubeAnnouncement'));}
function clearFaceFocus(){focusedFace=null;for(const face of game.faces){$(`face-${face.key}`).setAttribute('aria-pressed','false');cube.querySelector(`[data-face="${face.key}"]`).classList.remove('highlighted');}}
function focusFace(key,animate=true){
  const face=game.faces.find(f=>f.key===key);if(!face)return;focusedFace=key;const [x,y]=face.view;moveCamera(fromEuler(x,y),zoomGoal,animate);
  for(const f of game.faces){$(`face-${f.key}`).setAttribute('aria-pressed',String(f.key===key));cube.querySelector(`[data-face="${f.key}"]`).classList.toggle('highlighted',f.key===key);}
  setTileFocus(face.cellIds[0],false);
  if(view==='net'){
    const rect=cube.querySelector(`[data-face="${key}"]`).getBoundingClientRect(),base=viewport.getBoundingClientRect();
    viewport.scrollTo({left:Math.max(0,rect.left-base.left+viewport.scrollLeft-(viewport.clientWidth-rect.width)/2),top:Math.max(0,rect.top-base.top+viewport.scrollTop-(viewport.clientHeight-rect.height)/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  announce(t('faceFocused',{face:faceName(face.key)}));
}
function setTileFocus(id,focus=true){if(tiles[focusId])tiles[focusId].setAttribute('tabindex','-1');focusId=id;tiles[id].setAttribute('tabindex','0');if(focus)tiles[id].focus({preventScroll:true});}
function resetCamera(){clearFaceFocus();moveCamera(fromEuler(-25,-34),1);}
function changeZoom(delta){if(view==='net')return;moveCamera(cameraGoal,Math.max(.65,Math.min(1.4,zoomGoal+delta)));}
function showHint(){
  if(kind!=='puzzles'||game.status==='won')return;const step=nextDeduction(game,{language:getLanguage()});if(!step){announce(t('noHint'));return;}
  hinted=new Set(step.ids);lineHighlights.clear();inspected=null;$('clue-inspector').hidden=true;game.hints++;$('tip-title').textContent=t(step.value==='safe'?'safeHintTitle':'mineHintTitle');$('tip-copy').textContent=step.reason;
  focusFace(game.cells[step.ids[0]].face);setTileFocus(step.ids[0],false);render();savePuzzle();announce(step.reason);
}
function setKind(next){if(kind===next)return;savePuzzle();kind=next;puzzleMenu();startGame();}
function nextPuzzle(){
  const i=PUZZLES.findIndex(p=>p.id===game.spec.id),spec=PUZZLES[(i+1)%PUZZLES.length];savePuzzle();puzzleMenu(spec.id);startGame();
}

function drawRing(id){
  const cell=game.cells[id],ring=$('neighbor-ring');ring.replaceChildren();$('clue-inspector').hidden=false;
  for(const other of cell.ring){
    const neighbor=game.cells[other],button=document.createElement('button');button.type='button';button.className=`ring-tile${neighbor.revealed?' open':''}${neighbor.flagged?' marked':''}`;
    button.innerHTML=neighbor.flagged?icon('flag'):neighbor.revealed?String(neighbor.count):'·';button.setAttribute('aria-label',t('locate',{tile:tileLabel(neighbor)}));button.title=cellName(game,other);
    button.addEventListener('click',()=>{focusFace(neighbor.face);lineHighlights=new Set([other]);setTileFocus(other);render();});ring.append(button);
  }
}
function inspectClue(id){
  inspected=id;lineHighlights=new Set(game.cells[id].neighbors);const cell=game.cells[id],special=game.clueKinds[id];
  $('tip-title').textContent=`${clueText(cell.count,special)} · ${cellName(game,id)}`;
  $('tip-copy').textContent=t(special==='together'?'inspectTogether':special==='apart'?'inspectApart':'inspectNumber',{count:cell.count});
  drawRing(id);render();
}
function inspectLine(line){
  hinted.clear();inspected=null;lineHighlights=new Set(line.ids);$('clue-inspector').hidden=true;focusFace(line.face);
  $('tip-title').textContent=lineName(line);
  $('tip-copy').textContent=t('inspectLine',{count:line.count});render();announce($('tip-copy').textContent);
}

cube.addEventListener('click',event=>{if(Date.now()<suppressUntil)return;const tile=event.target.closest('.tile');if(!tile)return;const id=Number(tile.dataset.id);setTileFocus(id,false);if(kind==='puzzles'&&game.cells[id].revealed)inspectClue(id);act(id,event.shiftKey||mode==='flag');});
cube.addEventListener('contextmenu',event=>{event.preventDefault();if(Date.now()<suppressUntil)return;const tile=event.target.closest('.tile');if(tile)act(Number(tile.dataset.id),true);});
cube.addEventListener('keydown',event=>{
  const tile=event.target.closest('.tile');if(!tile)return;const id=Number(tile.dataset.id);
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(directions[event.key]){event.preventDefault();event.stopPropagation();setTileFocus(directionalNeighbor(game.surface,id,directions[event.key]));}
});
cube.addEventListener('pointerover',event=>{if(gesture?.moved||event.pointerType==='touch')return;const tile=event.target.closest('.tile');if(!tile)return;const cell=game.cells[Number(tile.dataset.id)];if(cell.revealed&&cell.count&&!cell.mine)for(const id of cell.neighbors)tiles[id].classList.add('related');});
cube.addEventListener('pointerout',()=>{for(const t of tiles)t.classList.remove('related');});
viewport.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.isPrimary===false||event.target.closest('.line-clue')||gesture)return;heldToFlag=false;
  gesture={id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};const tile=event.target.closest('.tile');
  if(event.pointerType==='touch'&&tile)longPress=setTimeout(()=>{if(gesture&&!gesture.moved){act(Number(tile.dataset.id),true);heldToFlag=true;suppressUntil=Date.now()+700;gesture=null;}},480);
});
viewport.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.startX,dy=event.clientY-gesture.startY;
  if(Math.hypot(dx,dy)>6){gesture.moved=true;clearTimeout(longPress);}
  if(gesture.moved&&view==='cube'){
    viewport.setPointerCapture(event.pointerId);cube.classList.add('dragging');clearFaceFocus();stopCameraAnimation();
    orientation=rotateOnScreen(orientation,event.clientX-gesture.lastX,event.clientY-gesture.lastY);cameraGoal=orientation;
    gesture.lastX=event.clientX;gesture.lastY=event.clientY;updateCamera();
  }
});
function endGesture(event){if(gesture&&gesture.id!==event.pointerId)return;clearTimeout(longPress);if(gesture?.moved||heldToFlag)suppressUntil=Date.now()+250;heldToFlag=false;gesture=null;cube.classList.remove('dragging');if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);}
viewport.addEventListener('pointerup',endGesture);viewport.addEventListener('pointercancel',endGesture);viewport.addEventListener('lostpointercapture',endGesture);viewport.addEventListener('pointerleave',()=>{clearTimeout(longPress);if(gesture&&!gesture.moved)gesture=null;});
viewport.addEventListener('wheel',event=>{if(view==='cube'){event.preventDefault();changeZoom(event.deltaY>0?-.04:.04);}},{passive:false});
$('game-random').addEventListener('click',()=>setKind('random'));$('game-puzzles').addEventListener('click',()=>setKind('puzzles'));
$('new-game').addEventListener('click',()=>startGame(true));$('play-again').addEventListener('click',()=>kind==='puzzles'?nextPuzzle():startGame());
$('difficulty').addEventListener('change',()=>startGame());$('puzzle-level').addEventListener('change',()=>startGame());$('puzzle-hint').addEventListener('click',showHint);
$('view-cube').addEventListener('click',()=>setView('cube'));$('view-net').addEventListener('click',()=>setView('net'));
$('mode-reveal').addEventListener('click',()=>setMode('reveal'));$('mode-flag').addEventListener('click',()=>setMode('flag'));
$('reset-view').addEventListener('click',resetCamera);$('zoom-in').addEventListener('click',()=>changeZoom(.1));$('zoom-out').addEventListener('click',()=>changeZoom(-.1));
for(const id of ['help-open','rules-open','shortcuts-open'])$(id).addEventListener('click',()=>$('help-dialog').showModal());
for(const id of ['help-close','help-done'])$(id).addEventListener('click',()=>$('help-dialog').close());
$('help-dialog').addEventListener('click',event=>{if(event.target===$('help-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.target.matches('select,input,textarea')||$('help-dialog').open)return;
  switch(event.key.toLowerCase()){
    case 'f':event.preventDefault();setMode(mode==='reveal'?'flag':'reveal');break;
    case 'n':event.preventDefault();startGame(true);break;
    case 'h':event.preventDefault();resetCamera();break;
    case '+':case '=':event.preventDefault();changeZoom(.1);break;
    case '-':event.preventDefault();changeZoom(-.1);break;
    case 'arrowleft':event.preventDefault();rotateCamera(-20/.42,0);break;
    case 'arrowright':event.preventDefault();rotateCamera(20/.42,0);break;
    case 'arrowup':event.preventDefault();rotateCamera(0,-20/.42);break;
    case 'arrowdown':event.preventDefault();rotateCamera(0,20/.42);break;
    case '?':event.preventDefault();$('help-dialog').showModal();break;
  }
});
new ResizeObserver(resize).observe(viewport);
setInterval(()=>{if(game?.status==='playing')$('timer').textContent=formatTime(game.elapsed);},500);
window.addEventListener('pagehide',savePuzzle);document.addEventListener('visibilitychange',()=>{if(document.hidden)savePuzzle();});
function changeLanguage(value){
  setLanguage(value);translatePage(document);
  const previousFocus=focusId,previousInspection=inspected;
  puzzleMenu();buildBoard();configureUI();
  for(const face of game.faces)cube.querySelector(`[data-face="${face.key}"]`).classList.toggle('highlighted',face.key===focusedFace);
  setTileFocus(previousFocus,false);setMode(mode);updateViewCopy();
  if(previousInspection!==null)inspectClue(previousInspection);
  else if(hinted.size){const step=nextDeduction(game,{language:getLanguage()});if(step){$('tip-title').textContent=t(step.value==='safe'?'safeHintTitle':'mineHintTitle');$('tip-copy').textContent=step.reason;}}
  else if(lineHighlights.size){const line=game.lines?.find(l=>l.ids.length===lineHighlights.size&&l.ids.every(id=>lineHighlights.has(id)));if(line){$('tip-title').textContent=lineName(line);$('tip-copy').textContent=t('inspectLine',{count:line.count});}}
  render();if(['won','lost'].includes(game.status))finish();
  announce(t('languageChanged'));
}
$('language').addEventListener('change',event=>changeLanguage(event.target.value));
translatePage(document);puzzleMenu();startGame();setMode(mode);
