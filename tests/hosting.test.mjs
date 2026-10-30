import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPreviewServer} from '../scripts/serve.mjs';

async function withServer(basePath,run){
  const server=createPreviewServer({basePath});server.listen(0,'127.0.0.1');await once(server,'listening');
  try{await run(`http://127.0.0.1:${server.address().port}`);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

test('the game and all imported modules serve under a GitHub Pages project prefix',async()=>{
 await withServer('/cubemine/',async origin=>{
  const redirect=await fetch(origin+'/cubemine',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/cubemine/');
  const home=await fetch(origin+'/cubemine/');assert.equal(home.status,200);const html=await home.text();assert.match(html,/<html lang="es">/);
  const css=await fetch(origin+'/cubemine/styles.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type'),/^text\/css/);
  const visited=new Set();
  async function module(path){
   if(visited.has(path))return;visited.add(path);
   const response=await fetch(path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/^text\/javascript/);
   for(const [,ref]of (await response.text()).matchAll(/from\s*['"](\.\.?\/[^'"]+)['"]/g))await module(new URL(ref,path).href);
  }
  await module(origin+'/cubemine/app.mjs');assert.ok(visited.has(origin+'/cubemine/camera.mjs'));
  const wrong=await fetch(origin+'/app.mjs');assert.equal(wrong.status,404);
 });
});

test('the local preview serves the root and keeps repository files outside the web root',async()=>{
 await withServer('/',async origin=>{
  assert.equal((await fetch(origin+'/')).status,200);
  for(const path of ['/package.json','/.github/workflows/pages.yml','/tests/engine.test.mjs','/%2e%2e%2fpackage.json'])assert.equal((await fetch(origin+path)).status,404,path);
  const head=await fetch(origin+'/app.mjs',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
 });
});
