export function ErrorMessage({error}:{error:string}){return error?<div className="cx-alert" role="alert">{error}</div>:null;}
export function EmptyState({title,description}:{title:string;description:string}){return <div className="cx-empty"><div className="cx-empty-icon">◎</div><strong>{title}</strong><p>{description}</p></div>;}

