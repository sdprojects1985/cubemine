import test from 'node:test';
import assert from 'node:assert/strict';
import {fromEuler,rotateOnScreen,rotateVector,interpolate,cssTransform,surfaceReadingAngles} from '../dist/camera.mjs';
import {createSurface,cubeVertex} from '../dist/shapes.mjs';
import {surfaceMark,tileMark} from '../dist/markings.mjs';

const near=(actual,expected,epsilon=1e-9)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} != ${expected}`);
const nearVector=(actual,expected)=>actual.forEach((v,i)=>near(v,expected[i]));
const inverse=q=>[-q[0],-q[1],-q[2],q[3]];
const faces=createSurface(4).faces;
const frame={halfSize:150,eyeX:0,eyeY:-20,perspective:1250};

test('the same drag moves the facing point right or down from every face and an upside-down cube',()=>{
  const poses=[...faces.map(f=>fromEuler(...f.view)),fromEuler(180,37),fromEuler(90,120),fromEuler(-135,-240),rotateOnScreen(fromEuler(-25,-34),190,240)];
  for(const q of poses){
    // Find a physical point facing the viewer, independent of the cube's current orientation.
    const front=rotateVector(inverse(q),[0,0,150]);
    const right=rotateVector(rotateOnScreen(q,20,0),front),down=rotateVector(rotateOnScreen(q,0,20),front);
    assert.ok(right[0]>20);near(right[1],0);
    assert.ok(down[1]>20);near(down[0],0);
    nearVector(rotateVector(rotateOnScreen(q,-20,0),front),[-right[0],0,right[2]]);
  }
});

test('horizontal and vertical gesture paths remain in screen coordinates after repeated tumbles',()=>{
  let q=fromEuler(-25,-34);
  for(let i=0;i<300;i++){
    q=rotateOnScreen(q,Math.sin(i)*21,Math.cos(i*1.7)*18);
    const before=rotateVector(q,[18,-45,128]),a=.42*12*Math.PI/180;
    const horizontal=rotateVector(rotateOnScreen(q,12,0),[18,-45,128]);
    nearVector(horizontal,[Math.cos(a)*before[0]+Math.sin(a)*before[2],before[1],-Math.sin(a)*before[0]+Math.cos(a)*before[2]]);
    const vertical=rotateVector(rotateOnScreen(q,0,12),[18,-45,128]);
    nearVector(vertical,[before[0],Math.cos(a)*before[1]+Math.sin(a)*before[2],-Math.sin(a)*before[1]+Math.cos(a)*before[2]]);
  }
});

test('long rotations preserve scale, orthogonal axes and reversibility without zoom drift',()=>{
  const initial=fromEuler(-25,-34);let q=initial;
  for(let i=0;i<10000;i++)q=rotateOnScreen(q,2,-3);
  near(Math.hypot(...q),1);
  const axes=[[1,0,0],[0,1,0],[0,0,1]].map(v=>rotateVector(q,v));
  for(const axis of axes)near(Math.hypot(...axis),1);
  near(axes[0].reduce((s,v,i)=>s+v*axes[1][i],0),0);
  for(let i=0;i<10000;i++)q=rotateOnScreen(q,-2,3);
  nearVector(rotateVector(q,[1,2,3]),rotateVector(initial,[1,2,3]));
  const matrix=cssTransform(q,1.3).slice(9,-1).split(',').map(Number);
  for(const offset of [0,4,8])near(Math.hypot(...matrix.slice(offset,offset+3)),1.3);
  assert.deepEqual(matrix.slice(12),[0,0,0,1]);
});

// Project actual finite segments on the cube independently of the angle solver.
// This includes the face transforms, a displaced perspective origin, and zoom.
function projectSurface(face, pose, zoom, view, x, y) {
  const half = view.halfSize;
  const local = cubeVertex(face.key, x + half, y + half, 2 * half).map(v => v - half);
  const [px,py,pz] = rotateVector(pose, local).map(v => zoom * v);
  const scale = view.perspective / (view.perspective - pz);
  return [view.eyeX + (px - view.eyeX) * scale, view.eyeY + (py - view.eyeY) * scale];
}

test('a mark on every visible face reads top to bottom after rolls, tumbles and zooms', () => {
  const poses = faces.map(face => fromEuler(...face.view));
  let pose = fromEuler(-25,-34);
  for (let i = 0; i < 120; i++) {
    pose = rotateOnScreen(pose, 18*Math.cos(i/11), 25*Math.sin(i/17));
    poses.push(pose);
  }
  const checked = new Set();
  for (const face of faces) for (const q of poses) for (const zoom of [.65,1.4]) {
    const view = {...frame, eyeX:47};
    const point = (x,y) => projectSurface(face,q,zoom,view,x,y);
    const center = point(0,0), right = point(10,0), down = point(0,10);
    const signedArea = (right[0]-center[0])*(down[1]-center[1]) - (down[0]-center[0])*(right[1]-center[1]);
    if (signedArea <= 1e-6) continue;
    const angleAt = surfaceReadingAngles(face,q,zoom,view);
    // Include ordinary cell centers and the outside line rail.
    for (const [x,y] of [[0,0],[-125,108],[128,-121],[55,-170]]) {
      const angle = angleAt(x,y) * Math.PI / 180;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      const top = point(x+6*sin, y-6*cos);
      const bottom = point(x-6*sin, y+6*cos);
      near(top[0],bottom[0],1e-7);
      assert.ok(top[1] < bottom[1], 'upright');
      assert.ok(point(x+6*cos,y+6*sin)[0] > point(x-6*cos,y-6*sin)[0], 'unmirrored');
    }
    checked.add(face.key);
  }
  assert.equal(checked.size,6);
});

test('sideways tilt foreshortens ink by the same factor as the cell surface', () => {
  const face = faces.find(face => face.key === 'front');
  for (const yaw of [0,35,60,74]) {
    const pose = fromEuler(0,yaw);
    const angle = surfaceReadingAngles(face,pose,1,frame)(0,0);
    near(angle,0);
    const left = projectSurface(face,pose,1,frame,-5,0);
    const right = projectSurface(face,pose,1,frame,5,0);
    const top = projectSurface(face,pose,1,frame,0,-5);
    const bottom = projectSurface(face,pose,1,frame,0,5);
    const apparentAspect = (right[0]-left[0]) / (bottom[1]-top[1]);
    if (yaw === 0) near(apparentAspect,1);
    if (yaw === 60) assert.ok(apparentAspect > .38 && apparentAspect < .43);
    if (yaw === 74) assert.ok(apparentAspect < .18);
  }
});

test('focused faces and exact edge-on views yield finite in-plane turns', () => {
  for (const face of faces) {
    const aligned = fromEuler(...face.view);
    near(surfaceReadingAngles(face,aligned,1,frame)(-105,42),0,1e-8);
    for (const other of faces) {
      const angle = surfaceReadingAngles(other,aligned,1,frame)(-105,42);
      assert.ok(Number.isFinite(angle));
    }
  }
});

test('numbers, line clues, flags, mines and incorrect marks use the same ink inside their buttons', () => {
  const cell = {revealed:false, flagged:false, count:3};
  const cases = [
    [tileMark({...cell,revealed:true},{}), '3'],
    [tileMark({...cell,revealed:true,count:0},{showZero:true}), '0'],
    [tileMark({...cell,revealed:true},{special:'together'}), '{3}'],
    [tileMark({...cell,revealed:true},{special:'apart'}), '-3-'],
    [tileMark({...cell,flagged:true},{}), '#i-flag'],
    [tileMark(cell,{showMine:true}), '#i-mine'],
    [tileMark({...cell,flagged:true},{incorrect:true}), '#i-close'],
    [surfaceMark(0), '0'],
  ];
  for (const [markup, content] of cases) {
    assert.match(markup,/^<span class="surface-mark" aria-hidden="true">.+<\/span>$/);
    assert.ok(markup.includes(content));
  }
  assert.equal(tileMark(cell,{}),'');
  assert.equal(tileMark({...cell,revealed:true,count:0},{}),'');
});

test('face transitions follow the shortest arc and keep a stable cube at every frame',()=>{
  const from=fromEuler(0,170),to=fromEuler(0,-170);
  nearVector(rotateVector(interpolate(from,to,.5),[0,0,1]),[0,0,-1]);
  for(let i=0;i<=100;i++){
    const q=interpolate(from,fromEuler(-90,0),i/100);
    near(Math.hypot(...q),1);near(Math.hypot(...rotateVector(q,[1,0,0])),1);
  }
  nearVector(rotateVector(interpolate(from,from.map(v=>-v),.5),[1,2,3]),rotateVector(from,[1,2,3]));
});
