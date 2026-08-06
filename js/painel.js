const GEO = window.GEO_DATA;
document.getElementById('genDate').textContent = new Date().toLocaleDateString('pt-BR');

// ---------------- estado ----------------
let state = {
  tab: 'agua',
  groupBy: 'territorio',
  regiao: 'todas',
  selectedMun: null,
};

function fmt(n){ return Math.round(n||0).toLocaleString('pt-BR'); }
function fmt1(n){ return (n||0).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}); }

/* Escala do mapa: déficit de adequação (0% = tudo adequado → 100% = nada adequado).
   Paleta azul do abastecimento (escuro = adequado → claro = sem ligação). */
function colorForPct(p){
  const stops = [
    {v:0,  c:[7,28,51]},      // #071C33 — 100% adequado
    {v:25, c:[27,95,160]},    // #1B5FA0
    {v:50, c:[76,163,222]},   // #4CA3DE
    {v:75, c:[163,212,240]},  // #A3D4F0
    {v:100,c:[239,247,252]},  // #EFF7FC — 0% adequado
  ];
  let lo=stops[0], hi=stops[stops.length-1];
  for(let i=0;i<stops.length-1;i++){ if(p>=stops[i].v && p<=stops[i+1].v){ lo=stops[i]; hi=stops[i+1]; break; } }
  const t = (hi.v===lo.v) ? 0 : (p-lo.v)/(hi.v-lo.v);
  const c = lo.c.map((x,i)=>Math.round(x + (hi.c[i]-x)*t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* Cores fixas por categoria SIDRA — paleta azul de abastecimento */
const AA_CAT_COLORS = {
  aa_rede:      '#071C33', // Rede geral de distribuição
  aa_poco_prof: '#0F3D66', // Poço profundo ou artesiano
  aa_fonte:     '#1B5FA0', // Fonte, nascente ou mina
  aa_chuva:     '#2B82C9', // Água de chuva armazenada
  aa_poco_raso: '#4CA3DE', // Poço raso, freático ou cacimba
  aa_pipa:      '#78BFE8', // Carro-pipa
  aa_rio:       '#A3D4F0', // Rios, açudes, córregos e lagos
  aa_outra:     '#C9E4F5', // Outra forma
  aa_sem_rede:  '#EFF7FC', // Não possui ligação à rede geral
};
function categoryColors(cats){
  return cats.map(c => AA_CAT_COLORS[c.key] || '#6b7c8a');
}

// ---------------- agregação SIDRA — abastecimento de água ----------------
const AA_KEYS = ['aa_rede','aa_poco_prof','aa_poco_raso','aa_fonte','aa_pipa','aa_chuva','aa_rio','aa_outra','aa_sem_rede'];

function sumAa(feats){
  const out = { aa_total:0 };
  AA_KEYS.forEach(k=> out[k]=0);
  feats.forEach(f=>{
    const p = f.properties;
    out.aa_total += p.aa_total||0;
    AA_KEYS.forEach(k=> out[k] += p[k]||0);
  });
  return out;
}

function classifyAa(v){
  const adequado = (v.aa_rede||0) + (v.aa_poco_prof||0) + (v.aa_poco_raso||0);
  const inadequado = (v.aa_fonte||0) + (v.aa_pipa||0) + (v.aa_chuva||0) + (v.aa_rio||0) + (v.aa_outra||0);
  const sem = v.aa_sem_rede||0;
  const total = v.aa_total||0;
  return {
    adequado, inadequado, sem, total,
    pctAdeq: total? adequado/total*100:0,
    pctInadeq: total? inadequado/total*100:0,
    pctSem: total? sem/total*100:0,
  };
}

function mapMetricPct(p){
  return classifyAa({
    aa_total: p.aa_total,
    aa_rede: p.aa_rede,
    aa_poco_prof: p.aa_poco_prof,
    aa_poco_raso: p.aa_poco_raso,
    aa_fonte: p.aa_fonte,
    aa_pipa: p.aa_pipa,
    aa_chuva: p.aa_chuva,
    aa_rio: p.aa_rio,
    aa_outra: p.aa_outra,
    aa_sem_rede: p.aa_sem_rede,
  });
}

const TERRITORIOS = [...new Set(GEO.features.map(f=>f.properties.territorio).filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,'pt-BR'));

function regiaoKey(){
  return state.groupBy === 'semiarido' ? 'semiarido' : 'territorio';
}

function currentSelectionFeatures(){
  if(state.selectedMun) return GEO.features.filter(f=>f.properties.cod_mun===state.selectedMun);
  if(state.regiao!=='todas') return GEO.features.filter(f=>f.properties[regiaoKey()]===state.regiao);
  return GEO.features;
}
function currentSelectionLabel(){
  if(state.selectedMun){
    const f = GEO.features.find(f=>f.properties.cod_mun===state.selectedMun);
    return 'Município — ' + (f?f.properties.nm_mun:state.selectedMun);
  }
  if(state.regiao!=='todas'){
    if(state.groupBy==='semiarido'){
      return (state.regiao==='SIM' ? 'Semiárido — SIM' : 'Semiárido — NÃO');
    }
    return 'Território de Identidade — ' + state.regiao;
  }
  return 'Estado da Bahia — 417 municípios';
}

// ---------------- controles ----------------
function renderControls(){
  document.querySelectorAll('#segGroupBy button').forEach(b=>b.classList.toggle('active', b.dataset.g===state.groupBy));
  const usaSelect = state.groupBy==='territorio';
  const usaChips = state.groupBy==='semiarido';
  document.getElementById('chipsPolo').style.display = usaChips ? 'flex' : 'none';
  document.getElementById('selectMicro').style.display = usaSelect ? '' : 'none';

  const chipsWrap = document.getElementById('chipsPolo');
  chipsWrap.innerHTML = '';
  if(usaChips){
    [['todas','Todo o Estado'],['SIM','Semiárido (SIM)'],['NÃO','Fora do Semiárido (NÃO)']].forEach(([val,lbl])=>{
      const b = document.createElement('button');
      b.className = 'chip' + (state.regiao===val ? ' active':'');
      b.textContent = lbl;
      b.onclick = ()=> applyRegiaoFilter(val);
      chipsWrap.appendChild(b);
    });
  }

  const sel = document.getElementById('selectMicro');
  sel.innerHTML = '<option value="todas">Todo o Estado</option>' +
    TERRITORIOS.map(m=>`<option value="${m}">${m}</option>`).join('');
  sel.value = usaSelect ? state.regiao : 'todas';
}
document.getElementById('segGroupBy').addEventListener('click', e=>{
  const btn = e.target.closest('button'); if(!btn) return;
  state.groupBy = btn.dataset.g;
  applyRegiaoFilter('todas');
});
document.getElementById('selectMicro').addEventListener('change', e=> applyRegiaoFilter(e.target.value));
document.getElementById('muniClear').addEventListener('click', clearMunicipio);
document.getElementById('muniDetailClose').addEventListener('click', clearMunicipio);
document.getElementById('muniSearch').addEventListener('change', e=>{
  const n = e.target.value.trim().toLowerCase();
  const f = GEO.features.find(f=>f.properties.nm_mun.toLowerCase()===n);
  if(f) selectMunicipio(f.properties.cod_mun);
});
function populateMuniList(){
  const list = document.getElementById('muniList');
  const names = GEO.features.map(f=>f.properties.nm_mun).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  list.innerHTML = names.map(n=>`<option value="${n}"></option>`).join('');
}

// ---------------- projeção geográfica -> pixels ----------------
let W=640, H=780, lonMin,lonMax,latMin,latMax;
function computeBounds(){
  lonMin=Infinity; lonMax=-Infinity; latMin=Infinity; latMax=-Infinity;
  GEO.features.forEach(f=>{
    const polys = f.geometry.type==='Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach(poly=>{ poly.forEach(ring=>{ ring.forEach(([lon,lat])=>{
      if(lon<lonMin)lonMin=lon; if(lon>lonMax)lonMax=lon;
      if(lat<latMin)latMin=lat; if(lat>latMax)latMax=lat;
    }); }); });
  });
  const padX=(lonMax-lonMin)*0.02, padY=(latMax-latMin)*0.02;
  lonMin-=padX; lonMax+=padX; latMin-=padY; latMax+=padY;
}
function proj(lon,lat){
  const x=(lon-lonMin)/(lonMax-lonMin)*W, y=(latMax-lat)/(latMax-latMin)*H;
  return [x.toFixed(1), y.toFixed(1)];
}
function ringToPath(ring){ return ring.map((pt,i)=>(i===0?'M':'L')+proj(pt[0],pt[1]).join(',')).join(' ')+' Z'; }
function geomToPath(geom){
  const polys = geom.type==='Polygon' ? [geom.coordinates] : geom.coordinates;
  let d=''; polys.forEach(poly=>{ poly.forEach(ring=>{ d+=ringToPath(ring)+' '; }); }); return d.trim();
}

