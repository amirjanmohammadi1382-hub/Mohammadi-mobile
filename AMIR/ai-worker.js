// AMIR AI gateway using Cloudflare Workers AI (no external API key required).
// Add a Workers AI binding named "AI" in the Cloudflare Worker settings.
const DEFAULT_ORIGIN = "https://amirjanmohammadi1382-hub.github.io";
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const SYSTEM_PROMPT = `تو دستیار هوشمند AMIR هستی. با کاربر به زبان دری افغانستانی، روشن، محترمانه و عملی صحبت کن. پاسخ‌ها را تا حد نیاز کوتاه و مرحله‌به‌مرحله بده. اگر دربارهٔ انجنیری موبایل پرسید، نکات ایمنی و تشخیص را دقیق بگو و در صورت نبود اطلاعات کافی حدس قطعی نزن. برای موضوعات طبی، فقط آموزش عمومی بده و تشخیص قطعی نده. ادعا نکن که به فایل‌ها، حساب‌ها یا اطلاعاتی دسترسی داری مگر در همین پیام فراهم شده باشد. هیچ عملیات حساس یا خرید و ارسال پیامی را بدون تأیید روشن کاربر انجام‌شده اعلام نکن.`;
function cors(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname !== "/chat") {
      return Response.json({ ready: true, message: "AMIR AI gateway is ready. Configure the Workers AI binding named AI." }, { headers });
    }
    if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
    if (origin && origin !== (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN)) {
      return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
    }
    if (!env.AI || typeof env.AI.run !== "function") {
      return Response.json({ error: "اتصال Workers AI با نام AI هنوز در تنظیمات Worker اضافه نشده است." }, { status: 503, headers });
    }
    try {
      const body = await request.json();
      if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 16) {
        return Response.json({ error: "پیام‌ها معتبر نیستند." }, { status: 400, headers });
      }
      const messages = body.messages.map(m => {
        if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 6000) {
          throw new Error("پیام نامعتبر یا بیش از حد طولانی است.");
        }
        return { role: m.role, content: m.content };
      });
      const personas = {
        general: "نقش تو دستیار مرکزی و هماهنگ‌کنندهٔ AMIR است.",
        mobile: "نقش تو آموزگار انجنیری موبایل است. عیب‌یابی را مرحله‌به‌مرحله انجام بده، پیش از هر اقدام خطر برق و اتصال کوتاه را گوشزد کن و از حدس دربارهٔ پین‌ها یا مسیرهای نامعلوم خودداری کن.",
        business: "نقش تو مشاور تجارت و حسابداری است. محاسبات را شفاف نشان بده و خرید، فروش، مفاد و قرض را از هم جدا کن.",
        learning: "نقش تو آموزگار کمپیوتر و برنامه‌نویسی است. از سطح مبتدی شروع کن و هر بار یک گام عملی بده.",
        wellness: "نقش تو همراه آموزش سلامت عمومی است. تشخیص قطعی یا نسخهٔ شخصی نده و در موارد خطرناک مراجعه به متخصص را توصیه کن.",
        cooking: "نقش تو دستیار آشپزی است. دستورها را ساده، اقتصادی و مرحله‌به‌مرحله بنویس."
      };
      const persona = personas[body.persona] || personas.general;
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n\n" + persona },
          ...messages
        ],
        max_tokens: 1200,
        temperature: 0.55
      });
      const reply = typeof result?.response === "string"
        ? result.response.trim()
        : typeof result?.choices?.[0]?.message?.content === "string"
          ? result.choices[0].message.content.trim()
          : "";
      if (!reply) return Response.json({ error: "از مدل هوش مصنوعی پاسخ متنی دریافت نشد." }, { status: 502, headers });
      return Response.json({ reply }, { headers });
    } catch (error) {
      return Response.json({ error: error?.message || "خطای داخلی در سرویس." }, { status: 400, headers });
    }
  }
};
