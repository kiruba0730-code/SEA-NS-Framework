import {getState} from "../lib/engine.js";
export const access="user";
export async function GET(){
  const names=["Autoencoder","Isolation Forest","Symbolic Rules","SEA-NS Hybrid"];
  const out=[];
  for(const n of names){const x=await getState(`upload_metric_${n}`);if(x)out.push(x)}
  return out;
}