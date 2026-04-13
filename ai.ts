import { GoogleGenAI } from "@google/genai";
export { classifyAIError, formatAIError, getAIRetryDelaySeconds } from "./ai-errors";
export type { AIErrorInfo } from "./ai-errors";

type GoogleGenAIInit = ConstructorParameters<typeof GoogleGenAI>[0] & {
  maxRetries?: number;
};

export const createAIClient = (apiKey?: string): GoogleGenAI => {
  return new GoogleGenAI({ apiKey, maxRetries: 0 } as GoogleGenAIInit);
};