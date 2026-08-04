const GEO = window.GEO_DATA;
document.getElementById('genDate').textContent = new Date().toLocaleDateString('pt-BR');

// ---------------- estado compartilhado ----------------
let state = {
  groupBy: 'polo', regiao: 'todas', selectedMun: null,   // filtros
  compIndicadorAgua: 'rural',
};

function fmt(n){ return Math.round(n||0).toLocaleString('pt-BR'); }
function fmt1(n){ return (n||0).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}); }

function colorForPct(p){
  const stops = [ {v:0,c:[46,125,70]}, {v:25,c:[143,185,62]}, {v:50,c:[226,166,60]}, {v:75,c:[228,87,46]}, {v:100,c:[179,38,30]} ];
  let lo=stops[0], hi=stops[stops.length-1];
  for(let i=0;i<stops.length-1;i++){ if(p>=stops[i].v && p<=stops[i+1].v){ lo=stops[i]; hi=stops[i+1]; break; } }
  const t = (hi.v===lo.v) ? 0 : (p-lo.v)/(hi.v-lo.v);
  const c = lo.c.map((x,i)=>Math.round(x + (hi.c[i]-x)*t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function categoryColors(cats){
  const goodIdx=[], badIdx=[];
  cats.forEach((c,i)=> (c.good?goodIdx:badIdx).push(i));
  const colors = new Array(cats.length);
  goodIdx.forEach((idx,k)=>{ const t = goodIdx.length>1? k/(goodIdx.length-1):0; colors[idx]=colorForPct(t*15); });
  badIdx.forEach((idx,k)=>{ const t = badIdx.length>1? k/(badIdx.length-1):0; colors[idx]=colorForPct(55+t*45); });
  return colors;
}

// ---------------- agregação de campos por situação (água) ----------------
const AGUA_FIELDS = ['v00111','v00112','v00113','v00114','v00115','v00116','v00117','v00118','v00463','v00464'];

function sumSit(feats, prefix, fields, sit){
  const parts = sit==='rural' ? ['aglom','disperso'] : [sit];
  const out = {};
  fields.forEach(v=>{ out[v] = feats.reduce((s,f)=> s + parts.reduce((ss,p)=> ss+(f.properties[prefix+'_'+p+'_'+v]||0), 0), 0); });
  return out;
}
const sumAgua = (feats, sit) => sumSit(feats, 'agua', AGUA_FIELDS, sit);

// total real de domicílios (V00001) — fonte de verdade para os denominadores de percentual
function domTotalSingle(p, sit){
  const parts = sit==='rural' ? ['aglom','disperso'] : [sit];
  return parts.reduce((s,part)=> s + (p['dom_'+part+'_v00001']||0), 0);
}
function sumDomTotal(feats, sit){
  return feats.reduce((s,f)=> s + domTotalSingle(f.properties, sit), 0);
}

function classifyAgua(v, domTotal){
  const adequado = v.v00111+v.v00112+v.v00113;
  const inadequado = v.v00114+v.v00115+v.v00116+v.v00117+v.v00118;
  const total = domTotal||0;
  const categorizado = adequado+inadequado;
  // protecao: se a soma das categorias (fonte primaria) for maior que o total oficial de domicilios (V00001),
  // ha inconsistencia na base de origem para este recorte — sinalizamos e limitamos a exibicao a 100%
  const inconsistente = total>0 && categorizado>total*1.005;
  return {adequado, inadequado, total, inconsistente,
    pctAdeq: total? Math.min(100, adequado/total*100):0,
    pctInadeq: total? Math.min(100, inadequado/total*100):0};
}

// métrica de cor do mapa (aba única de água)
function mapMetricPct(p){
  const feats = [{properties:p}];
  return classifyAgua(sumAgua(feats,'rural'), domTotalSingle(p,'rural'));
}

const POLOS = [...new Set(GEO.features.map(f=>f.properties.nm_polo))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
const MICROS = [...new Set(GEO.features.map(f=>f.properties.nm_msb))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
const CENTRAIS_ORDEM = ["Caetité","Feira de Santana","Jacobina","Ribeira do Pombal","Seabra","Vitória da Conquista","Sem Central definida"];
function regiaoKey(){ return state.groupBy==='polo' ? 'nm_polo' : state.groupBy==='central' ? 'central' : 'nm_msb'; }

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
    const lbl = state.groupBy==='polo'?'Polo Regional — ':state.groupBy==='central'?'Central — ':'Microrregião — ';
    return lbl + state.regiao;
  }
  return 'Estado da Bahia — 417 municípios';
}

// ---------------- controles compartilhados ----------------
function renderControls(){
  document.querySelectorAll('#segGroupBy button').forEach(b=>b.classList.toggle('active', b.dataset.g===state.groupBy));
  const usaChips = (state.groupBy==='polo' || state.groupBy==='central');
  document.getElementById('chipsPolo').style.display = usaChips ? 'flex' : 'none';
  document.getElementById('selectMicro').style.display = state.groupBy==='microrregiao' ? '' : 'none';
  const chipsWrap = document.getElementById('chipsPolo');
  chipsWrap.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'chip' + (state.regiao==='todas' ? ' active':'');
  allBtn.textContent = 'Todo o Estado';
  allBtn.onclick = ()=> applyRegiaoFilter('todas');
  chipsWrap.appendChild(allBtn);
  const lista = state.groupBy==='central' ? CENTRAIS_ORDEM : POLOS;
  lista.forEach(nome=>{
    const b = document.createElement('button');
    b.className = 'chip' + (state.regiao===nome ? ' active':'');
    b.textContent = nome;
    b.onclick = ()=> applyRegiaoFilter(nome);
    chipsWrap.appendChild(b);
  });
  const sel = document.getElementById('selectMicro');
  sel.innerHTML = '<option value="todas">Todo o Estado</option>' + MICROS.map(m=>`<option value="${m}">${m}</option>`).join('');
  sel.value = state.groupBy==='microrregiao' ? state.regiao : 'todas';
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

// ---------------- mapa único ----------------
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
  const wrap = document.getElementById('mapWrap-agua');
  const hint = wrap?.querySelector('.map-hint');
  if(hint){
    hint.classList.remove('visible');
    hint.setAttribute('aria-hidden', 'true');
  }
}

function showMapHint(clientX, clientY, text){
  const wrap = document.getElementById('mapWrap-agua');
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
  const slot = document.getElementById('mapWrap-agua');
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
  const legendSlot = document.querySelector('#view-agua .legend-slot');
  if(legendSlot) legendSlot.innerHTML = legendHtml;
}

// ---------------- donut genérico ----------------
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
    return `<div class="donut-legend-row"><span><span class="sw" style="background:${color}"></span>${label}</span><span>${fmt(val)} (${pct}%)</span></div>`;
  }).join('');
}

