(async function () {
  const res = await fetch('data.json', { cache: 'no-store' });
  const D = await res.json();
  const L = D.last, LIM = D.limits;
  const eur = (v, d = 0) => v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d = 1, sign = false) => v == null ? '—' : ((sign && v > 0 ? '+' : '') + (v * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %').replace('-', '−');
  const signed = (v, d = 0) => v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + eur(Math.abs(v), d);
  const cls = v => v == null ? 'muted' : v > 0 ? 'up' : v < 0 ? 'down' : 'muted';
  const fdate = (s, opt = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', opt);
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // KPIs
  $('k-total').textContent = eur(L.total, 2);
  $('k-date').textContent = 'Relevé du ' + fdate(L.date);
  $('k-day').textContent = signed(L.pnl_jour, 2);
  $('k-day-pct').innerHTML = `<span class="pill ${L.pnl_jour >= 0 ? 'up' : 'down'}">${pct(L.pnl_jour_pct, 2, true)}</span> vs la veille`;
  $('k-tot').textContent = signed(L.pnl_total, 2);
  $('k-tot-pct').innerHTML = `<span class="pill ${L.pnl_total >= 0 ? 'up' : 'down'}">${pct(L.pnl_total_pct, 2, true)}</span> depuis le ${fdate(D.point0, { day: 'numeric', month: 'short' })}`;

  // Line chart
  const labels = D.snapshots.map(s => fdate(s.date, { weekday: 'short', day: 'numeric', month: 'short' }));
  const vals = D.snapshots.map(s => s.total);
  const ctx = $('c-line').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, 'rgba(59,91,219,.25)'); grad.addColorStop(1, 'rgba(59,91,219,0)');
  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Valeur du portefeuille', data: vals, borderColor: '#3b5bdb', backgroundColor: grad, fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: '#3b5bdb', borderWidth: 2.5 },
      { label: 'Départ : 50 000 €', data: vals.map(() => D.capital), borderColor: '#94a3b8', borderDash: [6, 5], pointRadius: 0, borderWidth: 1.5, fill: false }
    ] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: c => c.dataset.label + ' : ' + eur(c.parsed.y, 2) } } },
      scales: { y: { ticks: { callback: v => eur(v) }, grid: { color: '#eef0f6' },
        suggestedMin: Math.min(...vals, D.capital) - 300, suggestedMax: Math.max(...vals, D.capital) + 300 },
        x: { grid: { display: false } } } }
  });

  // Donut
  const parts = [['Cœur', L.coeur, '#3b5bdb'], ['Tactique', L.tactique, '#f08c00'], ['Cash', L.cash, '#94a3b8']];
  new Chart($('c-donut'), {
    type: 'doughnut',
    data: { labels: parts.map(p => p[0]), datasets: [{ data: parts.map(p => p[1]), backgroundColor: parts.map(p => p[2]), borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false },
      tooltip: { callbacks: { label: c => c.label + ' : ' + eur(c.parsed, 0) + ' (' + pct(c.parsed / L.total) + ')' } } } }
  });
  $('donut-legend').innerHTML = parts.map(p => `<li><span class="sw" style="background:${p[2]}"></span>${p[0]} <b>${pct(p[1] / L.total)}</b><span class="amt">${eur(p[1])}</span></li>`).join('');

  // Gauges
  function gauge({ name, value, fmt, min, max, a, b, ticks, status, text, invert }) {
    const pos = v => Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
    const pa = pos(a), pb = pos(b);
    const bg = invert
      ? `linear-gradient(90deg,#fde2e0 0%,#fde2e0 ${pa}%,#ffe8b3 ${pa}%,#ffe8b3 ${pb}%,#d7f5e3 ${pb}%)`
      : null;
    return `<div class="gauge"><div class="top"><span class="name">${name}</span><span class="v">${fmt(value)}</span></div>
      <div class="bar" style="--a:${pa}%;--b:${pb}%;${bg ? 'background:' + bg : ''}"><span class="mk" style="left:${pos(value)}%"></span>
      ${ticks.map(t => `<span class="tick" style="left:${pos(t[0])}%">${t[1]}</span>`).join('')}</div>
      <span class="status ${status[0]}">${status[1]}</span><p>${text}</p></div>`;
  }
  const ia = L.ia_pct;
  const iaSt = ia >= LIM.ia_plafond ? ['bad', '● Plafond dépassé'] : ia >= LIM.ia_alerte ? ['warn', '● Vigilance'] : ['ok', '● OK'];
  const dd = L.drawdown;
  const ddSt = dd <= LIM.dd_hard ? ['bad', '● Coupure du risque'] : dd <= LIM.dd_gel ? ['bad', '● Gel des achats'] : dd <= LIM.dd_alerte ? ['warn', '● Revue'] : ['ok', '● OK'];
  const cp = L.cash_pct;
  const cpSt = cp < LIM.cash_min ? ['bad', '● Trop bas'] : ['ok', '● OK'];
  // drawdown gauge: from -30% (left) to 0% (right); colored red→orange→green
  $('gauges').innerHTML = [
    gauge({ name: 'Bloc IA <span class="nm">(alerte 42 % · plafond 45 %)</span>', value: ia, fmt: v => pct(v), min: .30, max: .50, a: LIM.ia_alerte, b: LIM.ia_plafond,
      ticks: [[.30, '30 %'], [LIM.ia_alerte, '42'], [LIM.ia_plafond, '45'], [.50, '50 %']], status: iaSt,
      text: ia >= LIM.ia_alerte && ia < LIM.ia_plafond ? 'Au-dessus de l\'alerte : on n\'achète plus rien lié à l\'IA, mais pas besoin de vendre.' : ia >= LIM.ia_plafond ? 'Au-dessus du plafond : il faut alléger.' : 'Sous le seuil d\'alerte.' }),
    gauge({ name: 'Baisse depuis le plus haut <span class="nm">(seuils −12 · −18 · −25 %)</span>', value: dd, fmt: v => pct(v, 1), min: -.30, max: 0, a: LIM.dd_gel, b: LIM.dd_alerte, invert: true,
      ticks: [[LIM.dd_hard, '−25'], [LIM.dd_gel, '−18'], [LIM.dd_alerte, '−12'], [0, '0 %']], status: ddSt,
      text: (dd === 0 ? 'Le portefeuille est à son plus haut.' : `Plus haut : ${eur(L.peak)}.`) + ` Pire baisse jusqu'ici : ${pct(D.max_drawdown, 1)}.` }),
    gauge({ name: 'Cash disponible <span class="nm">(minimum 2 %)</span>', value: cp, fmt: v => pct(v), min: 0, max: .20, a: 0, b: LIM.cash_min, invert: true,
      ticks: [[0, '0'], [LIM.cash_min, 'min 2 %'], [.10, '10 %'], [.20, '20 %']], status: cpSt,
      text: `${eur(L.cash)} en réserve pour saisir des occasions ou amortir une baisse.` })
  ].join('');

  // Positions table
  const order = ['Cœur', 'Tactique', 'Cash'];
  const bcls = { 'Cœur': 'b-core', 'Tactique': 'b-tac', 'Cash': 'b-cash' };
  let rows = '';
  for (const g of order) {
    const ps = D.positions.filter(p => p.poche === g).sort((a, b) => (b.valeur || 0) - (a.valeur || 0));
    if (!ps.length) continue;
    const sum = ps.reduce((s, p) => s + (p.valeur || 0), 0);
    rows += `<tr class="group"><td colspan="2">${g}</td><td class="r">${eur(sum)}</td><td class="r">${pct(sum / L.total)}</td><td colspan="3"></td></tr>`;
    for (const p of ps) {
      let stop = '<span class="muted">—</span>';
      if (p.distance_stop != null) {
        const d = p.distance_stop, w = Math.max(4, Math.min(100, d / 0.15 * 100));
        const col = d < 0.03 ? 'var(--down)' : d < 0.06 ? 'var(--warn)' : 'var(--up)';
        stop = `<div class="stopcell"><b style="color:${col}">${pct(d, 1)}</b><span class="minibar"><i style="width:${w}%;background:${col}"></i></span>
          <span class="nm">stop ${p.stop.toLocaleString('fr-FR')} ${p.stop_devise === 'EUR' ? '€' : '$'} · cours ${p.cours.toLocaleString('fr-FR')} ${p.devise === 'EUR' ? '€' : '$'}</span></div>`;
      }
      const name = p.ticker === 'CASH' ? '<span class="tk">Cash</span>' : `<span class="tk">${esc(p.ticker)}</span><br><span class="nm">${esc(p.nom)}${p.theme ? ' · ' + esc(p.theme.replace(/\s*\(.*\)/, '')) : ''}</span>`;
      rows += `<tr><td>${name}</td><td><span class="badge ${bcls[p.poche] || ''}">${esc(p.poche)}</span></td>
        <td class="r">${eur(p.valeur)}</td><td class="r">${pct(p.poids)}</td>
        <td class="r ${cls(p.var_jour)}">${p.ticker === 'CASH' ? '—' : pct(p.var_jour, 1, true)}</td>
        <td class="r ${cls(p.perf_depuis_achat)}">${p.ticker === 'CASH' ? '—' : pct(p.perf_depuis_achat, 1, true)}</td>
        <td class="r">${stop}</td></tr>`;
    }
  }
  document.querySelector('#t-pos tbody').innerHTML = rows;

  // Journal (grouped by day, newest first)
  const byDay = {};
  for (const j of D.journal) (byDay[j.date] ||= []).push(j);
  $('journal').innerHTML = Object.keys(byDay).sort().reverse().map(d => {
    const ops = byDay[d];
    const body = ops.map(j => j.action === 'Aucune'
      ? `<div class="jnone">Aucune opération. ${esc(j.motif || '')}</div>`
      : `<div class="jop"><span class="act ${j.action === 'Vente' ? 'down' : 'up'}">${esc(j.action)}</span><span class="tk">${esc(j.ticker)}</span><span class="amt">${eur(j.montant)}</span></div>`).join('');
    const motifs = [...new Set(ops.filter(j => j.action !== 'Aucune').map(j => j.motif))];
    return `<div class="jday"><div class="d">${fdate(d)}</div>${body}${motifs.length ? `<div class="nm" style="margin-top:4px">${motifs.map(esc).join(' · ')}</div>` : ''}</div>`;
  }).join('');

  // Notes
  $('last-note').textContent = L.notes || '—';
  $('notes-hist').innerHTML = D.snapshots.slice().reverse().map(s => `<p class="h"><b>${fdate(s.date, { day: 'numeric', month: 'short' })}</b> — ${esc(s.notes)}</p>`).join('');

  $('gen').textContent = 'Dernière génération : ' + new Date(D.generated_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) + ' (Paris)';
  if (D.issues && D.issues.length) { $('issues').hidden = false; $('issues').textContent = 'Points de données à vérifier : ' + D.issues.join(' · '); }
})();
