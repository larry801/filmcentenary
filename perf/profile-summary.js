#!/usr/bin/env node
/* Summarise a V8 .cpuprofile: self time per function, grouped by file. */
const fs = require('fs');

const file = process.argv[2];
const filter = process.argv[3];
const profile = JSON.parse(fs.readFileSync(file, 'utf8'));

const byId = new Map();
profile.nodes.forEach(n => byId.set(n.id, n));

const selfTime = new Map();
const total = profile.timeDeltas.reduce((a, b) => a + b, 0);
profile.samples.forEach((id, i) => {
    const dt = profile.timeDeltas[i] ?? 0;
    const node = byId.get(id);
    if (!node) return;
    const cf = node.callFrame;
    const url = (cf.url || '').replace(/^.*\/filmcentenary\//, '');
    const key = `${cf.functionName || '(anonymous)'}\t${url}:${cf.lineNumber + 1}`;
    selfTime.set(key, (selfTime.get(key) ?? 0) + dt);
});

const rows = [...selfTime.entries()]
    .filter(([k]) => !filter || k.includes(filter))
    .sort((a, b) => b[1] - a[1])
    .slice(0, Number(process.argv[4] ?? 35));

const ms = us => (us / 1000).toFixed(0);
console.log(`total sampled: ${ms(total)}ms`);
rows.forEach(([k, v]) => console.log(`${ms(v).padStart(7)}ms  ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`));
