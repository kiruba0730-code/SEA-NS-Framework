import {db} from "hatchable";import {getState} from "../lib/engine.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
  const uploaded=await getState("last_upload_metrics");
  if(uploaded){res.json(Object.entries(uploaded).map(([model_name,m])=>({model_name,precision_score:m.precision,recall_score:m.recall,f1_score:m.f1,false_positive_rate:m.false_positive_rate,detection_time_ms:m.detection_time_ms||null,confusion_matrix:m.confusion_matrix,support:m.support})));return}
  const {rows}=await db.query("SELECT model_name,precision_score,recall_score,f1_score,false_positive_rate,detection_time_ms FROM model_metrics ORDER BY created_at DESC LIMIT 20");res.json(rows)
}