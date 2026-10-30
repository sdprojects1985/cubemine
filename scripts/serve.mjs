import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve,relative,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};

export function createPreviewServer({basePath='/'}={}){
  if(!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath))throw Error('Base path must be / or /repository-name/');
  return createServer(async(req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    let pathname;
    try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
    if(basePath!=='/'&&pathname===basePath.slice(0,-1)){res.writeHead(308,{Location:basePath});res.end();return;}
    if(!pathname.startsWith(basePath)||pathname.includes('\\')||pathname.includes('\0')){res.writeHead(404);res.end();return;}
    const segments=pathname.slice(basePath.length).split('/');
    if(segments.some(s=>s.startsWith('.'))){res.writeHead(404);res.end();return;}
    let file=resolve(root,...segments),inside=relative(root,file);
    if(inside==='..'||inside.startsWith('..'+sep)){res.writeHead(404);res.end();return;}
    try{
      if((await stat(file)).isDirectory())file=resolve(file,'index.html');
      const body=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:body);
    }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const i=process.argv.indexOf('--base-path'),basePath=i===-1?'/':process.argv[i+1];
  const port=Number(process.env.PORT??8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer from 1 to 65535');
  const server=createPreviewServer({basePath});
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Cubemine: http://127.0.0.1:${port}${basePath}`));
}
