import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve,dirname,relative,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=resolve(root,'dist');
async function files(folder){
  const found=[];
  for(const entry of await readdir(folder,{withFileTypes:true})){
    const path=resolve(folder,entry.name);
    if(entry.isSymbolicLink())throw Error(`Unexpected symbolic link: ${path}`);
    if(entry.isDirectory())found.push(...await files(path));else found.push(path);
  }
  return found;
}
const all=(await Promise.all(['dist','scripts','tests'].map(dir=>files(resolve(root,dir))))).flat();
for(const path of all.filter(p=>extname(p)==='.mjs'))execFileSync(process.execPath,['--check',path],{stdio:'inherit'});

// A project site lives under /repository-name/. Every game URL must stay there.
const publicBase=new URL('https://example.github.io/cubemine/');
let references=0;
for(const path of await files(dist)){
  const text=await readFile(path,'utf8');
  if(/chatgpt\.site|git\.chatgpt-team\.site|appgprj_|\.openai\//.test(text))throw Error(`Hosting-specific reference in ${path}`);
  let refs=[];
  if(extname(path)==='.html')refs=[...text.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]);
  if(extname(path)==='.mjs')refs=[...text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);
  if(extname(path)==='.css')refs=[...text.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(m=>m[1]);
  for(const ref of refs){
    if(ref.startsWith('#')||ref.startsWith('data:'))continue;
    if(!ref.startsWith('./')&&!ref.startsWith('../'))throw Error(`Non-relative runtime dependency: ${ref}`);
    const from=relative(dist,path).split(sep).join('/'),url=new URL(ref,new URL(from,publicBase));
    if(url.origin!==publicBase.origin||!url.pathname.startsWith(publicBase.pathname))throw Error(`Reference escapes the repository path: ${ref}`);
    let target=resolve(dirname(path),ref.split(/[?#]/)[0]);
    if((await stat(target)).isDirectory())target=resolve(target,'index.html');
    if(!(await stat(target)).isFile())throw Error(`Missing local asset: ${ref}`);
    references++;
  }
}
console.log(`JavaScript syntax passed; ${references} relative references resolve under /cubemine/.`);
