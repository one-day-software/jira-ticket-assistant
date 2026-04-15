# JIRA Ticket Assistant | OnedaySoftware

A Chrome extension that automatically injects ticket templates and improves JIRA ticket content using AI.

> ### Project status
>
> This project is unlikely to receive further updates. JIRA's built-in AI integration has matured to the point where it covers these use cases well enough on its own. The repository is kept as a record and demonstration of previously developed work, not as actively maintained tooling.

## Features

- **Automatic Template Injection**: Auto-fill description fields with customizable templates
- **Domain Control**: Whitelist and blacklist specific domains
- **AI-Powered Content Improvement**: Enhance JIRA ticket summaries and descriptions using AI
- **Multiple AI Providers**: Anthropic Claude, OpenAI, Google Gemini, and Local Ollama
- **Live Model List**: Models are fetched from each provider's API when an API key is configured (falls back to a curated list of latest models)
- **Language Support**: Translate content to Traditional Chinese or English
- **Theme**: Light / dark mode toggle
- **Encrypted API Key Storage**: Keys are encrypted with AES-GCM before being stored in `chrome.storage.local`

## Installation

### From Chrome Web Store

Install directly from the [Chrome Web Store listing](https://chromewebstore.google.com/detail/jira-ticket-assistant-one/cpkhmloocfcjcdbilfbgdkohemhkfagi).

### Manual Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right corner)
4. Click **Load unpacked** and select the extension directory
5. Click the extension icon in your Chrome toolbar to open the side panel

> **No build step required** — this is a plain Manifest V3 extension. After editing any source file, click the refresh icon on the extension card in `chrome://extensions`.

## Setup

### 1. Configure AI Provider

Open the side panel and go to the **Settings** tab:

- **AI Provider** — pick one:
  - **Anthropic Claude** — [Get API key](https://console.anthropic.com/)
  - **OpenAI** — [Get API key](https://platform.openai.com/api-keys)
  - **Google Gemini / Gemma** — [Get API key](https://aistudio.google.com/apikey)
  - **Local Ollama** — no API key required (runs on your machine)

- **API Key** — enter your key (stored encrypted; see [Privacy & Security](#privacy--security))

- **AI Model** — the dropdown auto-populates from the provider's API once a key is present. A fallback list with the latest models (Claude 4.6, GPT-5.4, Gemini 3.1, etc.) is shown otherwise.

#### Ollama setup (Local)

The side panel defaults to `http://localhost:11434`. Because Chrome extensions call Ollama from a different origin (`chrome-extension://…`), Ollama must be told to accept that origin:

```bash
# macOS (Ollama desktop app)
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
# then quit Ollama from the menu bar and reopen it

# Or from the terminal
OLLAMA_ORIGINS="chrome-extension://*" ollama serve
```

If the Ollama server runs on another machine on your LAN, also set `OLLAMA_HOST=0.0.0.0` on that machine and point the side panel's **Ollama Endpoint URL** at `http://<machine-ip>:11434`.

### 2. Customize Settings

**Template Configuration**
- Edit the description template to match your team's requirements
- HTML formatting supported (`<ul>`, `<strong>`, `<p>`, etc.)

**Domain Configuration**
- **JIRA Domains** — whitelist domains where the extension should work
  - Default: `*.atlassian.net`, `*.jira.com`, `*/jira/*`
- **Blacklist Domains** — exclude specific domains (e.g., confluence wiki pages)
  - Default: `*/wiki/*`

**Autofill**
- Toggle **Enable Auto-fill Template** to auto-inject the template whenever a JIRA ticket's description field is detected
- Pick a **Translation Language** to apply when improving tickets

## Usage

### Auto-fill Template

1. Navigate to a JIRA ticket creation page
2. If autofill is enabled, the template is automatically injected
3. Or click **Use Template** in the side panel

### Improve Ticket Content

1. Open a JIRA ticket (new or existing)
2. Fill in the Summary and/or Description fields
3. Open the side panel and click **Improve Current Ticket**
4. Review the improved summary and description in the Main tab
5. Click on the improved content to copy it to clipboard, then paste it back into JIRA

### Translation

1. Select your target language in **Settings**
2. When improving tickets, content is translated as part of the improvement step
3. Options: No Translation, 繁體中文, English

## Architecture

| File | Runs in | Purpose |
|---|---|---|
| `scripts/constants.js` | content script + service worker | Shared constants (providers, models, prompts) |
| `scripts/crypto.js` | service worker + side panel | AES-GCM encrypt/decrypt for API keys |
| `scripts/background.js` | service worker | Calls Anthropic / OpenAI / Google / Ollama APIs |
| `scripts/content.js` | injected into all pages | Reads and writes JIRA DOM fields |
| `sidepanel.html` / `sidepanel.js` | side panel | Settings UI and result rendering |
| `scripts/theme-loader.js` | side panel | Applies saved theme before DOM renders |

External API calls are only made from the service worker — content scripts delegate via `chrome.runtime.sendMessage`.

## Privacy & Security

- **API keys are encrypted** with AES-GCM (256-bit) before being written to `chrome.storage.local`. The encryption key is generated on first use and kept in the same local store. Keys never leave your machine except in the `Authorization` / `x-api-key` / `?key=` header of requests you explicitly send to your chosen provider.
- **No telemetry, no third-party backend** — ticket content goes from your browser directly to the provider API you configured (or your own Ollama server for Local Ollama).
- **Open source** — review and audit the code yourself.

## License

MIT License — see LICENSE file for details.