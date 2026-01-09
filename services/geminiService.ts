
import { Order } from "../types";

const SERVER_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:4000'
  : '';

export const getSmartSchedulingAdvice = async (orders: Order[]): Promise<string> => {
  try {
    const apiResponse = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orders }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(errorData.error || `API call failed with status: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    return data.advice;
  } catch (error: any) {
    console.error("AI Service Error:", error);
    return "تعذر الاتصال بخدمة الذكاء الاصطناعي حالياً. يرجى المحاولة مرة أخرى.";
  }
};

export const saveOrdersToServer = async (orders: Order[]) => {
  try {
    const res = await fetch(`${SERVER_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
    return res.ok ? await res.json() : { ok: false };
  } catch (err) {
    console.error('Save orders error', err);
    return { ok: false };
  }
};

export const fetchOrdersFromServer = async () => {
  try {
    const res = await fetch(`${SERVER_BASE}/orders`);
    if (!res.ok) return { ok: false, orders: [] };
    return await res.json();
  } catch (err) {
    console.error('Fetch orders error', err);
    return { ok: false, orders: [] };
  }
};

export const saveAppState = async (state: any) => {
  try {
    const res = await fetch(`${SERVER_BASE}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'app', data: state }),
    });
    return res.ok ? await res.json() : { ok: false };
  } catch (err) {
    console.error('Save app state error', err);
    return { ok: false };
  }
};

export const fetchAppState = async () => {
  try {
    const res = await fetch(`${SERVER_BASE}/state`);
    if (!res.ok) return { ok: false, data: null };
    return await res.json();
  } catch (err) {
    console.error('Fetch app state error', err);
    return { ok: false, data: null };
  }
};