// ---------------- mapa ----------------
let mapSvgEl = null;
let currentZoomScale = 1;
let touchHintTimer = null;
const MUN_FILL_NEUTRAL = '#EFEFEF';
const MUN_FILL_GRAYOUT = '#C7CDD3';

function hintTextFromTarget(el){
  const mun = el?.closest?.('.mun-path');
  if(mun) return GEO.features[+mun.dataset.idx].properties.nm_mun;
  return null;
}

function hideAllMapHints(){
  document.querySelectorAll('.map-hint').forEach(h=>{
    h.classList.remove('visible');
    h.setAttribute('aria-hidden', 'true');
  });
}

function hideMapHint(){
  const wrap = document.getElementById('mapWrap-'+state.tab);
  const hint = wrap?.querySelector('.map-hint');
  if(hint){
    hint.classList.remove('visible');
    hint.setAttribute('aria-hidden', 'true');
  }
}

function showMapHint(clientX, clientY, text){
  const wrap = document.getElementById('mapWrap-'+state.tab);
  if(!wrap || !text) return;
  const hint = wrap.querySelector('.map-hint');
  if(!hint) return;
  hint.textContent = text;
  hint.classList.add('visible');
  hint.setAttribute('aria-hidden', 'false');
  const rect = wrap.getBoundingClientRect();
  let left = clientX - rect.left + 10;
  let top = clientY - rect.top + 8;
  hint.style.left = left + 'px';
  hint.style.top = top + 'px';
  requestAnimationFrame(()=>{
    const hw = hint.offsetWidth, hh = hint.offsetHeight;
    left = Math.max(6, Math.min(left, rect.width - hw - 6));
    top = Math.max(6, Math.min(top, rect.height - hh - 6));
    hint.style.left = left + 'px';
    hint.style.top = top + 'px';
  });
}

