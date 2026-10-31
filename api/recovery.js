import {db} from "hatchable";
export const access = 'user';
export const methods=['GET'];
export default async function(req,res){const {rows}=await db.query("SELECT * FROM recovery_memory ORDER BY last_used DESC LIMIT 100");res.json(rows)}