export const CUBE_FACES=['front','right','back','left','top','bottom'];
export const vertexKey=p=>p.map(v=>Math.round(v*1e7)).join(',');
export function cubeVertex(face,x,y,n){
  switch(face){
    case 'front':return [x,y,n];case 'right':return [n,y,n-x];
    case 'back':return [n-x,y,0];case 'left':return [0,y,x];
    case 'top':return [x,0,y];case 'bottom':return [x,n,n-y];
    default:throw new Error('Unknown cube face');
  }
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const mean=points=>[0,1,2].map(i=>points.reduce((s,p)=>s+p[i],0)/points.length);
export function createSurface(size=4){
  if(!Number.isInteger(size)||size<2||size>12)throw new Error('Invalid cube size');
  const cells=[],faces=[],atVertex=new Map();
  const letters=['F','R','B','L','U','D'],views=[[0,0],[0,-90],[0,-180],[0,90],[-90,0],[90,0]];
  CUBE_FACES.forEach((key,i)=>{
    const origin=cubeVertex(key,0,0,size),u=sub(cubeVertex(key,1,0,size),origin),v=sub(cubeVertex(key,0,1,size),origin);
    const face={key,label:key[0].toUpperCase()+key.slice(1),letter:letters[i],view:views[i],u,v,cellIds:[]};faces.push(face);
    for(let row=0;row<size;row++)for(let col=0;col<size;col++){
      const vertices=[[col,row],[col+1,row],[col+1,row+1],[col,row+1]].map(([x,y])=>cubeVertex(key,x,y,size));
      const cell={id:cells.length,face:key,row,col,vertices,center:mean(vertices),neighbors:new Set(),mine:false,count:0,revealed:false,flagged:false};
      face.cellIds.push(cell.id);cells.push(cell);
      for(const p of vertices){const id=vertexKey(p);if(!atVertex.has(id))atVertex.set(id,[]);atVertex.get(id).push(cell.id);}
    }
  });
  for(const ids of atVertex.values())for(const a of ids)for(const b of ids)if(a!==b)cells[a].neighbors.add(b);
  for(const cell of cells){
    cell.neighbors=[...cell.neighbors].sort((a,b)=>a-b);
    const face=faces.find(f=>f.key===cell.face);
    const angle=id=>{const delta=sub(cells[id].center,cell.center);return (Math.atan2(dot(delta,face.v),dot(delta,face.u))+2*Math.PI)%(2*Math.PI);};
    cell.ring=[...cell.neighbors].sort((a,b)=>angle(a)-angle(b));
  }
  return {size,cells,faces};
}
export function directionalNeighbor(surface,id,[dx,dy]){
  const cell=surface.cells[id],n=surface.size;
  return CUBE_FACES.indexOf(cell.face)*n*n+Math.max(0,Math.min(n-1,cell.row+dy))*n+Math.max(0,Math.min(n-1,cell.col+dx));
}
export function lineCells(surface,face,axis,index){
  if(!CUBE_FACES.includes(face)||!['row','col'].includes(axis)||!Number.isInteger(index)||index<0||index>=surface.size)throw new Error('Invalid line clue');
  return surface.cells.filter(c=>c.face===face&&c[axis]===index).map(c=>c.id);
}