function handleMapPointerHint(e){
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const text = hintTextFromTarget(hit);
  if(!text){ hideMapHint(); return; }
  showMapHint(e.clientX, e.clientY, text);
}

function bindMapInteractions(){
  if(!mapSvgEl || mapSvgEl.dataset.bound === '1') return;
  mapSvgEl.dataset.bound = '1';

  mapSvgEl.addEventListener('pointermove', e=>{
    if(e.pointerType === 'touch') return;
    handleMapPointerHint(e);
  });
  mapSvgEl.addEventListener('mousemove', e=> handleMapPointerHint(e));
  mapSvgEl.addEventListener('pointerdown', e=>{
    if(e.pointerType !== 'touch') return;
    handleMapPointerHint(e);
    clearTimeout(touchHintTimer);
    touchHintTimer = setTimeout(hideMapHint, 2500);
  });
  mapSvgEl.addEventListener('pointerleave', ()=>{
    clearTimeout(touchHintTimer);
    hideMapHint();
  });
  mapSvgEl.addEventListener('mouseleave', hideMapHint);
  mapSvgEl.addEventListener('click', e=>{
    const target = e.target.closest('.mun-path');
    if(!target) return;
    toggleMunicipio(GEO.features[+target.dataset.idx].properties.cod_mun);
  });
}

function buildMapSkeleton(){
  computeBounds();
  let paths = '';
  GEO.features.forEach((f,idx)=>{ paths += `<path class="mun-path" data-idx="${idx}" d="${geomToPath(f.geometry)}" fill-rule="evenodd"></path>`; });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<svg id="mapSvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><g id="zoomGroup"><g id="munLayer">${paths}</g></g></svg>`;
  mapSvgEl = wrapper.firstElementChild;
  bindMapInteractions();
}

function mountMapInActiveTab(){
  const slot = document.getElementById('mapWrap-'+state.tab);
  if(!slot) return;
  hideAllMapHints();
  clearTimeout(touchHintTimer);
  if(!mapSvgEl) buildMapSkeleton();
  if(mapSvgEl.parentElement !== slot) slot.appendChild(mapSvgEl);
  const hint = slot.querySelector('.map-hint');
  if(hint) slot.appendChild(hint);
}

