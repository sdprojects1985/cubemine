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
// Return the local 2D rotation for a mark at (x,y) on this face. The browser
// projects the complete face, including its ink, using the cube's CSS transform.
export function surfaceReadingAngles(face, orientation, zoom, {halfSize, eyeX, perspective}) {
  const right = rotateVector(orientation, face.u);
  const down = rotateVector(orientation, face.v);
  const half = zoom * halfSize;
  // The outward normal is right × down. Only its X and Z affect screen X.
  const centerX = half * (right[1] * down[2] - right[2] * down[1]);
  const centerZ = half * (right[0] * down[1] - right[1] * down[0]);

  return function angleAt(x, y) {
    const viewX = centerX + zoom * (right[0] * x + down[0] * y);
    const viewZ = centerZ + zoom * (right[2] * x + down[2] * y);
    const depth = perspective - viewZ;
    const offsetX = viewX - eyeX;
    // Derivatives of projected X along the two surface axes, up to a
    // shared positive factor. Turn the mark so its vertical stroke has
    // zero horizontal displacement. Local lengths and face tilt stay intact.
    const across = depth * right[0] + offsetX * right[2];
    const along = depth * down[0] + offsetX * down[2];
    return Math.atan2(along, across) / radians;
  };
}
