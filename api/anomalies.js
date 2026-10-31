import {db} from "hatchable";
export const access = 'user';
export const methods=['GET'];
export default async function(req,res){const {rows}=await db.query("SELECT * FROM anomalies ORDER BY created_at DESC LIMIT 100");res.json(rows)}