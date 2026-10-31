import { db } from "hatchable";
export const access = "user";
export const methods = ["GET"];
export default async function(req,res){
  const {rows}=await db.query("SELECT id, product_name, platform, goal, concepts, created_at FROM creatives ORDER BY created_at DESC LIMIT 20");
  res.json(rows);
}