# Fleety Components (Universal JS Edition)

Fleety Components is a growing suite of **open-source UI widgets** you can drop into *any* environment — plain HTML, Svelte, React, Vue, or any other framework.  
Everything ships as lightweight **Universal JS widgets** that run with a single `<script>` tag.

Currently available:
- 🟢 `SupportChatWidget` — AI-powered support chat (vanilla JS + framework wrappers)
- 🟢 `SupportTicketWidget` — user-friendly ticket system widget

Framework wrappers included:
- 🟢 Svelte (`.svelte`)
- 🟢 React (`.tsx`)
- 🟢 Vanilla JS (`.js`)
- 🚧 Vue (`.vue`) coming soon

---

## ✨ Features

- Works **anywhere** (HTML, SPA frameworks, SSR apps)
- No build step required for vanilla usage
- Real-time AI messaging via Fleety backend
- Multiple themes: `fleety`, `material`, `light`, `dark`, `nord`, `system`
- Anonymous session handling + secure proxy (no API keys in browser)
- Fully open-source widgets you can inspect, fork, and self-host

---

## 🚀 Using the Universal JS Widgets

### 1. Add script tags (CDN)

```html
<script src="https://cdn.jsdelivr.net/gh/localhost5173/fleety-components@main/SupportChatWidget.js"></script>
<script src="https://cdn.jsdelivr.net/gh/localhost5173/fleety-components@main/SupportTicketWidget.js"></script>
````

### 2. Initialize your widgets

```html
<script>
    new SupportChatWidget({
        projectId: 'your-project-id',
        theme: 'fleety',
        dockPosition: 'bottom-right'
    });

    new FleetySupportWidget({
        projectId: 'your-project-id',
        theme: 'fleety',
        dockPosition: 'bottom-left'
    });
</script>
```

That’s it — no bundler, no framework required.

---

## 📦 Using in Frameworks

### Svelte

```svelte
<script>
  import SupportChatWidget from './lib/SupportChatWidget.svelte';
</script>

<SupportChatWidget theme="fleety" dockPosition="bottom-right" />
```

### React (TSX)

```tsx
import { SupportChatWidget } from "./SupportChatWidget";

export default function App() {
  return <SupportChatWidget projectId="your-project-id" theme="fleety" />;
}
```

### Vue (coming soon)

Vue components will wrap the same universal JS core.

---

## 🧱 Architecture Overview

Each widget connects to Fleety’s proxy for:

* Anonymous session creation
* Secure JWT rotation
* Real-time streaming (SSE)
* RAG-enabled contextual responses

---

## 🛠️ Roadmap

| Framework  | Status         |
| ---------- | -------------- |
| Vanilla JS | ✅ Available    |
| Svelte     | ✅ Available    |
| React      | ✅ Available    |
| Vue        | 🚧 In progress |

---

## 💡 Contributing

PRs are welcome - new themes, new frameworks, refactors, whatever improves the project.
Everything stays open, transparent, and friendly for community-driven tooling.

---

## ⚖️ License

MIT License © Fleety 2025
Fork it, remix it, host it yourself — no corporate gatekeeping.

---
