
import { createClient } from "https://esm.sh/@neondatabase/neon-js?bundle";
const DATABASE_URL="https://ep-rapid-haze-b51ajefp.c-7.us-east-2.aws.neon.tech/neondb";
const client=createClient(DATABASE_URL,{auth:{allowAnonymous:true}});
const $=id=>document.getElementById(id);
let venues=[];

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){return new Date().toISOString().slice(0,10)}
function qno(){return `DOPYT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`}

async function loadVenues(){
  const {data,error}=await client.from('public_venues').select('*');
  if(error){$('availability').innerHTML=`<div class="note">Nepodarilo sa načítať priestory: ${esc(error.message)}</div>`;return}
  venues=data||[];
  $('pVenue').innerHTML=venues.filter(v=>v.kind==='internal').map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('');
  await loadAvailability();
}
async function loadAvailability(){
  const date=$('pDate').value;
  if(!date)return;
  const {data,error}=await client.from('public_availability').select('event_date,venue_id,venue_name,availability').eq('event_date',date);
  if(error){$('availability').innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
  const busy=new Map((data||[]).map(x=>[x.venue_id,x.availability]));
  const internal=venues.filter(v=>v.kind==='internal');
  $('availability').innerHTML=internal.map(v=>{
    const st=busy.get(v.id)||'free';
    const free=st==='free';
    const cls=free?'free':'busy';
    const label=st==='tentative'?'Predbežne rezervovaná':st==='occupied'?'Obsadená':'Voľná';
    return `<button class="avail ${cls}" ${free?'':'disabled'} data-venue="${v.id}"><b>${esc(v.name)}</b><br><small>${label}${v.capacity?` · do ${v.capacity} hostí`:''}</small></button>`;
  }).join('');
  document.querySelectorAll('[data-venue]').forEach(b=>b.onclick=()=>$('pVenue').value=b.dataset.venue);
}
$('pDate').value=today();
$('pDate').addEventListener('change',loadAvailability);

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
  e.target.reset(); $('pDate').value=today(); await loadAvailability();
});
loadVenues();
