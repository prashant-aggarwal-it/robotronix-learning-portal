export function MiniBars({items}:{items:Array<{label:string;value:number;max?:number}>}){
  const max=Math.max(1,...items.map(x=>x.max??x.value));
  return <div className="miniBars">{items.map(i=><div className="miniBarRow" key={i.label}><span>{i.label}</span><div className="miniBarTrack"><i style={{width:`${Math.min(100,(i.value/(i.max??max))*100)}%`}}/></div><b>{i.value}</b></div>)}</div>
}
