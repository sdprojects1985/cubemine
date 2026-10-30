import test from 'node:test';
import assert from 'node:assert/strict';
import {fromEuler,rotateOnScreen,rotateVector,interpolate,cssTransform,facePoint,projectClue} from '../dist/camera.mjs';
import {createSurface} from '../dist/shapes.mjs';

const near=(actual,expected,epsilon=1e-9)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} != ${expected}`);
const nearVector=(actual,expected)=>actual.forEach((v,i)=>near(v,expected[i]));
const inverse=q=>[-q[0],-q[1],-q[2],q[3]];
const faces=createSurface(4).faces;
const frame={centerX:350,centerY:220,originX:350,originY:200,perspective:1250};

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

test('each face focus projects its clues upright at the corresponding cell centers',()=>{
  for(const face of faces){
    const q=fromEuler(...face.view),{point,normal}=facePoint(face,32,-19,150);
    const p=projectClue(point,normal,q,1,frame),scale=1250/1100;
    near(p.x,350+32*scale);near(p.y,200+(220-19-200)*scale);near(p.scale,scale);
    const x=projectClue(facePoint(face,42,-19,150).point,normal,q,1,frame);
    const y=projectClue(facePoint(face,32,-9,150).point,normal,q,1,frame);
    assert.ok(x.x>p.x&&y.y>p.y);near(x.y,p.y);near(y.x,p.x);
  }
});

test('clue projection hides back faces, including grazing faces hidden by perspective',()=>{
  for(const face of faces){
    const q=fromEuler(...face.view);
    for(const other of faces){
      const {point,normal}=facePoint(other,0,0,150),p=projectClue(point,normal,q,1,frame);
      assert.equal(Boolean(p),face.key===other.key,`${face.key}: ${other.key}`);
    }
  }
  // A side face can have a positive screen-Z normal yet still point away from the eye.
  assert.equal(projectClue([150,0,0],[1,0,0],fromEuler(0,-3),1,frame),null);
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
