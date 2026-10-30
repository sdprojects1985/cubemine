// A run follows the physical neighbor ring; the first and last positions touch.
export function isConsecutive(values,cyclic=true){
  const count=values.filter(Boolean).length;
  if(!count)return false;
  if(count===values.length)return true;
  let starts=0;
  for(let i=0;i<values.length;i++)if(values[i]&&!(i?values[i-1]:cyclic?values.at(-1):false))starts++;
  return starts===1;
}
export const clueText=(count,kind)=>kind==='together'?`{${count}}`:kind==='apart'?`-${count}-`:String(count);
const cache=new Map();
export function arrangements(length,count,kind='plain'){
  const key=`${length}:${count}:${kind}`;if(cache.has(key))return cache.get(key);
  const result=[];
  for(let mask=0;mask<2**length;mask++){
    const values=Array.from({length},(_,i)=>Boolean(mask&(1<<i)));
    if(values.filter(Boolean).length!==count)continue;
    const run=isConsecutive(values);
    if(kind==='together'&&!run||kind==='apart'&&run)continue;
    result.push(mask);
  }
  cache.set(key,result);return result;
}
