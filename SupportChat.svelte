<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import MessageContent from './MessageContent.svelte';

    const FLEETY_PROJECT_ID = import.meta.env.VITE_FLEETY_PROJECT_ID;
	// Fleety API Configuration
	const API_URL = 'https://api.fleety.dev/api';
	
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
	let dockPosition: DockPosition = 'bottom-right'; // bottom-right | bottom-left | top-right | top-left
	let theme: Theme = 'fleety'; // fleety | midnight | material

	// Theme configurations
	const themes = {
		fleety: {
			buttonBg: 'bg-yellow-400',
			buttonHover: 'hover:bg-yellow-300',
			buttonText: 'text-black',
			chatBg: 'bg-gray-900',
			chatBorder: 'border-gray-700',
			headerBg: 'bg-yellow-400',
			headerHover: 'hover:bg-yellow-300',
			headerText: 'text-black',
			userMessageBg: 'bg-yellow-400',
			userMessageHover: 'hover:bg-yellow-300',
			userMessageText: 'text-black',
			aiMessageBg: 'bg-gray-800',
			aiMessageBorder: 'border-gray-700',
			aiMessageHover: 'hover:bg-gray-700 hover:border-gray-600',
			aiMessageText: 'text-white',
			inputBg: 'bg-gray-800',
			inputBorder: 'border-gray-600',
			inputFocus: 'focus:border-yellow-400 focus:ring-yellow-400',
			inputHover: 'hover:border-gray-500 hover:bg-gray-750',
			inputText: 'text-white',
			inputPlaceholder: 'placeholder-gray-400',
			sendButtonBg: 'bg-yellow-400',
			sendButtonHover: 'hover:bg-yellow-300',
			sendButtonText: 'text-black',
			resizeHandleHover: 'hover:bg-yellow-400',
			dividerBorder: 'border-gray-700'
		},
		material: {
			buttonBg: 'bg-blue-600',
			buttonHover: 'hover:bg-blue-700',
			buttonText: 'text-white',
			chatBg: 'bg-white',
			chatBorder: 'border-gray-300',
			headerBg: 'bg-blue-600',
			headerHover: 'hover:bg-blue-700',
			headerText: 'text-white',
			userMessageBg: 'bg-blue-600',
			userMessageHover: 'hover:bg-blue-700',
			userMessageText: 'text-white',
			aiMessageBg: 'bg-gray-100',
			aiMessageBorder: 'border-gray-200',
			aiMessageHover: 'hover:bg-gray-200 hover:border-gray-300',
			aiMessageText: 'text-gray-900',
			inputBg: 'bg-gray-50',
			inputBorder: 'border-gray-300',
			inputFocus: 'focus:border-blue-600 focus:ring-blue-600',
			inputHover: 'hover:border-gray-400 hover:bg-gray-100',
			inputText: 'text-gray-900',
			inputPlaceholder: 'placeholder-gray-500',
			sendButtonBg: 'bg-blue-600',
			sendButtonHover: 'hover:bg-blue-700',
			sendButtonText: 'text-white',
			resizeHandleHover: 'hover:bg-blue-600',
			dividerBorder: 'border-gray-300'
		},
		midnight: {
			buttonBg: 'bg-purple-600',
			buttonHover: 'hover:bg-purple-700',
			buttonText: 'text-white',
			chatBg: 'bg-slate-900',
			chatBorder: 'border-purple-800',
			headerBg: 'bg-gradient-to-r from-purple-900 to-indigo-900',
			headerHover: 'hover:from-purple-800 hover:to-indigo-800',
			headerText: 'text-purple-100',
			userMessageBg: 'bg-gradient-to-r from-purple-600 to-indigo-600',
			userMessageHover: 'hover:from-purple-700 hover:to-indigo-700',
			userMessageText: 'text-white',
			aiMessageBg: 'bg-slate-800',
			aiMessageBorder: 'border-purple-900',
			aiMessageHover: 'hover:bg-slate-700 hover:border-purple-800',
			aiMessageText: 'text-purple-50',
			inputBg: 'bg-slate-800',
			inputBorder: 'border-purple-900',
			inputFocus: 'focus:border-purple-500 focus:ring-purple-500',
			inputHover: 'hover:border-purple-800 hover:bg-slate-750',
			inputText: 'text-purple-50',
			inputPlaceholder: 'placeholder-purple-300',
			sendButtonBg: 'bg-purple-600',
			sendButtonHover: 'hover:bg-purple-700',
			sendButtonText: 'text-white',
			resizeHandleHover: 'hover:bg-purple-600',
			dividerBorder: 'border-purple-900'
		}
	};

	$: currentTheme = themes[theme];

	/**
	 * Initialize an anonymous session for the Fleety chat proxy
	 * Works for both authenticated and unauthenticated users
	 */
	async function initializeSession() {
		const token = $authStore.token;

		try {
			console.log('🔄 Initializing Fleety chat session...');
			console.log('Project ID:', FLEETY_PROJECT_ID);
			console.log('Origin:', window.location.origin);
			console.log('Authenticated:', !!token);
			
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			
			// Include auth token if available (allows authenticated users to bypass rate limits)
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}
			
			const response = await fetch(`${API_URL}/init-session`, {
				method: 'POST',
				headers,
				body: JSON.stringify({ project_id: FLEETY_PROJECT_ID })
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
				addAIMessage("⚠️ Unable to connect to chat service. Please make sure you're logged in and try again.");
				return;
			}
		}

		// Show typing indicator
		isTyping = true;

		try {
			console.log('📤 Sending chat message with history...');
			console.log('Conversation history length:', conversationHistory.length);
			console.log('Using anon token:', anonToken.substring(0, 20) + '...');
			
			const response = await fetch(`${API_URL}/chat`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${anonToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ 
					messages: conversationHistory 
				})
			});

			console.log('📥 Response status:', response.status);
			console.log('Response headers:', Object.fromEntries(response.headers.entries()));

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('❌ Chat request failed:', response.status, errorData);
				throw new Error(errorData.error || `HTTP ${response.status}`);
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

			// Handle token expiration
			if (error.includes('401') || error.includes('expired')) {
				console.log('🔄 Token expired, reinitializing session...');
				anonToken = '';
				await initializeSession();
				
				if (anonToken) {
					addAIMessage("Session refreshed. Please try sending your message again.");
				} else {
					addAIMessage("⚠️ Session expired. Please refresh the page and log in again.");
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

	// Helper functions for positioning
	function getButtonPosition(position: DockPosition): string {
		switch (position) {
			case 'bottom-right':
				return 'bottom-6 right-6';
			case 'bottom-left':
				return 'bottom-6 left-6';
			case 'top-right':
				return 'top-6 right-6';
			case 'top-left':
				return 'top-6 left-6';
		}
	}

	function getChatPosition(position: DockPosition): string {
		switch (position) {
			case 'bottom-right':
				return 'bottom-24 right-6';
			case 'bottom-left':
				return 'bottom-24 left-6';
			case 'top-right':
				return 'top-24 right-6';
			case 'top-left':
				return 'top-24 left-6';
		}
	}

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
		// Initialize session if user is already logged in
		if ($authStore.token) {
			initializeSession();
		}

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
		
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<!-- Chat Toggle Button -->
<div class="chat-toggle-button fixed z-50 {getButtonPosition(dockPosition)}">
	<button
		on:click={(e) => { e.stopPropagation(); toggleChat(); }}
		class="flex h-14 w-14 items-center justify-center rounded-full {currentTheme.buttonBg} {currentTheme.buttonText} shadow-lg transition-all {currentTheme.buttonHover} hover:scale-110 cursor-pointer {isOpen ? 'rotate-45' : ''}"
		aria-label="Toggle support chat"
	>
		{#if isOpen}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
		class="chat-container fixed z-40 flex flex-col rounded-lg border {currentTheme.chatBorder} {currentTheme.chatBg} shadow-2xl hover:shadow-3xl transition-shadow duration-300 {isResizing ? 'select-none' : ''} {getChatPosition(dockPosition)}"
		style="width: {chatWidth}px; height: {chatHeight}px;"
	>
		<!-- Dynamic Resize Handles Based on Dock Position -->
		<!-- Corner Resize Handle -->
		<div
			role="button"
			tabindex="0"
			on:mousedown={(e) => startResize(e, getResizeHandles(dockPosition).corner)}
			class="absolute w-4 h-4 {currentTheme.resizeHandleHover} hover:bg-opacity-20 transition-colors duration-200 z-10 {
				getResizeHandles(dockPosition).corner === 'nw' ? 'top-0 left-0 cursor-nw-resize' :
				getResizeHandles(dockPosition).corner === 'ne' ? 'top-0 right-0 cursor-ne-resize' :
				getResizeHandles(dockPosition).corner === 'sw' ? 'bottom-0 left-0 cursor-sw-resize' :
				getResizeHandles(dockPosition).corner === 'se' ? 'bottom-0 right-0 cursor-se-resize' : ''
			}"
			title="Resize chat window"
		></div>
		
		<!-- Edge Resize Handles -->
		{#each getResizeHandles(dockPosition).edges as edge}
			<div
				role="button"
				tabindex="0"
				on:mousedown={(e) => startResize(e, edge)}
				class="absolute {currentTheme.resizeHandleHover} hover:bg-opacity-10 transition-colors duration-200 {
					edge === 'n' ? 'top-0 left-4 right-4 h-2 cursor-n-resize' :
					edge === 's' ? 'bottom-0 left-4 right-4 h-2 cursor-s-resize' :
					edge === 'w' ? 'left-0 top-4 bottom-4 w-2 cursor-w-resize' :
					edge === 'e' ? 'right-0 top-4 bottom-4 w-2 cursor-e-resize' : ''
				}"
				title="Resize {edge === 'n' || edge === 's' ? 'height' : 'width'}"
			></div>
		{/each}
		<!-- Chat Header -->
		<div class="flex items-center justify-between rounded-t-lg {currentTheme.headerBg} px-4 py-3 {currentTheme.headerText} transition-colors duration-200 {currentTheme.headerHover} cursor-default">
			<div class="flex items-center space-x-2">
				<div class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
				<span class="font-medium">Fleety Support</span>
			</div>
			<button on:click={toggleChat} class="{currentTheme.headerText} hover:opacity-70 transition-all duration-200 hover:scale-110 cursor-pointer" aria-label="Minimize chat">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
		</div>

		<!-- Messages Container -->
		<div
			bind:this={chatContainer}
			class="flex-1 overflow-y-auto p-4 space-y-3"
		>
			{#each messages as message (message.id)}
				<div
					in:fly={{ y: 10, duration: 200 }}
					class="flex {message.isUser ? 'justify-end' : 'justify-start'}"
				>
					<div
						class="max-w-xs rounded-lg px-3 py-2 text-sm transition-all duration-200 hover:scale-105 cursor-default {
							message.isUser
								? `${currentTheme.userMessageBg} ${currentTheme.userMessageText} ${currentTheme.userMessageHover}`
								: `${currentTheme.aiMessageBg} ${currentTheme.aiMessageText} border ${currentTheme.aiMessageBorder} ${currentTheme.aiMessageHover}`
						}"
					>
						<MessageContent content={message.text} isUser={message.isUser} theme={currentTheme.chatBg.includes('white') ? 'light' : 'dark'} />
					</div>
				</div>
			{/each}

			{#if isTyping}
				<div in:fade={{ duration: 200 }} class="flex justify-start">
					<div class="flex items-center space-x-1 rounded-lg {currentTheme.aiMessageBg} border {currentTheme.aiMessageBorder} px-3 py-2">
						<div class="flex space-x-1">
							<div class="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
							<div class="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
							<div class="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="border-t {currentTheme.dividerBorder} p-4">
			<div class="flex space-x-2">
				<input
					bind:this={inputElement}
					bind:value={currentMessage}
					on:keypress={handleKeyPress}
					placeholder="Ask about Fleety..."
					class="flex-1 rounded-lg border {currentTheme.inputBorder} {currentTheme.inputBg} px-3 py-2 text-sm {currentTheme.inputText} {currentTheme.inputPlaceholder} transition-all duration-200 {currentTheme.inputFocus} focus:outline-none focus:ring-1 {currentTheme.inputHover} cursor-text"
				/>
				<button
					on:click={sendMessage}
					disabled={!currentMessage.trim()}
					class="rounded-lg {currentTheme.sendButtonBg} px-3 py-2 {currentTheme.sendButtonText} transition-all duration-200 {currentTheme.sendButtonHover} hover:scale-105 disabled:bg-gray-600 disabled:text-gray-400 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed"
					aria-label="Send message"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes bounce {
		0%, 80%, 100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-6px);
		}
	}
	
	.animate-bounce {
		animation: bounce 1.4s infinite;
	}
</style>