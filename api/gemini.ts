
import { GoogleGenAI } from "@google/genai";
import type { Order } from "../types";

export const config = {
  runtime: 'edge',
};

// This is a Vercel Edge Function to securely handle Gemini API calls.
export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
            status: 405, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }

    // API key must come from server-side environment variables (never hardcode keys).
    // In Vercel, set GEMINI_API_KEY in Project Settings → Environment Variables.
    const apiKey = (process.env as any)?.GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
        const { orders }: { orders: Order[] } = await request.json();

        const activeOrders = orders.filter((o: Order) => o.status !== 'delivered');
        const scheduleContext = activeOrders.map((o: Order) => ({
            product: o.productType,
            // FIX: Corrected typo from toLocaleDateDateString to toLocaleDateString.
            delivery: new Date(o.deliveryDate).toLocaleDateString('en-GB'),
        }));

        const prompt = `
            أنت خبير جدولة في مصنع ديكورا للأثاث. 
            الطلبات الحالية في الجدول: ${JSON.stringify(scheduleContext.slice(0, 10))}.
            
            بناءً على ضغط العمل الموضح في الجدول أعلاه، قم بتحليل الجدول واكتب تقريراً موجزاً من جملة واحدة عن حالة الضغط الحالية، مع اقتراح ما إذا كان الوقت مناسباً لاستقبال مشاريع جديدة.
            مثلاً: "ضغط العمل متوسط حالياً، مع وجود مساحة لمشاريع جديدة في نهاية الشهر."
            أو "يوجد ضغط عمل عالٍ في الأسبوعين القادمين، ينصح بتأجيل المشاريع الجديدة."
            
            اجعل الإجابة موجزة جداً ومهنية باللغة العربية.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        
        // Fix: Correctly access the 'text' property instead of calling it as a method.
        const text = response.text;

        return new Response(JSON.stringify({ advice: text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("AI API Error:", error);
        return new Response(JSON.stringify({ error: "تعذر الحصول على اقتراح ذكي في الوقت الحالي." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
