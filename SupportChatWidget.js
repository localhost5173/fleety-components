(function(window, document) {
    'use strict';

    const API_URL = 'https://api.fleety.dev/v1';

    class SupportChatWidget {
        constructor(config) {
            if (!config || !config.projectId) {
                console.error('SupportChatWidget: projectId is required');
                return;
            }

            this.projectId = config.projectId;
            this.theme = config.theme || 'fleety';
            this.dockPosition = config.dockPosition || 'bottom-right';
            
            this.isOpen = false;
            this.messages = [];
            this.conversationHistory = [];
            this.isTyping = false;
            this.anonToken = '';
            this.tokenExpiresAt = null;
            this.currentMessage = '';
            this.activeTheme = this.theme;
            
            // DOM Elements
            this.container = null;
            this.chatContainer = null;
            this.messagesContainer = null;
            this.inputElement = null;
            this.toggleButton = null;

            this.init();
        }

        async init() {
            await this.loadMarked();
            this.injectStyles();
            this.detectTheme();
            this.createDOM();
            this.setupEventListeners();
            this.setupMarkedRenderer();
            this.setupGlobalCopyFunctions();

            // Auto-show logic
            setTimeout(() => {
                if (!this.isOpen) {
                    // Animation logic could go here
                }
            }, 5000);
        }

        loadMarked() {
            return new Promise((resolve, reject) => {
                if (window.marked) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        detectTheme() {
            if (this.theme === 'system') {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                this.activeTheme = mediaQuery.matches ? 'dark' : 'light';
                
                mediaQuery.addEventListener('change', (e) => {
                    this.activeTheme = e.matches ? 'dark' : 'light';
                    this.updateTheme();
                });
            } else {
                this.activeTheme = this.theme;
            }
        }

        updateTheme() {
            if (this.chatContainer) {
                this.chatContainer.setAttribute('data-theme', this.activeTheme);
            }
            if (this.toggleButton) {
                this.toggleButton.parentElement.setAttribute('data-theme', this.activeTheme);
            }
        }

        injectStyles() {
            const styleId = 'fleety-chat-widget-styles';
            if (document.getElementById(styleId)) return;

            const css = `
                #fleety-chat-widget .chat-container, #fleety-chat-widget .chat-toggle-button {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    box-sizing: border-box;
                }
                #fleety-chat-widget * {
                    box-sizing: border-box;
                }

                /* Theme Variables */
                #fleety-chat-widget .chat-container[data-theme='light'], #fleety-chat-widget .chat-toggle-button[data-theme='light'] {
                    --bg-primary: #ffffff;
                    --bg-secondary: #f9fafb;
                    --bg-hover: #f3f4f6;
                    --text-primary: #111827;
                    --text-secondary: #6b7280;
                    --border-color: #e5e7eb;
                    --accent-color: var(--custom-accent, #3b82f6);
                    --user-msg-bg: var(--custom-accent, #3b82f6);
                    --user-msg-text: #ffffff;
                    --ai-msg-bg: #e5e7eb;
                    --ai-msg-text: #111827;
                    --ai-msg-border: #e5e7eb;
                    --shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                }

                #fleety-chat-widget .chat-container[data-theme='dark'], #fleety-chat-widget .chat-toggle-button[data-theme='dark'] {
                    --bg-primary: #1e1e1e;
                    --bg-secondary: #2d2d2d;
                    --bg-hover: #3a3a3a;
                    --text-primary: #eaeaea;
                    --text-secondary: #9ca3af;
                    --border-color: #404040;
                    --accent-color: var(--custom-accent, #3b82f6);
                    --user-msg-bg: var(--custom-accent, #3b82f6);
                    --user-msg-text: #ffffff;
                    --ai-msg-bg: #2d2d2d;
                    --ai-msg-text: #eaeaea;
                    --ai-msg-border: #404040;
                    --shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                }

                #fleety-chat-widget .chat-container[data-theme='material'], #fleety-chat-widget .chat-toggle-button[data-theme='material'] {
                    --bg-primary: #ffffff;
                    --bg-secondary: #fafafa;
                    --bg-hover: #f5f5f5;
                    --text-primary: #212121;
                    --text-secondary: #757575;
                    --border-color: #e0e0e0;
                    --accent-color: var(--custom-accent, #1976d2);
                    --user-msg-bg: var(--custom-accent, #1976d2);
                    --user-msg-text: #ffffff;
                    --ai-msg-bg: #f5f5f5;
                    --ai-msg-text: #212121;
                    --ai-msg-border: #e0e0e0;
                    --shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
                }

                #fleety-chat-widget .chat-container[data-theme='nord'], #fleety-chat-widget .chat-toggle-button[data-theme='nord'] {
                    --bg-primary: #2e3440;
                    --bg-secondary: #3b4252;
                    --bg-hover: #434c5e;
                    --text-primary: #eceff4;
                    --text-secondary: #d8dee9;
                    --border-color: #4c566a;
                    --accent-color: #88c0d0;
                    --user-msg-bg: #88c0d0;
                    --user-msg-text: #2e3440;
                    --ai-msg-bg: #3b4252;
                    --ai-msg-text: #eceff4;
                    --ai-msg-border: #4c566a;
                    --shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
                }

                #fleety-chat-widget .chat-container[data-theme='fleety'], #fleety-chat-widget .chat-toggle-button[data-theme='fleety'] {
                    --bg-primary: #232627;
                    --bg-secondary: #2d3133;
                    --bg-hover: #363a3c;
                    --text-primary: #ffffff;
                    --text-secondary: #b8babb;
                    --border-color: #3d4245;
                    --accent-color: #f1be00;
                    --user-msg-bg: #f1be00;
                    --user-msg-text: #232627;
                    --ai-msg-bg: #2d3133;
                    --ai-msg-text: #ffffff;
                    --ai-msg-border: #3d4245;
                    --shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
                }

                #fleety-chat-widget .chat-toggle-button {
                    position: fixed;
                    z-index: 9999;
                }

                #fleety-chat-widget .chat-toggle-button[data-dock='bottom-right'] { bottom: 20px; right: 20px; }
                #fleety-chat-widget .chat-toggle-button[data-dock='bottom-left'] { bottom: 20px; left: 20px; }
                #fleety-chat-widget .chat-toggle-button[data-dock='top-right'] { top: 20px; right: 20px; }
                #fleety-chat-widget .chat-toggle-button[data-dock='top-left'] { top: 20px; left: 20px; }

                #fleety-chat-widget .toggle-button {
                    display: flex;
                    height: 60px;
                    width: 60px;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    border: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    transition: all 0.2s;
                    cursor: pointer;
                    background: var(--accent-color);
                    color: white;
                }

                #fleety-chat-widget .chat-toggle-button[data-theme='fleety'] .toggle-button {
                    color: #232627;
                }

                #fleety-chat-widget .toggle-button:hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
                }

                #fleety-chat-widget .toggle-button:active {
                    transform: scale(0.95);
                }

                #fleety-chat-widget .icon-container {
                    position: relative;
                    width: 24px;
                    height: 24px;
                }

                #fleety-chat-widget .toggle-button .icon {
                    width: 24px;
                    height: 24px;
                    position: absolute;
                    top: 0;
                    left: 0;
                    transition: opacity 0.3s ease, transform 0.3s ease;
                }

                #fleety-chat-widget .icon-default { opacity: 1; transform: rotate(0deg) scale(1); }
                #fleety-chat-widget .icon-close { opacity: 0; transform: rotate(90deg) scale(0.8); }

                #fleety-chat-widget .icon-container.open .icon-default { opacity: 0; transform: rotate(-90deg) scale(0.8); }
                #fleety-chat-widget .icon-container.open .icon-close { opacity: 1; transform: rotate(0deg) scale(1); }

                #fleety-chat-widget .chat-container {
                    position: fixed;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    border-radius: 12px;
                    box-shadow: var(--shadow);
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                    width: 420px;
                    max-width: calc(100vw - 40px);
                    height: 650px;
                    max-height: calc(100vh - 120px);
                    opacity: 0;
                    pointer-events: none;
                    transform: translateY(20px);
                    transition: opacity 0.3s ease, transform 0.3s ease;
                }

                #fleety-chat-widget .chat-container.open {
                    opacity: 1;
                    pointer-events: all;
                    transform: translateY(0);
                }

                #fleety-chat-widget .chat-container[data-dock='bottom-right'] { bottom: 100px; right: 20px; }
                #fleety-chat-widget .chat-container[data-dock='bottom-left'] { bottom: 100px; left: 20px; }
                #fleety-chat-widget .chat-container[data-dock='top-right'] { top: 100px; right: 20px; }
                #fleety-chat-widget .chat-container[data-dock='top-left'] { top: 100px; left: 20px; }

                #fleety-chat-widget .chat-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    background: var(--accent-color);
                    color: white;
                    border-radius: 12px 12px 0 0;
                    flex-shrink: 0;
                }

                #fleety-chat-widget .chat-container[data-theme='fleety'] .chat-header {
                    color: #232627;
                }

                #fleety-chat-widget .header-left, #fleety-chat-widget .header-right {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                #fleety-chat-widget .header-title {
                    font-weight: 600;
                    font-size: 16px;
                }

                #fleety-chat-widget .minimize-button {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: inherit;
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                #fleety-chat-widget .minimize-button:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                #fleety-chat-widget .chat-container[data-theme='fleety'] .minimize-button:hover {
                    background: rgba(0, 0, 0, 0.1);
                }

                #fleety-chat-widget .messages-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    background: var(--bg-secondary);
                }

                #fleety-chat-widget .message-wrapper {
                    display: flex;
                    animation: fadeIn 0.3s ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                #fleety-chat-widget .message-wrapper.user { justify-content: flex-end; }
                #fleety-chat-widget .message-wrapper.ai { justify-content: flex-start; }

                #fleety-chat-widget .message-bubble {
                    max-width: 85%;
                    border-radius: 12px;
                    padding: 8px 12px !important;
                    font-size: 14px;
                    line-height: 1.5;
                }

                #fleety-chat-widget .message-bubble.user {
                    background: var(--user-msg-bg);
                    color: var(--user-msg-text);
                    border-bottom-right-radius: 4px;
                }

                #fleety-chat-widget .message-bubble.ai {
                    background: var(--ai-msg-bg);
                    color: var(--ai-msg-text);
                    border: 1px solid var(--ai-msg-border);
                    border-bottom-left-radius: 4px;
                }

                #fleety-chat-widget .source-citation {
                    background: rgba(0, 0, 0, 0.5);
                    padding: 8px 10px;
                    border-radius: 6px;
                    border: 1px solid rgba(107, 114, 128, 0.5);
                    font-size: 12px;
                    margin-top: 8px;
                }

                #fleety-chat-widget .source-label {
                    color: #9ca3af;
                }

                #fleety-chat-widget .source-text {
                    color: #d1d5db;
                }

                #fleety-chat-widget .typing-indicator {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 8px 12px;
                    background: var(--ai-msg-bg);
                    border: 1px solid var(--ai-msg-border);
                    border-radius: 12px;
                    border-bottom-left-radius: 4px;
                }

                #fleety-chat-widget .typing-dots { display: flex; gap: 4px; }
                #fleety-chat-widget .dot {
                    width: 6px;
                    height: 6px;
                    background: var(--text-secondary);
                    border-radius: 50%;
                    animation: bounce 1.4s infinite;
                }

                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-6px); }
                }

                #fleety-chat-widget .input-area {
                    padding: 16px 20px;
                    background: var(--bg-primary);
                    border-top: 1px solid var(--border-color);
                    flex-shrink: 0;
                }

                #fleety-chat-widget .input-wrapper {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                #fleety-chat-widget .message-input {
                    flex: 1;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 14px;
                    font-family: inherit;
                    color: var(--text-primary);
                    transition: border-color 0.2s;
                    outline: none;
                }

                #fleety-chat-widget .message-input:focus { border-color: var(--accent-color); }
                #fleety-chat-widget .message-input::placeholder { color: var(--text-secondary); }

                #fleety-chat-widget .send-button {
                    background: var(--accent-color);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.1s;
                    flex-shrink: 0;
                }

                #fleety-chat-widget .chat-container[data-theme='fleety'] .send-button { color: #232627; }
                #fleety-chat-widget .send-button:hover:not(:disabled) { opacity: 0.9; transform: scale(1.05); }
                #fleety-chat-widget .send-button:active:not(:disabled) { transform: scale(0.95); }
                #fleety-chat-widget .send-button:disabled { opacity: 0.4; cursor: not-allowed; }

                /* Message Content Styles */
                #fleety-chat-widget .message-content { word-wrap: break-word; overflow-wrap: break-word; line-height: 1.5; padding: 0 !important; }
                #fleety-chat-widget .message-content a { color: inherit; text-decoration: underline; }
                #fleety-chat-widget .message-content h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; line-height: 1.3; }
                #fleety-chat-widget .message-content h2 { font-size: 1.3em; font-weight: bold; margin: 0.5em 0 0.4em; line-height: 1.3; }
                #fleety-chat-widget .message-content h3 { font-size: 1.1em; font-weight: bold; margin: 0.4em 0 0.3em; line-height: 1.3; }
                #fleety-chat-widget .message-content p { margin: 0.25em 0 !important; line-height: 1.5; }
                #fleety-chat-widget .message-content ul, #fleety-chat-widget .message-content ol { margin: 0.5em 0 0.5em 1.25em; padding-left: 0.5em; }
                #fleety-chat-widget .message-content li { margin: 0.25em 0; line-height: 1.4; }
                #fleety-chat-widget .message-content ul li { list-style-type: disc; }
                #fleety-chat-widget .message-content ol li { list-style-type: decimal; }
                #fleety-chat-widget .message-content strong { font-weight: 700; }
                #fleety-chat-widget .message-content em { font-style: italic; }
                
                #fleety-chat-widget .message-content .blockquote-wrapper { position: relative; margin: 0.5em 0; }
                #fleety-chat-widget .message-content .message-blockquote {
                    position: relative;
                    border-left: 3px solid currentColor;
                    padding-left: 0.75em;
                    padding-right: 2em;
                    margin-left: 0.5em;
                    opacity: 0.85;
                    font-style: italic;
                    margin: 0;
                }

                #fleety-chat-widget .message-content .copy-quote-btn {
                    position: absolute;
                    top: 0.25em;
                    right: 0.25em;
                    background: transparent;
                    border: none;
                    padding: 0.25em;
                    border-radius: 3px;
                    cursor: pointer;
                    opacity: 0.6;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #fleety-chat-widget .message-content .copy-quote-btn:hover { opacity: 1; background-color: rgba(127, 127, 127, 0.15); }

                #fleety-chat-widget .message-content .message-link { text-decoration: underline; opacity: 0.9; transition: opacity 0.2s; font-weight: 500; }
                #fleety-chat-widget .message-content .message-link:hover { opacity: 1; }

                #fleety-chat-widget .message-content .message-inline-code {
                    background-color: rgba(127, 127, 127, 0.15);
                    padding: 0.15em 0.4em;
                    border-radius: 3px;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 0.9em;
                    border: 1px solid rgba(127, 127, 127, 0.2);
                }

                #fleety-chat-widget .message-content .inline-code-wrapper { display: inline-flex; align-items: center; gap: 0.25em; position: relative; }
                #fleety-chat-widget .message-content .copy-inline-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: none;
                    padding: 0.2em;
                    border-radius: 2px;
                    cursor: pointer;
                    opacity: 0;
                    transition: all 0.2s;
                    vertical-align: middle;
                }
                #fleety-chat-widget .message-content .inline-code-wrapper:hover .copy-inline-btn { opacity: 0.7; }
                #fleety-chat-widget .message-content .copy-inline-btn:hover { opacity: 1 !important; background-color: rgba(127, 127, 127, 0.2); }

                #fleety-chat-widget .message-content .code-block-wrapper { margin: 0.5em 0; border-radius: 6px; overflow: hidden; }
                #fleety-chat-widget .message-content .code-block-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.4em 0.75em;
                    background-color: rgba(127, 127, 127, 0.1);
                    border-bottom: 1px solid rgba(127, 127, 127, 0.15);
                }
                #fleety-chat-widget .message-content .code-language { font-size: 0.75em; text-transform: uppercase; opacity: 0.6; font-weight: 600; letter-spacing: 0.05em; }
                #fleety-chat-widget .message-content .copy-code-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.3em;
                    background: transparent;
                    border: none;
                    padding: 0.25em 0.5em;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.75em;
                    font-weight: 500;
                    opacity: 0.7;
                    transition: all 0.2s;
                }
                #fleety-chat-widget .message-content .copy-code-btn:hover { opacity: 1; background-color: rgba(127, 127, 127, 0.15); }
                #fleety-chat-widget .message-content .message-code-block {
                    background-color: rgba(127, 127, 127, 0.05);
                    border: 1px solid rgba(127, 127, 127, 0.15);
                    border-top: none;
                    padding: 0.75em;
                    border-radius: 0 0 6px 6px;
                    overflow-x: auto;
                    margin: 0;
                }
                #fleety-chat-widget .message-content .message-code-block code { font-family: 'Courier New', Courier, monospace; font-size: 0.9em; line-height: 1.5; }
                #fleety-chat-widget .message-content hr { border: none; border-top: 1px solid currentColor; opacity: 0.3; margin: 0.75em 0; }
                #fleety-chat-widget .message-content table { border-collapse: collapse; width: 100%; margin: 0.5em 0; font-size: 0.95em; }
                #fleety-chat-widget .message-content table th, #fleety-chat-widget .message-content table td { border: 1px solid rgba(127, 127, 127, 0.2); padding: 0.4em 0.6em; }
                #fleety-chat-widget .message-content table th { background-color: rgba(127, 127, 127, 0.05); font-weight: 600; }

                #fleety-chat-widget .message-content > *:first-child { margin-top: 0 !important; }
                #fleety-chat-widget .message-content > *:last-child { margin-bottom: 0 !important; }

                @media (max-width: 480px) {
                    #fleety-chat-widget .chat-container { width: calc(100vw - 40px); height: calc(100vh - 140px); }
                    #fleety-chat-widget .toggle-button { width: 56px; height: 56px; }
                }
            `;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);
        }

        createDOM() {
            // Create container for the whole widget
            const widgetContainer = document.createElement('div');
            widgetContainer.className = 'fleety-widget-root';
            widgetContainer.id = 'fleety-chat-widget';
            
            // Toggle Button
            const toggleButtonContainer = document.createElement('div');
            toggleButtonContainer.className = 'chat-toggle-button';
            toggleButtonContainer.setAttribute('data-theme', this.activeTheme);
            toggleButtonContainer.setAttribute('data-dock', this.dockPosition);
            
            toggleButtonContainer.innerHTML = `
                <button class="toggle-button" aria-label="Open support chat">
                    <div class="icon-container">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-default" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-close" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                </button>
            `;
            
            // Chat Window
            const chatContainer = document.createElement('div');
            chatContainer.className = 'chat-container';
            chatContainer.setAttribute('data-theme', this.activeTheme);
            chatContainer.setAttribute('data-dock', this.dockPosition);
            chatContainer.setAttribute('role', 'dialog');
            chatContainer.setAttribute('aria-label', 'Support chat');
            chatContainer.setAttribute('tabindex', '-1');
            
            chatContainer.innerHTML = `
                <div class="chat-header">
                    <div class="header-left">
                        <span class="header-title">Fleety Support</span>
                    </div>
                    <div class="header-right">
                        <button class="minimize-button" aria-label="Minimize chat">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="icon-sm">
                                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="messages-container"></div>
                <div class="input-area">
                    <div class="input-wrapper">
                        <input placeholder="Ask about Fleety..." class="message-input" />
                        <button class="send-button" aria-label="Send message" disabled>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M2 10L18 2L10 18L8 11L2 10Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            widgetContainer.appendChild(chatContainer);
            widgetContainer.appendChild(toggleButtonContainer);
            document.body.appendChild(widgetContainer);

            // Store references
            this.container = widgetContainer;
            this.chatContainer = chatContainer;
            this.toggleButton = toggleButtonContainer.querySelector('.toggle-button');
            this.messagesContainer = chatContainer.querySelector('.messages-container');
            this.inputElement = chatContainer.querySelector('.message-input');
            this.sendButton = chatContainer.querySelector('.send-button');
            this.minimizeButton = chatContainer.querySelector('.minimize-button');
            this.iconContainer = toggleButtonContainer.querySelector('.icon-container');
        }

        setupEventListeners() {
            this.toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleChat();
            });

            this.minimizeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleChat();
            });

            this.sendButton.addEventListener('click', () => this.sendMessage());

            this.inputElement.addEventListener('input', (e) => {
                this.currentMessage = e.target.value;
                this.sendButton.disabled = !this.currentMessage.trim();
            });

            this.inputElement.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Close on escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.toggleChat();
                }
            });

            // Prevent closing when clicking inside
            this.chatContainer.addEventListener('click', (e) => e.stopPropagation());
        }

        toggleChat() {
            this.isOpen = !this.isOpen;
            
            if (this.isOpen) {
                this.chatContainer.classList.add('open');
                this.iconContainer.classList.add('open');
                this.toggleButton.setAttribute('aria-label', 'Close support chat');
                
                if (this.messages.length === 0) {
                    this.addAIMessage("👋 Welcome to Fleety support! I'm here to help you. Ask me anything!");
                    if (!this.anonToken) {
                        this.initializeSession();
                    }
                }

                setTimeout(() => this.inputElement.focus(), 100);
            } else {
                this.chatContainer.classList.remove('open');
                this.iconContainer.classList.remove('open');
                this.toggleButton.setAttribute('aria-label', 'Open support chat');
            }
        }

        async initializeSession() {
            try {
                console.log('🔄 Initializing Fleety chat session...');
                const response = await fetch(`${API_URL}/init-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ project_id: this.projectId })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to initialize session');
                }

                this.anonToken = result.token;
                this.tokenExpiresAt = new Date(result.expires_at);
                console.log('✅ Fleety chat session initialized');

                setTimeout(() => {
                    console.log('🔄 Token expiring soon, renewing...');
                    this.initializeSession();
                }, 4 * 60 * 1000);

            } catch (err) {
                console.error('❌ Session initialization error:', err);
            }
        }

        addMessage(text, isUser, id = Date.now().toString(), sources = []) {
            console.log('📝 addMessage called with sources:', sources);
            const message = { 
                id, 
                text, 
                isUser, 
                timestamp: new Date(),
                sources: sources.length > 0 ? sources : undefined
            };
            console.log('📝 Created message object:', message);
            this.messages.push(message);
            this.renderMessage(message);
            this.scrollToBottom();
        }

        addAIMessage(text, sources = []) {
            this.addMessage(text, false, Date.now().toString(), sources);
        }

        renderMessage(message) {
            const wrapper = document.createElement('div');
            wrapper.className = `message-wrapper ${message.isUser ? 'user' : 'ai'}`;
            wrapper.id = `msg-${message.id}`;
            
            const bubble = document.createElement('div');
            bubble.className = `message-bubble ${message.isUser ? 'user' : 'ai'}`;
            
            const content = document.createElement('div');
            content.className = `message-content ${this.theme === 'material' ? 'light' : 'dark'}`;
            content.innerHTML = this.formatMessageContent(message.text, message.isUser);
            
            bubble.appendChild(content);
            
            // Add source citations if present and message is from AI
            if (message.sources && message.sources.length > 0 && !message.isUser) {
                const sourceCitation = document.createElement('div');
                sourceCitation.className = 'source-citation';
                
                if (message.sources.length === 1) {
                    sourceCitation.innerHTML = `<span class="source-label">Source:</span> <span class="source-text">${message.sources[0].description}</span>`;
                } else {
                    const sourceDescriptions = message.sources.map(s => s.description).join(', ');
                    sourceCitation.innerHTML = `<span class="source-label">Sources:</span> <span class="source-text">${sourceDescriptions}</span>`;
                }
                
                bubble.appendChild(sourceCitation);
            }
            
            wrapper.appendChild(bubble);
            
            // Insert before typing indicator if it exists
            const typingIndicator = this.messagesContainer.querySelector('.typing-indicator-wrapper');
            if (typingIndicator) {
                this.messagesContainer.insertBefore(wrapper, typingIndicator);
            } else {
                this.messagesContainer.appendChild(wrapper);
            }
        }

        updateMessage(id, text, sources) {
            const messageIndex = this.messages.findIndex(m => m.id === id);
            if (messageIndex !== -1) {
                this.messages[messageIndex].text = text;
                if (sources) {
                    this.messages[messageIndex].sources = sources;
                }
                const wrapper = document.getElementById(`msg-${id}`);
                if (wrapper) {
                    const content = wrapper.querySelector('.message-content');
                    content.innerHTML = this.formatMessageContent(text, false);
                    
                    // Update or add source citations
                    let sourceCitation = wrapper.querySelector('.source-citation');
                    if (sources && sources.length > 0) {
                        if (!sourceCitation) {
                            sourceCitation = document.createElement('div');
                            sourceCitation.className = 'source-citation';
                            const bubble = wrapper.querySelector('.message-bubble');
                            bubble.appendChild(sourceCitation);
                        }
                        
                        if (sources.length === 1) {
                            sourceCitation.innerHTML = `<span class="source-label">Source:</span> <span class="source-text">${sources[0].description}</span>`;
                        } else {
                            const sourceDescriptions = sources.map(s => s.description).join(', ');
                            sourceCitation.innerHTML = `<span class="source-label">Sources:</span> <span class="source-text">${sourceDescriptions}</span>`;
                        }
                    } else if (sourceCitation) {
                        sourceCitation.remove();
                    }
                }
            }
        }

        showTypingIndicator() {
            if (this.messagesContainer.querySelector('.typing-indicator-wrapper')) return;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper ai typing-indicator-wrapper';
            wrapper.innerHTML = `
                <div class="typing-indicator">
                    <div class="typing-dots">
                        <div class="dot"></div>
                        <div class="dot" style="animation-delay: 0.1s"></div>
                        <div class="dot" style="animation-delay: 0.2s"></div>
                    </div>
                </div>
            `;
            this.messagesContainer.appendChild(wrapper);
            this.scrollToBottom();
        }

        hideTypingIndicator() {
            const indicator = this.messagesContainer.querySelector('.typing-indicator-wrapper');
            if (indicator) indicator.remove();
        }

        scrollToBottom() {
            setTimeout(() => {
                if (this.messagesContainer) {
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                }
            }, 100);
        }

        async sendMessage() {
            if (!this.currentMessage.trim()) return;

            const userMessage = this.currentMessage.trim();
            this.addMessage(userMessage, true);
            
            this.conversationHistory.push({ role: 'user', content: userMessage });
            
            this.currentMessage = '';
            this.inputElement.value = '';
            this.sendButton.disabled = true;

            if (!this.anonToken) {
                await this.initializeSession();
                if (!this.anonToken) {
                    this.addAIMessage('⚠️ Unable to connect to chat service. Please try again later.');
                    return;
                }
            }

            this.showTypingIndicator();
            this.isTyping = true;

            try {
                const response = await fetch(`${API_URL}/chat/tools`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.anonToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messages: this.conversationHistory,
                        enable_tool_calling: true
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (response.status === 429) {
                        throw new Error("You're sending requests too fast.");
                    }
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const contentType = response.headers.get('content-type');
                
                if (contentType?.includes('application/json')) {
                    const toolResponse = await response.json();
                    console.log('📦 Tool response:', toolResponse);
                    console.log('📦 Response type:', toolResponse.type);
                    console.log('📦 Response sources:', toolResponse.sources);
                    this.hideTypingIndicator();
                    
                    if (toolResponse.type === 'tool_call') {
                        this.addAIMessage(toolResponse.message);
                        const event = new CustomEvent('ticket-created', {
                            detail: { ticketSlug: toolResponse.ticket_slug },
                            bubbles: true,
                            composed: true
                        });
                        window.dispatchEvent(event);
                    } else if (toolResponse.type === 'message') {
                        const sources = toolResponse.sources || [];
                        console.log('💬 Adding AI message with sources:', sources);
                        this.addAIMessage(toolResponse.message, sources);
                        console.log('💬 Messages array after add:', this.messages);
                    }
                    this.isTyping = false;
                    return;
                }

                // Streaming response
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let aiResponse = '';
                let messageId = Date.now().toString();
                let isFirstChunk = true;
                let currentSources = undefined;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    
                    // Handle potential JSON response in stream
                    if (isFirstChunk && chunk.trim().startsWith('{')) {
                        try {
                            const jsonResponse = JSON.parse(chunk);
                            console.log('📦 Parsed JSON response:', jsonResponse);
                            console.log('📦 Response type:', jsonResponse.type);
                            console.log('📦 Response sources:', jsonResponse.sources);
                            console.log('📦 Sources array length:', jsonResponse.sources?.length || 0);
                            this.hideTypingIndicator();
                            if (jsonResponse.type === 'message') {
                                const sources = jsonResponse.sources || [];
                                console.log('✅ About to add AI message with sources:', sources);
                                this.addAIMessage(jsonResponse.message, sources);
                                console.log('✅ Added message from JSON response', sources.length > 0 ? `with ${sources.length} sources` : 'without sources');
                                this.isTyping = false;
                                return;
                            } else if (jsonResponse.type === 'tool_call') {
                                this.addAIMessage(jsonResponse.message);
                                const event = new CustomEvent('ticket-created', {
                                    detail: { ticketSlug: jsonResponse.ticket_slug },
                                    bubbles: true,
                                    composed: true
                                });
                                window.dispatchEvent(event);
                                console.log('📢 Dispatched ticket-created event:', jsonResponse.ticket_slug);
                                this.isTyping = false;
                                return;
                            }
                        } catch (e) {
                            console.log('Not a complete JSON, treating as SSE stream');
                        }
                        isFirstChunk = false;
                    }

                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        // Handle SSE event type
                        if (line.startsWith('event: ')) {
                            const eventType = line.slice(7);
                            console.log('📌 SSE Event type:', eventType);
                            continue;
                        }
                        
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                console.log('✅ Received [DONE] signal');
                                this.isTyping = false;
                                return;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                
                                // Check if this is a sources event
                                if (Array.isArray(parsed) && parsed.length > 0 && 'file_name' in parsed[0]) {
                                    console.log('📚 Received sources:', parsed);
                                    currentSources = parsed;
                                    continue;
                                }
                                
                                const content = parsed.choices[0]?.delta?.content || '';
                                
                                if (content) {
                                    if (isFirstChunk) {
                                        this.hideTypingIndicator();
                                        this.addMessage('', false, messageId);
                                        isFirstChunk = false;
                                    }
                                    aiResponse += content;
                                    this.updateMessage(messageId, aiResponse, currentSources);
                                    this.scrollToBottom();
                                }
                            } catch (e) {}
                        }
                    }
                }

                if (aiResponse) {
                    this.conversationHistory.push({ role: 'assistant', content: aiResponse });
                }

            } catch (err) {
                this.hideTypingIndicator();
                const error = err.message || 'Failed to send message';
                
                if (error.includes('401') || error.includes('expired')) {
                    this.anonToken = '';
                    await this.initializeSession();
                    if (this.anonToken) {
                        this.addAIMessage('Session refreshed. Please try sending your message again.');
                    } else {
                        this.addAIMessage('⚠️ Session expired. Please refresh the page and try again.');
                    }
                } else {
                    this.addAIMessage(`⚠️ Sorry, I encountered an error: ${error}. Please try again.`);
                }
            } finally {
                this.isTyping = false;
            }
        }

        // Markdown Helpers
        escapeHtml(text) {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return text.replace(/[&<>"']/g, (m) => map[m]);
        }

        setupMarkedRenderer() {
            if (!window.marked) return;

            window.marked.setOptions({ breaks: true, gfm: true });
            const renderer = new window.marked.Renderer();

            renderer.link = ({ href, title, text }) => {
                const titleAttr = title ? ` title="${title}"` : '';
                const isExternal = href?.startsWith('http');
                const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
                return `<a href="${href}"${titleAttr}${target} class="message-link">${text}</a>`;
            };

            renderer.code = ({ text, lang }) => {
                const language = lang || 'text';
                const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
                const escapedText = this.escapeHtml(text);
                return `<div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span class="code-language">${language}</span>
                        <button class="copy-code-btn" data-code-id="${codeId}" onclick="window.fleetyCopyCode('${codeId}')">
                            <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span class="copy-text">Copy</span>
                            <span class="copied-text" style="display: none;">Copied!</span>
                        </button>
                    </div>
                    <pre class="message-code-block" id="${codeId}"><code class="language-${language}">${escapedText}</code></pre>
                </div>`;
            };

            renderer.codespan = ({ text }) => {
                const escapedText = this.escapeHtml(text);
                const codeId = `inline-code-${Math.random().toString(36).substr(2, 9)}`;
                return `<span class="inline-code-wrapper">
                    <code class="message-inline-code" id="${codeId}">${escapedText}</code>
                    <button class="copy-inline-btn" data-inline-id="${codeId}" onclick="window.fleetyCopyInlineCode('${codeId}')" title="Copy code">
                        <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                </span>`;
            };

            renderer.blockquote = ({ tokens }) => {
                const text = tokens.map(token => token.raw || '').join('');
                const quoteId = `quote-${Math.random().toString(36).substr(2, 9)}`;
                return `<div class="blockquote-wrapper">
                    <blockquote class="message-blockquote" id="${quoteId}">
                        ${window.marked.parse(text)}
                        <button class="copy-quote-btn" data-quote-id="${quoteId}" onclick="window.fleetyCopyQuote('${quoteId}')">
                            <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </blockquote>
                </div>`;
            };

            this.renderer = renderer;
        }

        formatMessageContent(content, isUser) {
            if (isUser) {
                return this.escapeHtml(content).replace(/\n/g, '<br>');
            } else {
                if (window.marked && this.renderer) {
                    try {
                        return window.marked.parse(content, { renderer: this.renderer });
                    } catch (e) {
                        console.error('Error parsing markdown:', e);
                    }
                }
                return this.escapeHtml(content);
            }
        }

        setupGlobalCopyFunctions() {
            window.fleetyCopyCode = (codeId) => {
                const codeBlock = document.getElementById(codeId);
                if (!codeBlock) return;
                const code = codeBlock.textContent || '';
                navigator.clipboard.writeText(code).then(() => {
                    const button = document.querySelector(`[data-code-id="${codeId}"]`);
                    if (!button) return;
                    const copyText = button.querySelector('.copy-text');
                    const copiedText = button.querySelector('.copied-text');
                    if (copyText) copyText.style.display = 'none';
                    if (copiedText) copiedText.style.display = 'inline';
                    setTimeout(() => {
                        if (copyText) copyText.style.display = 'inline';
                        if (copiedText) copiedText.style.display = 'none';
                    }, 2000);
                });
            };

            window.fleetyCopyQuote = (quoteId) => {
                const quoteBlock = document.getElementById(quoteId);
                if (!quoteBlock) return;
                const clonedQuote = quoteBlock.cloneNode(true);
                const clonedButton = clonedQuote.querySelector('.copy-quote-btn');
                if (clonedButton) clonedButton.remove();
                const quoteText = clonedQuote.textContent || '';
                navigator.clipboard.writeText(quoteText.trim());
            };

            window.fleetyCopyInlineCode = (codeId) => {
                const codeElement = document.getElementById(codeId);
                if (!codeElement) return;
                const code = codeElement.textContent || '';
                navigator.clipboard.writeText(code);
            };
        }
    }

    window.SupportChatWidget = SupportChatWidget;

})(window, document);
