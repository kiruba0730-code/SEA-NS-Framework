import {getModels,processRecord} from "../../lib/engine.js";import {generateDataset,preprocess} from "../../lib/sea.js";
export const access = 'user';
export const methods=['POST'];
export default async function(req,res){await getModels();const rows=preprocess(generateDataset(30,.25)).rows;const r=rows[Math.floor(Math.random()*rows.length)];res.json(await processRecord({...r,record_id:"LIVE-"+Date.now()},{similarityThreshold:req.body?.similarityThreshold||.7}))}