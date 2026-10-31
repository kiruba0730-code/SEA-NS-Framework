import {db} from "hatchable";
export const access = 'user';
export const methods=['POST'];
export default async function(req,res){for(const t of ["recovery_memory","sea_transitions","sea_states","fingerprints","anomalies","records","system_state"])await db.query("DELETE FROM "+t);res.json({ok:true})}