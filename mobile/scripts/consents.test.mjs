import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_CONSENT_PURPOSES, parseConsentCatalog, parseConsentState, parseConsentHistory, consentReference,
  newConsentAttempt, consentStorageKey, readConsentAttempt, submitConsent, recoverConsent, clearConsentAttempt, parseConsentReceipt, observeConsentRead,
} from '../src/screens/consents.ts';
const key='11111111-1111-4111-8111-111111111111';
const document=(purpose=REQUIRED_CONSENT_PURPOSES[0],index=0)=>({id:`doc-${index}`,document_key:`AO:pt:${purpose}`,version:1,content_hash:'a'.repeat(64),country:'AO',language:'pt',purpose,kind:'necessary_care',required:REQUIRED_CONSENT_PURPOSES.includes(purpose),title:`Test fixture ${purpose}`,content:'Exact synthetic text\n<b>not HTML</b>',approved_source:'synthetic-test-approval',effective_from:'2026-10-01T00:00:00Z',effective_to:null});
const docs=REQUIRED_CONSENT_PURPOSES.map(document);
const catalog=(overrides={})=>({country:'AO',language:'pt',available:true,required_purposes:[...REQUIRED_CONSENT_PURPOSES],unavailable_purposes:[],documents:docs,...overrides});
const event=(overrides={})=>({...consentReference(docs[0]),id:'event-1',sequence:1,purpose:docs[0].purpose,action:'grant',created_at:'2026-10-04T10:00:00Z',request_key:key,...overrides});
const state=(last=null,revision=last?.sequence??0)=>({country:'AO',language:'pt',available:true,revision,required_purposes:[...REQUIRED_CONSENT_PURPOSES],states:docs.map(doc=>({purpose:doc.purpose,status:last?.purpose===doc.purpose?(last.action==='grant'?'granted':last.action==='withdraw'?'withdrawn':'refused'):'missing',effective:last?.purpose===doc.purpose&&last.action==='grant',document:doc,latest_event:last?.purpose===doc.purpose?last:null}))});
const attempt=(action='grant',revision=0)=>newConsentAttempt('A',consentReference(docs[0]),action,revision,key);
const receipt=(last=event(),current=state(last))=>({event:last,revision:current.revision,state:current});
function fixture(){const values=new Map();return {values,storage:{getItemAsync:async key=>values.get(key)??null,setItemAsync:async(key,value)=>{values.set(key,value);},deleteItemAsync:async key=>{values.delete(key);}}};}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(done=>setImmediate(done));}assert.fail('Checkpoint not reached');}

