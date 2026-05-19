// ─── Shared helpers ───────────────────────────────────────────────────────────

function svg(width, height, content, extraAttrs = "") {
  return `<svg viewBox="0 0 ${width} ${height}" role="img" ${extraAttrs}>${content}</svg>`;
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

// ─── Chart 1: XP Over Time (smooth area line) ────────────────────────────────

export function renderXpOverTime(container, transactions) {
  if (!transactions.length) {
    container.innerHTML = "<p class='no-data'>No XP data to display.</p>";
    return;
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  let cum = 0;
  const pts = sorted.map((t) => {
    cum += t.amount;
    return { date: new Date(t.createdAt), value: cum };
  });

  const W = 680, H = 240, PL = 58, PR = 20, PT = 20, PB = 36;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const maxV = Math.max(...pts.map((p) => p.value), 1);

  const px = (i) => PL + (i / Math.max(pts.length - 1, 1)) * innerW;
  const py = (v) => PT + innerH - (v / maxV) * innerH;

  // Build smooth path using cubic bezier
  const pathD = pts.map((p, i) => {
    const x = px(i), y = py(p.value);
    if (i === 0) return `M ${x} ${y}`;
    const prevX = px(i - 1), prevY = py(pts[i - 1].value);
    const cpX = (prevX + x) / 2;
    return `C ${cpX} ${prevY} ${cpX} ${y} ${x} ${y}`;
  }).join(" ");

  const areaD = `${pathD} L ${px(pts.length - 1)} ${PT + innerH} L ${PL} ${PT + innerH} Z`;

  // Y axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = Math.round(f * maxV);
    const y = py(v);
    return `
      <line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#2a3a3a" stroke-dasharray="3,3"/>
      <text x="${PL - 6}" y="${y + 4}" fill="#7ec8b0" font-size="9" text-anchor="end">${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}</text>
    `;
  }).join("");

  // X axis labels — pick up to 6 evenly spaced points, deduplicated by label
  const maxLabels = 6;
  const step = Math.max(1, Math.floor((pts.length - 1) / (maxLabels - 1)));
  const labelIndices = [];
  for (let i = 0; i < pts.length; i += step) labelIndices.push(i);
  if (labelIndices[labelIndices.length - 1] !== pts.length - 1) labelIndices.push(pts.length - 1);

  const xLabels = "";

  // Dots for last and first
  const dot = (i) => {
    const x = px(i), y = py(pts[i].value);
    return `<circle cx="${x}" cy="${y}" r="4" fill="#f0a500" stroke="#1a2a2a" stroke-width="2">
      <title>${fmt(pts[i].value)} XP — ${pts[i].date.toLocaleDateString()}</title>
    </circle>`;
  };

  const content = `
    <defs>
      <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f0a500" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#f0a500" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    ${yTicks}
    <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + innerH}" stroke="#2a3a3a"/>
    <line x1="${PL}" y1="${PT + innerH}" x2="${W - PR}" y2="${PT + innerH}" stroke="#2a3a3a"/>
    <path d="${areaD}" fill="url(#xpGrad)"/>
    <path d="${pathD}" fill="none" stroke="#f0a500" stroke-width="2" stroke-linejoin="round"/>
    ${dot(0)}
    ${dot(pts.length - 1)}
    ${xLabels}
    <text x="${W / 2}" y="${H - 22}" fill="#5c8a7a" font-size="9" text-anchor="middle">Time →</text>
  `;

  container.innerHTML = svg(W, H, content);
}

// ─── Chart 2: Audit Ratio (horizontal gauge bars) ────────────────────────────

export function renderAuditRatio(container, given, received) {
  const total = given + received;
  if (!total) {
    container.innerHTML = "<p class='no-data'>No audit data to display.</p>";
    return;
  }

  const W = 460, H = 160;
  const barY1 = 52, barY2 = 102;
  const barH = 26;
  const labelX = 10;
  const barX = 110;
  const barMaxW = W - barX - 90;
  const ratio = received ? (given / received).toFixed(2) : "∞";
  const givenW = Math.max(4, (given / Math.max(given, received)) * barMaxW);
  const recvW = Math.max(4, (received / Math.max(given, received)) * barMaxW);

  const bar = (x, y, w, h, color, label, value, sublabel) => `
    <text x="${labelX}" y="${y + h / 2 + 5}" fill="#aabfbb" font-size="11" font-weight="600">${label}</text>
    <rect x="${x}" y="${y}" width="${barMaxW}" height="${h}" rx="6" fill="#1a2a2a"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${color}">
      <title>${sublabel}: ${fmt(value)}</title>
    </rect>
    <text x="${x + w + 8}" y="${y + h / 2 + 5}" fill="#ecf0e8" font-size="11">${fmt(value)}</text>
  `;

  const content = `
    <text x="${W / 2}" y="22" fill="#ecf0e8" font-size="14" font-weight="700" text-anchor="middle">Audit Ratio</text>
    ${bar(barX, barY1, givenW, barH, "#f0a500", "Given ↑", given, "Audits given")}
    ${bar(barX, barY2, recvW, barH, "#3ecba5", "Received ↓", received, "Audits received")}
    <text x="${W / 2}" y="148" fill="#7ec8b0" font-size="11" text-anchor="middle">Ratio: ${ratio} — ${given > received ? "✅ You give more than you take" : given === received ? "⚖️ Balanced" : "⚠️ You receive more than you give"}</text>
  `;

  container.innerHTML = svg(W, H, content);
}

// ─── Chart 3: XP by Project (horizontal bars, sorted) ────────────────────────

export function renderXpByProject(container, projectRows) {
  if (!projectRows.length) {
    container.innerHTML = "<p class='no-data'>No project XP data found.</p>";
    return;
  }

  // Take top 15 by xp
  const rows = [...projectRows].sort((a, b) => b.xp - a.xp).slice(0, 15);
  const maxXp = Math.max(...rows.map((r) => r.xp), 1);

  const W = 680;
  const barH = 22;
  const gap = 10;
  const labelW = 170;
  const barAreaW = W - labelW - 70;
  const rowH = barH + gap;
  const PT = 10;
  const H = PT + rows.length * rowH + 10;

  const bars = rows.map((row, i) => {
    const y = PT + i * rowH;
    const bw = Math.max(4, (row.xp / maxXp) * barAreaW);
    const label = row.project.length > 22 ? row.project.slice(0, 21) + "…" : row.project;
    const hue = Math.round((i / rows.length) * 60 + 160); // teal → amber range
    const color = `hsl(${hue}, 65%, 55%)`;
    return `
      <text x="${labelW - 8}" y="${y + barH / 2 + 4}" fill="#aabfbb" font-size="10" text-anchor="end">
        <title>${row.project}</title>${label}
      </text>
      <rect x="${labelW}" y="${y}" width="${bw}" height="${barH}" rx="5" fill="${color}">
        <title>${row.project}: ${fmt(row.xp)} XP</title>
      </rect>
      <text x="${labelW + bw + 6}" y="${y + barH / 2 + 4}" fill="#ecf0e8" font-size="10">${fmt(row.xp)}</text>
    `;
  }).join("");

  container.innerHTML = svg(W, H, bars);
}