function bboxPxOfFeatures(feats){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  feats.forEach(f=>{
    const polys = f.geometry.type==='Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach(poly=>{ poly.forEach(ring=>{ ring.forEach(([lon,lat])=>{
      const [x,y] = proj(lon,lat).map(Number);
      if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
    }); }); });
  });
  return {minX,maxX,minY,maxY};
}
function applyZoomToBBox(bbox, pad, maxScale){
  const zg = document.getElementById('zoomGroup'); if(!zg||!bbox) return;
  const bw = Math.max(bbox.maxX-bbox.minX,6), bh = Math.max(bbox.maxY-bbox.minY,6);
  const cx=(bbox.minX+bbox.maxX)/2, cy=(bbox.minY+bbox.maxY)/2;
  let scale = Math.min(W/(bw*pad), H/(bh*pad));
  scale = Math.max(1, Math.min(scale, maxScale));
  currentZoomScale = scale;
  const tx=W/2-cx*scale, ty=H/2-cy*scale;
  zg.setAttribute('transform', `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(3)})`);
}
function zoomToMunicipio(codMun){
  const f = GEO.features.find(f=>f.properties.cod_mun===codMun);
  if(f) applyZoomToBBox(bboxPxOfFeatures([f]), 1.7, 16);
}
function zoomToRegiao(){
  if(state.regiao==='todas'){ zoomReset(); return; }
  applyZoomToBBox(bboxPxOfFeatures(GEO.features.filter(f=>f.properties[regiaoKey()]===state.regiao)), 1.15, 8);
}
function zoomReset(){
  const zg = document.getElementById('zoomGroup'); currentZoomScale=1;
  if(zg) zg.setAttribute('transform','translate(0,0) scale(1)');
}

function renderMap(){
  mountMapInActiveTab();

  document.querySelectorAll('#munLayer .mun-path').forEach(pathEl=>{
    const p = GEO.features[+pathEl.dataset.idx].properties;
    const isSelected = state.selectedMun===p.cod_mun;
    const r = mapMetricPct(p);
    const refColor = r.total ? colorForPct(100-r.pctAdeq) : MUN_FILL_NEUTRAL;
    if(state.selectedMun){
      pathEl.setAttribute('fill', isSelected ? refColor : MUN_FILL_GRAYOUT);
      pathEl.classList.toggle('selected', isSelected);
      pathEl.classList.remove('dim');
    } else {
      pathEl.setAttribute('fill', refColor);
      pathEl.classList.remove('selected');
      const inFilter = (state.regiao==='todas' || p[regiaoKey()]===state.regiao);
      pathEl.classList.toggle('dim', !inFilter);
    }
  });

  const legendHtml = [['100% adequado',0],['75%',25],['50%',50],['25%',75],['0% adequado',100]].map(([lbl,v])=>
    `<span><span class="sw" style="background:${colorForPct(v)}"></span>${lbl}</span>`).join('') +
    `<span><span class="sw" style="background:${MUN_FILL_NEUTRAL}"></span>Sem dado</span>`;
  const legendSlot = document.querySelector('#view-'+state.tab+' .legend-slot');
  if(legendSlot) legendSlot.innerHTML = legendHtml;
}

// ---------------- donut ----------------
function renderDonut(svgId, legendId, parts){
  const svg = document.getElementById(svgId);
  if(!svg) return;
  const cx=90, cy=90, r=68, sw=28;
  const total = parts.reduce((s,p)=>s+p[1],0);
  const circumference = 2*Math.PI*r;
  let offsetAcc = 0, svgParts = '';
  parts.forEach(([label,val,color])=>{
    const frac = total? val/total : 0;
    const len = frac*circumference;
    svgParts += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
      stroke-dasharray="${len} ${circumference-len}" stroke-dashoffset="${-offsetAcc}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    offsetAcc += len;
  });
  const pctFirst = total? parts[0][1]/total*100 : 0;
  svg.innerHTML = svgParts + `<circle cx="${cx}" cy="${cy}" r="${r-sw/2-3}" fill="#fff"></circle>
    <text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="16" font-weight="700" fill="var(--azul-escuro)" font-family="Arial Narrow, Arial, sans-serif">${fmt1(pctFirst)}%</text>
    <text x="${cx}" y="${cy+13}" text-anchor="middle" font-size="9" fill="#5A6673" font-family="Arial Narrow, Arial, sans-serif">${parts[0][0].toLowerCase()}</text>`;
  document.getElementById(legendId).innerHTML = parts.map(([label,val,color])=>{
    const pct = total? (val/total*100).toFixed(1) : '0.0';
    const light = String(color).toUpperCase() === '#EFF7FC';
    const swStyle = `background:${color}` + (light ? ';box-shadow:inset 0 0 0 1px #C9E4F5' : '');
    return `<div class="donut-legend-row"><span><span class="sw" style="${swStyle}"></span>${label}</span><span>${fmt(val)} (${pct}%)</span></div>`;
  }).join('');
}

