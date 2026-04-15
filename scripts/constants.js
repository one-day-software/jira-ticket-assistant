const AI_PROVIDERS = {
    ANTHROPIC: 'anthropic',
    OPENAI: 'openai',
    GOOGLE: 'google',
    OLLAMA: 'ollama'
};

const API_CONFIG = {
    ANTHROPIC: {
        URL: 'https://api.anthropic.com/v1/messages',
        MODELS_URL: 'https://api.anthropic.com/v1/models',
        MODEL: 'claude-sonnet-4-6',
        VERSION: '2023-06-01',
        MAX_TOKENS: 8192
    },
    OPENAI: {
        URL: 'https://api.openai.com/v1/chat/completions',
        MODELS_URL: 'https://api.openai.com/v1/models',
        MODEL: 'gpt-5.4-mini',
        MAX_TOKENS: 8192,
        TEMPERATURE: 0.3
    },
    GOOGLE: {
        URL: 'https://generativelanguage.googleapis.com/v1beta/models',
        MODELS_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
        MODEL: 'gemini-2.5-flash',
        MAX_TOKENS: 8192
    },
    OLLAMA: {
        DEFAULT_URL: 'http://localhost:11434',
        CHAT_PATH: '/api/chat',
        MODELS_PATH: '/api/tags',
        MODEL: '',
        MAX_TOKENS: 8192,
        TEMPERATURE: 0.7
    }
};

// Available AI Models for each provider (used as fallback when API fetch fails)
const AI_MODELS = {
    ANTHROPIC: [
        { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
        { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
        { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
        { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
        { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' }
    ],
    OPENAI: [
        { value: 'gpt-5.4', label: 'GPT-5.4' },
        { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
        { value: 'gpt-5.4-nano', label: 'GPT-5.4 nano' },
        { value: 'gpt-4.1', label: 'GPT-4.1' },
        { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }
    ],
    GOOGLE: [
        { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
        { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
        { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite (Preview)' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
        { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' }
    ],
    OLLAMA: []
};

const PROMPT_TEMPLATES = {
    JIRA_IMPROVEMENT: `You are a JIRA ticket improvement assistant. Your task is to enhance the quality and clarity of JIRA ticket content while strictly following these guidelines:

**INPUT:**
Summary: {{summary}}
Description: {{description}}
{{translationInstruction}}

**IMPROVEMENT RULES:**
1. **Summary Requirements:**
   - Use sentence case (only capitalize the first word and proper nouns)
   - Keep it concise and descriptive
   - Maintain the original intent and scope

2. **Description Requirements:**
   - Preserve ALL existing field labels exactly as they appear and use bold text for them (Environment, Steps to Reproduce, Expected, Actual, Additional Details, etc.)
   - Use HTML formatting for better structure: <ul>, <li>, <strong>, <em>, <br>, <p>
   - Improve readability and grammar while preserving original meaning

3. **Content Guidelines:**
   - NEVER add root cause analysis, solutions, or technical recommendations
   - NEVER add new sections or fields not present in the original
   - Maintain exact original scope and meaning
   - Improve grammar, spelling, and clarity only

4. **Language Requirements:**
   {{languageRequirement}}

5. **Formatting Standards:**
   - Use proper HTML tags for lists and emphasis
   - Ensure consistent formatting throughout
   - Keep line breaks and spacing logical

**OUTPUT FORMAT:**
You MUST respond with valid JSON only, using this exact structure:
{
  "summary": "improved summary here",
  "description": "improved description with HTML formatting here"
}

**CRITICAL:** Return ONLY the JSON object, no additional text, explanations, or formatting markers.`
};


const DEFAULTS = {
    AI_PROVIDER: AI_PROVIDERS.ANTHROPIC,
    JIRA_DOMAINS: [
        '*.atlassian.net',
        '*.jira.com',
        '*/jira/*'
    ],
    BLACKLIST_DOMAINS: [
        '*/wiki/*'
    ],
    DESCRIPTION_TEMPLATE: `<p><strong>Environment:</strong></p>
<p>Protect v6.2</p>

<p><strong>Steps to Reproduce:</strong></p>
<ol>
<li>Step 1</li>
<li>Step 2</li>
</ol>

<p><strong>Expected Result:</strong></p>
<p>What should happen</p>

<p><strong>Actual Result:</strong></p>
<p>What actually happened</p>`
};

// Translation Languages
const TRANSLATION_LANGUAGES = {
    NONE: 'none',
    CHINESE: 'chinese',
    ENGLISH: 'english'
};

// Language Settings
const LANGUAGE_SETTINGS = {
    DEFAULT_TRANSLATE_LANG: TRANSLATION_LANGUAGES.NONE,
    LANGUAGE_OPTIONS: [
        { value: TRANSLATION_LANGUAGES.NONE, label: 'No Translation' },
        { value: TRANSLATION_LANGUAGES.CHINESE, label: '繁體中文' },
        { value: TRANSLATION_LANGUAGES.ENGLISH, label: 'English' }
    ],
    LANGUAGE_PROMPTS: {
        [TRANSLATION_LANGUAGES.CHINESE]: 'Translate all content to Traditional Chinese (繁體中文)',
        [TRANSLATION_LANGUAGES.ENGLISH]: 'Translate all content to clear, professional English'
    }
};


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AI_PROVIDERS,
        API_CONFIG,
        AI_MODELS,
        PROMPT_TEMPLATES,
        DEFAULTS,
        TRANSLATION_LANGUAGES,
        LANGUAGE_SETTINGS
    };
}
