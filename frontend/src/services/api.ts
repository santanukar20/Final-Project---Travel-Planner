import axios, { AxiosError } from 'axios';
import { PlanResponse, EditResponse, ExplainResponse, EmailItineraryResponse } from '@shared/types';
import { pushLog } from '../debug/logStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use((config) => {
  (config as any).meta = { start: performance.now() };
  const path = config.url || '';
  pushLog('API', `→ ${config.method?.toUpperCase()} ${path}`, config.data);
  return config;
});

// Response interceptor
axiosInstance.interceptors.response.use(
  (res) => {
    const meta = (res.config as any).meta || {};
    const ms = meta.start ? Math.round(performance.now() - meta.start) : undefined;
    pushLog('API', `✓ ${res.status} ${res.config.url} (${ms}ms)`);

    // If backend returns systemSteps or trace, log them too
    const steps = (res.data?.systemSteps || res.data?.trace || []) as any[];
    for (const s of steps) {
      const lvl = (s.level || s.type || s.toolName || 'SYSTEM').toString().toUpperCase();
      const mapped =
        lvl.includes('MCP') ? 'MCP' :
        lvl.includes('LLM') ? 'LLM' :
        lvl.includes('EVAL') ? 'EVAL' : 'SYSTEM';
      pushLog(mapped as any, s.message || s.inputSummary || s.outputSummary || JSON.stringify(s));
    }

    return res;
  },
  (err: AxiosError<any>) => {
    const cfg: any = err.config || {};
    const meta = cfg.meta || {};
    const ms = meta.start ? Math.round(performance.now() - meta.start) : undefined;

    const status = err.response?.status;
    const data = err.response?.data;
    const msg = data?.error?.message || data?.message || err.message;

    pushLog('ERROR', `✗ ${status ?? ''} ${cfg.url} (${ms}ms) — ${msg}`, data);
    return Promise.reject(err);
  }
);

export const api = {
  async plan(
    sessionId: string | null,
    transcript: string
  ): Promise<PlanResponse> {
    const response = await axiosInstance.post('/plan', {
      sessionId,
      utterance: transcript,
    });
    return response.data;
  },

  async edit(sessionId: string, transcript: string, editCommand?: string): Promise<EditResponse> {
    const response = await axiosInstance.post('/edit', {
      sessionId,
      utterance: transcript,
      editCommand,
    });
    return response.data;
  },

  async explain(
    sessionId: string,
    question: string,
    itinerarySnapshot?: any
  ): Promise<ExplainResponse> {
    const response = await axiosInstance.post('/explain', {
      sessionId,
      question,
      itinerarySnapshot,
    });
    return response.data;
  },

  async emailItinerary(
    sessionId: string,
    toEmail: string
  ): Promise<EmailItineraryResponse> {
    const response = await axiosInstance.post('/email-itinerary', {
      sessionId,
      toEmail,
    });
    return response.data;
  },
};

export default api;
