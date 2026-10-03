export function StatusDonut({segments,centerLabel,centerValue}:{segments:Array<{label:string;value:number;color:string}>;centerLabel:string;centerValue:number}){
  const total=Math.max(1,segments.reduce((s,x)=>s+x.value,0));let cursor=0;
  const parts=segments.map(s=>{const start=cursor;const end=cursor+(s.value/total)*360;cursor=end;return `${s.color} ${start}deg ${end}deg`;}).join(",");
  return <div className="donutWidget"><div className="donut" style={{background:`conic-gradient(${parts})`}}><div className="donutCenter"><b>{centerValue}</b><span>{centerLabel}</span></div></div><div className="donutLegend">{segments.map(s=><div key={s.label}><span className="legendDot" style={{background:s.color}}/><span>{s.label}</span><b>{s.value}</b></div>)}</div></div>
}
