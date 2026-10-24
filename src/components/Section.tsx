import type { ReactNode } from 'react';

export interface SectionProps {
  title: string;
  sub?: string | undefined;
  children: ReactNode;
}

export function Section({ title, sub, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {sub ? <p className="section-sub">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}
