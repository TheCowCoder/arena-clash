import { GoogleGenAI } from "@google/genai";

type GoogleGenAIInit = ConstructorParameters<typeof GoogleGenAI>[0] & {
  maxRetries?: number;
};

const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
const RETRYABLE_STATUS_TEXT = new Set([
  "DEADLINE_EXCEEDED",
  "INTERNAL",
  "RESOURCE_EXHAUSTED",
  "UNAVAILABLE",
]);

export interface AIErrorInfo {
  retryable: boolean;
  label: string;
  detail: string;
  statusCode?: number;
  statusText?: string;
}

interface ErrorPayload {
  code?: number;
  message?: string;
  status?: string;
}

const getString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const getNumber = (value: unknown): number | undefined => {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const stringifyUnknown = (value: unknown): string => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseEmbeddedPayload = (message: string): ErrorPayload | null => {
  const firstBrace = message.indexOf("{");
  if (firstBrace === -1) return null;

  try {
    const parsed = JSON.parse(message.slice(firstBrace));
    const payload = typeof parsed?.error === "object" && parsed.error ? parsed.error : parsed;
    return {
      code: getNumber((payload as any)?.code),
      message: getString((payload as any)?.message),
      status: getString((payload as any)?.status),
    };
  } catch {
    return null;
  }
};

const extractStatusText = (message: string): string | undefined => {
  const match = message.match(/got status:\s*([A-Z_]+)/i);
  return match?.[1]?.toUpperCase();
};

const extractMessage = (error: any, payload: ErrorPayload | null, fallback: string): string => {
  return getString(error?.error?.message) || payload?.message || fallback;
};

export const createAIClient = (apiKey?: string): GoogleGenAI => {
  return new GoogleGenAI({ apiKey, maxRetries: 0 } as GoogleGenAIInit);
};

export const classifyAIError = (error: unknown): AIErrorInfo => {
  const errorObj = error as any;
  const rawMessage = getString(errorObj?.message) || stringifyUnknown(error);
  const payload = parseEmbeddedPayload(rawMessage);
  const statusCode =
    getNumber(errorObj?.status) ||
    getNumber(errorObj?.code) ||
    getNumber(errorObj?.error?.code) ||
    payload?.code;
  const statusText =
    getString(errorObj?.error?.status)?.toUpperCase() ||
    payload?.status?.toUpperCase() ||
    extractStatusText(rawMessage);
  const detail = extractMessage(errorObj, payload, rawMessage);
  const errorName = getString(errorObj?.name) || "";

  const isRateLimit =
    statusCode === 429 ||
    statusText === "RESOURCE_EXHAUSTED" ||
    /quota|rate limit|too many requests/i.test(detail);
  const isServiceUnavailable =
    statusCode === 503 || statusText === "UNAVAILABLE";
  const isTimeout =
    statusCode === 408 ||
    statusText === "DEADLINE_EXCEEDED" ||
    errorName === "APIConnectionTimeoutError" ||
    /timed?\s*out|deadline exceeded/i.test(detail);
  const isNetwork =
    errorName === "APIConnectionError" ||
    /fetch failed|network|socket hang up|econnreset|enotfound|connection reset/i.test(detail);
  const isServerError =
    typeof statusCode === "number" && statusCode >= 500;

  const retryable =
    isRateLimit ||
    isServiceUnavailable ||
    isTimeout ||
    isNetwork ||
    (typeof statusCode === "number" && RETRYABLE_STATUS_CODES.has(statusCode)) ||
    (!!statusText && RETRYABLE_STATUS_TEXT.has(statusText));

  let label = "Gemini request failed";
  if (isRateLimit) {
    label = statusCode === 429 ? "API rate limited (429)" : "API rate limited";
  } else if (isServiceUnavailable) {
    label = statusCode === 503 ? "Gemini service unavailable (503)" : "Gemini service unavailable";
  } else if (isTimeout) {
    label = "Gemini request timed out";
  } else if (isNetwork) {
    label = "Gemini connection failed";
  } else if (isServerError && statusCode) {
    label = `Gemini server error (${statusCode})`;
  } else if (statusCode) {
    label = `Gemini request failed (${statusCode})`;
  }

  return {
    retryable,
    label,
    detail,
    statusCode,
    statusText,
  };
};

export const formatAIError = (errorInfo: AIErrorInfo): string => {
  if (!errorInfo.detail || errorInfo.detail === errorInfo.label) {
    return errorInfo.label;
  }
  return `${errorInfo.label}: ${errorInfo.detail}`;
};

export const getAIRetryDelaySeconds = (attempt: number): number => {
  const base = Math.pow(2, Math.min(Math.max(attempt, 1), 6));
  // Add ±25% jitter to stagger concurrent requests (e.g. PvP)
  const jitter = base * (0.75 + Math.random() * 0.5);
  return jitter;
};