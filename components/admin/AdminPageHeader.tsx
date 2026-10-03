import type { ReactNode } from "react";

export function AdminPageHeader({ title, description, eyebrow, actions }: { title:string; description:string; eyebrow?:string; actions?:ReactNode }) {
  return <div className="adminPageHeader">
    <div>
      {/* Navigation already supplies context; omit redundant uppercase page eyebrow. */}
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {actions && <div className="adminPageActions">{actions}</div>}
  </div>;
}
