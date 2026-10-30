export const FACES = ['front', 'right', 'back', 'left', 'top', 'bottom'];
export const LEVELS = {
  easy: { label: 'Easy', size: 4, mines: 12 },
  classic: { label: 'Classic', size: 6, mines: 36 },
  expert: { label: 'Expert', size: 8, mines: 76 }
};

// Map each face's grid vertices to the same integer coordinate system.
// Tiles are neighbors if they share a physical edge or vertex on the cube.
export function vertex(face, x, y, n) {
  switch (face) {
    case 'front': return [x, y, n];
    case 'right': return [n, y, n - x];
    case 'back': return [n - x, y, 0];
    case 'left': return [0, y, x];
    case 'top': return [x, 0, y];
    case 'bottom': return [x, n, n - y];
    default: throw new Error('Unknown cube face');
  }
}

export function makeTopology(n) {
  const cells = [];
  const vertices = new Map();
  for (const face of FACES) {
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const cell = { id: cells.length, face, row, col, neighbors: new Set(), mine: false, count: 0, revealed: false, flagged: false };
        cells.push(cell);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const key = vertex(face, col + dx, row + dy, n).join(',');
          if (!vertices.has(key)) vertices.set(key, []);
          vertices.get(key).push(cell.id);
        }
      }
    }
  }
  for (const group of vertices.values()) {
    for (const id of group) for (const other of group) if (id !== other) cells[id].neighbors.add(other);
  }
  for (const cell of cells) cell.neighbors = [...cell.neighbors];
  return cells;
}

export class CubeGame {
  constructor(level = 'classic', random = Math.random, fixed = null) {
    if (!LEVELS[level]) throw new Error('Unknown difficulty');
    const size = fixed?.size ?? LEVELS[level].size;
    this.surface = createSurface(size);
    const mines = fixed?.mines ?? LEVELS[level].mines;
    this.level = level;
    this.kind = 'random';
    this.faces = this.surface.faces;
    this.size = size;
    this.mineCount = mines;
    this.cells = this.surface.cells;
    this.random = random;
    this.status = 'ready';
    this.flagCount = 0;
    this.revealedCount = 0;
    this.startedAt = null;
    this.finishedAt = null;
    this.exploded = null;
  }
  get safeCount() { return this.cells.length - this.mineCount; }
  get elapsed() { return this.startedAt === null ? 0 : Math.floor(((this.finishedAt ?? Date.now()) - this.startedAt) / 1000); }
  plant(firstId) {
    const excluded = new Set([firstId, ...this.cells[firstId].neighbors]);
    const options = this.cells.filter(c => !excluded.has(c.id)).map(c => c.id);
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    for (const id of options.slice(0, this.mineCount)) this.cells[id].mine = true;
    for (const c of this.cells) c.count = c.neighbors.filter(id => this.cells[id].mine).length;
    this.status = 'playing';
    this.startedAt = Date.now();
  }
  flag(id) {
    const cell = this.cells[id];
    if (!cell || cell.revealed || this.status === 'won' || this.status === 'lost') return false;
    if (!cell.flagged && this.flagCount >= this.mineCount) return false;
    cell.flagged = !cell.flagged;
    this.flagCount += cell.flagged ? 1 : -1;
    return true;
  }
  reveal(id) {
    const cell = this.cells[id];
    if (!cell || cell.flagged || this.status === 'won' || this.status === 'lost') return false;
    if (cell.revealed) return this.chord(id);
    if (this.status === 'ready') this.plant(id);
    this.open([id]);
    return true;
  }
  chord(id) {
    const cell = this.cells[id];
    if (this.status !== 'playing' || !cell.revealed || !cell.count) return false;
    if (cell.neighbors.filter(i => this.cells[i].flagged).length !== cell.count) return false;
    this.open(cell.neighbors.filter(i => !this.cells[i].flagged && !this.cells[i].revealed));
    return true;
  }
  open(ids) {
    const pending = [...ids];
    while (pending.length && this.status === 'playing') {
      const cell = this.cells[pending.pop()];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.mine) {
        this.status = 'lost';
        this.exploded = cell.id;
        this.finishedAt = Date.now();
        return;
      }
      this.revealedCount++;
      if (cell.count === 0) pending.push(...cell.neighbors);
    }
    if (this.revealedCount === this.safeCount && this.status === 'playing') {
      this.status = 'won';
      this.finishedAt = Date.now();
      for (const cell of this.cells) if (cell.mine) cell.flagged = true;
      this.flagCount = this.mineCount;
    }
  }
}
import {createSurface,lineCells} from './shapes.mjs';