// ================= VIEW ÁGUA =================
const AA_COMP_CATS = [
  {key:'aa_rede', label:'Rede geral de distribuição', good:true},
  {key:'aa_poco_prof', label:'Poço profundo ou artesiano', good:true},
  {key:'aa_poco_raso', label:'Poço raso, freático ou cacimba', good:true},
  {key:'aa_fonte', label:'Fonte, nascente ou mina', good:false},
  {key:'aa_pipa', label:'Carro-pipa', good:false},
  {key:'aa_chuva', label:'Água de chuva armazenada', good:false},
  {key:'aa_rio', label:'Rios, açudes, córregos e lagos', good:false},
  {key:'aa_outra', label:'Outra forma', good:false},
  {key:'aa_sem_rede', label:'Não possui ligação à rede geral', good:false},
];

function renderTabAgua(){
  const feats = currentSelectionFeatures();
  const v = sumAa(feats);
  const cl = classifyAa(v);
  const pop = feats.reduce((s,f)=>s+(f.properties.populacao||0),0);
  const popUrb = feats.reduce((s,f)=>s+(f.properties.pop_urbana||0),0);
  const popRur = feats.reduce((s,f)=>s+(f.properties.pop_rural||0),0);
  const comForma = Math.max(0, (v.aa_total||0) - (v.aa_sem_rede||0));
  const pctCom = v.aa_total ? comForma/v.aa_total*100 : 0;
  const pctSem = v.aa_total ? (v.aa_sem_rede||0)/v.aa_total*100 : 0;

  document.getElementById('kpiRow-agua').innerHTML = `
    <div class="kpi"><div class="val">${fmt(feats.length)}</div><div class="lbl">Municípios na seleção</div></div>
    <div class="kpi"><div class="val">${fmt(pop)}</div><div class="lbl">População (Censo 2022)</div></div>
    <div class="kpi bom"><div class="val">${fmt(comForma)}</div><div class="sub">${fmt1(pctCom)}%</div><div class="lbl">Domicílios c/ forma de abastecimento</div></div>
    <div class="kpi alerta"><div class="val">${fmt(v.aa_sem_rede)}</div><div class="sub">${fmt1(pctSem)}%</div><div class="lbl">Sem ligação à rede geral</div></div>
    <div class="kpi ${cl.pctAdeq>=70?'bom':cl.pctAdeq<40?'alerta':''}"><div class="val">${fmt1(cl.pctAdeq)}%</div><div class="lbl">Atendimento adequado</div></div>
  `;

  renderDonut('donutAdeq-agua','legendAdeq-agua', [
    ['Adequado', cl.adequado, '#071C33'],
    ['Inadequado', cl.inadequado, '#78BFE8'],
    ['Sem ligação', cl.sem, '#EFF7FC'],
  ]);

  const colors = categoryColors(AA_COMP_CATS);
  document.getElementById('compChart-agua').innerHTML = cl.total>0 ? AA_COMP_CATS.map((c,i)=>{
    const val = v[c.key]||0, pct = cl.total? val/cl.total*100:0;
    const light = colors[i].toUpperCase() === '#EFF7FC';
    const barStyle = `width:${pct}%;background:${colors[i]}` + (light ? ';box-shadow:inset 0 0 0 1px #C9E4F5' : '');
    return `<div class="chart-row"><div class="name" title="${c.label}">${c.label}</div>
      <div class="bar-track"><div class="bar-fill" style="${barStyle}"></div></div>
      <div class="pct">${fmt(val)} (${fmt1(pct)}%)</div></div>`;
  }).join('') : '<div class="empty-msg">Sem dado para esta seleção.</div>';

  document.getElementById('redeChart-agua').innerHTML = `
    <div class="banheiro-row">
      <div class="banheiro-label">Domicílios</div>
      <div class="bar2"><div class="seg-com lab" style="width:${pctCom}%">${pctCom>12?fmt1(pctCom)+'%':''}</div><div class="seg-sem lab" style="width:${pctSem}%">${pctSem>8?fmt1(pctSem)+'%':''}</div></div>
    </div>
    <div class="banheiro-stats">
      <span><span style="color:#071C33;font-weight:700;">●</span> ${fmt(comForma)} com forma de abastecimento (${fmt1(pctCom)}%)</span>
      <span><span style="color:#4CA3DE;font-weight:700;">●</span> ${fmt(v.aa_sem_rede)} sem ligação à rede (${fmt1(pctSem)}%)</span>
    </div>
    <div class="banheiro-stats" style="margin-top:10px;">
      <span>Pop. urbana: <b>${fmt(popUrb)}</b></span>
      <span>Pop. rural: <b>${fmt(popRur)}</b></span>
    </div>`;

  document.getElementById('scopeInfo-agua').innerHTML = `<p><b>${currentSelectionLabel()}</b><br><br>
    Dados SIDRA/IBGE (Censo 2022) — domicílios particulares permanentes ocupados por forma de abastecimento de água.
    <br><br>
    <b>Adequado</b> = rede geral de distribuição + poço profundo/artesiano + poço raso/freático/cacimba.
    <br><b>Inadequado</b> = fonte/nascente, carro-pipa, água de chuva, rios/açudes ou outra forma.
  </p>`;
}

