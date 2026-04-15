// Import constants and crypto utilities
importScripts('constants.js');
importScripts('crypto.js');

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'callAI') {
    callAI(request.summary, request.description, request.translateLang)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'fetchModels') {
    fetchModels(request.provider, request.apiKey, request.ollamaEndpoint)
      .then(models => sendResponse({ success: true, data: models }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// ============================================================================
// PROMPT
// ============================================================================

function generatePrompt(summary, description, translateLang = TRANSLATION_LANGUAGES.NONE) {
  let translationInstruction = '';
  let languageRequirement = '- Keep the original language if no translation is requested';

  if (translateLang && translateLang !== TRANSLATION_LANGUAGES.NONE) {
    translationInstruction = `**TRANSLATION REQUEST:** ${LANGUAGE_SETTINGS.LANGUAGE_PROMPTS[translateLang]}`;
    languageRequirement = `- ${LANGUAGE_SETTINGS.LANGUAGE_PROMPTS[translateLang]}
   - Maintain professional tone and technical accuracy in the target language`;
  }

  return PROMPT_TEMPLATES.JIRA_IMPROVEMENT
    .replace('{{summary}}', summary)
    .replace('{{description}}', description)
    .replace('{{translationInstruction}}', translationInstruction)
    .replace('{{languageRequirement}}', languageRequirement);
}

// ============================================================================
// AI CALL DISPATCH
// ============================================================================

async function callAI(summary, description, translateLang = TRANSLATION_LANGUAGES.NONE) {
  const settings = await chrome.storage.local.get([
    'aiProvider', 'anthropicApiKey_encrypted', 'openaiApiKey_encrypted',
    'googleApiKey_encrypted', 'ollamaApiKey_encrypted', 'ollamaEndpoint',
    'aiModel'
  ]);
  const provider = settings.aiProvider || DEFAULTS.AI_PROVIDER;
  const model = settings.aiModel || API_CONFIG[provider.toUpperCase()]?.MODEL;

  const anthropicApiKey = settings.anthropicApiKey_encrypted
    ? await decryptValue(settings.anthropicApiKey_encrypted) : null;
  const openaiApiKey = settings.openaiApiKey_encrypted
    ? await decryptValue(settings.openaiApiKey_encrypted) : null;
  const googleApiKey = settings.googleApiKey_encrypted
    ? await decryptValue(settings.googleApiKey_encrypted) : null;
  const ollamaApiKey = settings.ollamaApiKey_encrypted
    ? await decryptValue(settings.ollamaApiKey_encrypted) : null;

  if (provider === AI_PROVIDERS.ANTHROPIC) {
    return await callAnthropicAPI(summary, description, anthropicApiKey, translateLang, model);
  } else if (provider === AI_PROVIDERS.OPENAI) {
    return await callOpenAIAPI(summary, description, openaiApiKey, translateLang, model);
  } else if (provider === AI_PROVIDERS.GOOGLE) {
    return await callGoogleAPI(summary, description, googleApiKey, translateLang, model);
  } else if (provider === AI_PROVIDERS.OLLAMA) {
    return await callOllamaAPI(summary, description, settings.ollamaEndpoint, ollamaApiKey, translateLang, model);
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

// ============================================================================
// MODEL FETCH DISPATCH
// ============================================================================

async function fetchModels(provider, apiKey, ollamaEndpoint) {
  if (provider === AI_PROVIDERS.ANTHROPIC) {
    return await fetchAnthropicModels(apiKey);
  } else if (provider === AI_PROVIDERS.OPENAI) {
    return await fetchOpenAIModels(apiKey);
  } else if (provider === AI_PROVIDERS.GOOGLE) {
    return await fetchGoogleModels(apiKey);
  } else if (provider === AI_PROVIDERS.OLLAMA) {
    return await fetchOllamaModels(ollamaEndpoint, apiKey);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

async function fetchAnthropicModels(apiKey) {
  const response = await fetch(API_CONFIG.ANTHROPIC.MODELS_URL, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': API_CONFIG.ANTHROPIC.VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  });
  if (!response.ok) throw new Error(`Anthropic models fetch failed: ${response.status}`);
  const data = await response.json();
  return data.data.map(m => ({ value: m.id, label: m.display_name || m.id }));
}

async function fetchOpenAIModels(apiKey) {
  const response = await fetch(API_CONFIG.OPENAI.MODELS_URL, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!response.ok) throw new Error(`OpenAI models fetch failed: ${response.status}`);
  const data = await response.json();

  const excludePrefixes = [
    'text-embedding', 'whisper', 'dall-e', 'tts', 'omni-moderation',
    'text-moderation', 'davinci', 'babbage', 'ada', 'curie'
  ];
  return data.data
    .filter(m => !excludePrefixes.some(p => m.id.startsWith(p)))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .map(m => ({ value: m.id, label: m.id }));
}

async function fetchGoogleModels(apiKey) {
  const response = await fetch(`${API_CONFIG.GOOGLE.MODELS_URL}?key=${apiKey}`);
  if (!response.ok) throw new Error(`Google models fetch failed: ${response.status}`);
  const data = await response.json();
  return (data.models || [])
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => ({
      value: m.name.replace('models/', ''),
      label: m.displayName || m.name.replace('models/', '')
    }));
}

async function fetchOllamaModels(endpoint, apiKey) {
  const base = (endpoint || API_CONFIG.OLLAMA.DEFAULT_URL).replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${base}${API_CONFIG.OLLAMA.MODELS_PATH}`, { headers });
  if (!response.ok) throw new Error(`Ollama models fetch failed: ${response.status}`);
  const data = await response.json();
  return (data.models || []).map(m => ({ value: m.name, label: m.name }));
}

// ============================================================================
// API CALLS
// ============================================================================

async function callAnthropicAPI(summary, description, apiKey, translateLang = TRANSLATION_LANGUAGES.NONE, model = API_CONFIG.ANTHROPIC.MODEL) {
  if (!apiKey) {
    throw new Error('Please configure the API key in the settings page first.');
  }

  const prompt = generatePrompt(summary, description, translateLang);

  const response = await fetch(API_CONFIG.ANTHROPIC.URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_CONFIG.ANTHROPIC.VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: API_CONFIG.ANTHROPIC.MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return parseJsonResponse(data.content[0].text, summary, description);
}

async function callOpenAIAPI(summary, description, apiKey, translateLang = TRANSLATION_LANGUAGES.NONE, model = API_CONFIG.OPENAI.MODEL) {
  if (!apiKey) {
    throw new Error('Please configure the API key in the extension settings first.');
  }

  const prompt = generatePrompt(summary, description, translateLang);

  const isReasoningEra = /^(gpt-5|o\d)/.test(model);
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }]
  };
  if (isReasoningEra) {
    body.max_completion_tokens = API_CONFIG.OPENAI.MAX_TOKENS;
  } else {
    body.max_tokens = API_CONFIG.OPENAI.MAX_TOKENS;
    body.temperature = API_CONFIG.OPENAI.TEMPERATURE;
  }

  const response = await fetch(API_CONFIG.OPENAI.URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return parseJsonResponse(data.choices[0].message.content, summary, description);
}

async function callGoogleAPI(summary, description, apiKey, translateLang = TRANSLATION_LANGUAGES.NONE, model = API_CONFIG.GOOGLE.MODEL) {
  if (!apiKey) {
    throw new Error('Please configure the Google API key in the settings page first.');
  }

  const prompt = generatePrompt(summary, description, translateLang);

  const response = await fetch(`${API_CONFIG.GOOGLE.URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: API_CONFIG.GOOGLE.MAX_TOKENS }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return parseJsonResponse(data.candidates[0].content.parts[0].text, summary, description);
}

async function callOllamaAPI(summary, description, endpoint, apiKey, translateLang = TRANSLATION_LANGUAGES.NONE, model = '') {
  if (!model) {
    throw new Error('Please select a model in the settings page first.');
  }

  const prompt = generatePrompt(summary, description, translateLang);
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const base = (endpoint || API_CONFIG.OLLAMA.DEFAULT_URL).replace(/\/$/, '');

  const response = await fetch(`${base}${API_CONFIG.OLLAMA.CHAT_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
      options: {
        temperature: API_CONFIG.OLLAMA.TEMPERATURE,
        num_predict: API_CONFIG.OLLAMA.MAX_TOKENS
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return parseJsonResponse(data.message.content, summary, description);
}

// ============================================================================
// HELPERS
// ============================================================================

function parseJsonResponse(content, fallbackSummary, fallbackDescription) {
  try {
    return JSON.parse(content);
  } catch (e) {
    const summaryMatch = content.match(/summary['":\s]*["']([^"']+)["']/i);
    const descMatch = content.match(/description['":\s]*["']([^"']+)["']/i);
    return {
      summary: summaryMatch ? summaryMatch[1] : fallbackSummary,
      description: descMatch ? descMatch[1] : fallbackDescription
    };
  }
}