test('an empty unapproved runtime catalog remains unavailable without fabricated texts or defaults',()=>{
  const unavailable=catalog({available:false,documents:[],unavailable_purposes:[...REQUIRED_CONSENT_PURPOSES]});
  assert.equal(parseConsentCatalog(unavailable,'AO').available,false);
  assert.deepEqual(parseConsentCatalog(unavailable,'AO').documents,[]);
  assert.throws(()=>parseConsentCatalog({...unavailable,available:true},'AO'));
  assert.throws(()=>parseConsentCatalog(catalog(),'PT'));
});
test('plain exact text and optional documents are preserved while invalid approval/hash/time/scope data fails closed',()=>{
  const optional=document('research',5);optional.required=false;
  const parsed=parseConsentCatalog(catalog({documents:[...docs,optional]}),'AO');
  assert.equal(parsed.documents[0].content,'Exact synthetic text\n<b>not HTML</b>');assert.equal(parsed.documents.at(-1).required,false);
  for(const patch of [{approved_source:''},{content_hash:'bad'},{effective_from:'2026-10-01'},{language:'en'},{version:'1'},{required:false}]){
    assert.throws(()=>parseConsentCatalog(catalog({documents:[{...docs[0],...patch},...docs.slice(1)]}),'AO'));
  }
});
test('a legacy or mismatched declaration is never effective exact-text consent',()=>{
  const valid=state(event());assert.equal(parseConsentState(valid,'AO').states[0].effective,true);
  for(const patch of [{latest_event:null},{status:'missing'},{latest_event:event({content_hash:'b'.repeat(64)})},{latest_event:event({version:2})}]){
    assert.throws(()=>parseConsentState({...valid,states:[{...valid.states[0],...patch},...valid.states.slice(1)]},'AO'));
  }
});
test('retired documents retain prior event evidence for explicit withdrawal without treating it as current approval',()=>{
  const retired=state(event());retired.available=false;retired.states[0]={...retired.states[0],document:null,status:'unavailable',effective:false};
  const parsed=parseConsentState(retired,'AO');assert.deepEqual(consentReference(parsed.states[0].latest_event),consentReference(docs[0]));
  assert.equal(newConsentAttempt('A',consentReference(parsed.states[0].latest_event),'withdraw',1,key).payload.expected_revision,1);
});
test('history validates UTC and cursor progress and does not duplicate an event within a page',()=>{
  assert.equal(parseConsentHistory({items:[event()],next_cursor:'next'}).items.length,1);
  assert.throws(()=>parseConsentHistory({items:[event(),event()],next_cursor:null}));
  assert.throws(()=>parseConsentHistory({items:[event({created_at:'2026-10-04T10:00:00'})],next_cursor:null}));
  assert.throws(()=>parseConsentHistory({items:[],next_cursor:'same'},'same'));
});
test('secure recovery persists only exact identifiers and action before POST and cannot silently replace unresolved decisions',async()=>{
  const {storage,values}=fixture();const sent=[];const first=attempt();
  const api={get:async()=>assert.fail(),post:async(path,body,options)=>{assert.deepEqual(JSON.parse(values.get(consentStorageKey('A'))),first);sent.push({path,body,options});throw new Error('lost');}};
  await assert.rejects(()=>submitConsent(api,storage,first),/lost/);
  const restored=await readConsentAttempt(storage,'A');assert.deepEqual(restored,first);assert.equal(await readConsentAttempt(storage,'B'),null);
  await assert.rejects(()=>submitConsent(api,storage,{...first,key:'22222222-2222-4222-8222-222222222222'}),/por confirmar/);
  await assert.rejects(()=>submitConsent(api,storage,restored),/lost/);assert.deepEqual(sent[0],sent[1]);
  assert.deepEqual(Object.keys(restored.payload).sort(),['action','content_hash','country','document_id','expected_revision','language','version']);
});
test('every uncertain failure retains key/body, including later auth, schema and generic conflict responses',async()=>{
  const {storage}=fixture();for(const status of [undefined,401,403,404,409,422,500]){
    await assert.rejects(()=>submitConsent({get:async()=>assert.fail(),post:async()=>{throw status?{response:{status}}:new Error('offline');}},storage,attempt()));
    assert.deepEqual(await readConsentAttempt(storage,'A'),attempt());
  }
});
test('only structured locked noncommit proof clears the pending UUID',async()=>{
  const {storage}=fixture();await assert.rejects(()=>submitConsent({get:async()=>assert.fail(),post:async()=>{throw {response:{status:409,data:{detail:{code:'consent_not_committed',request_key_committed:false,message:'Changed revision'}}}};}},storage,attempt()));
  assert.equal(await readConsentAttempt(storage,'A'),null);
});
test('exact retry after withdrawal returns original event plus current withdrawn state without regranting',async()=>{
  const {storage}=fixture();const withdrawal=event({id:'event-2',sequence:2,action:'withdraw',request_key:'22222222-2222-4222-8222-222222222222'});const result=receipt(event(),state(withdrawal));
  const observed=await submitConsent({get:async()=>assert.fail(),post:async()=>({data:result})},storage,attempt());
  assert.equal(observed.event.action,'grant');assert.equal(observed.revision,2);assert.equal(observed.state.states[0].effective,false);assert.equal(await readConsentAttempt(storage,'A'),null);
});
test('404 lookup preserves uncertainty; positive recovery needs no new POST or current catalog availability',async()=>{
  const {storage,values}=fixture();values.set(consentStorageKey('A'),JSON.stringify(attempt()));
  const api={post:async()=>assert.fail('Lookup must not write'),get:async()=>{throw {response:{status:404}};}};
  assert.equal(await recoverConsent(api,storage,attempt()),null);assert.notEqual(await readConsentAttempt(storage,'A'),null);
  const unavailable=state(event());unavailable.available=false;unavailable.states[0]={...unavailable.states[0],status:'unavailable',effective:false,document:null};
  api.get=async()=>({data:receipt(event(),unavailable)});assert.equal((await recoverConsent(api,storage,attempt())).state.available,false);assert.equal(await readConsentAttempt(storage,'A'),null);
});
test('wrong response key or action never acknowledges or clears an uncertain decision',async()=>{
  const {storage}=fixture();for(const patch of [{request_key:'22222222-2222-4222-8222-222222222222'},{action:'refuse'},{version:2}]){
    await assert.rejects(()=>submitConsent({get:async()=>assert.fail(),post:async()=>({data:receipt(event(patch),state())})},storage,attempt()));
    assert.notEqual(await readConsentAttempt(storage,'A'),null);
  }
});
test('an old successful response cannot clear a newer same-owner UUID',async()=>{
  const {storage,values}=fixture();const wait=deferred();const response=submitConsent({get:async()=>assert.fail(),post:async()=>wait.promise},storage,attempt());
  await until(()=>values.has(consentStorageKey('A')));const newer={...attempt(),key:'22222222-2222-4222-8222-222222222222'};values.set(consentStorageKey('A'),JSON.stringify(newer));
  wait.resolve({data:receipt()});await response;assert.deepEqual(await readConsentAttempt(storage,'A'),newer);assert.equal(await clearConsentAttempt(storage,attempt()),false);
});
test('account replacement while SecureStore waits prevents the chained POST with new credentials',async()=>{
  const {storage}=fixture();const gate=deferred();const write=storage.setItemAsync;let version=1;let waiting=false;
  storage.setItemAsync=async(...args)=>{waiting=true;await gate.promise;await write(...args);};
  const assertCurrent=()=>{if(version!==1)throw new Error('Session changed');};let calls=0;
  const response=submitConsent({get:async()=>assert.fail(),post:async()=>{calls++;return {data:receipt()};}},storage,attempt(),assertCurrent);
  await until(()=>waiting);version=2;gate.resolve();await assert.rejects(()=>response,/Session changed/);assert.equal(calls,0);
});
test('a failed SecureStore reserve prevents any request and malformed saved records fail closed',async()=>{
  const {storage,values}=fixture();storage.setItemAsync=async()=>{throw new Error('SecureStore unavailable');};
  await assert.rejects(()=>submitConsent({get:async()=>assert.fail(),post:async()=>assert.fail('Unsafe POST')},storage,attempt()),/SecureStore/);
  for(const value of ['bad-json',JSON.stringify({...attempt(),ownerId:'B'}),JSON.stringify({...attempt(),payload:{...attempt().payload,content:'Do not store text'}})]){
    values.set(consentStorageKey('A'),value);await assert.rejects(()=>readConsentAttempt(storage,'A'));
  }
});

