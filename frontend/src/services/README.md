# Frontend API services

The typed home for every KAYA backend API — current and future.

## Why

`src/api.ts` is the configured axios instance (base URL from `VITE_API_URL`, JWT
injection, 401 auto-logout). Historically pages call it inline
(`api.get('/api/v1/...')`), which scatters URL strings and response shapes. This
`services/` layer wraps that client so new endpoints arrive **typed and in one
place**.

## How to add a new API

1. **Add the path** to `endpoints` in `client.ts` (a string, or a builder for
   path params):

   ```ts
   consultations: {
     mine: '/api/v1/consultations/me',
     byId: (id: string) => `/api/v1/consultations/${id}`,
     messages: (id: string) => `/api/v1/consultations/${id}/messages`,  // new
   },
   ```

2. **Add a typed function** in the matching `*.service.ts` (create one per domain):

   ```ts
   export const consultationService = {
     messages: (id: string) => http.get<Message[]>(endpoints.consultations.messages(id)),
     send: (id: string, body: string) =>
       http.post<Message>(endpoints.consultations.messages(id), { body }),
   };
   ```

3. **Call it** from a component — no try/catch needed for expected errors:

   ```ts
   const res = await consultationService.messages(id);
   if (res.ok) setMessages(res.data);
   else showError(res.error.message);
   ```

## Contract

- `http.get/post/put/patch/delete<T>()` return `ApiResult<T>` — a discriminated
  union (`{ ok: true, data }` | `{ ok: false, error }`), so callers branch instead
  of throwing.
- `ApiError.message` is already unwrapped from FastAPI's `{ detail }` response.
- Everything inherits auth + base URL from `api.ts`, so services work the same
  locally (Vite proxy → `localhost:8000`) and in production (`VITE_API_URL` → the
  Azure Container App).

Existing inline `api.*` calls keep working; migrate them opportunistically.
