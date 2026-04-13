# Arena Clash — Gemini API Quota Issue Context

## Problem
API calls to `gemini-2.5-pro` and `gemini-3.1-pro-preview` return 429 errors with `free_tier` quota metrics, even though the API key is on a **paid tier**.

## Key Details

### API Key
- Key is set via `GEMINI_API_KEY` env var in `.env`
- Key value: `AIzaSyB0Sj6kwJ5csBTFbmWYYkSNBYln4-X-Hk4`
- User confirms this is a **paid** API key
- SDK: `@google/genai` (Google Gen AI JS SDK)
- Client is initialized with `new GoogleGenAI({ apiKey, maxRetries: 0 })`

### API Endpoint Used
- `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse`
- `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

### Error Response (2.5 Pro)
```json
{
  "error": {
    "code": 429,
    "message": "You exceeded your current quota... Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-2.5-pro... Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-2.5-pro",
    "status": "RESOURCE_EXHAUSTED",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        "violations": [
          {
            "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
            "quotaDimensions": { "location": "global", "model": "gemini-2.5-pro" }
          },
          {
            "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            "quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
            "quotaDimensions": { "location": "global", "model": "gemini-2.5-pro" }
          },
          {
            "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_input_token_count",
            "quotaId": "GenerateContentInputTokensPerModelPerMinute-FreeTier",
            "quotaDimensions": { "location": "global", "model": "gemini-2.5-pro" }
          },
          {
            "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_input_token_count",
            "quotaId": "GenerateContentInputTokensPerModelPerDay-FreeTier",
            "quotaDimensions": { "location": "global", "model": "gemini-2.5-pro" }
          }
        ]
      },
      {
        "@type": "type.googleapis.com/google.rpc.RetryInfo",
        "retryDelay": "5s"
      }
    ]
  }
}
```

### Error Response (2.5 Flash)
```json
{
  "error": {
    "code": 429,
    "message": "You exceeded your current quota... Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

### Key Observations
1. **All quota metrics say `free_tier`** — both `free_tier_requests` and `free_tier_input_token_count`
2. **2.5 Pro limit is 0** — zero requests allowed per day and per minute
3. **2.5 Flash limit is 20** — 20 requests per minute (consistent with free tier)
4. The quota IDs include `FreeTier` suffix: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`
5. The user's API key is confirmed to be on the paid tier
6. The key works — 2.5 Flash successfully generates content (when under the 20 req/min limit)

## Questions to Research
1. Why would a paid API key be classified as free tier by the Gemini API?
2. Is there a specific step needed to enable paid-tier quotas for the Generative Language API?
3. Does the GCP project need specific billing or API enablement beyond just having a paid API key?
4. Is there a difference between API keys from AI Studio vs Google Cloud Console?
5. Could the `v1beta` endpoint affect billing tier classification?
6. Are there known issues with 2.5 Pro having zero free-tier quota while Flash has 20?
7. How do you verify and switch an API key from free tier to paid tier?

## Project Context
- App: Arena Clash — browser-based PvP RPG 
- Stack: React + TypeScript (Vite) + Node/Express + Socket.IO
- AI calls are made client-side from the browser using the `@google/genai` JS SDK
- The API key is baked into the Vite build via `process.env.GEMINI_API_KEY`
- Deployed on Cloudflare Workers