// ================= AGUA =================
const AGUA_COMP_CATS = [
  {key:'v00111', label:'Rede geral de distribuição', good:true},
  {key:'v00112', label:'Poço profundo ou artesiano', good:true},
  {key:'v00113', label:'Poço raso, freático ou cacimba', good:true},
  {key:'v00114', label:'Fonte, nascente ou mina', good:false},
  {key:'v00115', label:'Carro-pipa', good:false},
  {key:'v00116', label:'Água de chuva armazenada', good:false},
  {key:'v00117', label:'Rios, açudes, córregos e lagos', good:false},
  {key:'v00118', label:'Outra forma', good:false},
];
function renderTabAgua(){
  const feats = currentSelectionFeatures();
  const domRural = sumDomTotal(feats,'rural'), domUrb = sumDomTotal(feats,'urbana');
  const rural = classifyAgua(sumAgua(feats,'rural'), domRural);
  const urbana = classifyAgua(sumAgua(feats,'urbana'), domUrb);
  const rede = sumAgua(feats,'rural');
  const pctV464 = domRural? rede.v00464/domRural*100:0;
  document.getElementById('kpiRow-agua').innerHTML = `
    <div class="kpi"><div class="val">${fmt(feats.length)}</div><div class="lbl">Municípios na seleção</div></div>
    <div class="kpi ${urbana.pctAdeq>=70?'bom':''}"><div class="val">${fmt1(urbana.pctAdeq)}%</div><div class="lbl">Adequado — Urbano</div></div>
    <div class="kpi ${rural.pctAdeq<40?'alerta':'bom'}"><div class="val">${fmt1(rural.pctAdeq)}%</div><div class="lbl">Adequado — Rural</div></div>
    <div class="kpi bom"><div class="val">${fmt(rural.adequado)}</div><div class="lbl">Domicílios adequados — Rural</div></div>
    <div class="kpi alerta"><div class="val">${fmt(rede.v00464)}</div><div class="sub">${fmt1(pctV464)}%</div><div class="lbl">Sem ligação de rede — Rural</div></div>
  `;
  renderDonut('donutUrbano-agua','legendUrbano-agua', [['Adequado',urbana.adequado,'var(--adeq)'],['Inadequado',urbana.inadequado,'var(--inadeq)']]);
  renderDonut('donutRural-agua','legendRural-agua', [['Adequado',rural.adequado,'var(--adeq)'],['Inadequado',rural.inadequado,'var(--inadeq)']]);
  renderDonut('donutRede-agua','legendRede-agua', [['V00463 — Tem ligação, usa outra forma',rede.v00463,'var(--inadeq)'],['V00464 — Não possui ligação',rede.v00464,'var(--sem)']]);

  document.getElementById('compTitle-agua').textContent = state.compIndicadorAgua==='urbana' ? 'Urbano' : 'Rural (Aglomerados + Disperso)';
  const v = sumAgua(feats, state.compIndicadorAgua);
  const domTot = sumDomTotal(feats, state.compIndicadorAgua);
  const values = AGUA_COMP_CATS.map(c=>v[c.key]);
  const colors = categoryColors(AGUA_COMP_CATS);
  document.getElementById('compChart-agua').innerHTML = domTot>0 ? AGUA_COMP_CATS.map((c,i)=>{
    const val = values[i], pct = domTot? val/domTot*100:0;
    return `<div class="chart-row"><div class="name" title="${c.label}">${c.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${colors[i]}"></div></div>
      <div class="pct">${fmt(val)} (${fmt1(pct)}%)</div></div>`;
  }).join('') : '<div class="empty-msg">Sem dado para esta seleção.</div>';

  document.getElementById('scopeInfo-agua').innerHTML = `<p><b>${currentSelectionLabel()}</b><br><br>"Rural" combina Aglomerados (Setores 5,6,7) e Rural Disperso (Setor 8).</p>`;
}
document.getElementById('segCompIndicador-agua').addEventListener('click', e=>{
  const btn = e.target.closest('button'); if(!btn) return;
  document.querySelectorAll('#segCompIndicador-agua button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.compIndicadorAgua = btn.dataset.ind;
  renderTabAgua();
});

// ================= município: detalhe =================
function renderMuniDetail(){
  const panel = document.getElementById('muniDetailPanel');
  if(!state.selectedMun){ panel.style.display='none'; return; }
  const f = GEO.features.find(f=>f.properties.cod_mun===state.selectedMun);
  if(!f){ panel.style.display='none'; return; }
  const p = f.properties;
  panel.style.display='';

  document.getElementById('muniDetailName').textContent = `${p.nm_mun} — Polo: ${p.nm_polo} · ${p.nm_msb}`;
  const aguaRural = classifyAgua(sumAgua([f],'rural'), domTotalSingle(p,'rural'));
  document.getElementById('muniDetailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="v">${fmt1(aguaRural.pctAdeq)}%</div><div class="l">Água adequada — Rural</div></div>
      <div class="detail-item"><div class="v">${fmt(aguaRural.total)}</div><div class="l">Domicílios (V00001) — Rural</div></div>
      <div class="detail-item"><div class="v">${p.nm_polo}</div><div class="l">Polo Regional</div></div>
      <div class="detail-item"><div class="v">${p.nm_msb}</div><div class="l">Microrregião</div></div>
    </div>
  `;
}

// ================= render geral =================
function renderCurrentTab(){
  renderMap();
  renderTabAgua();
  renderMuniDetail();
}

// ================= ações de filtro / seleção =================
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

// ================= inicialização =================
renderControls();
updateMuniSelectionUI();
populateMuniList();
buildMapSkeleton();
renderCurrentTab();