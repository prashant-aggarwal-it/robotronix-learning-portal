"use client";
import {useEffect} from "react";

export function Pagination({page,total,pageSize,onPage,onPageSizeChange}: {
 page:number;total:number;pageSize:number;onPage:(p:number)=>void;onPageSizeChange?:(size:number)=>void;
}){
 const pages=Math.max(1,Math.ceil(total/pageSize));
 const current=Math.min(Math.max(1,page),pages);
 const start=total===0?0:(current-1)*pageSize+1;
 const end=Math.min(total,current*pageSize);
 const first=Math.max(1,Math.min(current-2,pages-4));
 const last=Math.min(pages,first+4);
 // Changing filters while on a later page must never strand the user on an empty page.
 useEffect(()=>{if(page>pages)onPage(pages)},[page,pages,onPage]);
 return <div className="paginationBar gridPagination">
  <div className="paginationSummary"><span>Showing {start}–{end} of {total} records</span>{onPageSizeChange&&<label>Rows per page <select className="input pageSizeSelect" aria-label="Rows per page" value={pageSize} onChange={e=>{onPageSizeChange(Number(e.target.value));onPage(1)}}>{[10,25,50,100].map(n=><option value={n} key={n}>{n}</option>)}</select></label>}</div>
  <nav className="row" aria-label="Table pages"><button type="button" className="pageButton" disabled={current<=1} onClick={()=>onPage(current-1)}>Previous</button>{Array.from({length:last-first+1},(_,i)=>first+i).map(n=><button key={n} type="button" className={`pageButton ${n===current?"active":""}`} aria-current={n===current?"page":undefined} onClick={()=>onPage(n)}>{n}</button>)}<button type="button" className="pageButton" disabled={current>=pages} onClick={()=>onPage(current+1)}>Next</button></nav>
 </div>;
}
