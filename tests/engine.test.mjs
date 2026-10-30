import test from 'node:test';
import assert from 'node:assert/strict';
import {CubeGame, makeTopology, FACES, LEVELS} from '../dist/engine.mjs';

function seeded(seed) {
  return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}

test('every physical edge and corner connects symmetrically, with no opposite-face neighbors',()=>{
  const opposite={front:'back',back:'front',left:'right',right:'left',top:'bottom',bottom:'top'};
  for(const n of [4,6,8]) {
    const cells=makeTopology(n);
    assert.equal(cells.length,6*n*n);
    for(const c of cells) {
      const corner=(c.row===0||c.row===n-1)&&(c.col===0||c.col===n-1);
      assert.equal(c.neighbors.length,corner?7:8,`${n}: ${c.face}/${c.row}/${c.col}`);
      assert.equal(new Set(c.neighbors).size,c.neighbors.length);
      assert.ok(!c.neighbors.includes(c.id));
      for(const id of c.neighbors) {
        assert.ok(cells[id].neighbors.includes(c.id));
        assert.notEqual(cells[id].face,opposite[c.face]);
      }
    }
    const connected=new Set([0]),queue=[0];
    while(queue.length)for(const id of cells[queue.pop()].neighbors)if(!connected.has(id)){connected.add(id);queue.push(id);}
    assert.equal(connected.size,cells.length);
    // Front's top-left corner wraps onto left and top, never a distant face.
    assert.deepEqual([...new Set(cells[0].neighbors.map(i=>cells[i].face))].sort(),['front','left','top']);
  }
});

test('each first move across every face and difficulty is safe, with exact mine totals and clue counts',()=>{
  for(const [level,{size,mines}] of Object.entries(LEVELS))for(const face of FACES)for(const at of [0,Math.floor(size*size/2),size*size-1]) {
    const game=new CubeGame(level,seeded(at+3));
    const id=FACES.indexOf(face)*size*size+at;
    game.reveal(id);
    assert.equal(game.status,'playing');
    assert.equal(game.cells[id].count,0);
    assert.ok(game.revealedCount>1);
    assert.equal(game.cells.filter(c=>c.mine).length,mines);
    for(const c of game.cells) {
      assert.equal(c.count,c.neighbors.filter(n=>game.cells[n].mine).length);
      if(c.revealed)assert.equal(c.mine,false);
    }
    for(const neighbor of game.cells[id].neighbors)assert.equal(game.cells[neighbor].mine,false);
  }
});

test('flags protect covered tiles, can be toggled, and do not start the timer',()=>{
  const g=new CubeGame('easy',seeded(10));
  assert.equal(g.flag(0),true);assert.equal(g.flagCount,1);
  assert.equal(g.reveal(0),false);assert.equal(g.status,'ready');assert.equal(g.startedAt,null);
  g.flag(0);assert.equal(g.flagCount,0);g.reveal(0);
  assert.equal(g.flag(0),false);
  const hidden=g.cells.filter(c=>!c.revealed).slice(0,g.mineCount+1);
  for(const c of hidden.slice(0,g.mineCount))assert.equal(g.flag(c.id),true);
  assert.equal(g.flag(hidden[g.mineCount].id),false);
});

test('flood opening crosses cube edges',()=>{
  const g=new CubeGame('easy',seeded(99));g.reveal(0);
  assert.ok(new Set(g.cells.filter(c=>c.revealed).map(c=>c.face)).size>=3);
});

test('revealing a mine loses, freezes time, and prevents further actions',()=>{
  const g=new CubeGame('classic',seeded(18));g.reveal(0);
  const mine=g.cells.find(c=>c.mine);g.reveal(mine.id);
  assert.equal(g.status,'lost');assert.equal(g.exploded,mine.id);assert.ok(g.finishedAt);
  assert.equal(g.reveal(1),false);assert.equal(g.flag(3),false);
});

test('clearing every safe tile wins and flags every mine',()=>{
  const g=new CubeGame('expert',seeded(22));g.reveal(0);
  for(const c of g.cells)if(!c.mine&&!c.revealed)g.reveal(c.id);
  assert.equal(g.status,'won');assert.equal(g.revealedCount,g.safeCount);
  assert.equal(g.flagCount,g.mineCount);assert.ok(g.cells.filter(c=>c.mine).every(c=>c.flagged));
  assert.ok(g.finishedAt);assert.equal(g.flag(0),false);
});

test('chording reveals matching unflagged neighbors, including across a face edge',()=>{
  const g=new CubeGame('classic',seeded(100));g.reveal(0);
  const c=g.cells.find(c=>c.revealed&&c.count&&c.neighbors.some(i=>g.cells[i].face!==c.face&&!g.cells[i].revealed&&!g.cells[i].mine));
  assert.ok(c);
  for(const id of c.neighbors)if(g.cells[id].mine)g.flag(id);
  const before=g.revealedCount;assert.equal(g.chord(c.id),true);assert.ok(g.revealedCount>before);
  assert.notEqual(g.status,'lost');assert.ok(c.neighbors.every(i=>g.cells[i].revealed||g.cells[i].flagged));
});

test('incorrect flags do not make a chord safe',()=>{
  const g=new CubeGame('classic',seeded(101));g.reveal(0);
  const c=g.cells.find(c=>c.revealed&&c.count&&c.neighbors.filter(i=>!g.cells[i].mine&&!g.cells[i].revealed).length>=c.count);
  assert.ok(c);
  for(const id of c.neighbors.filter(i=>!g.cells[i].mine&&!g.cells[i].revealed).slice(0,c.count))g.flag(id);
  assert.equal(g.chord(c.id),true);assert.equal(g.status,'lost');
});
