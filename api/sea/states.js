import {db} from "hatchable";
export const access = 'user';
export const methods=['GET'];
export default async function(req,res){const {rows}=await db.query("SELECT * FROM sea_states ORDER BY created_at");res.json(rows)}