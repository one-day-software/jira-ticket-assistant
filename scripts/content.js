// ============================================================================
// CONSTANTS & SELECTORS
// ============================================================================

// Unified description selectors (used for both autofill and content reading)
// When used for autofill: filtered to only editable elements
// When used for reading: accepts all elements including readonly
const DESCRIPTION_SELECTORS = [
  // Editable fields (priority for autofill)
  '#ak-editor-textarea',
  'textarea[name="description"]',
  'textarea[id="description"]',
  'textarea[id*="description"]',
  '[contenteditable="true"][aria-label*="Description"]',
  '[contenteditable="true"][aria-label*="description"]',
  '[data-testid="issue.views.field.rich-text.description"]',
  '[data-testid="issue.views.field.rich-text.description"] textarea',
  '[data-testid*="description"] textarea',
  '[data-testid*="description"] [contenteditable="true"]',
  '[data-field-name="description"]',
  '[data-field-name="description"] textarea',
  '[data-field-name="description"] [contenteditable="true"]',
  '[data-field-id="description"]',
  '[aria-label*="start typing"][contenteditable="true"]',
  '.ak-editor-content-area [contenteditable="true"]',
  '.ak-editor-content-area textarea',
  '.field-description',
  '.description-field',
  '.create-issue-dialog [data-testid*="description"]',
  '.aui-dialog2 [data-testid*="description"]',
  '.jira-dialog [data-testid*="description"]',
  '[data-testid*="description"]',

  // Readonly display fields (used for content reading)
  '#description-field',
  '#description-val',
  '#description-field-readonly',
  '.user-content-block',
  '.wiki-content',
  '.issue-body-content',
  '#descriptionmodule .user-content-block',
  '.description-block',
  '.field-description .user-content-block',
  '.issue-field[data-field-name="description"]',
  '.property-list .description',
  '#issue-field-description',
  '.issue-view .description',
  '.issue-container .description',
  '.field-group .description',
  '.aui-field-description',
  '.issue-details .description',
  '[data-component-selector*="description"]',
  '.js-issue-description',
  '.issue-body .content'
];

// Summary content selectors (for reading content)
const SUMMARY_CONTENT_SELECTORS = [
  '#summary-field',
  '#summary-val',
  '[data-field-id="summary"]',
  'h1#summary',
  '.issue-header-content h1',
  '[aria-label="Summary"]',
  'input[name="summary"]',
  '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
  '.issue-header h1',
  '.issue-view h1',
  'h1[data-testid*="summary"]',
  '.ghx-summary',
  '.issue-title',
  '.summary',
  '.issue-content h1',
  'h1[data-field-name="summary"]',
  '[data-component-selector="jira-issue-view"] h1',
  '.js-issue-title',
  '#issue-content h1'
];


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

function isDescriptionField(element) {
  if (!element) return false;

  const ariaLabel = element.getAttribute('aria-label') || '';
  const testId = element.getAttribute('data-testid') || '';
  const id = element.id || '';

  return (
    ariaLabel.toLowerCase().includes('description') ||
    testId.includes('description') ||
    id === 'ak-editor-textarea' ||
    element.tagName === 'TEXTAREA' && (
      element.name === 'description' ||
      id.includes('description')
    )
  );
}

function hasDescriptionEditor() {
  for (const selector of DESCRIPTION_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 &&
        window.getComputedStyle(element).visibility !== 'hidden';
      if (isVisible) return true;
    }
  }
  return false;
}

function highlightElement(element, duration = 3000) {
  if (!element || !element.style) return;

  // Save original styles
  const originalBorder = element.style.border;
  const originalBoxShadow = element.style.boxShadow;
  const originalOutline = element.style.outline;

  // Apply blue highlight
  element.style.border = '3px solid #2196F3';
  element.style.boxShadow = '0 0 10px rgba(33, 150, 243, 0.5)';
  element.style.outline = 'none';

  // Restore original styles after duration
  setTimeout(() => {
    element.style.border = originalBorder;
    element.style.boxShadow = originalBoxShadow;
    element.style.outline = originalOutline;
  }, duration);
}


// ============================================================================
// DOMAIN CHECKING FUNCTIONS
// ============================================================================

function isAllowedDomain(domains) {
  const currentHost = window.location.hostname;
  const currentPath = window.location.pathname;
  const currentUrl = window.location.href;

  return domains.some(domain => {
    const cleanDomain = domain.replace(/[*]/g, '').trim();

    if (domain.includes('*')) {
      if (domain.startsWith('*.')) {
        const baseDomain = domain.substring(2);
        return currentHost.endsWith(baseDomain);
      } else if (domain.includes('/*')) {
        const pathPattern = domain.replace(/[*]/g, '');
        return currentPath.includes(pathPattern) || currentUrl.includes(pathPattern);
      }
    } else {
      return currentHost === cleanDomain || currentHost.includes(cleanDomain);
    }

    return false;
  });
}

