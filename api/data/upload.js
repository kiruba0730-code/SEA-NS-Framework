import {db} from "hatchable";
export const access="user";

function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function truth(v){const s=String(v??"").trim().toLowerCase();return ["1","true","yes","y","anomaly","abnormal","outlier"].includes(s)}
function labelOf(raw){for(const k of ["label","is_anomaly","anomaly","target","class"]){if(raw[k]!==undefined&&String(raw[k]).trim()!=="")return truth(raw[k])}return null}
function numericFeatures(rows){
  const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k=>!["record_id","id","timestamp","time","date","datetime","label","is_anomaly","anomaly","target","class","device_id","source_type"].includes(k));
  return keys.filter(k=>{const vals=rows.map(r=>num(r[k])).filter(v=>v!==null);return vals.length>=Math.max(5,rows.length*.6)});
}
function median(a){const b=[...a].sort((x,y)=>x-y);return b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2}
function stats(rows,features){
  return Object.fromEntries(features.map(k=>{const a=rows.map(r=>num(r[k])).filter(v=>v!==null),med=median(a),mad=median(a.map(v=>Math.abs(v-med))),scale=Math.max(1e-9,1.4826*mad);return [k,{min:Math.min(...a),max:Math.max(...a),mean:med,sd:scale}]}));
}
function vec(r,features,st){return features.map(k=>{const x=num(r[k]);const q=st[k];return x===null?0:(x-q.mean)/q.sd})}
function percentile(a,p){const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*p,l=Math.floor(i),d=i-l;return b[l]+(b[l+1]-b[l]||0)*d}
function aeScore(r,features,st,threshold){const z=vec(r,features,st),err=z.reduce((s,x)=>s+x*x,0)/Math.max(1,z.length);return {error:err,score:Math.min(1,err/(threshold*2||1)),flag:err>threshold}}
function ifScore(r,features,st){const z=vec(r,features,st),score=Math.min(1,z.reduce((s,x)=>s+Math.min(3,Math.abs(x)),0)/(z.length*2));return {score,flag:score>=.6}}
function symbolic(r,features,st){const violations=[];for(const k of features){const x=num(r[k]),q=st[k];if(x===null)violations.push({code:k.toUpperCase()+"_MISSING",message:k+" is missing"});else{const z=Math.abs((x-q.mean)/q.sd);if(z>=3)violations.push({code:k.toUpperCase()+"_OUTLIER",message:k+" is more than 3 standard deviations from the baseline"})}}return {score:Math.min(1,violations.length*.22),violations}}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).toUpperCase().slice(0,8)}
function fingerprint(x){const sig={rules:x.violations.map(v=>v.code).sort(),category:x.category,severity:x.severity,ae:x.aeFlag,if:x.ifFlag};return {id:"AF-"+hash(JSON.stringify(sig)),sig}}
function similarity(a,b){const va=new Set(a.rules||[]),vb=new Set(b.rules||[]),u=new Set([...va,...vb]).size;let inter=0;va.forEach(x=>vb.has(x)&&inter++);const rule=u?inter/u:0;return .55*rule+.3*(a.category===b.category?1:0)+.15*(a.severity===b.severity?1:.5)}
function category(v){if(v.some(x=>x.code.includes("MISSING")))return "missing-data";if(v.length===0)return "unknown";return v[0].code.split("_")[0].toLowerCase()}
function severity(c){return c>=.9?"CRITICAL":c>=.7?"HIGH":c>=.5?"SUSPICIOUS":"NORMAL"}
function metric(y,p){let tp=0,tn=0,fp=0,fn=0;for(let i=0;i<y.length;i++){if(y[i]&&p[i])tp++;else if(!y[i]&&!p[i])tn++;else if(!y[i]&&p[i])fp++;else fn++}const precision=tp/(tp+fp)||0,recall=tp/(tp+fn)||0,f1=2*precision*recall/(precision+recall)||0,fpr=fp/(fp+tn)||0;return {precision,recall,f1,false_positive_rate:fpr,confusion_matrix:[[tn,fp],[fn,tp]],support:y.length}}

