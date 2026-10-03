export function PageIntro({ eyebrow, title, text, children }: { eyebrow:string; title:string; text:string; children?:React.ReactNode }) {
  return <section className="pageIntro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div>{children ? <div className="pageIntroActions">{children}</div> : null}</section>;
}
