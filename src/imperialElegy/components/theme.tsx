import React from "react";
import "./imperial-elegy.css";
import {ieT} from "./i18n";

export const IESurface = ({children, className = ""}: {children: React.ReactNode; className?: string}) => (
  <div className={`ie-surface ${className}`}>{children}</div>
);

export const IEPanel = ({title, children, actions, className = ""}: {title?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode; className?: string}) => (
  <section className={`ie-panel ${className}`}>
    {(title || actions) && <header className="ie-panel-head"><h3>{title}</h3>{actions}</header>}
    <div className="ie-panel-body">{children}</div>
  </section>
);

export const IEBadge = ({children, tone = "default"}: {children: React.ReactNode; tone?: string}) => (
  <span className={`ie-badge ie-badge-${tone}`}>{children}</span>
);

export const IEChip = ({children}: {children: React.ReactNode}) => <span className="ie-chip">{children}</span>;
