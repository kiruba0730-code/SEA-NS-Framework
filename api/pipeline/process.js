import {processRecord} from "../../lib/engine.js";
export const access = 'user';
export const methods=['POST'];
export default async function(req,res){try{res.json(await processRecord(req.body,{similarityThreshold:req.body?.similarityThreshold||.7}))}catch(e){res.status(500).json({error:String(e.message||e)})}}