test('one parallel access denial clears evidence immediately while a sibling is hung and its late success is ignored', async () => {
  const hung=deferred(); const deny=deferred(); let generation=1; let evidence=['old-record']; let denied=0; const ticket=generation;
  const current=()=>generation===ticket; const revoke=()=>{generation++;evidence=[];denied++;};
  const loaded=Promise.allSettled([observeConsentRead(hung.promise,current,revoke),observeConsentRead(deny.promise,current,revoke)]).then(results=>{if(current())evidence=results;});
  deny.resolve(Promise.reject({response:{status:403}}));await until(()=>denied===1);assert.deepEqual(evidence,[]);
  hung.resolve({data:'late record'});await loaded;assert.deepEqual(evidence,[]);assert.equal(denied,1);
});
test('transient parallel read failures preserve evidence and a blurred generation cannot publish a denial or stale success',async()=>{
  let active=true;let denied=0;await assert.rejects(()=>observeConsentRead(Promise.reject(new Error('offline')),()=>active,()=>{denied++;}));assert.equal(denied,0);
  active=false;await assert.rejects(()=>observeConsentRead(Promise.reject({response:{status:401}}),()=>active,()=>{denied++;}));assert.equal(denied,0);
});

test('personal history retains other languages and a cross-language denial overrides the PT grant without enabling another language action',()=>{
  const english=event({language:'en',action:'withdraw',sequence:2});
  assert.equal(parseConsentHistory({items:[english],next_cursor:null}).items[0].language,'en');
  const denied=state(english);const observed=parseConsentState(denied,'AO');
  assert.equal(observed.states[0].latest_event.language,'en');assert.equal(observed.states[0].status,'withdrawn');assert.equal(observed.states[0].effective,false);
  assert.throws(()=>parseConsentState({...denied,states:[{...denied.states[0],latest_event:{...english,action:'grant'}},...denied.states.slice(1)]},'AO'));
  assert.throws(()=>consentReference(english));
});
