import { ai, db } from "hatchable";
export const access = "user";
export const methods = ["POST"];
export default async function(req,res){
  const b=req.body||{};
  const required=["productName","audience","platform","tone","goal","brief"];
  for(const k of required){if(!String(b[k]||"").trim()) return res.status(400).json({error:"Missing "+k});}
  const prompt = `Create 3 high-converting ad creative concepts for:
Product: ${b.productName}
Offer: ${b.offer||"None"}
Audience: ${b.audience}
Platform: ${b.platform}
Tone: ${b.tone}
Goal: ${b.goal}
Brief: ${b.brief}
Return ONLY valid JSON array of 3 objects. Each object must contain: hook, headline, primaryText, cta, visualDirection, format, score. score is an integer 1-100 representing predicted creative strength.`;
  try{
    const out=await ai.generateText({model:"sonnet",system:"You are an elite performance advertising creative director. Be specific, concise and commercially useful.",prompt,purpose:"ad creative generation"});
    const raw=out.text||out.output||"";
    const match=raw.match(/\\[[\\s\\S]*\\]/);
    if(!match) throw new Error("AI returned an unexpected format");
    const concepts=JSON.parse(match[0]);
    const {rows}=await db.query(`INSERT INTO creatives (product_name,offer,audience,platform,tone,goal,brief,concepts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id, created_at`,[b.productName,b.offer||"",b.audience,b.platform,b.tone,b.goal,b.brief,JSON.stringify(concepts)]);
    res.json({id:rows[0].id,createdAt:rows[0].created_at,concepts});
  }catch(e){console.error(e);res.status(500).json({error:"Generation failed. Check your AI provider setup and try again.",detail:String(e.message||e)});}
}