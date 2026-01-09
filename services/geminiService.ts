
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

const LOCAL_STORAGE_KEY = 'decora_app_state';

export const saveAppState = async (state: any) => {
  // Always save to localStorage first as backup
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('localStorage save error', e);
  }

  // Then try to save to server
  try {
    const res = await fetch(`${SERVER_BASE}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'app', data: state }),
    });
    return res.ok ? await res.json() : { ok: true }; // Return ok even if server fails since localStorage saved
  } catch (err) {
    console.error('Save app state to server error (using localStorage backup)', err);
    return { ok: true }; // Return ok since localStorage saved
  }
};

export const fetchAppState = async () => {
  // Try server first
  try {
    const res = await fetch(`${SERVER_BASE}/state`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.data) {
        // Also update localStorage with server data
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.data));
        } catch (e) {}
        return data;
      }
    }
  } catch (err) {
    console.error('Fetch from server error, trying localStorage', err);
  }

  // Fallback to localStorage
  try {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localData) {
      const parsed = JSON.parse(localData);
      return { ok: true, data: parsed };
    }
  } catch (e) {
    console.error('localStorage fetch error', e);
  }

  return { ok: false, data: null };
};