function isBlacklistedDomain(blacklistDomains) {
  const currentHost = window.location.hostname;
  const currentPath = window.location.pathname;
  const currentUrl = window.location.href;

  if (!blacklistDomains || blacklistDomains.length === 0) {
    return false;
  }

  return blacklistDomains.some(domain => {
    const cleanDomain = domain.replace(/[*]/g, '').trim();

    if (domain.includes('*')) {
      if (domain.startsWith('*.')) {
        const baseDomain = domain.substring(2);
        return currentHost.endsWith(baseDomain);
      } else if (domain.includes('/*')) {
        const pathPattern = domain.replace(/[*]/g, '');
        return currentPath.includes(pathPattern) || currentUrl.includes(pathPattern);
      }
    } else {
      return currentHost === cleanDomain || currentHost.includes(cleanDomain) || currentUrl.includes(domain);
    }

    return false;
  });
}


// ============================================================================
// AUTO FILL SYSTEM
// ============================================================================

let autofillState = {
  isWatching: false,
  checkCount: 0,
  maxChecks: 5,
  descriptionElementPresent: false,
  autofillApplied: false,
  currentUrl: '',
  isEnabled: false
};

async function findDescriptionField(waitForIt = false) {
  let descriptionField = null;

  // Loop through all selectors and find an EDITABLE field
  for (const selector of DESCRIPTION_SELECTORS) {
    descriptionField = document.querySelector(selector);
    if (descriptionField) {
      const rect = descriptionField.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;

      // Filter: only accept editable elements for autofill
      const isEditable = descriptionField.contentEditable === 'true' || descriptionField.tagName === 'TEXTAREA';

      if (isVisible && isEditable) {
        return descriptionField;
      }
      descriptionField = null;
    }
  }

  if (waitForIt && !descriptionField) {
    try {
      descriptionField = await waitForElement('#ak-editor-textarea, textarea[name="description"]', 2000);
    } catch (error) {
      return null;
    }
  }

  return descriptionField;
}

function fillDescriptionField(descriptionField, template) {
  if (descriptionField.tagName.toLowerCase() === 'textarea') {
    descriptionField.value = template;
    descriptionField.dispatchEvent(new Event('input', { bubbles: true }));
    descriptionField.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (descriptionField.contentEditable === 'true') {
    descriptionField.focus();
    descriptionField.innerHTML = template;
    descriptionField.dispatchEvent(new Event('input', { bubbles: true }));
    descriptionField.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => descriptionField.blur(), 100);
  }
}

async function autofillDescription(template) {
  try {
    const descriptionField = await findDescriptionField(true);
    if (!descriptionField) return;

    // Check if field already has content
    const currentContent = descriptionField.value || descriptionField.textContent || descriptionField.innerHTML || '';
    const trimmedContent = currentContent.trim();

    // Skip if field has meaningful content
    if (trimmedContent.length > 0 &&
      !trimmedContent.includes('start typing') &&
      !trimmedContent.includes('placeholder') &&
      !trimmedContent.includes('Type @') &&
      !descriptionField.querySelector('.placeholder-decoration')) {
      return;
    }

    fillDescriptionField(descriptionField, template);

    // Mark autofill as applied
    autofillState.autofillApplied = true;
  } catch (error) {
    // Silently handle errors
  }
}

async function initializeAutofill() {
  try {
    if (!chrome?.storage?.sync) return;

    const result = await chrome.storage.local.get(['enableAutofill', 'jiraDomains', 'blacklistDomains', 'descriptionTemplate']);

    if (result.enableAutofill !== true) return;

    const blacklistDomains = result.blacklistDomains || DEFAULTS.BLACKLIST_DOMAINS;
    if (isBlacklistedDomain(blacklistDomains)) return;

    const jiraDomains = result.jiraDomains || DEFAULTS.JIRA_DOMAINS;
    const descriptionTemplate = result.descriptionTemplate || DEFAULTS.DESCRIPTION_TEMPLATE;

    if (!isAllowedDomain(jiraDomains)) return;

    setTimeout(() => {
      autofillDescription(descriptionTemplate);
    }, 200);
  } catch (error) {
    // Silently handle errors
  }
}

function handlePotentialAutofill() {
  try {
    if (!autofillState.isEnabled) return;

    if (autofillState.currentUrl && window.location.href !== autofillState.currentUrl) {
      autofillState.descriptionElementPresent = false;
      autofillState.autofillApplied = false;
      autofillState.currentUrl = window.location.href;
    }

    if (autofillState.autofillApplied && autofillState.descriptionElementPresent) return;

    const hasEditor = hasDescriptionEditor();

    if (hasEditor && !autofillState.descriptionElementPresent) {
      autofillState.descriptionElementPresent = true;
      autofillState.autofillApplied = false;
      initializeAutofill();
    } else if (!hasEditor && autofillState.descriptionElementPresent) {
      autofillState.descriptionElementPresent = false;
      autofillState.autofillApplied = false;
    } else if (hasEditor && !autofillState.autofillApplied) {
      initializeAutofill();
    }
  } catch (error) {
    // Silently handle errors
  }
}

