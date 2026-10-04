import { createClient } from "https://esm.sh/@neondatabase/neon-js?bundle";
const DATABASE_URL="https://ep-rapid-haze-b51ajefp.c-7.us-east-2.aws.neon.tech/neondb";
const client=createClient(DATABASE_URL,{auth:{allowAnonymous:true}});
const $=id=>document.getElementById(id);
let venues=[];
let monthCursor=new Date();
monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth(),1);

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function isoDate(d){return d.toISOString().slice(0,10)}
function today(){return isoDate(new Date())}
function qno(){return `DOPYT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`}
function monthName(d){return d.toLocaleDateString('sk-SK',{month:'long',year:'numeric'})}
function statusLabel(s){return s==='tentative'?'Predbežne':s==='occupied'?'Obsadené':'Voľné'}

async function loadVenues(){
  const {data,error}=await client.from('public_venues').select('*');
  if(error){$('availability').innerHTML=`<div class="note">Nepodarilo sa načítať priestory: ${esc(error.message)}</div>`;return}
  venues=(data||[]).filter(v=>v.kind==='internal');
  $('pVenue').innerHTML=venues.map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('');
  await Promise.all([loadAvailability(),renderMonth()]);
}

async function loadAvailability(){
  const date=$('pDate').value;
  if(!date)return;
  const {data,error}=await client.from('public_availability').select('event_date,venue_id,venue_name,availability').eq('event_date',date);
  if(error){$('availability').innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
  const busy=new Map((data||[]).map(x=>[x.venue_id,x.availability]));
  $('availability').innerHTML=venues.map(v=>{
    const st=busy.get(v.id)||'free';
    const free=st==='free';
    return `<button class="avail ${free?'free':'busy'}" ${free?'':'disabled'} data-venue="${v.id}"><b>${esc(v.name)}</b><br><small>${statusLabel(st)}${v.capacity?` · do ${v.capacity} hostí`:''}</small></button>`;
  }).join('');
  document.querySelectorAll('[data-venue]').forEach(b=>b.onclick=()=>$('pVenue').value=b.dataset.venue);
  document.querySelectorAll('.pday').forEach(d=>d.classList.toggle('selected',d.dataset.date===date));
}

async function renderMonth(){
  const y=monthCursor.getFullYear(),m=monthCursor.getMonth();
  $('monthTitle').textContent=monthName(monthCursor);
  const from=`${y}-${String(m+1).padStart(2,'0')}-01`;
  const last=new Date(y,m+1,0).getDate();
  const to=`${y}-${String(m+1).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
  const {data,error}=await client.from('public_availability').select('event_date,venue_id,availability').gte('event_date',from).lte('event_date',to);
  const rows=error?[]:(data||[]);
  const byDate=new Map();
  rows.forEach(r=>{
    if(!byDate.has(r.event_date))byDate.set(r.event_date,new Map());
    byDate.get(r.event_date).set(r.venue_id,r.availability);
  });
  const names=['Po','Ut','St','Št','Pi','So','Ne'];
  let html=names.map(n=>`<div class="dow">${n}</div>`).join('');
  const offset=(new Date(y,m,1).getDay()+6)%7;
  for(let i=0;i<offset;i++)html+='<div class="pday empty"></div>';
  for(let d=1;d<=last;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const states=byDate.get(ds)||new Map();
    const free=venues.filter(v=>!states.has(v.id)).length;
    const tentative=[...states.values()].filter(s=>s==='tentative').length;
    const occupied=[...states.values()].filter(s=>s==='occupied').length;
    html+=`<div class="pday ${$('pDate').value===ds?'selected':''}" data-date="${ds}"><div class="date">${d}</div>
      <span class="mark free">Voľné: ${free}</span>
      ${tentative?`<span class="mark tentative">Predbežne: ${tentative}</span>`:''}
      ${occupied?`<span class="mark occupied">Obsadené: ${occupied}</span>`:''}
    </div>`;
  }
  $('publicCalendar').innerHTML=html;
  document.querySelectorAll('.pday[data-date]').forEach(el=>el.onclick=async()=>{
    $('pDate').value=el.dataset.date;
    await loadAvailability();
    document.getElementById('availability').scrollIntoView({behavior:'smooth',block:'center'});
  });
}

$('pDate').value=today();
$('pDate').addEventListener('change',async()=>{const d=new Date($('pDate').value+'T12:00:00');monthCursor=new Date(d.getFullYear(),d.getMonth(),1);await Promise.all([loadAvailability(),renderMonth()])});
$('prevMonth').addEventListener('click',async()=>{monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()-1,1);await renderMonth()});
$('nextMonth').addEventListener('click',async()=>{monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,1);await renderMonth()});

$('publicInquiry').addEventListener('submit',async e=>{
  e.preventDefault();
  const payload={
    inquiry_no:qno(),
    full_name:$('pName').value.trim(),
    phone:$('pPhone').value.trim(),
    email:$('pEmail').value.trim()||null,
    event_type:$('pType').value,
    guest_count:+$('pGuests').value,
    preferred_date:$('pDate').value,
    venue_id:$('pVenue').value,
    note:$('pMessage').value.trim()||null,
    source:'public_web',
    status:'new'
  };
  const {data,error}=await client.from('inquiries').insert(payload).select('inquiry_no');
  if(error){alert(`Dopyt sa nepodarilo odoslať: ${error.message}`);return}
  $('qid').textContent=data?.[0]?.inquiry_no||payload.inquiry_no;
  $('done').classList.remove('hidden');
  e.target.reset();
  $('pDate').value=today();
  await Promise.all([loadAvailability(),renderMonth()]);
});
loadVenues();