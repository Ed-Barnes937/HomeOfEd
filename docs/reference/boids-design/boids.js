/* ============================================================
   Boids Simulator — reference behaviour (vanilla JS)
   This paints ONE STATIC reference frame of the flock and wires
   the settings dialog. It is NOT a live simulation — it exists so
   the handoff page matches the mockup. Palettes + control specs
   below are the source of truth for the real implementation.
   ============================================================ */

const THEMES = {
  neon:      { bg:'#08080c', palette:['#00e6ff','#ff2bd6','#8b5cff'],          glow:14, mode:'fill'   },
  retro:     { bg:'#221436', palette:['#ff5d8f','#ffb03a','#39d5c6'],          glow:9,  mode:'fill'   },
  asteroids: { bg:'#000000', palette:['#ffffff','#d9e2ff'],                    glow:0,  mode:'stroke' },
  autumnal:  { bg:'#f2ece0', palette:['#b8451f','#d98a37','#7c7a3a','#9c392c'],glow:0,  mode:'fill'   },
};
const ORDER = ['neon','retro','asteroids','autumnal'];

// Slider spec — key, label, min, max, step, value formatter, default value
const SLIDERS = [
  { key:'count',      label:'boids',      min:20, max:400, step:1,    fmt:v=>String(Math.round(v)) },
  { key:'speed',      label:'speed',      min:0.5,max:6,   step:0.1,  fmt:v=>(+v).toFixed(1) },
  { key:'separation', label:'separation', min:0,  max:3,   step:0.05, fmt:v=>(+v).toFixed(2) },
  { key:'alignment',  label:'alignment',  min:0,  max:3,   step:0.05, fmt:v=>(+v).toFixed(2) },
  { key:'cohesion',   label:'cohesion',   min:0,  max:3,   step:0.05, fmt:v=>(+v).toFixed(2) },
  { key:'vision',     label:'vision',     min:20, max:140, step:1,    fmt:v=>Math.round(v)+'px' },
  { key:'trail',      label:'trail',      min:0,  max:1,   step:0.01, fmt:v=>Math.round(v*100)+'%' },
];

const state = {
  theme:'neon',
  shape:'triangle',
  params:{ count:150, speed:2.6, separation:1.3, alignment:1.0, cohesion:0.9, vision:66, trail:0.42 },
};

/* ---------- seeded static flock layout ---------- */
let pool = [];
(function buildPool(){
  let seed = 20260702;
  const rnd = ()=>{ seed = (seed*1664525 + 1013904223) & 0x7fffffff; return seed/0x7fffffff; };
  const W=1600, H=900, clusters=[];
  for(let c=0;c<7;c++) clusters.push({ x:rnd()*W, y:rnd()*H, a:rnd()*Math.PI*2 });
  for(let i=0;i<400;i++){
    const cl = clusters[Math.floor(rnd()*clusters.length)];
    const spread = 60 + rnd()*160;
    pool.push({ rx:(cl.x+(rnd()-0.5)*spread*2)/W, ry:(cl.y+(rnd()-0.5)*spread*2)/H,
                a:cl.a+(rnd()-0.5)*0.9, ci:Math.floor(rnd()*6) });
  }
})();

const canvas = document.getElementById('sim');
const ctx = canvas.getContext('2d');
let W, H;

function resize(){
  const d = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W*d; canvas.height = H*d;
  ctx.setTransform(d,0,0,d,0,0);
  draw();
}

function rgba(hex,a){
  const h = hex.replace('#','');
  return `rgba(${parseInt(h.substr(0,2),16)},${parseInt(h.substr(2,2),16)},${parseInt(h.substr(4,2),16)},${a})`;
}