async function startAutofillSystem() {
  if (autofillState.isWatching) return;

  // Check if autofill is enabled first
  try {
    const result = await chrome.storage.local.get(['enableAutofill']);
    autofillState.isEnabled = result.enableAutofill === true;

    if (!autofillState.isEnabled) {
      return;
    }
  } catch (error) {
    return;
  }

  autofillState.isWatching = true;
  autofillState.currentUrl = window.location.href;

  // MutationObserver for DOM changes
  const observer = new MutationObserver((mutations) => {
    const hasRelevantChanges = mutations.some(mutation => {
      if (mutation.type !== 'childList' || !mutation.addedNodes.length) return false;

      return Array.from(mutation.addedNodes).some(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;

        return DESCRIPTION_SELECTORS.some(selector => {
          try {
            return node.matches?.(selector) || node.querySelector?.(selector);
          } catch {
            return false;
          }
        });
      });
    });

    if (hasRelevantChanges) handlePotentialAutofill();
  });

  observer.observe(document, { subtree: true, childList: true });

  // Periodic checks
  const periodicCheck = setInterval(() => {
    autofillState.checkCount++;
    handlePotentialAutofill();

    if (autofillState.checkCount >= autofillState.maxChecks) {
      clearInterval(periodicCheck);
    }
  }, 2000);

  // Focus and click event listeners
  let focusTimeout;
  document.addEventListener('focus', (event) => {
    if (isDescriptionField(event.target)) {
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => handlePotentialAutofill(), 300);
    }
  }, true);

  let clickTimeout;
  document.addEventListener('click', (event) => {
    if (isDescriptionField(event.target) || event.target.closest('[data-testid*="description"], .ak-editor-content-area')) {
      clearTimeout(clickTimeout);
      clickTimeout = setTimeout(() => handlePotentialAutofill(), 300);
    }
  }, true);

  setTimeout(() => handlePotentialAutofill(), 1500);
}

async function insertTemplateManually() {
  try {
    const result = await chrome.storage.local.get(['descriptionTemplate']);
    const descriptionTemplate = result.descriptionTemplate || DEFAULTS.DESCRIPTION_TEMPLATE;
    const success = await insertTemplateIntoField(descriptionTemplate);

    if (success) {
      return { success: true, message: 'Template inserted successfully' };
    } else {
      throw new Error('Could not find description field on this page');
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function insertTemplateIntoField(template) {
  try {
    const descriptionField = await findDescriptionField(false);
    if (!descriptionField) return false;

    fillDescriptionField(descriptionField, template);
    return true;
  } catch (error) {
    return false;
  }
}


// ============================================================================
// IMPROVE TICKET SYSTEM
// ============================================================================

async function improveTicket(translateLang = TRANSLATION_LANGUAGES.NONE) {
  try {
    let summaryElement = null;
    let descriptionElement = null;

    // Find summary element
    for (const selector of SUMMARY_CONTENT_SELECTORS) {
      summaryElement = document.querySelector(selector);
      if (summaryElement) {
        break;
      }
    }

    // Find description element (accepts all elements, including readonly)
    for (const selector of DESCRIPTION_SELECTORS) {
      descriptionElement = document.querySelector(selector);
      if (descriptionElement) {
        break;
      }
    }

    if (!summaryElement && !descriptionElement) {
      throw new Error('No ticket fields found. Please navigate to a JIRA ticket page.');
    }

    // Highlight found elements with blue border for 3 seconds
    if (summaryElement) {
      highlightElement(summaryElement, 3000);
    }
    if (descriptionElement) {
      highlightElement(descriptionElement, 3000);
    }

    // Extract summary text
    let summary = '';
    if (summaryElement) {
      summary = summaryElement.value ||
        summaryElement.textContent ||
        summaryElement.innerText ||
        '';
      summary = summary.trim();
    }

    // Extract description text
    let description = '';
    if (descriptionElement) {
      // Try to get rich content first
      const paragraphs = descriptionElement.querySelectorAll('p');
      if (paragraphs.length > 0) {
        description = Array.from(paragraphs)
          .map(p => p.textContent || '')
          .filter(text => text.trim() && !text.includes('We support markdown'))
          .join('\n\n');
      } else {
        // Fallback to plain text
        description = descriptionElement.value ||
          descriptionElement.textContent ||
          descriptionElement.innerText ||
          '';
      }
      description = description.trim();
    }

    if (!summary.trim() && !description.trim()) {
      throw new Error('No content found to improve. Please enter some text in the Summary or Description fields.');
    }

    const response = await chrome.runtime.sendMessage({
      action: 'callAI',
      summary: summary,
      description: description,
      translateLang: translateLang
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const improvedContent = response.data;

    // Store the improved content for the side panel
    const results = {
      summary: improvedContent.summary,
      description: improvedContent.description
    };

    chrome.storage.local.set({ lastImprovedContent: results });

    return {
      success: true,
      improvedContent: results
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}


// ============================================================================
// MESSAGE LISTENERS & INITIALIZATION
// ============================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'improveTicket') {
    improveTicket(request.translateLang)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'insertTemplate') {
    insertTemplateManually()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => handlePotentialAutofill(), 500);
  });
} else {
  setTimeout(() => handlePotentialAutofill(), 500);
}

// Start autofill system
startAutofillSystem();
