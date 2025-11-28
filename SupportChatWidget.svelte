<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { marked } from 'marked';

	// Component props
	let {
		projectId,
		theme = 'fleety',
		dockPosition = 'bottom-right'
	}: {
		projectId: string;
		theme?: 'fleety' | 'material' | 'nord' | 'light' | 'dark' | 'system';
		dockPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
	} = $props();

	// Type definitions
	type DockPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
	type Theme = 'fleety' | 'material' | 'nord' | 'light' | 'dark' | 'system';

	let activeTheme = $state(theme);

	// Theme detection for system theme
	$effect(() => {
		if (theme === 'system') {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			activeTheme = mediaQuery.matches ? 'dark' : 'light';

			const handleChange = (e: MediaQueryListEvent) => {
				activeTheme = e.matches ? 'dark' : 'light';
			};

			mediaQuery.addEventListener('change', handleChange);
			return () => mediaQuery.removeEventListener('change', handleChange);
		} else {
			activeTheme = theme;
		}
	});

	// Fleety API Configuration
	const API_URL = 'https://api.fleety.dev/v1';

	// State for anonymous session
	let anonToken = $state('');
	let tokenExpiresAt: Date | null = $state(null);
	let sessionError = $state('');

	// Conversation history for context
	type ConversationMessage = {
		role: 'user' | 'assistant';
		content: string;
	};
	let conversationHistory: ConversationMessage[] = $state([]);

	let isOpen = $state(false);
	let messages: Array<{ id: string; text: string; isUser: boolean; timestamp: Date }> = $state([]);
	let currentMessage = $state('');
	let isTyping = $state(false);
	let chatContainer: HTMLElement = $state()!;
	let inputElement: HTMLInputElement = $state()!;

	// No theme configuration needed - using CSS classes

	// --- Start of inlined MessageContent logic ---

	// Configure marked options
	marked.setOptions({
		breaks: true, // Convert \n to <br>
		gfm: true // GitHub Flavored Markdown
	});

	// Custom renderer for better control
	const renderer = new marked.Renderer();

	// Override link rendering to add target="_blank" for external links
	renderer.link = ({
		href,
		title,
		text
	}: {
		href: string;
		title?: string | null;
		text: string;
	}) => {
		const titleAttr = title ? ` title="${title}"` : '';
		const isExternal = href?.startsWith('http') || href?.startsWith('https');
		const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
		return `<a href="${href}"${titleAttr}${target} class="message-link">${text}</a>`;
	};

	// Override code rendering to add syntax highlighting classes and copy button
	renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
		const language = lang || 'text';
		const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
		const escapedText = escapeHtml(text);
		return `<div class="code-block-wrapper">
            <div class="code-block-header">
                <span class="code-language">${language}</span>
                <button class="copy-code-btn" data-code-id="${codeId}" onclick="copyCode('${codeId}')">
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

	// Override inline code
	renderer.codespan = ({ text }: { text: string }) => {
		const escapedText = escapeHtml(text);
		const codeId = `inline-code-${Math.random().toString(36).substr(2, 9)}`;
		return `<span class="inline-code-wrapper">
            <code class="message-inline-code" id="${codeId}">${escapedText}</code>
            <button class="copy-inline-btn" data-inline-id="${codeId}" onclick="copyInlineCode('${codeId}')" title="Copy code">
                <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </button>
        </span>`;
	};

	// Override blockquote to add copy button
	renderer.blockquote = ({ tokens }: { tokens: any[] }) => {
		const text = tokens.map((token: any) => token.raw || '').join('');
		const quoteId = `quote-${Math.random().toString(36).substr(2, 9)}`;
		return `<div class="blockquote-wrapper">
            <blockquote class="message-blockquote" id="${quoteId}">
                ${marked.parse(text)}
                <button class="copy-quote-btn" data-quote-id="${quoteId}" onclick="copyQuote('${quoteId}')">
                    <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
            </blockquote>
        </div>`;
	};

	// Escape HTML to prevent XSS
	function escapeHtml(text: string): string {
		const map: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, (m) => map[m]);
	}

	// Parse markdown content
	function parseMarkdown(text: string): string {
		try {
			return marked(text, { renderer }) as string;
		} catch (error) {
			console.error('Error parsing markdown:', error);
			return escapeHtml(text);
		}
	}

	function formatMessageContent(content: string, isUser: boolean): string {
		if (isUser) {
			// For user messages, just escape HTML and preserve line breaks
			return escapeHtml(content).replace(/\n/g, '<br>');
		} else {
			// For AI messages, parse markdown
			return parseMarkdown(content);
		}
	}

	// --- End of inlined MessageContent logic ---

	/**
	 * Initialize an anonymous session for the Fleety chat proxy
	 * Works for both authenticated and unauthenticated users
	 */
	async function initializeSession() {
		try {
			console.log('🔄 Initializing Fleety chat session...');
			console.log('Project ID:', projectId);
			console.log('Origin:', window.location.origin);

			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			const response = await fetch(`${API_URL}/init-session`, {
				method: 'POST',
				headers,
				credentials: 'include', // CRITICAL: Required for CORS with credentials
				body: JSON.stringify({ project_id: projectId })
			});

			const result = await response.json();

			if (!response.ok) {
				console.error('❌ Session initialization failed:', response.status, result);
				throw new Error(result.error || 'Failed to initialize session');
			}

			anonToken = result.token;
			tokenExpiresAt = new Date(result.expires_at);
			sessionError = '';

			console.log('✅ Fleety chat session initialized');
			console.log('Token expires at:', tokenExpiresAt);
			console.log('Project ID:', result.project_id);

			// Auto-renew token before expiration (4 minutes, as tokens last 5 min)
			setTimeout(
				() => {
					console.log('🔄 Token expiring soon, renewing...');
					initializeSession();
				},
				4 * 60 * 1000
			);
		} catch (err) {
			sessionError = err instanceof Error ? err.message : 'Unknown error';
			console.error('❌ Session initialization error:', err);
		}
	}

	function toggleChat() {
		isOpen = !isOpen;
		if (isOpen && messages.length === 0) {
			// Add welcome message
			addAIMessage("👋 Welcome to Fleety support! I'm here to help you. Ask me anything!");

			// Initialize session if not already done (works for both authenticated and unauthenticated users)
			if (!anonToken) {
				initializeSession();
			}
		}

		// Auto-focus input when chat opens
		if (isOpen) {
			setTimeout(() => {
				inputElement?.focus();
			}, 100);
		}
	}

	function addMessage(text: string, isUser: boolean) {
		const message = {
			id: Date.now().toString(),
			text,
			isUser,
			timestamp: new Date()
		};
		messages = [...messages, message];

		// Scroll to bottom
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 100);
	}

	function addAIMessage(text: string) {
		addMessage(text, false);
	}

	function clearConversation() {
		messages = [];
		conversationHistory = [];
		console.log('🗑️ Conversation history cleared');
	}

	async function sendMessage() {
		if (!currentMessage.trim()) return;

		const userMessage = currentMessage.trim();
		addMessage(userMessage, true);

		// Add user message to conversation history
		conversationHistory.push({
			role: 'user',
			content: userMessage
		});

		currentMessage = '';

		// Check if we have a session token
		if (!anonToken) {
			console.log('⚠️ No session token, initializing...');
			// Try to initialize session
			await initializeSession();

			if (!anonToken) {
				// If still no token, show error
				addAIMessage('⚠️ Unable to connect to chat service. Please try again later.');
				return;
			}
		}

		// Show typing indicator
		isTyping = true;

		try {
			console.log('📤 Sending chat message with history...');
			console.log('Conversation history length:', conversationHistory.length);
			console.log('Using anon token:', anonToken.substring(0, 20) + '...');

			const response = await fetch(`${API_URL}/chat/tools`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${anonToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					messages: conversationHistory,
					enable_tool_calling: true
				})
			});

			console.log('📥 Response status:', response.status);
			console.log('Response headers:', Object.fromEntries(response.headers.entries()));

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('❌ Chat request failed:', response.status, errorData);

				// Handle rate limiting specifically
				if (response.status === 429) {
					const retryAfter = response.headers.get('Retry-After');
					const retryMessage = retryAfter
						? `Please wait ${retryAfter} seconds before trying again.`
						: 'Please wait a moment before trying again.';
					throw new Error(
						`rate_limit:${errorData.message || "You're sending requests too fast."} ${retryMessage}`
					);
				}

				throw new Error(errorData.error || `HTTP ${response.status}`);
			}

			// Check if this is a tool call response (non-streaming)
			const contentType = response.headers.get('content-type');
			console.log('📋 Content-Type:', contentType);

			if (contentType?.includes('application/json')) {
				// This is a tool call response
				const toolResponse = await response.json();
				console.log('📦 Tool response:', toolResponse);
				console.log('📦 Response type:', toolResponse.type);
				console.log('📦 Response message:', toolResponse.message);

				if (toolResponse.type === 'tool_call') {
					// AI created a ticket
					console.log('🎫 Ticket created:', toolResponse.ticket_slug);
					addAIMessage(toolResponse.message);

					// Dispatch custom event to notify SupportTicketWidget
					const event = new CustomEvent('ticket-created', {
						detail: { ticketSlug: toolResponse.ticket_slug },
						bubbles: true,
						composed: true
					});
					window.dispatchEvent(event);
					console.log('📢 Dispatched ticket-created event:', toolResponse.ticket_slug);

					isTyping = false;
					return;
				} else if (toolResponse.type === 'message') {
					// Regular message response
					console.log('💬 Adding AI message:', toolResponse.message);
					addAIMessage(toolResponse.message);
					console.log('💬 Messages array after add:', messages);
					isTyping = false;
					return;
				}

				console.log('⚠️ Unknown response type:', toolResponse.type);
			}

			// Read streaming response
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				throw new Error('No response body');
			}

			let aiResponse = '';
			let messageId = Date.now().toString();
			let chunkCount = 0;

			console.log('📖 Reading streaming response...');
			console.log('Reader:', reader);
			console.log('Response body locked?:', response.bodyUsed);

			while (true) {
				console.log(`⏳ Waiting for chunk ${chunkCount + 1}...`);
				const { done, value } = await reader.read();

				console.log(
					`📦 Chunk ${chunkCount + 1} - done: ${done}, value length: ${value?.length || 0}`
				);

				if (done) {
					console.log(`✅ Stream complete. Received ${chunkCount} chunks.`);
					break;
				}

				const chunk = decoder.decode(value, { stream: true });
				chunkCount++;

				console.log(`Chunk ${chunkCount} raw:`, chunk);

				// Check if this is a complete JSON response (not SSE format)
				if (chunkCount === 1 && chunk.trim().startsWith('{')) {
					try {
						const jsonResponse = JSON.parse(chunk);
						console.log('📦 Parsed JSON response:', jsonResponse);

						if (jsonResponse.type === 'message' && jsonResponse.message) {
							addAIMessage(jsonResponse.message);
							console.log('✅ Added message from JSON response');
							isTyping = false;
							return;
						} else if (jsonResponse.type === 'tool_call') {
							addAIMessage(jsonResponse.message);
							// Dispatch event for ticket creation
							const event = new CustomEvent('ticket-created', {
								detail: { ticketSlug: jsonResponse.ticket_slug },
								bubbles: true,
								composed: true
							});
							window.dispatchEvent(event);
							console.log('📢 Dispatched ticket-created event:', jsonResponse.ticket_slug);
							isTyping = false;
							return;
						}
					} catch (e) {
						console.log('Not a complete JSON, treating as SSE stream');
					}
				}

				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);

						if (data === '[DONE]') {
							console.log('✅ Received [DONE] signal');
							isTyping = false;
							return;
						}

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices[0]?.delta?.content || '';

							if (content) {
								aiResponse += content;

								// Update or create AI message
								const existingMessageIndex = messages.findIndex((m) => m.id === messageId);
								if (existingMessageIndex !== -1) {
									// Update existing message
									messages[existingMessageIndex] = {
										...messages[existingMessageIndex],
										text: aiResponse
									};
									messages = [...messages];
								} else {
									// Create new message
									const message = {
										id: messageId,
										text: aiResponse,
										isUser: false,
										timestamp: new Date()
									};
									messages = [...messages, message];
								}

								// Scroll to bottom
								setTimeout(() => {
									if (chatContainer) {
										chatContainer.scrollTop = chatContainer.scrollHeight;
									}
								}, 10);
							}
						} catch (e) {
							// Ignore parse errors for incomplete chunks
						}
					}
				}
			}

			// After stream completes, add the complete AI response to conversation history
			if (aiResponse) {
				conversationHistory.push({
					role: 'assistant',
					content: aiResponse
				});
				console.log('✅ Added AI response to conversation history');
			}
		} catch (err) {
			const error = err instanceof Error ? err.message : 'Failed to send message';
			console.error('❌ Chat error:', err);

			// Handle rate limiting
			if (error.includes('rate_limit:')) {
				const message = error.replace('rate_limit:', '');
				addAIMessage(`⏰ ${message}`);
			}
			// Handle token expiration
			else if (error.includes('401') || error.includes('expired')) {
				console.log('🔄 Token expired, reinitializing session...');
				anonToken = '';
				await initializeSession();

				if (anonToken) {
					addAIMessage('Session refreshed. Please try sending your message again.');
				} else {
					addAIMessage('⚠️ Session expired. Please refresh the page and try again.');
				}
			} else {
				addAIMessage(`⚠️ Sorry, I encountered an error: ${error}. Please try again.`);
			}
		} finally {
			isTyping = false;
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	// No helper functions needed - using CSS classes directly

	onMount(() => {
		// Auto-show after a few seconds for demo purposes
		setTimeout(() => {
			if (!isOpen) {
				// Show a subtle animation to draw attention
			}
		}, 5000);

		// Handle Escape key to close chat
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape' && isOpen) {
				isOpen = false;
			}
		}

		document.addEventListener('keydown', handleKeyDown);


		// --- Start of inlined onMount logic from MessageContent ---
		// Define the copy function globally so it's accessible from the HTML
		(window as any).copyCode = (codeId: string) => {
			const codeBlock = document.getElementById(codeId);
			if (!codeBlock) return;

			const code = codeBlock.textContent || '';

			// Copy to clipboard
			navigator.clipboard
				.writeText(code)
				.then(() => {
					// Find the button that was clicked
					const button = document.querySelector(`[data-code-id="${codeId}"]`);
					if (!button) return;

					const copyText = button.querySelector('.copy-text') as HTMLElement;
					const copiedText = button.querySelector('.copied-text') as HTMLElement;

					// Show "Copied!" feedback
					if (copyText) copyText.style.display = 'none';
					if (copiedText) copiedText.style.display = 'inline';

					// Reset after 2 seconds
					setTimeout(() => {
						if (copyText) copyText.style.display = 'inline';
						if (copiedText) copiedText.style.display = 'none';
					}, 2000);
				})
				.catch((err) => {
					console.error('Failed to copy code:', err);
				});
		};

		// Define the copy quote function
		(window as any).copyQuote = (quoteId: string) => {
			const quoteBlock = document.getElementById(quoteId);
			if (!quoteBlock) return;

			// Get the text content without the copy button
			const button = quoteBlock.querySelector('.copy-quote-btn');
			const clonedQuote = quoteBlock.cloneNode(true) as HTMLElement;
			const clonedButton = clonedQuote.querySelector('.copy-quote-btn');
			if (clonedButton) clonedButton.remove();

			const quoteText = clonedQuote.textContent || '';

			// Copy to clipboard
			navigator.clipboard
				.writeText(quoteText.trim())
				.then(() => {
					if (!button) return;

					// Visual feedback - change icon temporarily
					const icon = button.querySelector('.copy-icon') as HTMLElement;
					if (icon) {
						icon.style.opacity = '1';
						setTimeout(() => {
							icon.style.opacity = '0.6';
						}, 1000);
					}
				})
				.catch((err) => {
					console.error('Failed to copy quote:', err);
				});
		};

		// Define the copy inline code function
		(window as any).copyInlineCode = (codeId: string) => {
			const codeElement = document.getElementById(codeId);
			if (!codeElement) return;

			const code = codeElement.textContent || '';

			// Copy to clipboard
			navigator.clipboard
				.writeText(code)
				.then(() => {
					const button = document.querySelector(`[data-inline-id="${codeId}"]`);
					if (!button) return;

					// Visual feedback
					const icon = button.querySelector('.copy-icon') as HTMLElement;
					if (icon) {
						icon.style.opacity = '1';
						icon.style.transform = 'scale(1.2)';
						setTimeout(() => {
							icon.style.opacity = '0.7';
							icon.style.transform = 'scale(1)';
						}, 800);
					}
				})
				.catch((err) => {
					console.error('Failed to copy inline code:', err);
				});
		};
		// --- End of inlined onMount logic ---

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<!-- Chat Window -->
{#if isOpen}
	<div
		in:fly={{ y: 20, duration: 300 }}
		out:fly={{ y: 20, duration: 200 }}
		class="chat-container"
		data-theme={activeTheme}
		data-dock={dockPosition}
		role="dialog"
		aria-label="Support chat"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<!-- Chat Header -->
		<div class="chat-header">
			<div class="header-left">
				<span class="header-title">Fleety Support</span>
			</div>
			<div class="header-right">
				<button onclick={toggleChat} class="minimize-button" aria-label="Minimize chat">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="icon-sm">
						<path
							d="M15 5L5 15M5 5L15 15"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Messages Container -->
		<div bind:this={chatContainer} class="messages-container">
			{#each messages as message (message.id)}
				<div
					in:fly={{ y: 10, duration: 200 }}
					class="message-wrapper {message.isUser ? 'user' : 'ai'}"
				>
					<div class="message-bubble {message.isUser ? 'user' : 'ai'}">
						<div class="message-content {theme === 'material' ? 'light' : 'dark'}">
							{@html formatMessageContent(message.text, message.isUser)}
						</div>
					</div>
				</div>
			{/each}

			{#if isTyping}
				<div in:fade={{ duration: 200 }} class="message-wrapper ai">
					<div class="typing-indicator">
						<div class="typing-dots">
							<div class="dot"></div>
							<div class="dot" style="animation-delay: 0.1s"></div>
							<div class="dot" style="animation-delay: 0.2s"></div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="input-area">
			<div class="input-wrapper">
				<input
					bind:this={inputElement}
					bind:value={currentMessage}
					onkeypress={handleKeyPress}
					placeholder="Ask about Fleety..."
					class="message-input"
				/>
				<button
					onclick={sendMessage}
					disabled={!currentMessage.trim()}
					class="send-button"
					aria-label="Send message"
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path
							d="M2 10L18 2L10 18L8 11L2 10Z"
							fill="currentColor"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Chat Toggle Button - Always visible, positioned below the chat window -->
<div class="chat-toggle-button" data-theme={activeTheme} data-dock={dockPosition}>
	<button
		onclick={(e) => {
			e.stopPropagation();
			toggleChat();
		}}
		class="toggle-button"
		aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
	>
		<div class="icon-container" class:open={isOpen}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="icon icon-default"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
				/>
			</svg>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="icon icon-close"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</div>
	</button>
</div>

<style>
	/* Theme Variables - Copied and adapted from SupportTicketWidget */
	.chat-container,
	.chat-toggle-button {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	.chat-container[data-theme='light'],
	.chat-toggle-button[data-theme='light'] {
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

	.chat-container[data-theme='dark'],
	.chat-toggle-button[data-theme='dark'] {
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

	.chat-container[data-theme='material'],
	.chat-toggle-button[data-theme='material'] {
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

	.chat-container[data-theme='nord'],
	.chat-toggle-button[data-theme='nord'] {
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

	.chat-container[data-theme='fleety'],
	.chat-toggle-button[data-theme='fleety'] {
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

	/* Midnight theme (kept from original but adapted) */
	.chat-container[data-theme='midnight'],
	.chat-toggle-button[data-theme='midnight'] {
		--bg-primary: #0f172a;
		--bg-secondary: #1e293b;
		--bg-hover: #334155;
		--text-primary: #f0e9ff;
		--text-secondary: #d8b4fe;
		--border-color: #581c87;
		--accent-color: #9333ea;
		--user-msg-bg: #9333ea;
		--user-msg-text: #ffffff;
		--ai-msg-bg: #1e293b;
		--ai-msg-text: #f0e9ff;
		--ai-msg-border: #581c87;
		--shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
	}

	/* === Toggle Button === */
	.chat-toggle-button {
		position: fixed;
		z-index: 9999;
	}

	.chat-toggle-button[data-dock='bottom-right'] {
		bottom: 20px;
		right: 20px;
	}

	.chat-toggle-button[data-dock='bottom-left'] {
		bottom: 20px;
		left: 20px;
	}

	.chat-toggle-button[data-dock='top-right'] {
		top: 20px;
		right: 20px;
	}

	.chat-toggle-button[data-dock='top-left'] {
		top: 20px;
		left: 20px;
	}

	.toggle-button {
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

	.chat-toggle-button[data-theme='fleety'] .toggle-button {
		color: #232627;
	}

	.toggle-button:hover {
		transform: scale(1.05);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	.toggle-button:active {
		transform: scale(0.95);
	}

	.icon-container {
		position: relative;
		width: 24px;
		height: 24px;
	}

	.toggle-button .icon {
		width: 24px;
		height: 24px;
		position: absolute;
		top: 0;
		left: 0;
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
	}

	.icon-default {
		opacity: 1;
		transform: rotate(0deg) scale(1);
	}

	.icon-close {
		opacity: 0;
		transform: rotate(90deg) scale(0.8);
	}

	.icon-container.open .icon-default {
		opacity: 0;
		transform: rotate(-90deg) scale(0.8);
	}

	.icon-container.open .icon-close {
		opacity: 1;
		transform: rotate(0deg) scale(1);
	}

	/* === Chat Container === */
	.chat-container {
		position: fixed;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		border-radius: 12px;
		box-shadow: var(--shadow);
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		overflow: hidden;

		/* Fixed size matching SupportTicketWidget */
		width: 420px;
		max-width: calc(100vw - 40px);
		height: 650px;
		max-height: calc(100vh - 120px);
	}

	/* Chat container positioning */
	.chat-container[data-dock='bottom-right'] {
		bottom: 100px;
		right: 20px;
	}

	.chat-container[data-dock='bottom-left'] {
		bottom: 100px;
		left: 20px;
	}

	.chat-container[data-dock='top-right'] {
		top: 100px;
		right: 20px;
	}

	.chat-container[data-dock='top-left'] {
		top: 100px;
		left: 20px;
	}

	/* === Chat Header === */
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		background: var(--accent-color);
		color: white;
		border-radius: 12px 12px 0 0;
		flex-shrink: 0;
	}

	.chat-container[data-theme='fleety'] .chat-header {
		color: #232627;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-title {
		font-weight: 600;
		font-size: 16px;
	}

	.minimize-button {
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

	.minimize-button:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.chat-container[data-theme='fleety'] .minimize-button:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	.icon-sm {
		width: 20px;
		height: 20px;
	}

	/* === Messages Container === */
	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		background: var(--bg-secondary);
	}

	.message-wrapper {
		display: flex;
		animation: fadeIn 0.3s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message-wrapper.user {
		justify-content: flex-end;
	}

	.message-wrapper.ai {
		justify-content: flex-start;
	}

	.message-bubble {
		max-width: 85%;
		border-radius: 12px;
		padding: 10px 14px;
		font-size: 14px;
		line-height: 1.5;
	}

	.message-bubble.user {
		background: var(--user-msg-bg);
		color: var(--user-msg-text);
		border-bottom-right-radius: 4px;
	}

	.message-bubble.ai {
		background: var(--ai-msg-bg);
		color: var(--ai-msg-text);
		border: 1px solid var(--ai-msg-border);
		border-bottom-left-radius: 4px;
	}

	/* === Typing Indicator === */
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		background: var(--ai-msg-bg);
		border: 1px solid var(--ai-msg-border);
		border-radius: 12px;
		border-bottom-left-radius: 4px;
	}

	.typing-dots {
		display: flex;
		gap: 4px;
	}

	.dot {
		width: 6px;
		height: 6px;
		background: var(--text-secondary);
		border-radius: 50%;
		animation: bounce 1.4s infinite;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-6px);
		}
	}

	/* === Input Area === */
	.input-area {
		padding: 16px 20px;
		background: var(--bg-primary);
		border-top: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.input-wrapper {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.message-input {
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

	.message-input:focus {
		border-color: var(--accent-color);
	}

	.message-input::placeholder {
		color: var(--text-secondary);
	}

	/* === Send Button === */
	.send-button {
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
		transition:
			opacity 0.2s,
			transform 0.1s;
		flex-shrink: 0;
	}

	.chat-container[data-theme='fleety'] .send-button {
		color: #232627;
	}

	.send-button:hover:not(:disabled) {
		opacity: 0.9;
		transform: scale(1.05);
	}

	.send-button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.send-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* === Message Content Styles === */
	.message-content {
		word-wrap: break-word;
		overflow-wrap: break-word;
		line-height: 1.5;
	}

	/* Link colors */
	:global(.message-content a) {
		color: inherit;
		text-decoration: underline;
	}

	/* Global styles for markdown content */
	:global(.message-content h1) {
		font-size: 1.5em;
		font-weight: bold;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		line-height: 1.3;
	}

	:global(.message-content h2) {
		font-size: 1.3em;
		font-weight: bold;
		margin-top: 0.5em;
		margin-bottom: 0.4em;
		line-height: 1.3;
	}

	:global(.message-content h3) {
		font-size: 1.1em;
		font-weight: bold;
		margin-top: 0.4em;
		margin-bottom: 0.3em;
		line-height: 1.3;
	}

	:global(.message-content p) {
		margin-top: 0.25em;
		margin-bottom: 0.25em;
		line-height: 1.5;
	}

	:global(.message-content ul),
	:global(.message-content ol) {
		margin-left: 1.25em;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		padding-left: 0.5em;
	}

	:global(.message-content li) {
		margin-top: 0.25em;
		margin-bottom: 0.25em;
		line-height: 1.4;
	}

	:global(.message-content ul li) {
		list-style-type: disc;
	}

	:global(.message-content ol li) {
		list-style-type: decimal;
	}

	:global(.message-content strong) {
		font-weight: 700;
	}

	:global(.message-content em) {
		font-style: italic;
	}

	/* Blockquote wrapper */
	:global(.message-content .blockquote-wrapper) {
		position: relative;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.message-content .message-blockquote) {
		position: relative;
		border-left: 3px solid currentColor;
		padding-left: 0.75em;
		padding-right: 2em;
		margin-left: 0.5em;
		opacity: 0.85;
		font-style: italic;
		margin-top: 0;
		margin-bottom: 0;
	}

	/* Copy quote button */
	:global(.message-content .copy-quote-btn) {
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

	:global(.message-content.dark .copy-quote-btn:hover) {
		opacity: 1;
		background-color: rgba(255, 255, 255, 0.1);
	}

	:global(.message-content.light .copy-quote-btn:hover) {
		opacity: 1;
		background-color: rgba(0, 0, 0, 0.08);
	}

	:global(.message-content .copy-quote-btn .copy-icon) {
		transition: opacity 0.2s;
	}

	:global(.message-content .message-link) {
		text-decoration: underline;
		opacity: 0.9;
		transition: opacity 0.2s;
		font-weight: 500;
	}

	:global(.message-content .message-link:hover) {
		opacity: 1;
		text-decoration: underline;
	}

	/* Inline code */
	:global(.message-content .message-inline-code) {
		background-color: rgba(127, 127, 127, 0.15);
		padding: 0.15em 0.4em;
		border-radius: 3px;
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.9em;
		border: 1px solid rgba(127, 127, 127, 0.2);
	}

	/* Inline code wrapper */
	:global(.message-content .inline-code-wrapper) {
		display: inline-flex;
		align-items: center;
		gap: 0.25em;
		position: relative;
	}

	/* Copy inline code button */
	:global(.message-content .copy-inline-btn) {
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

	:global(.message-content .inline-code-wrapper:hover .copy-inline-btn) {
		opacity: 0.7;
	}

	:global(.message-content .copy-inline-btn:hover) {
		opacity: 1 !important;
		background-color: rgba(127, 127, 127, 0.2);
	}

	:global(.message-content .copy-inline-btn .copy-icon) {
		transition: all 0.2s;
	}

	/* Code block wrapper */
	:global(.message-content .code-block-wrapper) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		border-radius: 6px;
		overflow: hidden;
	}

	/* Code block header */
	:global(.message-content .code-block-header) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4em 0.75em;
		background-color: rgba(127, 127, 127, 0.1);
		border-bottom: 1px solid rgba(127, 127, 127, 0.15);
	}

	:global(.message-content .code-language) {
		font-size: 0.75em;
		text-transform: uppercase;
		opacity: 0.6;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	/* Copy button */
	:global(.message-content .copy-code-btn) {
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

	:global(.message-content .copy-code-btn:hover) {
		opacity: 1;
		background-color: rgba(127, 127, 127, 0.15);
	}

	:global(.message-content .copy-icon) {
		width: 14px;
		height: 14px;
	}

	/* Code block */
	:global(.message-content .message-code-block) {
		background-color: rgba(127, 127, 127, 0.05);
		border: 1px solid rgba(127, 127, 127, 0.15);
		border-top: none;
		padding: 0.75em;
		border-radius: 0 0 6px 6px;
		overflow-x: auto;
		margin: 0;
	}

	:global(.message-content .message-code-block code) {
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.9em;
		line-height: 1.5;
	}

	:global(.message-content hr) {
		border: none;
		border-top: 1px solid currentColor;
		opacity: 0.3;
		margin-top: 0.75em;
		margin-bottom: 0.75em;
	}

	:global(.message-content table) {
		border-collapse: collapse;
		width: 100%;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		font-size: 0.95em;
	}

	:global(.message-content table th),
	:global(.message-content table td) {
		border: 1px solid rgba(127, 127, 127, 0.2);
		padding: 0.4em 0.6em;
	}

	:global(.message-content table th) {
		background-color: rgba(127, 127, 127, 0.05);
		font-weight: 600;
	}

	/* Handle first and last element margins */
	:global(.message-content > *:first-child) {
		margin-top: 0;
	}

	:global(.message-content > *:last-child) {
		margin-bottom: 0;
	}

	/* Mobile Responsiveness */
	@media (max-width: 480px) {
		.chat-container {
			width: calc(100vw - 40px);
			height: calc(100vh - 140px);
		}

		.toggle-button {
			width: 56px;
			height: 56px;
		}
	}
</style>