// ================= município: detalhe =================
function renderMuniDetail(){
  const panel = document.getElementById('muniDetailPanel');
  if(!state.selectedMun){ panel.style.display='none'; return; }
  const f = GEO.features.find(f=>f.properties.cod_mun===state.selectedMun);
  if(!f){ panel.style.display='none'; return; }
  const p = f.properties;
  panel.style.display='';

  document.getElementById('muniDetailName').textContent =
    `${p.nm_mun} — ${p.territorio}` + (p.semiarido==='SIM' ? ' · Semiárido' : '');

  const aa = classifyAa(p);
  document.getElementById('muniDetailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="v">${fmt1(aa.pctAdeq)}%</div><div class="l">Água adequada</div></div>
      <div class="detail-item"><div class="v">${fmt(p.populacao)}</div><div class="l">População</div></div>
      <div class="detail-item"><div class="v">${p.territorio}</div><div class="l">Território de Identidade</div></div>
      <div class="detail-item"><div class="v">${fmt(p.aa_total)}</div><div class="l">Domicílios (água)</div></div>
    </div>
  `;
}

function renderCurrentTab(){
  renderMap();
  renderTabAgua();
  renderMuniDetail();
}

function updateMuniSelectionUI(){
  const btn = document.getElementById('muniClear');
  const hasSelection = !!state.selectedMun;
  btn.classList.toggle('visible', hasSelection);
  btn.disabled = !hasSelection;
  btn.setAttribute('aria-hidden', hasSelection ? 'false' : 'true');
}

function toggleMunicipio(codMun){
  if(state.selectedMun === codMun) clearMunicipio();
  else selectMunicipio(codMun);
}

function selectMunicipio(codMun){
  state.selectedMun = codMun;
  const f = GEO.features.find(f=>f.properties.cod_mun===codMun);
  document.getElementById('muniSearch').value = f?f.properties.nm_mun:'';
  updateMuniSelectionUI();
  zoomToMunicipio(codMun);
  renderCurrentTab();
}
function clearMunicipio(){
  state.selectedMun = null;
  document.getElementById('muniSearch').value = '';
  updateMuniSelectionUI();
  zoomToRegiao();
  renderCurrentTab();
}
function applyRegiaoFilter(nome){
  state.regiao = nome;
  state.selectedMun = null;
  document.getElementById('muniSearch').value = '';
  updateMuniSelectionUI();
  renderControls();
  zoomToRegiao();
  renderCurrentTab();
}

renderControls();
updateMuniSelectionUI();
populateMuniList();
buildMapSkeleton();
renderCurrentTab();
