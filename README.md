# Fleety Components

Fleety Components is a growing collection of **ready-to-use, open-source UI widgets** that integrate seamlessly with [Fleety](https://fleety.dev) — designed to make adding AI-powered support or ticket systems to your product effortless.

Currently available:
- 🟢 `SupportChat.svelte` — real-time AI support chat with streaming responses.
- 🟢 `SupportTicket.svelte` — full-featured ticket system with message threads and status tracking.

Coming soon:
- ⚛️ React components (`.tsx`)
- 🧩 Vue components (`.vue`)

---

## ✨ Features

- Drop-in widgets (just copy & paste)
- Real-time messaging with streaming OpenAI responses
- Built-in token/session handling via Fleety proxy
- Multiple visual themes (`fleety`, `material`, `midnight`)
- Works with Fleety’s RAG-enabled backend for contextual AI support

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Copy components

Copy the component you want into your Svelte app:

```bash
src/lib/SupportChat.svelte
src/lib/SupportTicket.svelte
```

### 3. Add your project ID

Create a project on the [Fleety Dashboard](https://fleety.dev/projects) and copy & paste the project ID into your .env file as
```bash
FLEETY_PROJECT_ID=your-project-id
```

### 3. Use in your app

```svelte
<script>
  import SupportChat from './lib/SupportChat.svelte';
</script>

<SupportChat theme="fleety" dockPosition="bottom-right" />
```

Your app will now connect to your [Fleety](https://fleety.dev) backend (you can self-host or use the managed API).

---

## 🧱 Architecture Overview

Each component connects to Fleety’s lightweight API proxy for:
- Anonymous session initialization
- Secure JWT token exchange
- Real-time SSE (Server-Sent Events) for message streaming

No API keys exposed in the browser. Everything is proxied safely.

---

## 🛠️ Framework Roadmap

| Framework | Status |
|------------|---------|
| Svelte     | ✅ Available |
| React      | 🚧 In progress |
| Vue        | 🚧 In progress |

---

## 💡 Contributing

Pull requests are welcome!  
We’re open to new features, design improvements, and additional framework ports.

If you’re adding a new framework version, try to keep parity with the Svelte implementation.

---

## ⚖️ License

MIT License © Fleety 2025  
You’re free to use, modify, and self-host it however you like.

---

**Fleety Components** — simple, open, and developer-friendly building blocks for smarter support systems. Learn more at [fleety.dev](https://fleety.dev).
