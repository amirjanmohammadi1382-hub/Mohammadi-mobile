// AMIR secure AI gateway for Cloudflare Workers
// Configure OPENAI_API_KEY as a Worker Secret. Never put it in the website.
const DEFAULT_ORIGIN = "https://amirjanmohammadi1382-hub.github.io";
const SYSTEM_PROMPT = `تو دستیار هوشمند AMIR هستی. با کاربر به زبان دری افغانستانی، روشن، محترمانه و عملی صحبت کن. پاسخ‌ها را تا حد نیاز کوتاه و مرحله‌به‌مرحله بده. اگر دربارهٔ انجنیری موبایل پرسید، نکات ایمنی و تشخیص را دقیق بگو و در صورت نبود اطلاعات کافی حدس قطعی نزن. برای موضوعات طبی، فقط آموزش عمومی بده و تشخیص قطعی نده. ادعا نکن که به فایل‌ها، حساب‌ها یا اطلاعاتی دسترسی داری مگر در همین پیام فراهم شده باشد. هیچ عملیات حساس یا خرید و ارسال پیامی را بدون تأیید روشن کاربر انجام‌شده اعلام نکن.`;
function cors(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
  return { "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin" };
}
export default {
 async fetch(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = cors(origin, env);
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
  const url = new URL(request.url);
  if (url.pathname !== "/chat") return Response.json({error:"AMIR AI gateway is ready."},{headers});
  if (request.method !== "POST") return Response.json({error:"Method not allowed"},{status:405,headers});
  if (!env.OPENAI_API_KEY) return Response.json({error:"کلید API در Worker تنظیم نشده است."},{status:503,headers});
  if (origin && origin !== (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN)) return Response.json({error:"Origin not allowed"},{status:403,headers});
  try {
   const body = await request.json();
   if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 16) return Response.json({error:"پیام‌ها معتبر نیستند."},{status:400,headers});
   const messages = body.messages.map(m => {
    if (!m || !["user","assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 6000) throw new Error("پیام نامعتبر یا بیش از حد طولانی است.");
    return {role:m.role,content:m.content};
   });
   const apiResponse = await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({model:env.OPENAI_MODEL || "gpt-4.1-mini",instructions:SYSTEM_PROMPT,input:messages,max_output_tokens:1200})
   });
   const result = await apiResponse.json();
   if (!apiResponse.ok) return Response.json({error:result.error?.message || "خطا از سرویس هوش مصنوعی."},{status:apiResponse.status,headers});
   const reply = (result.output || []).flatMap(item=>item.content || []).filter(item=>item.type==="output_text").map(item=>item.text).join("\\n").trim();
   if (!reply) return Response.json({error:"پاسخ متنی دریافت نشد."},{status:502,headers});
   return Response.json({reply},{headers});
  } catch(error) {
   return Response.json({error:error.message || "خطای داخلی در سرویس."},{status:400,headers});
  }
 }
};
