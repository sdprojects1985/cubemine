// CSS coordinates: X right, Y down, Z toward the viewer. Quaternions are [x,y,z,w].
const radians=Math.PI/180;
const normalize=q=>{const length=Math.hypot(...q);return q.map(v=>v/length);};
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);

export function multiply(a,b){
  const [x,y,z,w]=a,[i,j,k,r]=b;
  return [w*i+x*r+y*k-z*j,w*j-x*k+y*r+z*i,w*k+x*j-y*i+z*r,w*r-x*i-y*j-z*k];
}
function axisAngle(x,y,z,angle){const s=Math.sin(angle/2);return [x*s,y*s,z*s,Math.cos(angle/2)];}
export function fromEuler(x,y){return multiply(axisAngle(1,0,0,x*radians),axisAngle(0,1,0,y*radians));}

export function rotateOnScreen(orientation,dx,dy,sensitivity=.42){
  const distance=Math.hypot(dx,dy);
  if(!distance)return orientation.slice();
  // Pre-multiplication applies the gesture in screen space, at every orientation.
  return normalize(multiply(axisAngle(-dy/distance,dx/distance,0,distance*sensitivity*radians),orientation));
}
export function interpolate(from,to,amount){
  let target=to,cosine=dot(from,target);
  if(cosine<0){target=target.map(v=>-v);cosine=-cosine;}
  if(cosine>.9995)return normalize(from.map((v,i)=>v+(target[i]-v)*amount));
  const angle=Math.acos(Math.min(1,cosine)),sine=Math.sin(angle);
  return from.map((v,i)=>(v*Math.sin((1-amount)*angle)+target[i]*Math.sin(amount*angle))/sine);
}
export function rotateVector(q,v){
  const [x,y,z,w]=q,[a,b,c]=v;
  const tx=2*(y*c-z*b),ty=2*(z*a-x*c),tz=2*(x*b-y*a);
  return [a+w*tx+y*tz-z*ty,b+w*ty+z*tx-x*tz,c+w*tz+x*ty-y*tx];
}
export function cssTransform(q,zoom=1){
  const x=rotateVector(q,[1,0,0]).map(v=>v*zoom);
  const y=rotateVector(q,[0,1,0]).map(v=>v*zoom);
  const z=rotateVector(q,[0,0,1]).map(v=>v*zoom);
  return `matrix3d(${[...x,0,...y,0,...z,0,0,0,0,1].join(',')})`;
}
export function facePoint(face,x,y,half){
  const [a,b,c]=face.u,[d,e,f]=face.v;
  const normal=[b*f-c*e,c*d-a*f,a*e-b*d];
  return {normal,point:normal.map((n,i)=>face.u[i]*x+face.v[i]*y+n*half)};
}
export function projectClue(point,normal,orientation,zoom,frame){
  const p=rotateVector(orientation,point).map(v=>v*zoom),n=rotateVector(orientation,normal);
  const camera=[frame.originX-frame.centerX,frame.originY-frame.centerY,frame.perspective];
  const towardCamera=camera.map((v,i)=>v-p[i]);
  const facing=dot(n,towardCamera)/Math.hypot(...towardCamera);
  // Test the actual perspective viewing ray, not just the normal's Z component.
  if(facing<=0||frame.perspective-p[2]<=0)return null;
  const perspectiveScale=frame.perspective/(frame.perspective-p[2]);
  return {
    x:frame.originX+(frame.centerX+p[0]-frame.originX)*perspectiveScale,
    y:frame.originY+(frame.centerY+p[1]-frame.originY)*perspectiveScale,
    scale:zoom*perspectiveScale,
    facing,
  };
}
