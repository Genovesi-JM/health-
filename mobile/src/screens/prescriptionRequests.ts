export type RenewalCountry = 'AO' | 'PT';
export type RenewalPayload = { doctor_id: string; country: RenewalCountry; consent_language: 'pt'; medication_name: string; dose: string | null; frequency: string | null; reason: string | null };
export type RenewalPending = { ownerId: string; key: string; payloadHash: string; country: RenewalCountry; consent_language: 'pt'; doctor_id: string };
export type RenewalDoctor = { id: string; display_name: string | null; title: string | null; specialization: string; practice_country: RenewalCountry };
export type RenewalRequest = {
  id: string; patient_id: string; doctor_id: string; medication_name: string; dose: string | null; frequency: string | null; reason: string | null;
  status: 'pending' | 'approved' | 'adjusted' | 'consult_requested' | 'exams_requested' | 'rejected';
  doctor_note: string | null; adjusted_dose: string | null; adjusted_frequency: string | null;
  created_at: string; decided_at: string | null; country: RenewalCountry | null; consent_language: string | null; request_key: string | null;
  revision: number; decision_id: string | null; standalone_prescription_id: string | null;
  decision_state: 'pending' | 'decided' | 'legacy_review_required'; doctor_name: string | null;
};
export type RenewalPage = { items: RenewalRequest[]; next_cursor: string | null };
export type RenewalStorage = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> };
export type RenewalApi = { get(path: string): Promise<{ data: unknown }>; post(path: string, body: unknown, config: { headers: Record<string, string> }): Promise<{ data: unknown }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = /^[0-9a-f]{64}$/;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 256): value is string => typeof value === 'string' && !!value && value.length <= max;
const nullableText = (value: unknown, max = 10000): value is string | null => value === null || typeof value === 'string' && value.length <= max;
const utc = (value: unknown): value is string => typeof value === 'string' && /(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value));
export const renewalCountry = (value: unknown): value is RenewalCountry => value === 'AO' || value === 'PT';
const invalid = (): never => { throw new Error('Não foi possível verificar o pedido de renovação. Atualize antes de continuar.'); };
export const RENEWAL_STATUS: Record<RenewalRequest['status'], string> = { pending: 'A aguardar análise médica', approved: 'Pedido aprovado pelo médico', adjusted: 'Pedido ajustado pelo médico', consult_requested: 'Consulta solicitada pelo médico', exams_requested: 'Exames solicitados pelo médico', rejected: 'Pedido recusado pelo médico' };
export const renewalCountryName = (value: string | null) => value === 'AO' ? 'Angola' : value === 'PT' ? 'Portugal' : 'País não registado';

/** SHA-256 of UTF-8 text for local request equality only. The server independently
 * verifies the authenticated UUID and validated body; this is not authorization. */
