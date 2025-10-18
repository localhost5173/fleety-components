<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { marked } from 'marked';

	// Fleety API Configuration
	const API_URL = 'https://api.fleety.dev/v1';
	
	// State for anonymous session
	let anonToken = '';
	let tokenExpiresAt: Date | null = null;
	let sessionError = '';

	// Conversation history for context
	type ConversationMessage = {
		role: 'user' | 'assistant';
		content: string;
	};
	let conversationHistory: ConversationMessage[] = [];

	// Docking position types
	type DockPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
	type Theme = 'fleety' | 'material' | 'midnight';
	
	export let projectId: string;
	export let dockPosition: DockPosition = 'bottom-right';
	export let theme: Theme = 'fleety';
	
	let isOpen = false;
	let messages: Array<{ id: string; text: string; isUser: boolean; timestamp: Date }> = [];
	let currentMessage = '';
	let isTyping = false;
	let chatContainer: HTMLElement;
	let inputElement: HTMLInputElement;
	let isResizing = false;
	let chatWidth = 320; // Default width in pixels
	let chatHeight = 500; // Default height in pixels1
	let minWidth = 280;
	let maxWidth = 500;
	let minHeight = 400;
	let maxHeight = 700;

	// No theme configuration needed - using CSS classes

	// --- Start of inlined MessageContent logic ---

    // Configure marked options
    marked.setOptions({
        breaks: true, // Convert \n to <br>
        gfm: true, // GitHub Flavored Markdown
    });

    // Custom renderer for better control
    const renderer = new marked.Renderer();
    
    // Override link rendering to add target="_blank" for external links
    renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
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
			setTimeout(() => {
				console.log('🔄 Token expiring soon, renewing...');
				initializeSession();
			}, 4 * 60 * 1000);

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
				addAIMessage("⚠️ Unable to connect to chat service. Please try again later.");
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
					'Authorization': `Bearer ${anonToken}`,
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
					throw new Error(`rate_limit:${errorData.message || 'You\'re sending requests too fast.'} ${retryMessage}`);
				}
				
				throw new Error(errorData.error || `HTTP ${response.status}`);
			}

			// Check if this is a tool call response (non-streaming)
			const contentType = response.headers.get('content-type');
			if (contentType?.includes('application/json')) {
				// This is a tool call response
				const toolResponse = await response.json();
				
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
					addAIMessage(toolResponse.message);
					isTyping = false;
					return;
				}
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
				
				console.log(`📦 Chunk ${chunkCount + 1} - done: ${done}, value length: ${value?.length || 0}`);
				
				if (done) {
					console.log(`✅ Stream complete. Received ${chunkCount} chunks.`);
					break;
				}

				const chunk = decoder.decode(value, { stream: true });
				chunkCount++;
				
				console.log(`Chunk ${chunkCount} raw:`, chunk);

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
								const existingMessageIndex = messages.findIndex(m => m.id === messageId);
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
					addAIMessage("Session refreshed. Please try sending your message again.");
				} else {
					addAIMessage("⚠️ Session expired. Please refresh the page and try again.");
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

	function getResizeHandles(position: DockPosition): { corner: 'nw' | 'ne' | 'sw' | 'se'; edges: ('n' | 's' | 'w' | 'e')[] } {
		switch (position) {
			case 'bottom-right':
				return { corner: 'nw', edges: ['n', 'w'] }; // top-left corner, top and left edges
			case 'bottom-left':
				return { corner: 'ne', edges: ['n', 'e'] }; // top-right corner, top and right edges
			case 'top-right':
				return { corner: 'sw', edges: ['s', 'w'] }; // bottom-left corner, bottom and left edges
			case 'top-left':
				return { corner: 'se', edges: ['s', 'e'] }; // bottom-right corner, bottom and right edges
		}
	}

	function startResize(event: MouseEvent, direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e') {
		isResizing = true;
		const startX = event.clientX;
		const startY = event.clientY;
		const startWidth = chatWidth;
		const startHeight = chatHeight;

		function handleMouseMove(e: MouseEvent) {
			if (!isResizing) return;
			
			const deltaX = e.clientX - startX;
			const deltaY = e.clientY - startY;
			
			let newWidth = startWidth;
			let newHeight = startHeight;
			
			// Handle horizontal resizing
			if (direction.includes('w')) {
				// West side - decrease width when moving right, increase when moving left
				newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
			} else if (direction.includes('e')) {
				// East side - increase width when moving right, decrease when moving left
				newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
			}
			
			// Handle vertical resizing
			if (direction.includes('n')) {
				// North side - decrease height when moving down, increase when moving up
				newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
			} else if (direction.includes('s')) {
				// South side - increase height when moving down, decrease when moving up
				newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
			}
			
			chatWidth = newWidth;
			chatHeight = newHeight;
		}

		function handleMouseUp() {
			isResizing = false;
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

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

		// Close chat when clicking outside
		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Element;
			if (isOpen && target && !target.closest('.chat-container') && !target.closest('.chat-toggle-button')) {
				isOpen = false;
			}
		}

		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('click', handleClickOutside);
		
        // --- Start of inlined onMount logic from MessageContent ---
        // Define the copy function globally so it's accessible from the HTML
        (window as any).copyCode = (codeId: string) => {
            const codeBlock = document.getElementById(codeId);
            if (!codeBlock) return;

            const code = codeBlock.textContent || '';
            
            // Copy to clipboard
            navigator.clipboard.writeText(code).then(() => {
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
            }).catch(err => {
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
            navigator.clipboard.writeText(quoteText.trim()).then(() => {
                if (!button) return;

                // Visual feedback - change icon temporarily
                const icon = button.querySelector('.copy-icon') as HTMLElement;
                if (icon) {
                    icon.style.opacity = '1';
                    setTimeout(() => {
                        icon.style.opacity = '0.6';
                    }, 1000);
                }
            }).catch(err => {
                console.error('Failed to copy quote:', err);
            });
        };

        // Define the copy inline code function
        (window as any).copyInlineCode = (codeId: string) => {
            const codeElement = document.getElementById(codeId);
            if (!codeElement) return;

            const code = codeElement.textContent || '';
            
            // Copy to clipboard
            navigator.clipboard.writeText(code).then(() => {
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
            }).catch(err => {
                console.error('Failed to copy inline code:', err);
            });
        };
        // --- End of inlined onMount logic ---

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<!-- Chat Toggle Button -->
<div class="chat-toggle-button theme-{theme} dock-{dockPosition}">
	<button
		on:click={(e) => { e.stopPropagation(); toggleChat(); }}
		class="toggle-button {isOpen ? 'rotated' : ''}"
		aria-label="Toggle support chat"
	>
		{#if isOpen}
			<svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
			</svg>
		{/if}
	</button>
</div>

<!-- Chat Window -->
{#if isOpen}
	<div
		in:fly={{ y: 20, duration: 300 }}
		out:fly={{ y: 20, duration: 200 }}
		class="chat-container theme-{theme} dock-{dockPosition} {isResizing ? 'resizing' : ''}"
		style="width: {chatWidth}px; height: {chatHeight}px;"
	>
		<!-- Dynamic Resize Handles Based on Dock Position -->
		<!-- Corner Resize Handle -->
		<div
			role="button"
			tabindex="0"
			on:mousedown={(e) => startResize(e, getResizeHandles(dockPosition).corner)}
			class="resize-handle corner-{getResizeHandles(dockPosition).corner}"
			title="Resize chat window"
		></div>
		
		<!-- Edge Resize Handles -->
		{#each getResizeHandles(dockPosition).edges as edge}
			<div
				role="button"
				tabindex="0"
				on:mousedown={(e) => startResize(e, edge)}
				class="resize-handle edge-{edge}"
				title="Resize {edge === 'n' || edge === 's' ? 'height' : 'width'}"
			></div>
		{/each}
		<!-- Chat Header -->
		<div class="chat-header">
			<div class="header-left">
				<div class="status-indicator"></div>
				<span class="header-title">Fleety Support</span>
			</div>
			<button on:click={toggleChat} class="minimize-button" aria-label="Minimize chat">
				<svg xmlns="http://www.w3.org/2000/svg" class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
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
					on:keypress={handleKeyPress}
					placeholder="Ask about Fleety..."
					class="message-input"
				/>
				<button
					on:click={sendMessage}
					disabled={!currentMessage.trim()}
					class="send-button"
					aria-label="Send message"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* === Animations === */
	@keyframes bounce {
		0%, 80%, 100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-6px);
		}
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* === Toggle Button === */
	.chat-toggle-button {
		position: fixed;
		z-index: 50;
	}

	.chat-toggle-button.dock-bottom-right {
		bottom: 1.5rem;
		right: 1.5rem;
	}

	.chat-toggle-button.dock-bottom-left {
		bottom: 1.5rem;
		left: 1.5rem;
	}

	.chat-toggle-button.dock-top-right {
		top: 1.5rem;
		right: 1.5rem;
	}

	.chat-toggle-button.dock-top-left {
		top: 1.5rem;
		left: 1.5rem;
	}

	.toggle-button {
		display: flex;
		height: 3.5rem;
		width: 3.5rem;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: none;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
		transition: all 0.3s;
		cursor: pointer;
	}

	.toggle-button:hover {
		transform: scale(1.1);
	}

	.toggle-button.rotated {
		transform: rotate(45deg);
	}

	.toggle-button.rotated:hover {
		transform: rotate(45deg) scale(1.1);
	}

	.toggle-button .icon {
		width: 1.5rem;
		height: 1.5rem;
	}

	/* Theme colors for toggle button */
	.chat-toggle-button.theme-fleety .toggle-button {
		background: #facc15;
		color: #000;
	}

	.chat-toggle-button.theme-fleety .toggle-button:hover {
		background: #fde047;
	}

	.chat-toggle-button.theme-material .toggle-button {
		background: #2563eb;
		color: #fff;
	}

	.chat-toggle-button.theme-material .toggle-button:hover {
		background: #1d4ed8;
	}

	.chat-toggle-button.theme-midnight .toggle-button {
		background: #9333ea;
		color: #fff;
	}

	.chat-toggle-button.theme-midnight .toggle-button:hover {
		background: #7e22ce;
	}

	/* === Chat Container === */
	.chat-container {
		position: fixed;
		z-index: 40;
		display: flex;
		flex-direction: column;
		border-radius: 0.5rem;
		border: 1px solid;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		transition: box-shadow 0.3s;
	}

	.chat-container:hover {
		box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.6);
	}

	.chat-container.resizing {
		user-select: none;
	}

	/* Chat container positioning */
	.chat-container.dock-bottom-right {
		bottom: 6rem;
		right: 1.5rem;
	}

	.chat-container.dock-bottom-left {
		bottom: 6rem;
		left: 1.5rem;
	}

	.chat-container.dock-top-right {
		top: 6rem;
		right: 1.5rem;
	}

	.chat-container.dock-top-left {
		top: 6rem;
		left: 1.5rem;
	}

	/* Theme colors for chat container */
	.chat-container.theme-fleety {
		background: #111827;
		border-color: #374151;
	}

	.chat-container.theme-material {
		background: #fff;
		border-color: #d1d5db;
	}

	.chat-container.theme-midnight {
		background: #0f172a;
		border-color: #6b21a8;
	}

	/* === Resize Handles === */
	.resize-handle {
		position: absolute;
		transition: background-color 0.2s;
		z-index: 10;
	}

	.resize-handle.corner-nw {
		top: 0;
		left: 0;
		width: 1rem;
		height: 1rem;
		cursor: nw-resize;
	}

	.resize-handle.corner-ne {
		top: 0;
		right: 0;
		width: 1rem;
		height: 1rem;
		cursor: ne-resize;
	}

	.resize-handle.corner-sw {
		bottom: 0;
		left: 0;
		width: 1rem;
		height: 1rem;
		cursor: sw-resize;
	}

	.resize-handle.corner-se {
		bottom: 0;
		right: 0;
		width: 1rem;
		height: 1rem;
		cursor: se-resize;
	}

	.resize-handle.edge-n {
		top: 0;
		left: 1rem;
		right: 1rem;
		height: 0.5rem;
		cursor: n-resize;
	}

	.resize-handle.edge-s {
		bottom: 0;
		left: 1rem;
		right: 1rem;
		height: 0.5rem;
		cursor: s-resize;
	}

	.resize-handle.edge-w {
		left: 0;
		top: 1rem;
		bottom: 1rem;
		width: 0.5rem;
		cursor: w-resize;
	}

	.resize-handle.edge-e {
		right: 0;
		top: 1rem;
		bottom: 1rem;
		width: 0.5rem;
		cursor: e-resize;
	}

	.resize-handle:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.theme-fleety .resize-handle:hover {
		background-color: rgba(250, 204, 21, 0.2);
	}

	.theme-material .resize-handle:hover {
		background-color: rgba(37, 99, 235, 0.1);
	}

	.theme-midnight .resize-handle:hover {
		background-color: rgba(147, 51, 234, 0.2);
	}

	/* === Chat Header === */
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-radius: 0.5rem 0.5rem 0 0;
		padding: 0.75rem 1rem;
		transition: all 0.2s;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-indicator {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #22c55e;
		animation: pulse 2s infinite;
	}

	.header-title {
		font-weight: 500;
	}

	.minimize-button {
		background: none;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.minimize-button:hover {
		opacity: 0.7;
		transform: scale(1.1);
	}

	.icon-sm {
		width: 1rem;
		height: 1rem;
	}

	/* Theme colors for header */
	.theme-fleety .chat-header {
		background: #facc15;
		color: #000;
	}

	.theme-fleety .chat-header:hover {
		background: #fde047;
	}

	.theme-fleety .minimize-button {
		color: #000;
	}

	.theme-material .chat-header {
		background: #2563eb;
		color: #fff;
	}

	.theme-material .chat-header:hover {
		background: #1d4ed8;
	}

	.theme-material .minimize-button {
		color: #fff;
	}

	.theme-midnight .chat-header {
		background: linear-gradient(to right, #581c87, #312e81);
		color: #e9d5ff;
	}

	.theme-midnight .chat-header:hover {
		background: linear-gradient(to right, #6b21a8, #3730a3);
	}

	.theme-midnight .minimize-button {
		color: #e9d5ff;
	}

	/* === Messages Container === */
	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.message-wrapper {
		display: flex;
	}

	.message-wrapper.user {
		justify-content: flex-end;
	}

	.message-wrapper.ai {
		justify-content: flex-start;
	}

	.message-bubble {
		max-width: 18rem;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.message-bubble:hover {
		transform: scale(1.05);
	}

	.message-bubble.ai {
		border: 1px solid;
	}

	/* Theme colors for messages */
	.theme-fleety .message-bubble.user {
		background: #facc15;
		color: #000;
	}

	.theme-fleety .message-bubble.user:hover {
		background: #fde047;
	}

	.theme-fleety .message-bubble.ai {
		background: #1f2937;
		color: #fff;
		border-color: #374151;
	}

	.theme-fleety .message-bubble.ai:hover {
		background: #374151;
		border-color: #4b5563;
	}

	.theme-material .message-bubble.user {
		background: #2563eb;
		color: #fff;
	}

	.theme-material .message-bubble.user:hover {
		background: #1d4ed8;
	}

	.theme-material .message-bubble.ai {
		background: #f3f4f6;
		color: #111827;
		border-color: #e5e7eb;
	}

	.theme-material .message-bubble.ai:hover {
		background: #e5e7eb;
		border-color: #d1d5db;
	}

	.theme-midnight .message-bubble.user {
		background: linear-gradient(to right, #9333ea, #6366f1);
		color: #fff;
	}

	.theme-midnight .message-bubble.user:hover {
		background: linear-gradient(to right, #7e22ce, #4f46e5);
	}

	.theme-midnight .message-bubble.ai {
		background: #1e293b;
		color: #f0e9ff;
		border-color: #581c87;
	}

	.theme-midnight .message-bubble.ai:hover {
		background: #334155;
		border-color: #6b21a8;
	}

	/* === Typing Indicator === */
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		border-radius: 0.5rem;
		border: 1px solid;
		padding: 0.5rem 0.75rem;
	}

	.typing-dots {
		display: flex;
		gap: 0.25rem;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		background: #9ca3af;
		border-radius: 50%;
		animation: bounce 1.4s infinite;
	}

	.theme-fleety .typing-indicator {
		background: #1f2937;
		border-color: #374151;
	}

	.theme-material .typing-indicator {
		background: #f3f4f6;
		border-color: #e5e7eb;
	}

	.theme-midnight .typing-indicator {
		background: #1e293b;
		border-color: #581c87;
	}

	/* === Input Area === */
	.input-area {
		border-top: 1px solid;
		padding: 1rem;
	}

	.theme-fleety .input-area {
		border-color: #374151;
	}

	.theme-material .input-area {
		border-color: #d1d5db;
	}

	.theme-midnight .input-area {
		border-color: #581c87;
	}

	.input-wrapper {
		display: flex;
		gap: 0.5rem;
	}

	.message-input {
		flex: 1;
		border-radius: 0.5rem;
		border: 1px solid;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		transition: all 0.2s;
		outline: none;
	}

	.message-input:focus {
		outline: none;
		border-width: 1px;
		box-shadow: 0 0 0 1px currentColor;
	}

	/* Theme colors for input */
	.theme-fleety .message-input {
		background: #1f2937;
		border-color: #4b5563;
		color: #fff;
	}

	.theme-fleety .message-input::placeholder {
		color: #9ca3af;
	}

	.theme-fleety .message-input:hover {
		border-color: #6b7280;
		background: #252f3f;
	}

	.theme-fleety .message-input:focus {
		border-color: #facc15;
		box-shadow: 0 0 0 1px #facc15;
	}

	.theme-material .message-input {
		background: #f9fafb;
		border-color: #d1d5db;
		color: #111827;
	}

	.theme-material .message-input::placeholder {
		color: #6b7280;
	}

	.theme-material .message-input:hover {
		border-color: #9ca3af;
		background: #f3f4f6;
	}

	.theme-material .message-input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 1px #2563eb;
	}

	.theme-midnight .message-input {
		background: #1e293b;
		border-color: #581c87;
		color: #f0e9ff;
	}

	.theme-midnight .message-input::placeholder {
		color: #d8b4fe;
	}

	.theme-midnight .message-input:hover {
		border-color: #6b21a8;
		background: #252f3f;
	}

	.theme-midnight .message-input:focus {
		border-color: #a855f7;
		box-shadow: 0 0 0 1px #a855f7;
	}

	/* === Send Button === */
	.send-button {
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: none;
		transition: all 0.2s;
		cursor: pointer;
	}

	.send-button:hover:not(:disabled) {
		transform: scale(1.05);
	}

	.send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: #4b5563;
		color: #9ca3af;
	}

	.send-button:disabled:hover {
		transform: none;
	}

	.theme-fleety .send-button:not(:disabled) {
		background: #facc15;
		color: #000;
	}

	.theme-fleety .send-button:not(:disabled):hover {
		background: #fde047;
	}

	.theme-material .send-button:not(:disabled) {
		background: #2563eb;
		color: #fff;
	}

	.theme-material .send-button:not(:disabled):hover {
		background: #1d4ed8;
	}

	.theme-midnight .send-button:not(:disabled) {
		background: #9333ea;
		color: #fff;
	}

	.theme-midnight .send-button:not(:disabled):hover {
		background: #7e22ce;
	}

	/* === Message Content Styles === */
    .message-content {
        word-wrap: break-word;
        overflow-wrap: break-word;
        line-height: 1.5;
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

    /* Dark theme inline code */
    :global(.message-content.dark .message-inline-code) {
        background-color: rgba(255, 255, 255, 0.1);
        padding: 0.15em 0.4em;
        border-radius: 3px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9em;
        border: 1px solid rgba(255, 255, 255, 0.15);
    }

    /* Light theme inline code */
    :global(.message-content.light .message-inline-code) {
        background-color: rgba(0, 0, 0, 0.08);
        padding: 0.15em 0.4em;
        border-radius: 3px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9em;
        border: 1px solid rgba(0, 0, 0, 0.1);
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

    :global(.message-content.dark .copy-inline-btn:hover) {
        opacity: 1 !important;
        background-color: rgba(255, 255, 255, 0.15);
    }

    :global(.message-content.light .copy-inline-btn:hover) {
        opacity: 1 !important;
        background-color: rgba(0, 0, 0, 0.1);
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
    :global(.message-content.dark .code-block-header) {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.4em 0.75em;
        background-color: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    :global(.message-content.light .code-block-header) {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.4em 0.75em;
        background-color: rgba(0, 0, 0, 0.03);
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
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

    :global(.message-content.dark .copy-code-btn:hover) {
        opacity: 1;
        background-color: rgba(255, 255, 255, 0.1);
    }

    :global(.message-content.light .copy-code-btn:hover) {
        opacity: 1;
        background-color: rgba(0, 0, 0, 0.08);
    }

    :global(.message-content .copy-icon) {
        width: 14px;
        height: 14px;
    }

    /* Dark theme code block */
    :global(.message-content.dark .message-code-block) {
        background-color: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-top: none;
        padding: 0.75em;
        border-radius: 0 0 6px 6px;
        overflow-x: auto;
        margin: 0;
    }

    /* Light theme code block */
    :global(.message-content.light .message-code-block) {
        background-color: rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(0, 0, 0, 0.1);
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

    :global(.message-content.dark table th),
    :global(.message-content.dark table td) {
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.4em 0.6em;
    }

    :global(.message-content.light table th),
    :global(.message-content.light table td) {
        border: 1px solid rgba(0, 0, 0, 0.2);
        padding: 0.4em 0.6em;
    }

    :global(.message-content.dark table th) {
        background-color: rgba(255, 255, 255, 0.05);
        font-weight: 600;
    }

    :global(.message-content.light table th) {
        background-color: rgba(0, 0, 0, 0.03);
        font-weight: 600;
    }

    /* Handle first and last element margins */
    :global(.message-content > *:first-child) {
        margin-top: 0;
    }

    :global(.message-content > *:last-child) {
        margin-bottom: 0;
    }
</style>