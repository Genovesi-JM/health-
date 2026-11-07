import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { requireCurrentCareConsent, REQUIRED_CONSENT_PURPOSES } from '../src/screens/consents.ts';
import { readingState } from './readings-fixtures.mjs';
import { renewalSha256, renewalPayload, renewalPayloadHash, newRenewalPending, renewalStorageKey, readRenewalPending, clearRenewalPending, submitRenewal, recoverRenewal, parseRenewalDoctors, parseRenewal, parseRenewalPage, mergeRenewalHistory, createRenewalHistory, loadRenewalPresence, renewalAccessLost } from '../src/screens/prescriptionRequests.ts';
const key='11111111-1111-4111-8111-111111111111';
const form={doctor_id:'doctor-A',country:'AO',medication_name:' Test medicine ',dose:' 10 mg ',frequency:' daily ',reason:' synthetic test reason '};
const body=renewalPayload(form);
const pending=()=>newRenewalPending('A',body,key);
const row=(patch={})=>({id:'request-A',patient_id:'patient-A',...body,status:'pending',doctor_note:null,adjusted_dose:null,adjusted_frequency:null,created_at:'2026-10-04T12:00:00Z',decided_at:null,request_key:key,revision:0,decision_id:null,standalone_prescription_id:null,decision_state:'pending',doctor_name:'Synthetic doctor',...patch});
const page=(items=[row()],next_cursor=null)=>({items,next_cursor});
function storage(){const values=new Map();return {values,store:{getItemAsync:async key=>values.get(key)??null,setItemAsync:async(key,value)=>{values.set(key,value);},deleteItemAsync:async key=>{values.delete(key);}}};}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(done=>setImmediate(done));}assert.fail('Expected checkpoint');}