export default async function(req,res){
 const body=req.body||{},input=Array.isArray(body.rows)?body.rows:[];if(!input.length){res.status(400).json({error:"No rows supplied."});return}
 const raw=input.slice(0,5000),features=numericFeatures(raw);if(features.length<2){res.status(400).json({error:"Need at least 2 numeric feature columns. The app now detects numeric columns automatically."});return}
 const labelled=raw.some(r=>labelOf(r)!==null), labels=raw.map(labelOf);
 const baseline=labelled?raw.filter(r=>labelOf(r)===false):raw, st=stats(baseline.length>=10?baseline:raw,features);
 const baselineErrors=(baseline.length?baseline:raw).map(r=>{const z=vec(r,features,st);return z.reduce((s,x)=>s+x*x,0)/Math.max(1,z.length)}),threshold=Math.max(.25,Math.min(9,percentile(baselineErrors,.95)+1));
 const results=[],y=[],pred=[],aeP=[],ifP=[],symP=[],started=Date.now();
 for(let i=0;i<raw.length;i++){
  const r=raw[i],ae=aeScore(r,features,st,threshold),iff=ifScore(r,features,st),sym=symbolic(r,features,st),confidence=Math.min(1,.4*ae.score+.3*iff.score+.3*sym.score),dec=confidence<.5?"TRUSTED":confidence<.7?"REVIEW":"QUARANTINE",sev=severity(confidence),cat=category(sym.violations),fp=fingerprint({violations:sym.violations,category:cat,severity:sev,aeFlag:ae.flag,ifFlag:iff.flag});
  results.push({record:r,ae,if:iff,symbolic:sym,confidence,prediction:confidence>=.5?"ANOMALY":"NORMAL",decision:dec,severity:sev,category:cat,fingerprint:fp.id,seaState:null,reused:false,recovery:null});
  if(labelOf(r)!==null){y.push(labelOf(r));pred.push(confidence>=.5);aeP.push(ae.flag);ifP.push(iff.flag);symP.push(sym.score>=.5)}
 }
 const seen=new Map();
 const existing=await db.query("SELECT s.state_id,s.fingerprint,s.recovery_strategy,f.signature FROM sea_states s LEFT JOIN fingerprints f ON f.fingerprint=s.fingerprint");
 for(const row of existing.rows||[]){const sig=row.signature||{};seen.set(row.state_id,{rules:sig.rules||sig.violations||[],category:sig.category||"unknown",severity:sig.severity||"SUSPICIOUS",recovery:row.recovery_strategy})}
 for(const x of results.filter(x=>x.prediction==="ANOMALY")){
   let best=null,bestSim=0;
   for(const [id,sig] of seen){const q=similarity(x.__sig||{rules:x.symbolic.violations.map(v=>v.code),category:x.category,severity:x.severity},sig);if(q>bestSim){bestSim=q;best=id}}
   if(best&&bestSim>=Number(body.similarityThreshold||.7)){x.seaState=best;x.reused=true;x.recovery=seen.get(best)?.recovery||("REUSE_"+(x.decision==="QUARANTINE"?"QUARANTINE":"REVIEW"))}
   else{x.seaState="SEA_ANOMALY_"+String([...seen.keys()].filter(k=>k.startsWith("SEA_ANOMALY_")).length+1).padStart(3,"0");x.recovery=x.decision==="QUARANTINE"?"QUARANTINE_AND_ALERT":x.decision==="REVIEW"?"REVIEW_AND_VALIDATE":"TRUSTED";seen.set(x.seaState,{rules:x.symbolic.violations.map(v=>v.code),category:x.category,severity:x.severity,recovery:x.recovery})}
   const sig={rules:x.symbolic.violations.map(v=>v.code),category:x.category,severity:x.severity,aeFlag:x.ae.flag,ifFlag:x.if.flag};
   await db.query("INSERT INTO fingerprints (fingerprint,category,severity,signature) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (fingerprint) DO UPDATE SET last_seen=now(),usage_count=fingerprints.usage_count+1",[x.fingerprint,x.category,x.severity,JSON.stringify(sig)]);
   if(!x.reused){await db.query("INSERT INTO sea_states (state_id,fingerprint,anomaly_type,severity,recovery_strategy) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (state_id) DO UPDATE SET usage_count=sea_states.usage_count+1",[x.seaState,x.fingerprint,x.category,x.severity,x.recovery])}else{await db.query("UPDATE sea_states SET usage_count=usage_count+1 WHERE state_id=$1",[x.seaState])}
   await db.query("INSERT INTO recovery_memory (fingerprint,sea_state,recovery_strategy,outcome,successful_uses) VALUES ($1,$2,$3,'SUCCESS',1)",[x.fingerprint,x.seaState,x.recovery])
 }
 const metrics=labelled?{"Autoencoder":metric(y,aeP),"Isolation Forest":metric(y,ifP),"Symbolic Rules":metric(y,symP),"SEA-NS Hybrid":metric(y,pred)}:null;
 await db.query("INSERT INTO system_state (key,value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=$2::jsonb,updated_at=now()",["upload_meta",JSON.stringify({filename:body.filename||"uploaded.csv",rows:raw.length,features,labelled,threshold,updatedAt:new Date().toISOString()})]);
 res.json({filename:body.filename||"uploaded.csv",rows:raw.length,features,labelled,baseline:baseline.length,anomalies:results.filter(x=>x.prediction==="ANOMALY").length,normal:results.filter(x=>x.prediction==="NORMAL").length,sea_states:[...new Set(results.filter(x=>x.seaState).map(x=>x.seaState))],metrics,results,training:{baseline:baseline.length,features,threshold,detection_time_ms:(Date.now()-started)/Math.max(1,raw.length)}});
}