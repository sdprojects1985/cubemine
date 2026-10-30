import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MESSAGES,LANGUAGE_KEY,initializeLanguage,getLanguage,setLanguage,t,faceName,faceLetter,cellName,puzzleTitle,puzzleBrief,translatePage} from '../dist/i18n.mjs';
import {PuzzleGame} from '../dist/engine.mjs';
import {PUZZLES,CHAPTERS} from '../dist/puzzles.mjs';
import {nextDeduction,solvePuzzle} from '../dist/deduction.mjs';

test('Spanish is the default even for missing, invalid, or unavailable preferences; English persists independently',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 assert.equal(initializeLanguage(storage),'es');
 data.set(LANGUAGE_KEY,'fr');assert.equal(initializeLanguage(storage),'es');
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(initializeLanguage(blocked),'es');assert.equal(setLanguage('en',blocked),'en');
 setLanguage('en',storage);assert.equal(data.get(LANGUAGE_KEY),'en');assert.equal(initializeLanguage(storage),'en');
 assert.equal(data.has('cubemine-puzzles-v1'),false);
 setLanguage('es',storage);
});

test('every translation has matching placeholders and every authored puzzle has both names and instructions',()=>{
 assert.deepEqual(Object.keys(MESSAGES.es).sort(),Object.keys(MESSAGES.en).sort());
 const tokens=s=>[...s.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort();
 for(const key of Object.keys(MESSAGES.en)){
  assert.ok(MESSAGES.es[key].trim(),key);assert.deepEqual(tokens(MESSAGES.es[key]),tokens(MESSAGES.en[key]),key);
 }
 for(const locale of ['en','es']){
  setLanguage(locale,{});
  for(const spec of PUZZLES){assert.ok(puzzleTitle(spec));assert.ok(puzzleBrief(spec));if(locale==='en'){assert.equal(puzzleTitle(spec),spec.title);assert.equal(puzzleBrief(spec),spec.brief);}}
  for(const key of Object.keys(CHAPTERS))assert.ok(t('chapter.'+key));
  const faces=['front','right','back','left','top','bottom'];assert.equal(new Set(faces.map(face=>faceLetter(face))).size,6);
  for(const face of faces)assert.ok(faceName(face));
 }
 setLanguage('es',{});
});

test('both languages produce exactly the same complete proof for all 12 puzzles',()=>{
 for(const spec of PUZZLES){
  const en=solvePuzzle(spec,{language:'en'}),es=solvePuzzle(spec,{language:'es'});
  assert.ok(en.complete&&es.complete);assert.equal(en.game.mistakes+es.game.mistakes,0);
  const logical=steps=>steps.map(({reason,...step})=>step);
  assert.deepEqual(logical(es.steps),logical(en.steps));
  for(const [i,step]of es.steps.entries()){
   assert.notEqual(step.reason,en.steps[i].reason);assert.doesNotMatch(step.reason,/\{[a-zA-Z]+\}/);
   assert.doesNotMatch(step.reason,/\b(Front|Back|Right|Left|Top|Bottom|row|column|highlighted|covered|requires|Comparing)\b/);
  }
 }
});

test('language changes do not mutate an active board or saved progress',()=>{
 const game=new PuzzleGame(PUZZLES[0]);game.reveal(2);game.hints=2;
 const before=JSON.stringify(game.serialize());const mines=game.cells.map(c=>c.mine);
 setLanguage('en',{});const en=nextDeduction(game,{language:getLanguage()});const englishName=cellName(game,4);
 setLanguage('es',{});const es=nextDeduction(game,{language:getLanguage()});
 assert.deepEqual(es.ids,en.ids);assert.notEqual(cellName(game,4),englishName);
 assert.equal(JSON.stringify(game.serialize()),before);assert.deepEqual(game.cells.map(c=>c.mine),mines);
});

test('the initial HTML, all translation hooks, and accessibility attributes have Spanish content',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/<html lang="es">/);assert.match(html,/<option value="es"[^>]*selected/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);
 const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
 for(const [,id]of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),id);
 const translated=[...html.matchAll(/data-i18n-html="([^"]+)"/g)].map(([,key])=>({dataset:{i18nHtml:key}}));
 const attrs=[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].map(([,keys])=>({dataset:{i18nAttr:keys},attributes:{},setAttribute(k,v){this.attributes[k]=v;}}));
 const doc={documentElement:{},querySelector:()=>({setAttribute(){}}),getElementById:()=>({}),querySelectorAll:selector=>selector==='[data-i18n-html]'?translated:attrs};
 for(const locale of ['en','es']){setLanguage(locale,{});translatePage(doc);assert.equal(doc.documentElement.lang,locale);for(const el of translated)assert.equal(el.innerHTML,MESSAGES[locale][el.dataset.i18nHtml]);for(const el of attrs)for(const [attr,value]of Object.entries(el.attributes))assert.ok(value?.trim(),attr);}
 setLanguage('es',{});
});
