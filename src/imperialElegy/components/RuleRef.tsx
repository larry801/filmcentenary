import React from "react";

/**
 * A printed rule number.  It is a typographic superscript, not body text, so it
 * may sit below 12 px; the title carries the full reference for hover/AT.
 */
export const RuleRef = ({n, title}: {n: string; title?: string}) => (
  <sup className="ie-rule-ref" title={title ?? n}>{n}</sup>
);