test('pure UTF-8 SHA256 matches independent Node crypto for standard vectors, multilingual input, padding edges and long text',()=>{
  for(const text of ['', 'abc','a'.repeat(55),'a'.repeat(56),'a'.repeat(63),'a'.repeat(64),'a'.repeat(1000),'ação renovação 🇦🇴 💊 中文','\ud800','x'.repeat(8000)])assert.equal(renewalSha256(text),createHash('sha256').update(text).digest('hex'));
  assert.equal(renewalSha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('canonical payload uses correct server fields, explicit nulls and ASCII key order, independently of property insertion order',()=>{
  assert.deepEqual(body,{doctor_id:'doctor-A',country:'AO',consent_language:'pt',medication_name:'Test medicine',dose:'10 mg',frequency:'daily',reason:'synthetic test reason'});
  const sorted=Object.fromEntries(Object.keys(body).sort().map(key=>[key,body[key]]));
  assert.equal(renewalPayloadHash(body),createHash('sha256').update(JSON.stringify(sorted)).digest('hex'));
  assert.equal(renewalPayloadHash(Object.fromEntries(Object.entries(body).reverse())),renewalPayloadHash(body));
  assert.equal(renewalPayload({...form,dose:' ',frequency:'',reason:''}).dose,null);
  for(const patch of [{medication_name:' '},{dose:'x'.repeat(101)},{frequency:'x'.repeat(101)},{reason:'x'.repeat(4001)},{country:'BR'},{doctor_id:''}])assert.throws(()=>renewalPayload({...form,...patch}));
});
test('write-ahead recovery stores bounded identifiers and hash only, without medication or notes',async()=>{
  const f=storage();let posts=0;
  await assert.rejects(()=>submitRenewal({get:async()=>assert.fail(),post:async(path,payload,config)=>{
    posts++;assert.equal(path,'/api/v1/prescription-requests');assert.deepEqual(payload,body);assert.equal(config.headers['Idempotency-Key'],key);
    const raw=f.values.get(renewalStorageKey('A'));assert.ok(raw.length<1024);assert.doesNotMatch(raw,/Test medicine|synthetic test reason|10 mg|daily/);assert.deepEqual(JSON.parse(raw),pending());throw new Error('lost');
  }},f.store,pending(),body),/lost/);
  assert.equal(posts,1);assert.deepEqual(await readRenewalPending(f.store,'A'),pending());assert.equal(await readRenewalPending(f.store,'B'),null);
});
test('failed storage prevents POST and a reserved request cannot be replaced by another UUID or edited re-entry',async()=>{
  const f=storage();let posts=0;const api={get:async()=>assert.fail(),post:async()=>{posts++;throw new Error('offline');}};
  await assert.rejects(()=>submitRenewal(api,{...f.store,setItemAsync:async()=>{throw new Error('storage');}},pending(),body));assert.equal(posts,0);
  await assert.rejects(()=>submitRenewal(api,f.store,pending(),body));
  await assert.rejects(()=>submitRenewal(api,f.store,newRenewalPending('A',body,'22222222-2222-4222-8222-222222222222'),body),/anterior/);
  await assert.rejects(()=>submitRenewal(api,f.store,pending(),{...body,dose:'20 mg'}),/não correspondem/);assert.equal(posts,1);
});
test('every ambiguous result, including later auth, validation and generic conflict, retains exact identity',async()=>{
  const f=storage();const sent=[];
  for(const status of [undefined,401,403,404,409,422,500])await assert.rejects(()=>submitRenewal({get:async()=>assert.fail(),post:async(_path,payload,config)=>{sent.push({payload,config});throw status?{response:{status}}:new Error('lost');}},f.store,pending(),body));
  sent.forEach(item=>{assert.deepEqual(item.payload,body);assert.equal(item.config.headers['Idempotency-Key'],key);});assert.deepEqual(await readRenewalPending(f.store,'A'),pending());
});
test('only the named locked noncommit proof clears an absent attempt',async()=>{
  const f=storage();const api={get:async()=>assert.fail(),post:async()=>{throw{response:{status:409,data:{detail:{code:'renewal_not_committed',request_key_committed:false}}}};}};
  await assert.rejects(()=>submitRenewal(api,f.store,pending(),body));assert.equal(await readRenewalPending(f.store,'A'),null);
});
test('restored metadata lookup works without clinical text, preserves 404 uncertainty and shows a later current decision',async()=>{
  const f=storage();f.values.set(renewalStorageKey('A'),JSON.stringify(pending()));
  assert.equal(await recoverRenewal({get:async()=>{throw{response:{status:404}};}},f.store,pending()),null);assert.ok(await readRenewalPending(f.store,'A'));
  const decided=row({status:'approved',revision:1,decision_state:'decided',decision_id:'decision-A',standalone_prescription_id:'rx-A',decided_at:'2026-10-04T14:00:00Z'});
  const result=await recoverRenewal({get:async path=>{assert.equal(path,`/api/v1/prescription-requests/requests/${key}`);return{data:decided};}},f.store,pending());
  assert.equal(result.status,'approved');assert.equal(await readRenewalPending(f.store,'A'),null);
});
test('lookup rejects a wrong UUID, doctor, country or request content and keeps the receipt reference',async()=>{
  for(const patch of [{request_key:'22222222-2222-4222-8222-222222222222'},{doctor_id:'other'},{country:'PT'},{dose:'20 mg'}]){
    const f=storage();f.values.set(renewalStorageKey('A'),JSON.stringify(pending()));
    await assert.rejects(()=>recoverRenewal({get:async()=>({data:row(patch)})},f.store,pending()));assert.ok(await readRenewalPending(f.store,'A'));
  }
});
test('same-key exact re-entry replays without a fresh doctor or consent lookup',async()=>{
  const f=storage();f.values.set(renewalStorageKey('A'),JSON.stringify(pending()));
  const result=await submitRenewal({get:async()=>assert.fail('Recovery must not require fresh authority'),post:async()=>({data:row({status:'rejected',revision:1,decision_state:'decided'})})},f.store,pending(),renewalPayload(form));
  assert.equal(result.status,'rejected');assert.equal(await readRenewalPending(f.store,'A'),null);
});
test('fresh renewal preflight requires all five current grants in its explicit country before reserving or sending health text',async()=>{
  for(const country of ['AO','PT']) {
    const f=storage();let posts=0;
    const send=async state=>{
      const payload=renewalPayload({...form,country});
      const api={get:async path=>{assert.equal(path,`/api/v1/compliance/consent-state?country=${country}&language=pt`);return{data:state};},post:async()=>{posts++;return{data:row({...payload})};}};
      await requireCurrentCareConsent(api,country);
      return submitRenewal(api,f.store,newRenewalPending('A',payload,key),payload);
    };
    for(const purpose of REQUIRED_CONSENT_PURPOSES) {
      const state=readingState(country,false);const item=state.states.find(item=>item.purpose===purpose);item.effective=false;item.status='withdrawn';item.latest_event.action='withdraw';
      await assert.rejects(()=>send(state),failure=>failure.response.status===403&&failure.response.data.detail.missing_purposes.includes(purpose));
    }
    await assert.rejects(()=>send({...readingState(country),available:false}));
    assert.equal(posts,0);assert.equal(await readRenewalPending(f.store,'A'),null);
    await send(readingState(country,false));assert.equal(posts,1,'Optional device consent must not gate a renewal');
  }
});
test('fresh renewal consent preflight rejects another market, an unknown result, and late authority after owner change',async()=>{
  await assert.rejects(()=>requireCurrentCareConsent({get:async()=>({data:readingState('PT')})},'AO'));
  await assert.rejects(()=>requireCurrentCareConsent({get:async()=>{throw new Error('offline');}},'AO'),/offline/);
  let current=true;const delayed=deferred();let reads=0;
  const work=requireCurrentCareConsent({get:()=>{reads++;return delayed.promise;}},'AO',()=>{if(!current)throw new Error('changed');});
  assert.equal(reads,1);current=false;delayed.resolve({data:readingState('AO')});await assert.rejects(()=>work,/changed/);
  await assert.rejects(()=>requireCurrentCareConsent({get:async()=>assert.fail('No request after owner change')},'AO',()=>{throw new Error('changed');}),/changed/);
});
test('session change during secure storage prevents POST and matching cleanup cannot remove a newer UUID',async()=>{
  const f=storage();let current=true;const delayed=deferred();let writing=false;
  const store={...f.store,setItemAsync:async(k,v)=>{writing=true;await delayed.promise;await f.store.setItemAsync(k,v);}};
  const work=submitRenewal({get:async()=>assert.fail(),post:async()=>assert.fail('No request under replacement account')},store,pending(),body,()=>{if(!current)throw new Error('changed');}).catch(error=>error);
  await until(()=>writing);current=false;delayed.resolve();assert.match((await work).message,/changed/);
  const newer=newRenewalPending('A',body,'22222222-2222-4222-8222-222222222222');f.values.set(renewalStorageKey('A'),JSON.stringify(newer));
  assert.equal(await clearRenewalPending(f.store,pending()),false);assert.deepEqual(await readRenewalPending(f.store,'A'),newer);
});
test('current doctors must match the selected market; missing country or verification never becomes an option',()=>{
  const doctor={id:'doctor-A',display_name:'Test doctor',title:null,specialization:'clinica_geral',practice_country:'AO',verification_status:'verified'};
  assert.equal(parseRenewalDoctors([doctor],'AO').length,1);
  for(const patch of [{practice_country:null},{practice_country:'PT'},{verification_status:'pending'}])assert.throws(()=>parseRenewalDoctors([{...doctor,...patch}],'AO'));
});
test('history allowlist preserves actual decisions and nullable legacy scope without rendering clinician risk enrichment',()=>{
  const legacy=row({country:null,consent_language:null,request_key:null,decision_state:'legacy_review_required',risk_alert:'PRIVATE',patient_name:'PRIVATE',allergies:['PRIVATE']});
  const result=parseRenewal(legacy);assert.equal(result.country,null);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|risk_alert|allergies|patient_name/);
  assert.throws(()=>parseRenewal({...legacy,created_at:'2026-10-04'}));assert.throws(()=>parseRenewal({...legacy,status:'approve'}));
  assert.throws(()=>parseRenewalPage(page([row(),row()])));assert.throws(()=>parseRenewalPage(page([],'same'),'same'));
  assert.equal(mergeRenewalHistory([row({revision:1,status:'approved'})],[row()])[0].status,'approved');
});
test('history keeps rows on transient failure, freezes expired cursor continuation and ignores late pages after owner replacement',async()=>{
  let state;let denied=0;const pager=createRenewalHistory(value=>{state=value;},()=>{denied++;pager.clearAccess();});pager.activate('A');
  await pager.load({get:async()=>({data:page([row()],'next')})});
  await pager.load({get:async()=>{throw new Error('offline');}},true);assert.equal(state.items.length,1);assert.equal(state.cursor,'next');
  await pager.load({get:async()=>{throw{response:{status:422}};}},true);assert.equal(state.restartRequired,true);assert.equal(state.items.length,1);
  const late=deferred();const request=pager.load({get:()=>late.promise});pager.activate('B');late.resolve({data:page()});await request;assert.equal(state.items.length,0);
  await pager.load({get:async()=>{throw{response:{status:403}};}});assert.equal(denied,1);assert.equal(state.accessLost,true);assert.equal(state.items.length,0);
});
test('bounded Home existence check does not claim that historical decisions are pending or count the whole history',async()=>{
  let path;assert.equal(await loadRenewalPresence({get:async requested=>{path=requested;return{data:page([row({status:'approved',revision:1})],'next')};}}),true);
  assert.equal(path,'/api/v1/prescription-requests/page?limit=1');assert.equal(await loadRenewalPresence({get:async()=>({data:page([])})}),false);
  assert.equal(renewalAccessLost({response:{status:403,data:{detail:{code:'consent_required'}}}}),false);
});
