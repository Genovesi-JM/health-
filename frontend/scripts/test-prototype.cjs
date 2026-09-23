const {JSDOM}=require('jsdom');
const fs=require('fs'),assert=require('node:assert/strict');
const path=require('node:path');
const dir=path.join(__dirname,'../public/prototype');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'app.js'),'utf8');
const dom=new JSDOM(html,{url:'https://genovesi-jm.github.io/health-/prototype/',runScripts:'outside-only'});
const w=dom.window,d=w.document;w.scrollTo=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
w.eval(js);let count=0;function test(name,fn){fn();console.log('PASS '+name);count++}
function view(name){w.location.hash=name;w.dispatchEvent(new w.HashChangeEvent('hashchange'))}
function click(q){const el=d.querySelector(q);assert(el,'Missing '+q);el.click()}
const submit=id=>d.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
test('all seven customer views render',()=>{for(const p of ['home','discover','appointments','video','documents','ambulance','profile']){view(p);assert(d.querySelector('h1'));assert(!d.body.textContent.includes('undefined'))}});
test('every button has an accessible label',()=>{for(const p of ['home','discover','appointments','video','documents','ambulance','profile']){view(p);for(const b of d.querySelectorAll('button'))assert(b.textContent.trim()||b.getAttribute('aria-label'),p)}});
test('pharmacy category filters fictional records',()=>{view('discover');click('[data-category="Farmácias"]');assert.equal(d.querySelectorAll('.provider').length,2)});
test('search handles accented names and empty results',()=>{const s=d.querySelector('#search');s.value='nao-existe';s.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.provider').length,0);s.value='farmacia';s.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.provider').length,2)});
test('booking is added to session agenda',()=>{view('appointments');d.querySelector('#specialty').value='Pediatria';click('[data-slot="14:00"]');submit('booking-form');assert(d.querySelector('#modal-content').textContent.includes('Pediatria'));assert(d.querySelector('.booking-layout').textContent.includes('Pediatria'))});
test('booking cancellation removes only selected sample',()=>{d.querySelector('#modal').close();click('[data-action="cancel-booking"]');assert(!d.querySelector('.booking-layout').textContent.includes('Dra. Ana'));assert(d.querySelector('.booking-layout').textContent.includes('Pediatria'))});
test('teleconsultation controls remain simulated',()=>{view('video');click('[data-action="start-video"]');assert(d.querySelector('.video-stage').textContent.includes('Nenhum médico'));click('[data-action="mic"]');assert.equal(d.querySelector('[data-action="mic"]').getAttribute('aria-pressed'),'false');click('[data-action="end-video"]');assert(d.querySelector('[data-action="start-video"]'))});
test('OCR demo adds a sample without file upload',()=>{view('documents');click('[data-action="ocr"]');assert(d.querySelector('#modal-content').textContent.includes('Nenhum ficheiro'));assert.equal(d.querySelectorAll('.document-card').length,3);assert.equal(d.querySelectorAll('input[type=file]').length,0)});
test('ambulance simulation never promises dispatch',()=>{view('ambulance');submit('ambulance-form');assert(d.querySelector('#modal-content').textContent.includes('Nenhuma ambulância foi enviada'))});
test('manual ambulance zone changes map bounds',()=>{d.querySelector('#modal').close();const z=d.querySelector('#pickup-zone');const old=d.querySelector('iframe').src;z.value='Talatona';z.dispatchEvent(new w.Event('change'));assert.notEqual(d.querySelector('iframe').src,old)});
test('reset restores the presentation examples',()=>{view('profile');click('[data-action="reset"]');click('[data-action="confirm-reset"]');view('appointments');assert.equal(d.querySelectorAll('[data-action="cancel-booking"]').length,1);assert(d.body.textContent.includes('Dra. Ana'))});
test('no persistent health data or outbound writes',()=>{assert(!/localStorage|indexedDB|sendBeacon|getUserMedia/.test(js));assert(!/method\s*:\s*['"]POST/.test(js));assert(!/password|type="email"/.test(html))});
console.log(`${count} prototype checks passed.`);w.close();
