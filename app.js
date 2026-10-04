
import { createClient } from "https://esm.sh/@neondatabase/neon-js?bundle";

const DATABASE_URL = "https://ep-rapid-haze-b51ajefp.c-7.us-east-2.aws.neon.tech/neondb";
const client = createClient(DATABASE_URL, { auth: { allowAnonymous: true } });

const ED = {
  state: { venues:[], inquiries:[], events:[], clients:[], foods:[], notifications:[], inventory:[], audit:[], finance:[], profiles:[] },
  currentUser: null,
  profile: null,
  currentEventId: null,

  async init(){
    this.bind();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    await this.restoreSession();
    if(this.currentUser) await this.loadAll();
    this.applyAuth();
  },

  bind(){
    document.addEventListener('click', e=>{
      const v=e.target.closest('[data-view]'); if(v){ this.show(v.dataset.view); return; }
      const go=e.target.closest('[data-go]'); if(go){ this.show(go.dataset.go); return; }
      const ev=e.target.closest('[data-event-id]'); if(ev){ this.currentEventId=ev.dataset.eventId; this.show('event'); return; }
      const q=e.target.closest('[data-inquiry-action]'); if(q){ this.handleInquiry(q.dataset.inquiryAction,q.dataset.id); return; }
    });
    document.getElementById('sendOtpBtn')?.addEventListener('click',()=>this.sendOtp());
    document.getElementById('loginForm')?.addEventListener('submit',e=>{e.preventDefault();this.loginOtp()});
    document.getElementById('logoutBtn')?.addEventListener('click',()=>this.logout());
    document.getElementById('newEventForm')?.addEventListener('submit',e=>{e.preventDefault();this.createEvent()});
    document.getElementById('foodSearch')?.addEventListener('input',e=>this.renderFoodSearch(e.target.value));
    document.getElementById('addFoodForm')?.addEventListener('submit',e=>{e.preventDefault();this.addFood()});
    document.getElementById('pushBtn')?.addEventListener('click',()=>this.enablePush());
    document.getElementById('pushBtn2')?.addEventListener('click',()=>this.enablePush());
  },

  async sendOtp(){
    const email=document.getElementById('loginEmail').value.trim().toLowerCase();
    if(!email) return this.loginStatus('Zadaj e-mail.');
    this.loginStatus('Posielam kód…');
    const { error } = await client.auth.emailOtp.sendVerificationOtp({ email, type:'sign-in' });
    this.loginStatus(error ? `Chyba: ${error.message}` : 'Kód bol odoslaný na e-mail.');
  },

  async loginOtp(){
    const email=document.getElementById('loginEmail').value.trim().toLowerCase();
    const otp=document.getElementById('loginOtp').value.trim();
    if(!email || !otp) return this.loginStatus('Zadaj e-mail aj jednorazový kód.');
    this.loginStatus('Overujem…');
    const { data, error } = await client.auth.signIn.emailOtp({ email, otp });
    if(error) return this.loginStatus(`Prihlásenie zlyhalo: ${error.message}`);
    this.currentUser=data?.user || null;
    const ok=await this.loadProfile();
    if(!ok){
      await client.auth.signOut();
      this.currentUser=null;
      this.applyAuth();
      return this.loginStatus('Účet nemá aktívny interný profil EventDesk.');
    }
    await this.loadAll();
    this.applyAuth();
    this.show('dashboard');
    this.toast('Prihlásenie úspešné');
  },

  async restoreSession(){
    const { data } = await client.auth.getSession();
    this.currentUser=data?.user || null;
    if(this.currentUser) {
      const ok=await this.loadProfile();
      if(!ok){ await client.auth.signOut(); this.currentUser=null; this.profile=null; }
    }
  },

  async loadProfile(){
    const uid=this.currentUser?.id;
    if(!uid) return false;
    const { data, error }=await client.from('profiles').select('user_id,role,display_name,phone,active').eq('user_id',uid).limit(1);
    if(error || !data?.length || !data[0].active) return false;
    this.profile=data[0];
    return true;
  },

  async logout(){
    await client.auth.signOut();
    this.currentUser=null; this.profile=null;
    this.applyAuth();
  },

  applyAuth(){
    document.getElementById('loginOverlay')?.classList.toggle('hidden',!!this.currentUser);
    document.querySelectorAll('[data-admin-only]').forEach(el=>el.classList.toggle('hidden',this.profile?.role!=='admin'));
    document.getElementById('userLabel').textContent=this.currentUser ? `${this.profile?.display_name||this.currentUser.email} · ${this.profile?.role||'—'}` : 'neprihlásený';
  },

  loginStatus(msg){ const el=document.getElementById('loginStatus'); if(el) el.textContent=msg; },

  async loadAll(){
    const eventCols='id,event_no,inquiry_id,client_id,event_type,event_date,start_time,prep_date,venue_id,external_location,guest_count,status,notes,created_by,updated_by,created_at,updated_at';
    const reqs=[
      client.from('venues').select('id,name,kind,capacity,calendar_color,active').eq('active',true),
      client.from('inquiries').select('*').order('created_at',{ascending:false}),
      client.from('events').select(eventCols).order('event_date',{ascending:true}),
      client.from('clients').select('*'),
      client.from('food_catalog').select('*').eq('active',true).order('canonical_name',{ascending:true}),
      client.from('notifications').select('*').order('created_at',{ascending:false}),
      client.from('profiles').select('user_id,display_name,role,active')
    ];
    if(this.profile?.role==='admin'){
      reqs.push(client.from('inventory_items').select('*').order('name',{ascending:true}));
      reqs.push(client.from('audit_log').select('*').order('created_at',{ascending:false}).limit(100));
      reqs.push(client.from('event_finance').select('*'));
    }
    const out=await Promise.all(reqs);
    const firstErr=out.find(x=>x.error)?.error;
    if(firstErr) this.toast(`DB chyba: ${firstErr.message}`);
    this.state.venues=out[0].data||[];
    this.state.inquiries=out[1].data||[];
    this.state.events=out[2].data||[];
    this.state.clients=out[3].data||[];
    this.state.foods=out[4].data||[];
    this.state.notifications=out[5].data||[];
    this.state.profiles=out[6].data||[];
    let ix=7;
    if(this.profile?.role==='admin'){
      this.state.inventory=out[ix++]?.data||[];
      this.state.audit=out[ix++]?.data||[];
      this.state.finance=out[ix++]?.data||[];
    } else {
      this.state.inventory=[]; this.state.audit=[]; this.state.finance=[];
    }
    await this.loadEventDetails();
    this.populateVenueSelect();
    this.renderAll();
  },

  async loadEventDetails(){
    if(!this.state.events.length) return;
    const ids=this.state.events.map(e=>e.id);
    const [menus,services,program]=await Promise.all([
      client.from('event_menu_items').select('*').in('event_id',ids),
      client.from('event_services').select('*').in('event_id',ids),
      client.from('event_program').select('*').in('event_id',ids).order('sort_order',{ascending:true})
    ]);
    for(const e of this.state.events){
      e.menu=(menus.data||[]).filter(x=>x.event_id===e.id);
      e.services=(services.data||[]).filter(x=>x.event_id===e.id);
      e.timeline=(program.data||[]).filter(x=>x.event_id===e.id);
      e.client=this.clientName(e.client_id);
      const fin=this.state.finance.find(f=>f.event_id===e.id);
      if(fin) e.finance=fin;
    }
  },

  populateVenueSelect(){
    const s=document.querySelector('#newEventForm select[name="venueId"]');
    if(s) s.innerHTML=this.state.venues.map(v=>`<option value="${v.id}">${this.esc(v.name)}</option>`).join('');
  },

  clientName(id){ return this.state.clients.find(c=>c.id===id)?.full_name || '—'; },
  venue(id){ return this.state.venues.find(v=>v.id===id)||{name:'—',calendar_color:'#999'}; },
  user(id){ return this.state.profiles.find(p=>p.user_id===id)||{display_name:'Systém'}; },
  fmt(d){ if(!d) return '—'; return new Intl.DateTimeFormat('sk-SK').format(new Date(String(d).slice(0,10)+'T12:00:00')); },
  fmtTime(t){ return t ? String(t).slice(0,5) : '—'; },

  renderAll(){
    this.renderDashboard(); this.renderInquiries(); this.renderEvents(); this.renderCalendar();
    this.renderFoodSearch(''); this.renderNotifications(); this.renderStock(); this.renderFinance(); this.renderAudit(); this.applyAuth();
  },

  show(id){
    if(!this.currentUser)return;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
    document.getElementById('pageTitle').textContent=({dashboard:'Prehľad',inquiries:'Dopyty',calendar:'Kalendár',events:'Akcie',event:'Detail akcie','new-event':'Nová akcia',foods:'Databáza jedál',notifications:'Notifikácie',stock:'Sklad',finance:'Financie',audit:'Audit'})[id]||'EventDesk';
    if(id==='event')this.renderEvent();
    if(id==='calendar')this.renderCalendar();
  },

  renderDashboard(){
    const e=this.state.events.filter(x=>x.status!=='cancelled');
    const q=this.state.inquiries.filter(x=>x.status==='new');
    const rev=this.profile?.role==='admin' ? this.state.finance.reduce((s,x)=>s+(+x.total_price||0),0) : 0;
    document.getElementById('statEvents').textContent=e.length;
    document.getElementById('statQueries').textContent=q.length;
    document.getElementById('statRevenue').textContent=this.profile?.role==='admin' ? `${rev.toLocaleString('sk-SK')} €` : '—';
    document.getElementById('statUnread').textContent=this.state.notifications.filter(n=>!n.read_at).length;
    document.getElementById('dashEvents').innerHTML=e.slice(0,5).map(x=>this.eventCard(x)).join('')||'<div class="note">Žiadne akcie.</div>';
  },

  eventCard(x){
    const v=this.venue(x.venue_id);
    return `<div class="eventcard" data-event-id="${x.id}"><div><div class="id">${this.esc(x.event_no)}</div><b>${this.fmt(x.event_date)}</b></div><div><b>${this.esc(x.client)}</b><div class="muted">${this.esc(x.event_type)} · ${x.guest_count} hostí</div></div><span class="badge ${this.statusClass(x.status)}">${this.statusLabel(x.status)}</span><span class="slot">${this.esc(v.name)}</span></div>`;
  },

  renderEvents(){ document.getElementById('eventsList').innerHTML=this.state.events.map(x=>this.eventCard(x)).join('')||'<div class="note">Žiadne akcie.</div>'; },

  renderInquiries(){
    document.getElementById('inquiryRows').innerHTML=this.state.inquiries.map(q=>`<tr><td><b>${this.esc(q.inquiry_no)}</b><br><small>${this.esc(q.full_name)}</small></td><td>${this.fmt(q.preferred_date)}</td><td>${q.guest_count||'—'}</td><td>${this.esc(this.venue(q.venue_id).name)}</td><td><span class="badge ${this.statusClass(q.status)}">${this.statusLabel(q.status)}</span></td><td>${this.esc(q.phone)}</td><td><button class="btn small" data-inquiry-action="contact" data-id="${q.id}">Kontaktovaný</button> <button class="btn small" data-inquiry-action="hold" data-id="${q.id}">Predbežne</button> <button class="btn small primary" data-inquiry-action="convert" data-id="${q.id}">Vytvoriť akciu</button></td></tr>`).join('');
  },

  async handleInquiry(action,id){
    const q=this.state.inquiries.find(x=>x.id===id); if(!q)return;
    if(action==='contact' || action==='hold'){
      const status=action==='contact'?'contacted':'tentative';
      const {error}=await client.from('inquiries').update({status,updated_at:new Date().toISOString()}).eq('id',id);
      if(error)return this.toast(error.message);
      await this.writeAudit('inquiry',id,`Stav dopytu → ${status}`);
      await this.loadAll(); return;
    }
    if(action==='convert'){
      const eventNo=`ED-${new Date(q.preferred_date||Date.now()).getFullYear()}-${String(Date.now()).slice(-4)}`;
      let cl=this.state.clients.find(c=>c.email && q.email && c.email.toLowerCase()===q.email.toLowerCase());
      if(!cl){
        const {data,error}=await client.from('clients').insert({full_name:q.full_name,phone:q.phone,email:q.email||null,notes:q.note||null,created_by:this.currentUser.id}).select();
        if(error)return this.toast(error.message); cl=data?.[0];
      }
      const payload={event_no:eventNo,inquiry_id:q.id,client_id:cl.id,event_type:q.event_type||'Iné',event_date:q.preferred_date,start_time:q.preferred_time||null,venue_id:q.venue_id,guest_count:q.guest_count||1,status:'tentative',notes:q.note||null,created_by:this.currentUser.id,updated_by:this.currentUser.id};
      const {data,error}=await client.from('events').insert(payload).select('id,event_no');
      if(error)return this.toast(error.message);
      await client.from('inquiries').update({status:'confirmed',updated_at:new Date().toISOString()}).eq('id',q.id);
      await this.writeAudit('event',data[0].id,`Akcia vytvorená z dopytu ${q.inquiry_no}`);
      await this.loadAll(); this.currentEventId=data[0].id; this.show('event'); this.toast('Dopyt bol prevedený na akciu');
    }
  },

  statusClass(s){return ({new:'b-new',contacted:'b-contact',tentative:'b-hold',confirmed:'b-confirm',completed:'b-done',cancelled:'b-cancel'})[s]||''},
  statusLabel(s){return ({new:'Nový',contacted:'Kontaktovaný',tentative:'Predbežná',confirmed:'Potvrdená',completed:'Realizovaná',cancelled:'Zrušená'})[s]||s},

  renderCalendar(){
    const root=document.getElementById('calendarGrid'); if(!root)return;
    const base=new Date(2026,9,1), y=base.getFullYear(), m=base.getMonth();
    const names=['Po','Ut','St','Št','Pi','So','Ne']; let html=names.map(x=>`<div class="dow">${x}</div>`).join('');
    let offset=(new Date(y,m,1).getDay()+6)%7; for(let i=0;i<offset;i++)html+='<div class="day"></div>';
    const days=new Date(y,m+1,0).getDate();
    for(let d=1;d<=days;d++){
      const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const ev=this.state.events.filter(x=>x.event_date===ds&&x.status!=='cancelled');
      html+=`<div class="day"><div class="n">${d}</div>${ev.map(x=>`<div class="slot" data-event-id="${x.id}">${this.esc(x.client)}<br><small>${this.fmtTime(x.start_time)} · ${this.esc(this.venue(x.venue_id).name)}</small></div>`).join('')}</div>`;
    }
    root.innerHTML=html;
  },

  renderEvent(){
    const x=this.state.events.find(e=>e.id===this.currentEventId)||this.state.events[0]; if(!x)return;
    this.currentEventId=x.id; const v=this.venue(x.venue_id), fin=x.finance;
    document.getElementById('eventHero').innerHTML=`<div class="kicker">${this.esc(x.event_no)}</div><h2>${this.esc(x.client)} · ${this.esc(x.event_type)}</h2><div class="chips"><span class="chip">${this.fmt(x.event_date)}</span><span class="chip">${this.fmtTime(x.start_time)}</span><span class="chip">${x.guest_count} hostí</span><span class="chip">${this.esc(v.name)}</span><span class="chip">${this.statusLabel(x.status)}</span></div>`;
    const finHtml=this.profile?.role==='admin' ? `${fin?.price_per_person||0} €/os. · spolu ${(+fin?.total_price||0).toLocaleString('sk-SK')} €<br>Záloha ${(+fin?.deposit_amount||0).toLocaleString('sk-SK')} €` : 'Len pre Admin';
    document.getElementById('eventSummary').innerHTML=`<div class="card section"><b>Klient</b><p>${this.esc(x.client)}</p></div><div class="card section"><b>Financie</b><p>${finHtml}</p></div><div class="card section"><b>Poznámky</b><p>${this.esc(x.notes||'—')}</p></div>`;
    document.getElementById('eventMenu').innerHTML=(x.menu||[]).map(m=>`<div class="service"><b>${this.esc(m.course_name)}</b><div class="muted">${this.esc(m.custom_name||this.state.foods.find(f=>f.id===m.food_id)?.canonical_name||'—')}</div></div>`).join('')||'<div class="note">Menu zatiaľ nie je zadané.</div>';
    document.getElementById('eventServices').innerHTML=(x.services||[]).map(s=>`<span class="chip">${this.esc(s.service_type)}: <b>${s.enabled?'ÁNO':'NIE'}</b></span>`).join('')||'<span class="muted">Bez služieb</span>';
    document.getElementById('eventTimeline').innerHTML=(x.timeline||[]).map(t=>`<div class="tl"><b>${this.fmtTime(t.starts_at)} · ${this.esc(t.title)}</b></div>`).join('')||'<div class="note">Program ešte nie je zadaný.</div>';
  },

  async createEvent(){
    const fd=new FormData(document.getElementById('newEventForm'));
    const guests=+fd.get('guests'), date=fd.get('date');
    const eventNo=`ED-${new Date(date).getFullYear()}-${String(Date.now()).slice(-4)}`;
    const {data:cl,error:ce}=await client.from('clients').insert({full_name:fd.get('client'),phone:fd.get('phone'),email:fd.get('email')||null,created_by:this.currentUser.id}).select();
    if(ce)return this.toast(ce.message);
    const payload={event_no:eventNo,client_id:cl[0].id,event_type:fd.get('type'),event_date:date,start_time:fd.get('start')||null,venue_id:fd.get('venueId'),guest_count:guests,status:'tentative',notes:fd.get('notes')||null,created_by:this.currentUser.id,updated_by:this.currentUser.id};
    const {data:ev,error:ee}=await client.from('events').insert(payload).select('id,event_no');
    if(ee)return this.toast(ee.message);
    const eventId=ev[0].id;

    const services={grill:fd.get('grill')==='yes',cake:fd.get('cake')==='yes',bar:fd.get('bar')==='yes',buffet:fd.get('buffet')==='yes',decor:fd.get('decor')==='yes',music:!!fd.get('music'),photo:fd.get('photo')!=='no',accommodation:fd.get('accommodation')!=='no',transport:fd.get('transport')!=='no'};
    await client.from('event_services').insert(Object.entries(services).map(([service_type,enabled])=>({event_id:eventId,service_type,enabled,details:{}})));

    const menu=[['Predjedlo',fd.get('starter')],['Polievka',fd.get('soup')],['Hlavné jedlo',fd.get('main')],['Príloha 1',fd.get('side1')],['Príloha 2',fd.get('side2')]]
      .filter(x=>x[1]).map((x,i)=>({event_id:eventId,course_name:x[0],custom_name:x[1],sort_order:i}));
    if(menu.length) await client.from('event_menu_items').insert(menu);

    if(this.profile?.role==='admin'){
      const p=+fd.get('pricePerPerson')||0, dep=+fd.get('deposit')||0;
      await client.from('event_finance').insert({event_id:eventId,price_per_person:p,deposit_amount:dep,total_price:p*guests,payment_status:dep>0?'deposit':'none'});
    }
    await this.writeAudit('event',eventId,'Vytvorená nová akcia');
    await this.loadAll(); this.currentEventId=eventId; this.show('event'); this.toast(`Akcia ${eventNo} uložená`);
  },

  renderFoodSearch(q){
    const root=document.getElementById('foodResults');if(!root)return;
    q=(q||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
    const list=this.state.foods.filter(f=>!q||[f.canonical_name,f.category,f.cuisine,...(f.aliases||[])].join(' ').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').includes(q));
    root.innerHTML=list.map(f=>`<div class="food-result"><b>${this.esc(f.canonical_name)}</b><div class="muted">${this.esc(f.category)} · ${this.esc(f.cuisine||'—')} · alergény ${(f.allergens||[]).join(', ')||'—'}</div></div>`).join('');
  },

  async addFood(){
    const map={'Predjedlo':'appetizer','Polievka':'soup','Hlavné jedlo':'main','Príloha':'side','Dezert':'dessert','Bufet':'buffet'};
    const name=document.getElementById('foodName').value.trim();if(!name)return;
    const payload={canonical_name:name,category:map[document.getElementById('foodCategory').value]||'other',cuisine:document.getElementById('foodCuisine').value||'European',allergens:document.getElementById('foodAllergens').value.split(',').map(x=>x.trim()).filter(Boolean),aliases:[]};
    const {error}=await client.from('food_catalog').insert(payload); if(error)return this.toast(error.message);
    await this.writeAudit('food',null,`Pridané jedlo: ${name}`);
    document.getElementById('addFoodForm').reset(); await this.loadAll(); this.toast('Jedlo pridané');
  },

  renderNotifications(){ document.getElementById('notificationList').innerHTML=this.state.notifications.map(n=>`<div class="service"><div class="service-head"><div><b>${this.esc(n.title)}</b><div class="muted">${this.esc(n.body||'')}</div></div><small>${this.fmt(n.created_at)}</small></div></div>`).join('')||'<div class="note">Žiadne notifikácie.</div>'; },

  async enablePush(){
    if(!('Notification'in window))return this.toast('Prehliadač nepodporuje push notifikácie');
    const p=await Notification.requestPermission();
    if(p==='granted'){new Notification('EventDesk',{body:'Lokálne notifikácie sú povolené.'});this.toast('Notifikácie povolené')}
    else this.toast('Notifikácie neboli povolené');
  },

  renderStock(){
    const root=document.getElementById('stockRows'); if(!root)return;
    root.innerHTML=this.profile?.role!=='admin'?'':this.state.inventory.map(s=>`<tr><td>${this.esc(s.name)}</td><td>${s.quantity} ${this.esc(s.unit)}</td><td>${s.min_quantity} ${this.esc(s.unit)}</td><td>${+s.quantity<+s.min_quantity?'<span class="badge b-cancel">Doplniť</span>':'<span class="badge b-confirm">OK</span>'}</td></tr>`).join('');
  },

  renderFinance(){
    const root=document.getElementById('financeRows'); if(!root)return;
    if(this.profile?.role!=='admin'){root.innerHTML='';return;}
    root.innerHTML=this.state.events.map(e=>{const f=this.state.finance.find(x=>x.event_id===e.id)||{};return `<tr><td>${this.esc(e.event_no)}</td><td>${this.esc(e.client)}</td><td>${(+f.total_price||0).toLocaleString('sk-SK')} €</td><td>${(+f.deposit_amount||0).toLocaleString('sk-SK')} €</td><td>${this.esc(f.payment_status||'—')}</td></tr>`}).join('');
  },

  async writeAudit(entityType,entityId,action){
    const {error}=await client.from('audit_log').insert({actor_user_id:this.currentUser.id,action,entity_type:entityType,entity_id:entityId||null,after_data:{message:action}});
    if(error) console.warn('audit',error);
  },

  renderAudit(){
    const root=document.getElementById('auditRows');if(!root)return;
    if(this.profile?.role!=='admin'){root.innerHTML='';return;}
    root.innerHTML=this.state.audit.map(a=>`<tr><td>${this.fmt(a.created_at)}</td><td>${this.esc(this.user(a.actor_user_id).display_name)}</td><td>${this.esc(a.entity_type)} ${a.entity_id?this.esc(a.entity_id):''}</td><td>${this.esc(a.action)}</td></tr>`).join('');
  },

  toast(msg){const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),2600)},
  esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
};

window.addEventListener('DOMContentLoaded',()=>ED.init());
