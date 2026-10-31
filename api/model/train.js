import {train} from "../../lib/engine.js";import {generateDataset} from "../../lib/sea.js";
export const access = 'user';
export const methods=['POST'];
export default async function(req,res){res.json(await train(generateDataset(Math.min(1000,Math.max(80,Number(req.body?.size||300))),.05)))}