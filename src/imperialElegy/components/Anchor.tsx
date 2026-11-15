import React from "react";

/**
 * The printed anchor mark.
 *
 * The board does not draw a line for every port-to-box route; it prints an
 * anchor beside each port and lets the naval-box plates carry the rest.  Drawing
 * all 120 sea routes at once turned the sea into a red web, so the map follows
 * the print: an anchor marks a port, and the routes themselves appear when a
 * space or a box is selected.
 */
export const Anchor = ({size, color = "#2f6b7c"}: {size: number; color?: string}) => (
  <g fill="none" stroke={color} strokeWidth={size * 0.16} strokeLinecap="round">
    <circle cx={0} cy={-size * 0.55} r={size * 0.2}/>
    <line x1={0} y1={-size * 0.35} x2={0} y2={size * 0.55}/>
    <line x1={-size * 0.38} y1={-size * 0.1} x2={size * 0.38} y2={-size * 0.1}/>
    <path d={`M${-size * 0.55},${size * 0.15} A${size * 0.55},${size * 0.55} 0 0 0 ${size * 0.55},${size * 0.15}`}/>
  </g>
);

export default Anchor;