export function cellName(game,id){
  const c=game.cells[id],face=game.faces.find(f=>f.key===c.face);
  return `${face.label}, row ${c.row+1}, column ${c.col+1}`;
}

export class PuzzleGame extends CubeGame {
  constructor(spec,saved=null){
    super('easy',()=>{throw new Error('Fixed puzzles never plant random mines');},{size:spec.size,mines:spec.mines.length});
    this.kind='puzzles';this.spec=spec;this.mistakes=0;this.hints=0;this.error=null;
    const mines=new Set(spec.mines);
    if(mines.size!==spec.mines.length||[...mines].some(id=>!this.cells[id]))throw new Error('Invalid puzzle mines');
    for(const c of this.cells){c.mine=mines.has(c.id);c.count=c.neighbors.filter(id=>mines.has(id)).length;}
    for(const id of spec.givens){if(!this.cells[id]||this.cells[id].mine)throw new Error('Invalid starting clue');this.cells[id].revealed=true;}
    if(saved&&Array.isArray(saved.revealed))for(const id of saved.revealed)if(Number.isInteger(id)&&this.cells[id]&&!this.cells[id].mine)this.cells[id].revealed=true;
    if(saved&&Array.isArray(saved.flagged))for(const id of saved.flagged)if(Number.isInteger(id)&&this.cells[id]?.mine)this.cells[id].flagged=true;
    this.revealedCount=this.cells.filter(c=>c.revealed).length;this.flagCount=this.cells.filter(c=>c.flagged).length;
    this.faceTotals={}; // Puzzle deductions use board clues, never implicit face totals.
    this.clueKinds={...spec.clueKinds};
    this.lines=(spec.lines??[]).map(line=>({...line,id:`${line.face}-${line.axis}-${line.index}`,ids:lineCells(this.surface,line.face,line.axis,line.index)}));
    for(const line of this.lines)if(line.count!==line.ids.filter(id=>mines.has(id)).length)throw new Error('Invalid line total');
    this.status='playing';
    if(saved){
      this.mistakes=Number.isInteger(saved.mistakes)&&saved.mistakes>0?saved.mistakes:0;
      this.hints=Number.isInteger(saved.hints)&&saved.hints>0?saved.hints:0;
      const seconds=Number.isFinite(saved.seconds)?Math.max(0,Math.min(saved.seconds,31536000)):0;
      if(seconds||this.revealedCount>spec.givens.length||this.flagCount)this.startedAt=Date.now()-seconds*1000;
    }
    this.open([]);
  }
  startClock(){if(this.startedAt===null)this.startedAt=Date.now();}
  reject(id){this.startClock();this.error=id;this.mistakes++;return true;}
  reveal(id){
    this.error=null;const c=this.cells[id];
    if(!c||c.flagged||this.status!=='playing')return false;
    if(c.mine)return this.reject(id);
    this.startClock();
    if(c.revealed&&c.count===0){
      const pending=c.neighbors.filter(n=>!this.cells[n].revealed&&!this.cells[n].flagged);
      if(!pending.length)return false;this.open(pending);return true;
    }
    return super.reveal(id);
  }
  flag(id){
    this.error=null;const c=this.cells[id];
    if(!c||c.revealed||this.status!=='playing')return false;
    if(!c.mine)return this.reject(id);
    this.startClock();return super.flag(id);
  }
  serialize(){return {revealed:this.cells.filter(c=>c.revealed).map(c=>c.id),flagged:this.cells.filter(c=>c.flagged).map(c=>c.id),seconds:this.elapsed,mistakes:this.mistakes,hints:this.hints};}
}
