function a(o,s){const n=new Map(o.map(e=>[e.id,e]));for(const e of s)(!n.has(e.id)||e.version>=n.get(e.id).version)&&n.set(e.id,e);return[...n.values()]}export{a};
