// Load theme immediately to prevent flash
(function() {
    // Try to get theme from localStorage first (synchronous backup)
    const cachedTheme = localStorage.getItem('theme');
    if (cachedTheme) {
        document.documentElement.setAttribute('data-theme', cachedTheme);
    }

    // Then verify with chrome.storage (authoritative source)
    chrome.storage.local.get('theme', function(data) {
        const theme = data.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        // Keep localStorage in sync
        localStorage.setItem('theme', theme);
    });
})();
