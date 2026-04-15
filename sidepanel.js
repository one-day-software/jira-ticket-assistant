document.addEventListener('DOMContentLoaded', function () {
  const aiProviderSelect = document.getElementById('aiProvider');
  const apiKeyInput = document.getElementById('apiKey');
  const apiKeyLabel = document.getElementById('apiKeyLabel');
  const aiModelSelect = document.getElementById('aiModel');
  const ollamaEndpointInput = document.getElementById('ollamaEndpoint');
  const ollamaEndpointGroup = document.getElementById('ollamaEndpointGroup');
  const enableAutofillCheckbox = document.getElementById('enableAutofill');
  const jiraDomainsInput = document.getElementById('jiraDomains');
  const blacklistDomainsInput = document.getElementById('blacklistDomains');
  const descriptionTemplateInput = document.getElementById('descriptionTemplate');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const insertTemplateBtn = document.getElementById('insertTemplateBtn');
  const improveBtn = document.getElementById('improveBtn');
  const status = document.getElementById('status');
  const settingsStatus = document.getElementById('settings-status');
  const resultsContainer = document.getElementById('resultsContainer');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const themeToggle = document.getElementById('themeToggle');

  // Update UI based on selected AI provider
  function updateProviderUI() {
    const provider = aiProviderSelect.value;
    if (provider === AI_PROVIDERS.ANTHROPIC) {
      apiKeyLabel.textContent = 'Anthropic API Key:';
      apiKeyInput.placeholder = 'Enter your Anthropic API key';
    } else if (provider === AI_PROVIDERS.OPENAI) {
      apiKeyLabel.textContent = 'OpenAI API Key:';
      apiKeyInput.placeholder = 'Enter your OpenAI API key';
    } else if (provider === AI_PROVIDERS.GOOGLE) {
      apiKeyLabel.textContent = 'Google AI API Key:';
      apiKeyInput.placeholder = 'Enter your Google AI Studio API key';
    } else if (provider === AI_PROVIDERS.OLLAMA) {
      apiKeyLabel.textContent = 'API Key (optional):';
      apiKeyInput.placeholder = 'Leave empty for local Ollama';
    }

    // Show/hide Ollama endpoint field
    ollamaEndpointGroup.style.display = provider === AI_PROVIDERS.OLLAMA ? 'block' : 'none';

    // Update model options based on provider (hardcoded fallback)
    updateModelOptions(provider);
  }

  // Update model selector options based on provider
  function updateModelOptions(provider) {
    aiModelSelect.innerHTML = ''; // Clear existing options

    const models = AI_MODELS[provider.toUpperCase()] || [];

    if (models.length === 0) {
      aiModelSelect.innerHTML = '<option value="">No models available</option>';
      return;
    }

    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      aiModelSelect.appendChild(option);
    });
  }

  // Fetch models from API and update the select; falls back to hardcoded list on failure
  async function fetchAndUpdateModels(provider) {
    const storageKeys = ['anthropicApiKey_encrypted', 'openaiApiKey_encrypted', 'googleApiKey_encrypted', 'ollamaApiKey_encrypted', 'ollamaEndpoint'];
    const stored = await chrome.storage.local.get(storageKeys);

    let apiKey = null;
    if (provider === AI_PROVIDERS.ANTHROPIC && stored.anthropicApiKey_encrypted) {
      apiKey = await decryptValue(stored.anthropicApiKey_encrypted);
    } else if (provider === AI_PROVIDERS.OPENAI && stored.openaiApiKey_encrypted) {
      apiKey = await decryptValue(stored.openaiApiKey_encrypted);
    } else if (provider === AI_PROVIDERS.GOOGLE && stored.googleApiKey_encrypted) {
      apiKey = await decryptValue(stored.googleApiKey_encrypted);
    } else if (provider === AI_PROVIDERS.OLLAMA && stored.ollamaApiKey_encrypted) {
      apiKey = await decryptValue(stored.ollamaApiKey_encrypted);
    }

    const ollamaEndpoint = stored.ollamaEndpoint || '';

    // Ollama works without an API key (defaults to localhost); other providers need one
    const canFetch = provider === AI_PROVIDERS.OLLAMA ? true : !!apiKey;
    if (!canFetch) return;

    // Show loading state while preserving current selection
    const previousModel = aiModelSelect.value;
    aiModelSelect.innerHTML = '<option value="" disabled>Loading models...</option>';

    chrome.runtime.sendMessage(
      { action: 'fetchModels', provider, apiKey, ollamaEndpoint },
      function (response) {
        if (response && response.success && response.data.length > 0) {
          aiModelSelect.innerHTML = '';
          response.data.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            aiModelSelect.appendChild(option);
          });
          // Restore previous selection if still available
          if (previousModel && [...aiModelSelect.options].some(o => o.value === previousModel)) {
            aiModelSelect.value = previousModel;
          }
          // Persist whatever ended up selected — programmatic changes don't fire 'change'
          autoSave();
        } else {
          // Restore hardcoded fallback on failure
          updateModelOptions(provider);
          if (provider === AI_PROVIDERS.OLLAMA) {
            aiModelSelect.innerHTML = '<option value="" disabled>No models found — is Ollama running?</option>';
          } else if (previousModel) {
            aiModelSelect.value = previousModel;
          }
        }
      }
    );
  }

  // Migrate old data from chrome.storage.sync to local (one-time migration)
  async function migrateFromSync() {
    const syncKeys = ['aiProvider', 'anthropicApiKey', 'openaiApiKey', 'aiModel', 'enableAutofill', 'jiraDomains', 'blacklistDomains', 'descriptionTemplate', 'translateLang'];
    const syncData = await chrome.storage.sync.get(syncKeys);
    const hasOldData = syncKeys.some(k => syncData[k] !== undefined);
    if (!hasOldData) return;

    const localData = {
      aiProvider: syncData.aiProvider,
      aiModel: syncData.aiModel,
      enableAutofill: syncData.enableAutofill,
      jiraDomains: syncData.jiraDomains,
      blacklistDomains: syncData.blacklistDomains,
      descriptionTemplate: syncData.descriptionTemplate,
      translateLang: syncData.translateLang
    };
    // Remove undefined keys
    Object.keys(localData).forEach(k => localData[k] === undefined && delete localData[k]);

    if (syncData.anthropicApiKey) {
      localData.anthropicApiKey_encrypted = await encryptValue(syncData.anthropicApiKey);
    }
    if (syncData.openaiApiKey) {
      localData.openaiApiKey_encrypted = await encryptValue(syncData.openaiApiKey);
    }

    await chrome.storage.local.set(localData);
    await chrome.storage.sync.remove(syncKeys);
  }

  // Load saved settings
  async function loadSettings() {
    await migrateFromSync();

    const result = await chrome.storage.local.get(['aiProvider', 'anthropicApiKey_encrypted', 'openaiApiKey_encrypted', 'googleApiKey_encrypted', 'ollamaApiKey_encrypted', 'ollamaEndpoint', 'aiModel', 'enableAutofill', 'jiraDomains', 'blacklistDomains', 'descriptionTemplate', 'translateLang']);

    if (result.aiProvider) {
      aiProviderSelect.value = result.aiProvider;
    } else {
      aiProviderSelect.value = DEFAULTS.AI_PROVIDER;
    }
    updateProviderUI();

    // Set AI model after updating provider UI
    if (result.aiModel) {
      aiModelSelect.value = result.aiModel;
    } else {
      const provider = aiProviderSelect.value;
      const defaultModel = API_CONFIG[provider.toUpperCase()]?.MODEL;
      if (defaultModel) {
        aiModelSelect.value = defaultModel;
      }
    }

    const anthropicApiKey = result.anthropicApiKey_encrypted
      ? await decryptValue(result.anthropicApiKey_encrypted)
      : null;
    const openaiApiKey = result.openaiApiKey_encrypted
      ? await decryptValue(result.openaiApiKey_encrypted)
      : null;
    const googleApiKey = result.googleApiKey_encrypted
      ? await decryptValue(result.googleApiKey_encrypted)
      : null;
    const ollamaApiKey = result.ollamaApiKey_encrypted
      ? await decryptValue(result.ollamaApiKey_encrypted)
      : null;

    if (aiProviderSelect.value === AI_PROVIDERS.ANTHROPIC && anthropicApiKey) {
      apiKeyInput.value = anthropicApiKey;
    } else if (aiProviderSelect.value === AI_PROVIDERS.OPENAI && openaiApiKey) {
      apiKeyInput.value = openaiApiKey;
    } else if (aiProviderSelect.value === AI_PROVIDERS.GOOGLE && googleApiKey) {
      apiKeyInput.value = googleApiKey;
    } else if (aiProviderSelect.value === AI_PROVIDERS.OLLAMA && ollamaApiKey) {
      apiKeyInput.value = ollamaApiKey;
    }

    if (result.ollamaEndpoint) {
      ollamaEndpointInput.value = result.ollamaEndpoint;
    }

    // Load autofill setting (default: false)
    if (enableAutofillCheckbox) {
      enableAutofillCheckbox.checked = result.enableAutofill === true;
    }

    if (result.jiraDomains) {
      jiraDomainsInput.value = result.jiraDomains.join('\n');
    } else {
      jiraDomainsInput.value = DEFAULTS.JIRA_DOMAINS.join('\n');
    }

    if (result.blacklistDomains) {
      blacklistDomainsInput.value = result.blacklistDomains.join('\n');
    } else {
      blacklistDomainsInput.value = DEFAULTS.BLACKLIST_DOMAINS.join('\n');
    }

    if (result.descriptionTemplate) {
      descriptionTemplateInput.value = result.descriptionTemplate;
    } else {
      descriptionTemplateInput.value = DEFAULTS.DESCRIPTION_TEMPLATE;
    }

    // Load translation language setting
    const translateLangSelect = document.getElementById('translateLang');
    if (translateLangSelect && result.translateLang) {
      translateLangSelect.value = result.translateLang;
    } else if (translateLangSelect) {
      translateLangSelect.value = LANGUAGE_SETTINGS.DEFAULT_TRANSLATE_LANG;
    }

    // Fetch models from API (async, non-blocking)
    fetchAndUpdateModels(aiProviderSelect.value);
  }

  loadSettings();

  // Handle AI provider change
  aiProviderSelect.addEventListener('change', function () {
    updateProviderUI();

    // Set default model for new provider
    const provider = aiProviderSelect.value;
    const defaultModel = API_CONFIG[provider.toUpperCase()]?.MODEL;
    if (defaultModel) {
      aiModelSelect.value = defaultModel;
    }

    // Load the corresponding API key
    chrome.storage.local.get(['anthropicApiKey_encrypted', 'openaiApiKey_encrypted', 'googleApiKey_encrypted', 'ollamaApiKey_encrypted'], async function (result) {
      const anthropicApiKey = result.anthropicApiKey_encrypted
        ? await decryptValue(result.anthropicApiKey_encrypted) : null;
      const openaiApiKey = result.openaiApiKey_encrypted
        ? await decryptValue(result.openaiApiKey_encrypted) : null;
      const googleApiKey = result.googleApiKey_encrypted
        ? await decryptValue(result.googleApiKey_encrypted) : null;
      const ollamaApiKey = result.ollamaApiKey_encrypted
        ? await decryptValue(result.ollamaApiKey_encrypted) : null;

      const provider = aiProviderSelect.value;
      if (provider === AI_PROVIDERS.ANTHROPIC && anthropicApiKey) {
        apiKeyInput.value = anthropicApiKey;
      } else if (provider === AI_PROVIDERS.OPENAI && openaiApiKey) {
        apiKeyInput.value = openaiApiKey;
      } else if (provider === AI_PROVIDERS.GOOGLE && googleApiKey) {
        apiKeyInput.value = googleApiKey;
      } else if (provider === AI_PROVIDERS.OLLAMA && ollamaApiKey) {
        apiKeyInput.value = ollamaApiKey;
      } else {
        apiKeyInput.value = '';
      }

      fetchAndUpdateModels(provider);
    });
  });

  function showStatus(message, isError = false, statusElement = status) {
    statusElement.textContent = message;
    statusElement.className = `status ${isError ? 'error' : 'success'}`;
    statusElement.style.display = 'block';

    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 8000);
  }

  // Tab switching functionality
  function switchTab(tabName) {
    // Update tab buttons
    tabButtons.forEach(button => {
      button.classList.remove('active');
      if (button.dataset.tab === tabName) {
        button.classList.add('active');
      }
    });

    // Update tab contents
    tabContents.forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName + '-tab').classList.add('active');
  }

  // Add tab click event listeners
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.tab);
    });
  });

  async function copyToClipboard(content, isHtml = false) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        if (isHtml) {
          const htmlBlob = new Blob([content.html], { type: 'text/html' });
          const textBlob = new Blob([content.text], { type: 'text/plain' });

          const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          });

          await navigator.clipboard.write([clipboardItem]);
        } else {
          await navigator.clipboard.writeText(content);
        }
      } else {
        fallbackCopyToClipboard(isHtml ? content.text : content);
      }
    } catch (err) {
      showStatus('❌ Failed to copy to clipboard', true);
    }
  }

  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  function parseAndRenderHTML(htmlString) {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    // Create a new div for the rendered content
    const renderedDiv = document.createElement('div');

    // Process each child node
    Array.from(tempDiv.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Handle text nodes
        if (node.textContent.trim()) {
          const textSpan = document.createElement('span');
          textSpan.textContent = node.textContent;
          renderedDiv.appendChild(textSpan);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Handle element nodes
        const clonedNode = node.cloneNode(true);
        renderedDiv.appendChild(clonedNode);
      }
    });

    return renderedDiv;
  }

  function convertHtmlToFormattedText(htmlString) {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    let result = '';

    function extractText(element) {
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          if (text) {
            result += text;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();

          switch (tagName) {
            case 'p':
              extractText(node);
              result += '\n\n';
              break;
            case 'br':
              result += '\n';
              break;
            case 'ul':
            case 'ol':
              result += '\n';
              extractText(node);
              result += '\n';
              break;
            case 'li':
              result += '• ';
              extractText(node);
              result += '\n';
              break;
            case 'strong':
            case 'b':
            case 'em':
            case 'i':
              extractText(node);
              break;
            default:
              extractText(node);
              break;
          }
        }
      }
    }

    extractText(tempDiv);

    // Clean up formatting
    return result
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/^\n+/, '')         // Remove leading newlines
      .replace(/\n+$/, '')         // Remove trailing newlines
      .trim();
  }

  function displayResults(improvedContent) {
    // Clear existing results
    resultsContainer.innerHTML = '';

    if (!improvedContent || Object.keys(improvedContent).length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No improved content available.</div>';
      return;
    }

    // Define the display order: Summary first, then Description
    const fieldOrder = ['summary', 'description'];
    const sortedFields = [];

    // Add fields in the specified order
    fieldOrder.forEach(fieldName => {
      if (improvedContent[fieldName]) {
        sortedFields.push([fieldName, improvedContent[fieldName]]);
      }
    });

    // Add any remaining fields that weren't in the order list
    Object.entries(improvedContent).forEach(([fieldName, content]) => {
      if (!fieldOrder.includes(fieldName)) {
        sortedFields.push([fieldName, content]);
      }
    });

    // Create result items for each improved field
    sortedFields.forEach(([fieldName, content]) => {
      if (content && content.trim()) {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        const title = document.createElement('h5');
        title.textContent = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'result-content';

        // Check if content contains HTML tags
        if (fieldName === 'description' && content.includes('<')) {
          // Render HTML properly for description
          const renderedContent = parseAndRenderHTML(content);
          contentDiv.appendChild(renderedContent);
        } else {
          // Plain text for summary or non-HTML content
          contentDiv.textContent = content;
        }

        const copyIndicator = document.createElement('div');
        copyIndicator.className = 'copy-indicator';
        copyIndicator.textContent = 'Click to Copy';

        resultItem.appendChild(title);
        resultItem.appendChild(contentDiv);
        resultItem.appendChild(copyIndicator);

        // Add click handler for copying content only (excluding title)
        contentDiv.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling

          if (fieldName === 'description' && content.includes('<')) {
            // Copy HTML content with formatting for description
            const formattedText = convertHtmlToFormattedText(content);
            const copyContent = {
              html: content,
              text: formattedText
            };
            copyToClipboard(copyContent, true);
          } else {
            // Plain text for summary or non-HTML content
            copyToClipboard(content, false);
          }

          // Visual feedback
          copyIndicator.textContent = 'Copied!';
          copyIndicator.classList.add('copied-feedback');

          setTimeout(() => {
            copyIndicator.textContent = 'Click to Copy';
            copyIndicator.classList.remove('copied-feedback');
          }, 2000);
        });

        // Also add click handler to copy indicator
        copyIndicator.addEventListener('click', (e) => {
          e.stopPropagation();
          contentDiv.click(); // Trigger the content div click
        });

        resultsContainer.appendChild(resultItem);
      }
    });

    // If no valid content was found
    if (resultsContainer.children.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No valid improved content to display.</div>';
    }
  }

  saveSettingsBtn.addEventListener('click', async function () {
    const provider = aiProviderSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const jiraDomainsText = jiraDomainsInput.value.trim();
    const blacklistDomainsText = blacklistDomainsInput.value.trim();
    const descriptionTemplate = descriptionTemplateInput.value.trim();

    if (!jiraDomainsText) {
      showStatus('⚠️ Please enter at least one JIRA domain', true, settingsStatus);
      return;
    }

    if (!descriptionTemplate) {
      showStatus('⚠️ Please enter a description template', true, settingsStatus);
      return;
    }

    // Parse JIRA domains
    const jiraDomains = jiraDomainsText.split('\n')
      .map(domain => domain.trim())
      .filter(domain => domain.length > 0);

    // Parse blacklist domains
    const blacklistDomains = blacklistDomainsText.split('\n')
      .map(domain => domain.trim())
      .filter(domain => domain.length > 0);

    // Get translation language setting
    const translateLangSelect = document.getElementById('translateLang');
    const translateLang = translateLangSelect ? translateLangSelect.value : LANGUAGE_SETTINGS.DEFAULT_TRANSLATE_LANG;

    // Get autofill setting
    const enableAutofill = enableAutofillCheckbox ? enableAutofillCheckbox.checked : false;

    // Get AI model
    const aiModel = aiModelSelect.value;

    // Prepare settings object
    const settings = {
      aiProvider: provider,
      aiModel: aiModel,
      enableAutofill: enableAutofill,
      jiraDomains: jiraDomains,
      blacklistDomains: blacklistDomains,
      descriptionTemplate: descriptionTemplate,
      translateLang: translateLang
    };

    // Save Ollama endpoint URL
    if (provider === AI_PROVIDERS.OLLAMA) {
      settings.ollamaEndpoint = ollamaEndpointInput.value.trim();
    }

    // Encrypt and save API key for the selected provider
    if (apiKey) {
      const encrypted = await encryptValue(apiKey);
      if (provider === AI_PROVIDERS.ANTHROPIC) {
        settings.anthropicApiKey_encrypted = encrypted;
      } else if (provider === AI_PROVIDERS.OPENAI) {
        settings.openaiApiKey_encrypted = encrypted;
      } else if (provider === AI_PROVIDERS.GOOGLE) {
        settings.googleApiKey_encrypted = encrypted;
      } else if (provider === AI_PROVIDERS.OLLAMA) {
        settings.ollamaApiKey_encrypted = encrypted;
      }
    }

    await chrome.storage.local.set(settings);

    // Show success state
    const originalText = saveSettingsBtn.textContent;
    const originalBgColor = saveSettingsBtn.style.backgroundColor;

    saveSettingsBtn.textContent = '✅ Settings Saved!';
    saveSettingsBtn.style.backgroundColor = '#28a745';
    saveSettingsBtn.disabled = true;

    // Restore original state after 3 seconds
    setTimeout(() => {
      saveSettingsBtn.textContent = originalText;
      saveSettingsBtn.style.backgroundColor = originalBgColor;
      saveSettingsBtn.disabled = false;
    }, 3000);
  });

  insertTemplateBtn.addEventListener('click', async function () {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'insertTemplate'
      });

      if (result.success) {
        // Show success state
        const originalBgColor = insertTemplateBtn.style.backgroundColor;

        insertTemplateBtn.textContent = '✅ Template Inserted!';
        insertTemplateBtn.style.backgroundColor = '#28a745';

        // Restore original state after 3 seconds
        setTimeout(() => {
          insertTemplateBtn.textContent = '📝 Use Template';
          insertTemplateBtn.style.backgroundColor = originalBgColor;
        }, 3000);
      } else {
        showStatus(result.error || 'Failed to insert template', true);
      }
    } catch (error) {
      showStatus('❌ Error: ' + error.message, true);
    }
  });

  improveBtn.addEventListener('click', async function () {
    improveBtn.disabled = true;
    improveBtn.textContent = '⏳ Improving...';

    try {
      // Get selected translation language
      const translateLangSelect = document.getElementById('translateLang');
      const translateLang = translateLangSelect ? translateLangSelect.value : TRANSLATION_LANGUAGES.NONE;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'improveTicket',
        translateLang: translateLang
      });

      if (result.success) {
        // Ticket improved successfully - no status message needed

        // Display the improved content in the results section
        if (result.improvedContent) {
          displayResults(result.improvedContent);
        }
      } else {
        showStatus(result.error || 'Failed to improve ticket', true);
      }
    } catch (error) {
      showStatus('❌ Error: ' + error.message, true);
    } finally {
      improveBtn.disabled = false;
      improveBtn.textContent = '✨ Improve Current Ticket';
    }
  });

  // Auto-save for Provider, API Key, and Model (without Save Button)
  async function autoSave() {
    const provider = aiProviderSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const model = aiModelSelect.value;

    const settings = {
      aiProvider: provider,
      aiModel: model
    };

    if (provider === AI_PROVIDERS.OLLAMA) {
      settings.ollamaEndpoint = ollamaEndpointInput.value.trim();
    }

    // Encrypt and save API key for the selected provider
    if (apiKey) {
      const encrypted = await encryptValue(apiKey);
      if (provider === AI_PROVIDERS.ANTHROPIC) {
        settings.anthropicApiKey_encrypted = encrypted;
      } else if (provider === AI_PROVIDERS.OPENAI) {
        settings.openaiApiKey_encrypted = encrypted;
      } else if (provider === AI_PROVIDERS.GOOGLE) {
        settings.googleApiKey_encrypted = encrypted;
      } else if (provider === AI_PROVIDERS.OLLAMA) {
        settings.ollamaApiKey_encrypted = encrypted;
      }
    }

    chrome.storage.local.set(settings);
  }

  // Add auto-save event listeners
  aiProviderSelect.addEventListener('change', autoSave);
  aiModelSelect.addEventListener('change', autoSave);

  // Auto-save API key with debouncing, then refresh model list
  let apiKeyTimeout;
  apiKeyInput.addEventListener('input', function() {
    clearTimeout(apiKeyTimeout);
    apiKeyTimeout = setTimeout(async () => {
      await autoSave();
      fetchAndUpdateModels(aiProviderSelect.value);
    }, 1000);
  });

  // Auto-save Ollama endpoint with debouncing, then refresh model list
  let endpointTimeout;
  ollamaEndpointInput.addEventListener('input', function() {
    clearTimeout(endpointTimeout);
    endpointTimeout = setTimeout(async () => {
      await autoSave();
      fetchAndUpdateModels(AI_PROVIDERS.OLLAMA);
    }, 1000);
  });

  // Handle translate language change - save immediately
  const translateLangSelect = document.getElementById('translateLang');
  if (translateLangSelect) {
    translateLangSelect.addEventListener('change', function () {
      const translateLang = translateLangSelect.value;
      chrome.storage.local.set({ translateLang: translateLang });
    });
  }

  // Clear previous results on panel load
  chrome.storage.local.remove('lastImprovedContent');

  // Theme Toggle Functionality
  function updateThemeIcon(theme) {
    const sunIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`;
    const moonIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`;

    themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon;
    themeToggle.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';

    // Update logo based on theme
    const footerLogo = document.querySelector('.footer-logo');
    if (footerLogo) {
      footerLogo.src = theme === 'dark' ? 'static/img/logo-w.png' : 'static/img/logo.png';
    }
  }

  // Load current theme
  chrome.storage.local.get('theme', function(data) {
    const currentTheme = data.theme || 'light';
    updateThemeIcon(currentTheme);
  });

  // Handle theme toggle click
  themeToggle.addEventListener('click', function() {
    chrome.storage.local.get('theme', function(data) {
      const currentTheme = data.theme || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      // Save to chrome storage
      chrome.storage.local.set({ theme: newTheme }, function() {
        // Update the UI
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
      });
    });
  });
});