export function renewalSha256(input: string): string {
  const bytes: number[] = [];
  for (const character of input) {
    let cp = character.codePointAt(0)!;
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | cp >>> 6, 0x80 | cp & 63);
    else if (cp < 0x10000) bytes.push(0xe0 | cp >>> 12, 0x80 | cp >>> 6 & 63, 0x80 | cp & 63);
    else bytes.push(0xf0 | cp >>> 18, 0x80 | cp >>> 12 & 63, 0x80 | cp >>> 6 & 63, 0x80 | cp & 63);
  }
  const bits = bytes.length * 8; bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bits / 0x100000000), low = bits >>> 0;
  for (const word of [high, low]) for (let shift = 24; shift >= 0; shift -= 8) bytes.push(word >>> shift & 255);
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotate = (value: number, count: number) => value >>> count | value << 32 - count;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i++) { const n = offset + i * 4; w[i] = bytes[n] << 24 | bytes[n + 1] << 16 | bytes[n + 2] << 8 | bytes[n + 3]; }
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rotate(a,7) ^ rotate(a,18) ^ a >>> 3) + w[i - 7] + (rotate(b,17) ^ rotate(b,19) ^ b >>> 10)) | 0; }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (j + (rotate(e,6) ^ rotate(e,11) ^ rotate(e,25)) + (e & f ^ ~e & g) + k[i] + w[i]) | 0;
      const t2 = ((rotate(a,2) ^ rotate(a,13) ^ rotate(a,22)) + (a & b ^ a & c ^ b & c)) | 0;
      j=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    const end=[a,b,c,d,e,f,g,j];for(let i=0;i<8;i++)h[i]=(h[i]+end[i])|0;
  }
  return h.map(value => (value >>> 0).toString(16).padStart(8,'0')).join('');
}
export function renewalPayload(input: { doctor_id: string; country: RenewalCountry; medication_name: string; dose: string; frequency: string; reason: string }): RenewalPayload {
  if (!text(input.doctor_id,128) || !renewalCountry(input.country)) return invalid();
  const medication_name = input.medication_name.trim(), dose = input.dose.trim() || null, frequency = input.frequency.trim() || null, reason = input.reason.trim() || null;
  if (!medication_name || medication_name.length > 300 || dose && dose.length > 100 || frequency && frequency.length > 100 || reason && reason.length > 4000) throw new Error('Indique o medicamento (até 300 caracteres), dose e frequência (até 100 cada) e motivo (até 4000).');
  return { doctor_id: input.doctor_id, country: input.country, consent_language: 'pt', medication_name, dose, frequency, reason };
}
export function renewalPayloadHash(payload: RenewalPayload): string {
  return renewalSha256(JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0))));
}
export function newRenewalPending(ownerId: string, payload: RenewalPayload, key?: string): RenewalPending {
  const generated = key ?? globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => { const n=Math.floor(Math.random()*16);return (char==='x'?n:(n&3)|8).toString(16); });
  return validatePending({ ownerId, key: generated, payloadHash: renewalPayloadHash(payload), country: payload.country, consent_language: payload.consent_language, doctor_id: payload.doctor_id }, ownerId);
}
function validatePending(value: unknown, owner: string): RenewalPending {
  const data = object(value);
  if (!text(owner,128) || data.ownerId !== owner || typeof data.key !== 'string' || !uuid.test(data.key) || typeof data.payloadHash !== 'string' || !hash.test(data.payloadHash)
    || !renewalCountry(data.country) || data.consent_language !== 'pt' || !text(data.doctor_id,128)
    || Object.keys(data).sort().join(',') !== 'consent_language,country,doctor_id,key,ownerId,payloadHash') return invalid();
  return { ownerId: owner, key: data.key, payloadHash: data.payloadHash, country: data.country, consent_language: 'pt', doctor_id: data.doctor_id };
}
export function renewalMatches(pending: RenewalPending, payload: RenewalPayload): boolean {
  return pending.country === payload.country && pending.consent_language === payload.consent_language && pending.doctor_id === payload.doctor_id && pending.payloadHash === renewalPayloadHash(payload);
}
export function renewalStorageKey(owner: string): string { if (!text(owner,128)) return invalid(); return `kaya_renewal_${Array.from(owner).map(character=>character.codePointAt(0)!.toString(16)).join('_')}`; }
const queues = new WeakMap<RenewalStorage, Map<string, Promise<unknown>>>();
function serialize<T>(storage: RenewalStorage, key: string, operation: () => Promise<T>): Promise<T> {
  let queue=queues.get(storage);if(!queue){queue=new Map();queues.set(storage,queue);}
  const result=(queue.get(key)??Promise.resolve()).catch(()=>undefined).then(operation);queue.set(key,result);
  void result.finally(()=>{if(queue!.get(key)===result)queue!.delete(key);}).catch(()=>undefined);return result;
}
async function readStored(storage: RenewalStorage, owner: string): Promise<RenewalPending | null> {
  const raw = await storage.getItemAsync(renewalStorageKey(owner));if(raw===null)return null;
  if(raw.length>1024)return invalid();return validatePending(JSON.parse(raw),owner);
}
export function readRenewalPending(storage: RenewalStorage, owner: string): Promise<RenewalPending | null> { return serialize(storage,renewalStorageKey(owner),()=>readStored(storage,owner)); }
export async function clearRenewalPending(storage: RenewalStorage, pending: RenewalPending, assertCurrent=()=>{}): Promise<boolean> {
  return serialize(storage,renewalStorageKey(pending.ownerId),async()=>{assertCurrent();const saved=await readStored(storage,pending.ownerId);assertCurrent();if(saved?.key!==pending.key)return false;await storage.deleteItemAsync(renewalStorageKey(pending.ownerId));return true;});
}
export function parseRenewal(value: unknown): RenewalRequest {
  const data=object(value);
  if(!['id','patient_id','doctor_id'].every(key=>text(data[key],128)) || !text(data.medication_name,300) || !Object.hasOwn(RENEWAL_STATUS,String(data.status))
    || !['dose','frequency','reason','doctor_note','adjusted_dose','adjusted_frequency','decision_id','standalone_prescription_id','doctor_name'].every(key=>nullableText(data[key]))
    || !utc(data.created_at) || !(data.decided_at===null||utc(data.decided_at)) || !(data.country===null||renewalCountry(data.country))
    || !(data.consent_language===null||text(data.consent_language,10)) || !(data.request_key===null||typeof data.request_key==='string'&&uuid.test(data.request_key))
    || !Number.isSafeInteger(data.revision) || Number(data.revision)<0 || !['pending','decided','legacy_review_required'].includes(String(data.decision_state))) return invalid();
  return Object.fromEntries(['id','patient_id','doctor_id','medication_name','dose','frequency','reason','status','doctor_note','adjusted_dose','adjusted_frequency','created_at','decided_at','country','consent_language','request_key','revision','decision_id','standalone_prescription_id','decision_state','doctor_name'].map(key=>[key,data[key]])) as RenewalRequest;
}
export function verifiedRenewal(value: unknown, pending: RenewalPending): RenewalRequest {
  const row=parseRenewal(value);
  if(row.request_key!==pending.key || row.doctor_id!==pending.doctor_id || row.country!==pending.country || row.consent_language!==pending.consent_language) return invalid();
  const payload:RenewalPayload={doctor_id:row.doctor_id,country:pending.country,consent_language:'pt',medication_name:row.medication_name,dose:row.dose,frequency:row.frequency,reason:row.reason};
  if(!renewalMatches(pending,payload))return invalid();return row;
}
export function renewalNotCommitted(failure: unknown): boolean {
  const response=(failure as {response?:{status?:number;data?:{detail?:{code?:string;request_key_committed?:unknown}}}})?.response;
  return response?.status===409&&response.data?.detail?.code==='renewal_not_committed'&&response.data.detail.request_key_committed===false;
}
export async function submitRenewal(api: RenewalApi, storage: RenewalStorage, input: RenewalPending, payload: RenewalPayload, assertCurrent=()=>{}): Promise<RenewalRequest> {
  const pending=validatePending(input,input.ownerId);
  if(!renewalMatches(pending,payload))throw new Error('Os dados não correspondem ao pedido guardado. Reponha exatamente o medicamento, dose, frequência e motivo originais; não foi enviado outro pedido.');
  await serialize(storage,renewalStorageKey(pending.ownerId),async()=>{assertCurrent();const saved=await readStored(storage,pending.ownerId);assertCurrent();
    if(saved&&JSON.stringify(saved)!==JSON.stringify(pending))throw new Error('Recupere primeiro o pedido anterior.');
    await storage.setItemAsync(renewalStorageKey(pending.ownerId),JSON.stringify(pending));assertCurrent();});
  let result:RenewalRequest;
  try{assertCurrent();const response=await api.post('/api/v1/prescription-requests',payload,{headers:{'Idempotency-Key':pending.key}});assertCurrent();result=verifiedRenewal(response.data,pending);}
  catch(failure){assertCurrent();if(renewalNotCommitted(failure))await clearRenewalPending(storage,pending,assertCurrent);throw failure;}
  try{await clearRenewalPending(storage,pending,assertCurrent);}catch{/* Keep reference if cleanup fails; a later lookup can confirm it again. */}assertCurrent();return result;
}
export async function recoverRenewal(api: Pick<RenewalApi,'get'>,storage:RenewalStorage,pending:RenewalPending,assertCurrent=()=>{}):Promise<RenewalRequest|null>{
  assertCurrent();try{const response=await api.get(`/api/v1/prescription-requests/requests/${encodeURIComponent(pending.key)}`);assertCurrent();const result=verifiedRenewal(response.data,pending);
    try{await clearRenewalPending(storage,pending,assertCurrent);}catch{/* Retain minimal recovery identity. */}assertCurrent();return result;
  }catch(failure){assertCurrent();if((failure as {response?:{status?:number}})?.response?.status===404)return null;throw failure;}
}
export function renewalDoctorsPath(country: RenewalCountry): string { if(!renewalCountry(country))return invalid();return `/api/v1/doctors/?country=${country}`; }
export function parseRenewalDoctors(value:unknown,country:RenewalCountry):RenewalDoctor[]{
  if(!Array.isArray(value))return invalid();const rows:RenewalDoctor[]=value.map(item=>{const data=object(item);
    if(!text(data.id,128)||data.practice_country!==country||data.verification_status!=='verified'||!text(data.specialization)||!nullableText(data.display_name,300)||!nullableText(data.title,100))return invalid();
    return {id:data.id,display_name:data.display_name as string|null,title:data.title as string|null,specialization:data.specialization,practice_country:country};});
  if(new Set(rows.map(row=>row.id)).size!==rows.length)return invalid();return rows;
}
export function renewalPagePath(cursor:string|null=null,limit=20):string{return `/api/v1/prescription-requests/page?limit=${limit}`+(cursor?`&cursor=${encodeURIComponent(cursor)}`:'');}
export function parseRenewalPage(value:unknown,cursor:string|null=null):RenewalPage{
  const data=object(value);if(!Array.isArray(data.items)||data.items.length>100||!(data.next_cursor===null||text(data.next_cursor,4096))||cursor&&data.next_cursor===cursor)return invalid();
  const items=data.items.map(parseRenewal);if(new Set(items.map(item=>item.id)).size!==items.length)return invalid();return {items,next_cursor:data.next_cursor as string|null};
}
export async function loadRenewalPresence(api:Pick<RenewalApi,'get'>):Promise<boolean>{
  const response=await api.get(renewalPagePath(null,1));return parseRenewalPage(response.data).items.length>0;
}
export function mergeRenewalHistory(previous:RenewalRequest[],incoming:RenewalRequest[]):RenewalRequest[]{
  const rows=new Map(previous.map(row=>[row.id,row]));for(const row of incoming){const old=rows.get(row.id);if(!old||row.revision>=old.revision)rows.set(row.id,row);}return [...rows.values()];
}
export function renewalAccessLost(failure:unknown):boolean{const r=(failure as {response?:{status?:number;data?:{detail?:{code?:string}}}})?.response;return r?.status===401||r?.status===403&&r.data?.detail?.code!=='consent_required';}
export function renewalError(failure:unknown,fallback:string):string{const detail=(failure as {response?:{data?:{detail?:unknown}}})?.response?.data?.detail;
  if(typeof detail==='string')return detail;if(detail&&typeof detail==='object'&&'message'in detail&&typeof detail.message==='string')return detail.message;return failure instanceof Error?failure.message:fallback;}
