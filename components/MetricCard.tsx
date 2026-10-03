export function MetricCard({ label, value, detail }: { label:string; value:string|number; detail?:string }) {
  return <div className="card"><div className="kpiLabel">{label}</div><div className="bigNumber">{value}</div>{detail && <div className="muted" style={{fontSize:13}}>{detail}</div>}</div>;
}
