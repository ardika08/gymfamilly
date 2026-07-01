import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) => (
  <div className="page-header">
    <div>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {actions ? <div className="page-actions">{actions}</div> : null}
  </div>
);