export type RenewalHistoryState = { items:RenewalRequest[]; cursor:string|null; loading:boolean; loadingMore:boolean; loaded:boolean; restartRequired:boolean; error:string; accessLost:boolean };
export const emptyRenewalHistory=():RenewalHistoryState=>({items:[],cursor:null,loading:false,loadingMore:false,loaded:false,restartRequired:false,error:'',accessLost:false});
export function createRenewalHistory(publish:(state:RenewalHistoryState)=>void,onDenied:()=>void){
  let state=emptyRenewalHistory();let generation=0;let active=false;let owner='';
  const set=(next:RenewalHistoryState)=>{state=next;publish(next);};
  return {
    snapshot:()=>state,
    activate(scope:string){active=true;if(scope!==owner){owner=scope;generation++;set(emptyRenewalHistory());}},
    deactivate(){active=false;generation++;},
    clearAccess(){generation++;set({...emptyRenewalHistory(),accessLost:true,error:'O acesso ao histórico mudou. Atualize explicitamente para verificar o acesso.'});},
    accept(row:RenewalRequest){if(active){generation++;set({...state,items:mergeRenewalHistory(state.items,[row]).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)),loading:false,loadingMore:false});}},
    async load(api:Pick<RenewalApi,'get'>,append=false){
      if(!active||append&&(state.loading||state.loadingMore||state.restartRequired||!state.cursor))return;
      const sequence=++generation;const requestedOwner=owner;const cursor=append?state.cursor:null;set({...state,loading:!append,loadingMore:append,error:''});
      try{const response=await api.get(renewalPagePath(cursor));const page=parseRenewalPage(response.data,cursor);if(!active||sequence!==generation||requestedOwner!==owner)return;
        set({items:mergeRenewalHistory(append?state.items:[],page.items),cursor:page.next_cursor,loading:false,loadingMore:false,loaded:true,restartRequired:false,error:'',accessLost:false});
      }catch(failure){if(!active||sequence!==generation||requestedOwner!==owner)return;
        if(renewalAccessLost(failure)){onDenied();return;}
        const status=(failure as {response?:{status?:number}})?.response?.status;
        set({...state,loading:false,loadingMore:false,restartRequired:state.restartRequired||append&&status===422,error:append&&status===422?'A continuação expirou. Recomece a lista; os registos carregados foram mantidos.':'Não foi possível atualizar o histórico. Os registos carregados foram mantidos.'});
      }
    },
  };
}