function draw(){
  const th = THEMES[state.theme], p = state.params;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = th.bg; ctx.fillRect(0,0,W,H);
  const stroke = th.mode==='stroke', pal = th.palette;
  const n = Math.round(p.count);
  const streak = 6 + p.trail*46 + p.speed*3;

  for(let i=0;i<n;i++){
    const b = pool[i % pool.length];
    const x = b.rx*W, y = b.ry*H, a = b.a, col = pal[b.ci % pal.length];
    const dx = Math.cos(a), dy = Math.sin(a);

    if(p.trail > 0.02){
      const tx = x-dx*streak, ty = y-dy*streak;
      const g = ctx.createLinearGradient(x,y,tx,ty);
      g.addColorStop(0, rgba(col, stroke?0.5:0.42));
      g.addColorStop(1, rgba(col, 0));
      ctx.strokeStyle = g; ctx.lineWidth = state.shape==='dot'?2.6:1.6; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(tx,ty); ctx.stroke();
    }

    ctx.save(); ctx.translate(x,y); ctx.rotate(a);
    if(th.glow>0){ ctx.shadowBlur = th.glow; ctx.shadowColor = col; }
    if(stroke){ ctx.strokeStyle = col; ctx.lineWidth = 1.4; } else { ctx.fillStyle = col; }

    if(state.shape==='dot'){
      ctx.beginPath(); ctx.arc(0,0,2.7,0,Math.PI*2); stroke?ctx.stroke():ctx.fill();
    } else if(state.shape==='line'){
      ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.beginPath(); ctx.arc(6,0, stroke?1.5:2,0,Math.PI*2); ctx.fillStyle=col; stroke?ctx.stroke():ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(6.5,0); ctx.lineTo(-5,3.7); ctx.lineTo(-2.4,0); ctx.lineTo(-5,-3.7); ctx.closePath();
      stroke?ctx.stroke():ctx.fill();
    }
    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

/* ---------- build controls ---------- */
function buildThemes(){
  const wrap = document.getElementById('themes');
  wrap.innerHTML = '';
  ORDER.forEach(k=>{
    const t = THEMES[k];
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.setAttribute('aria-selected', k===state.theme);
    chip.innerHTML =
      `<div class="chip__preview" style="background:${t.bg}">` +
        t.palette.slice(0,3).map(c=>
          `<span class="chip__dot" style="background:${c}${t.glow>0?`;box-shadow:0 0 7px ${c}`:''}"></span>`).join('') +
      `</div><span class="chip__name">${k}</span>`;
    chip.onclick = ()=>{
      state.theme = k;
      document.documentElement.setAttribute('data-theme', k);
      buildThemes();
      draw();
    };
    wrap.appendChild(chip);
  });
}

function buildSliders(){
  const wrap = document.getElementById('sliders');
  wrap.innerHTML = '';
  SLIDERS.forEach(d=>{
    const v = state.params[d.key];
    const row = document.createElement('div');
    row.className = 'slider';
    row.innerHTML =
      `<div class="slider__row"><span class="slider__label">${d.label}</span>` +
      `<span class="slider__val" id="val-${d.key}">${d.fmt(v)}</span></div>` +
      `<input type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}">`;
    const input = row.querySelector('input');
    input.style.setProperty('--pct', ((v-d.min)/(d.max-d.min)*100) + '%');
    input.oninput = e=>{
      const val = Number(e.target.value);
      state.params[d.key] = val;
      document.getElementById('val-'+d.key).textContent = d.fmt(val);
      input.style.setProperty('--pct', ((val-d.min)/(d.max-d.min)*100) + '%');
      draw();
    };
    wrap.appendChild(row);
  });
}

document.getElementById('shapes').addEventListener('click', e=>{
  const btn = e.target.closest('.seg__btn'); if(!btn) return;
  state.shape = btn.dataset.shape;
  [...document.querySelectorAll('.seg__btn')].forEach(b=>b.setAttribute('aria-pressed', b===btn));
  draw();
});

// collapse / expand
const panel = document.getElementById('panel'), fab = document.getElementById('fab');
document.getElementById('collapse').onclick = ()=>{ panel.hidden = true; fab.hidden = false; };
fab.onclick = ()=>{ panel.hidden = false; fab.hidden = true; };

buildThemes();
buildSliders();
window.addEventListener('resize', resize);
resize();
