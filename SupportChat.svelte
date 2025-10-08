<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { marked } from 'marked';
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
	}<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';

	// API Configuration
	const API_URL = 'https://api.fleety.dev/api';
	const FLEETY_PROJECT_ID = import.meta.env.VITE_FLEETY_PROJECT_ID;

	interface Ticket {
		id: string;
		slug: string;
		title: string;
		description: string;
		status: 'open' | 'in_progress' | 'resolved' | 'closed';
		created_at: string;
		updated_at: string;
		messages: TicketMessage[];
	}

	interface TicketMessage {
		id: string;
		author: 'user' | 'admin';
		content: string;
		timestamp: string;
		read_by: ('user' | 'admin')[]; // Array of who has read this message
	}

	interface CreateTicketRequest {
		project_id: string;
		title: string;
		description: string;
		public_key?: string;
	}

	interface AddMessageRequest {
		author: 'user' | 'admin';
		content: string;
	}

	interface UpdateTicketRequest {
		status: 'open' | 'in_progress' | 'resolved' | 'closed';
	}

	/**
	 * Create a new support ticket (public, no auth required)
	 */
	async function createTicket(data: CreateTicketRequest): Promise<Ticket> {
		const response = await fetch(`${API_URL}/tickets`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to create ticket');
		}

		return result;
	}

	/**
	 * Get a ticket by its slug (public, no auth required, rate-limited)
	 * If token is provided, bypasses rate limiting
	 */
	async function getTicket(slug: string, token?: string): Promise<Ticket> {
		const headers: Record<string, string> = {};
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		const response = await fetch(`${API_URL}/tickets/${slug}`, { headers });

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to fetch ticket');
		}

		return result;
	}

	/**
	 * Add a message to a ticket (public, no auth required, rate-limited)
	 * If token is provided, bypasses rate limiting
	 */
	async function addMessage(slug: string, data: AddMessageRequest, token?: string): Promise<void> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		const response = await fetch(`${API_URL}/tickets/${slug}/messages`, {
			method: 'POST',
			headers,
			body: JSON.stringify(data)
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to add message');
		}
	}

	/**
	 * List all tickets for a project (admin only, requires auth)
	 */
	async function listTickets(projectId: string, token: string): Promise<Ticket[]> {
		const response = await fetch(`${API_URL}/projects/${projectId}/tickets`, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to fetch tickets');
		}

		return result.tickets || [];
	}

	/**
	 * Update ticket status (admin only, requires auth)
	 */
	async function updateTicketStatus(
		ticketId: string,
		status: UpdateTicketRequest['status'],
		token: string
	): Promise<void> {
		const response = await fetch(`${API_URL}/tickets/${ticketId}`, {
			method: 'PATCH',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ status })
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to update ticket');
		}
	}

	/**
	 * Delete a ticket (admin only, requires auth)
	 */
	async function deleteTicket(ticketId: string, token: string): Promise<void> {
		const response = await fetch(`${API_URL}/tickets/${ticketId}`, {
			method: 'DELETE',
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to delete ticket');
		}
	}

	/**
	 * Poll a ticket for updates (for real-time message updates)
	 * If token is provided, bypasses rate limiting
	 */
	async function pollTicket(slug: string, lastMessageCount: number, token?: string): Promise<Ticket | null> {
		try {
			const ticket = await getTicket(slug, token);
			if (ticket.messages.length > lastMessageCount) {
				return ticket;
			}
			return null;
		} catch (error) {
			console.error('Error polling ticket:', error);
			return null;
		}
	}

	/**
	 * Mark all messages in a ticket as read by a specific reader (user or admin)
	 */
	async function markMessagesAsRead(slug: string, reader: 'user' | 'admin'): Promise<void> {
		const response = await fetch(`${API_URL}/tickets/${slug}/messages/read`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ reader })
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to mark messages as read');
		}
	}

	// Component props
	export let theme: 'fleety' | 'material' | 'midnight' = 'fleety';
	export let dockPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-left';

	// UI State
	let isOpen = false;
	let currentView: 'list' | 'create' | 'view' = 'list';
	
	// Ticket Creation
	let title = '';
	let description = '';
	let isCreating = false;
	let createError = '';

	// Ticket Viewing
	let currentTicket: Ticket | null = null;
	let ticketSlug = '';
	let messageContent = '';
	let isSendingMessage = false;
	let messageError = '';
	let isLoadingTicket = false;
	let ticketError = '';

	// Saved tickets (stored in localStorage)
	let savedTickets: Array<{ slug: string; title: string; status: string; unreadCount?: number }> = [];

	// Chat dimensions
	let chatWidth = 380;
	let chatHeight = 550;
	let minWidth = 320;
	let maxWidth = 500;
	let minHeight = 450;
	let maxHeight = 700;

	// Polling for new messages
	let pollInterval: number | null = null;

	// Auto-scroll
	let messagesEndRef: HTMLDivElement;

	// Theme configurations
	const themes = {
		fleety: {
			buttonBg: 'bg-yellow-400',
			buttonHover: 'hover:bg-yellow-300',
			buttonText: 'text-black',
			chatBg: 'bg-gray-900',
			chatBorder: 'border-gray-700',
			headerBg: 'bg-yellow-400',
			headerText: 'text-black',
			userMessageBg: 'bg-yellow-400',
			userMessageText: 'text-black',
			adminMessageBg: 'bg-gray-800',
			adminMessageText: 'text-white',
			inputBg: 'bg-gray-800',
			inputBorder: 'border-gray-600',
			inputFocus: 'focus:border-yellow-400 focus:ring-yellow-400',
			inputText: 'text-white',
			sendButtonBg: 'bg-yellow-400',
			sendButtonText: 'text-black',
			cardBg: 'bg-gray-800',
			cardHover: 'hover:bg-gray-700'
		},
		material: {
			buttonBg: 'bghttp://localhost:5173/projects/a-ue7MC5OCmxoA2uNDccFd6hOHxE3zrk/ticketsa-ue7MC5OCmxoA2uNDccFd6hOHxE3zrk-blue-600',
			buttonHover: 'hover:bg-blue-700',
			buttonText: 'text-white',
			chatBg: 'bg-white',
			chatBorder: 'border-gray-300',
			headerBg: 'bg-blue-600',
			headerText: 'text-white',
			userMessageBg: 'bg-blue-600',
			userMessageText: 'text-white',
			adminMessageBg: 'bg-gray-100',
			adminMessageText: 'text-gray-900',
			inputBg: 'bg-gray-50',
			inputBorder: 'border-gray-300',
			inputFocus: 'focus:border-blue-600 focus:ring-blue-600',
			inputText: 'text-gray-900',
			sendButtonBg: 'bg-blue-600',
			sendButtonText: 'text-white',
			cardBg: 'bg-gray-50',
			cardHover: 'hover:bg-gray-100'
		},
		midnight: {
			buttonBg: 'bg-purple-600',
			buttonHover: 'hover:bg-purple-700',
			buttonText: 'text-white',
			chatBg: 'bg-slate-900',
			chatBorder: 'border-purple-800',
			headerBg: 'bg-gradient-to-r from-purple-900 to-indigo-900',
			headerText: 'text-purple-100',
			userMessageBg: 'bg-gradient-to-r from-purple-600 to-indigo-600',
			userMessageText: 'text-white',
			adminMessageBg: 'bg-slate-800',
			adminMessageText: 'text-purple-50',
			inputBg: 'bg-slate-800',
			inputBorder: 'border-purple-900',
			inputFocus: 'focus:border-purple-500 focus:ring-purple-500',
			inputText: 'text-purple-50',
			sendButtonBg: 'bg-purple-600',
			sendButtonText: 'text-white',
			cardBg: 'bg-slate-800',
			cardHover: 'hover:bg-slate-700'
		}
	};

	$: currentTheme = themes[theme];
	$: positionClasses = {
		'bottom-right': 'bottom-4 right-4',
		'bottom-left': 'bottom-4 left-4',
		'top-right': 'top-4 right-4',
		'top-left': 'top-4 left-4'
	}[dockPosition];

	onMount(() => {
		loadSavedTickets();
	});

	onDestroy(() => {
		stopPolling();
	});

	function loadSavedTickets() {
		const saved = localStorage.getItem('supportTickets');
		if (saved) {
			savedTickets = JSON.parse(saved);
		}
	}

	function saveTicketToList(ticket: Ticket) {
		// Count unread admin messages (not read by user)
		const unreadCount = ticket.messages.filter(msg => 
			msg.author === 'admin' && !msg.read_by?.includes('user')
		).length;
		
		const ticketInfo = {
			slug: ticket.slug,
			title: ticket.title,
			status: ticket.status,
			unreadCount
		};
		
		savedTickets = [ticketInfo, ...savedTickets.filter(t => t.slug !== ticket.slug)];
		localStorage.setItem('supportTickets', JSON.stringify(savedTickets));
	}

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesEndRef) {
				messagesEndRef.scrollIntoView({ behavior: 'smooth' });
			}
		}, 100);
	}

	async function handleCreateTicket() {
		if (!title.trim() || !description.trim()) {
			createError = 'Please fill in all fields';
			return;
		}

		isCreating = true;
		createError = '';

		try {
			const ticket = await createTicket({
				project_id: FLEETY_PROJECT_ID,
				title: title.trim(),
				description: description.trim()
			});

			saveTicketToList(ticket);
			currentTicket = ticket;
			currentView = 'view';
			title = '';
			description = '';
			startPolling();
		} catch (error: any) {
			createError = error.message || 'Failed to create ticket';
		} finally {
			isCreating = false;
		}
	}

	async function handleLoadTicket(slug: string) {
		if (!slug.trim()) return;
		
		isLoadingTicket = true;
		ticketError = '';

		try {
			const ticket = await getTicket(slug.trim());
			currentTicket = ticket;
			currentView = 'view';
			saveTicketToList(ticket);
			
			// Mark all admin messages as read by user
			try {
				await markMessagesAsRead(slug.trim(), 'user');
				// Refresh to get updated read_by status
				const refreshed = await getTicket(slug.trim());
				currentTicket = refreshed;
				saveTicketToList(refreshed);
			} catch (readErr) {
				console.error('Error marking messages as read:', readErr);
			}
			
			startPolling();
			// Scroll to bottom after loading
			scrollToBottom();
		} catch (error: any) {
			ticketError = error.message || 'Failed to load ticket';
		} finally {
			isLoadingTicket = false;
		}
	}	async function handleSendMessage() {
		if (!messageContent.trim() || !currentTicket) return;

		isSendingMessage = true;
		messageError = '';

		try {
			await addMessage(currentTicket.slug, {
				author: 'user',
				content: messageContent.trim()
			});

			messageContent = '';
			// Reload ticket to get the new message
			const updated = await getTicket(currentTicket.slug);
			currentTicket = updated;
			saveTicketToList(updated);
			
			// Scroll to bottom after sending
			scrollToBottom();
		} catch (error: any) {
			messageError = error.message || 'Failed to send message';
		} finally {
			isSendingMessage = false;
		}
	}

	function startPolling() {
		stopPolling();
		pollInterval = window.setInterval(async () => {
			if (currentTicket) {
				const updated = await pollTicket(currentTicket.slug, currentTicket.messages.length);
				if (updated) {
					currentTicket = updated;
					saveTicketToList(updated);
				}
			}
		}, 5000); // Poll every 5 seconds
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	function handleClose() {
		isOpen = false;
		stopPolling();
	}

	function handleOpen() {
		isOpen = true;
		// Refresh unread counts when widget opens
		refreshUnreadCounts();
		if (currentView === 'view' && currentTicket) {
			startPolling();
		}
	}

	// Refresh unread counts for all saved tickets
	async function refreshUnreadCounts() {
		for (const ticket of savedTickets) {
			try {
				const updated = await getTicket(ticket.slug);
				const unreadCount = updated.messages.filter(msg => 
					msg.author === 'admin' && !msg.read_by?.includes('user')
				).length;
				
				// Update the ticket in the list with new unread count
				savedTickets = savedTickets.map(t => 
					t.slug === ticket.slug ? { ...t, unreadCount } : t
				);
			} catch (err) {
				console.error('Error refreshing ticket:', err);
			}
		}
		// Save updated counts to localStorage
		localStorage.setItem('supportTickets', JSON.stringify(savedTickets));
	}

	function goToList() {
		currentView = 'list';
		currentTicket = null;
		stopPolling();
	}

	function goToCreate() {
		currentView = 'create';
		createError = '';
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'open': return 'bg-green-500';
			case 'in_progress': return 'bg-blue-500';
			case 'resolved': return 'bg-purple-500';
			case 'closed': return 'bg-gray-500';
			default: return 'bg-gray-500';
		}
	}

	function getStatusLabel(status: string): string {
		return status.replace('_', ' ').toUpperCase();
	}
</script>

<!-- Floating Action Button -->
{#if !isOpen}
	<button
		on:click={handleOpen}
		class="fixed {positionClasses} {currentTheme.buttonBg} {currentTheme.buttonHover} {currentTheme.buttonText} 
			rounded-full p-4 shadow-2xl transition-all duration-200 hover:scale-110 z-50"
		transition:fade={{ duration: 200 }}
		aria-label="Open Support Tickets"
	>
		<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
				d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
		</svg>
	</button>
{/if}

<!-- Chat Widget -->
{#if isOpen}
	<div
		class="fixed {positionClasses} {currentTheme.chatBg} rounded-lg shadow-2xl border-2 {currentTheme.chatBorder} 
			flex flex-col overflow-hidden z-50"
		style="width: {chatWidth}px; height: {chatHeight}px;"
		transition:fly={{ y: 50, duration: 300 }}
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 {currentTheme.headerBg} {currentTheme.headerText}">
			<div class="flex items-center gap-2">
				{#if currentView !== 'list'}
					<button on:click={goToList} class="hover:opacity-80 transition-opacity" aria-label="Back to list">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
				{/if}
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
						d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
				</svg>
				<h3 class="font-semibold">
					{#if currentView === 'list'}Support Tickets{/if}
					{#if currentView === 'create'}Create Ticket{/if}
					{#if currentView === 'view' && currentTicket}
						<span class="text-sm">{currentTicket.title}</span>
					{/if}
				</h3>
			</div>
			<button on:click={handleClose} class="hover:opacity-80 transition-opacity" aria-label="Close">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>		<!-- Content -->
		<div class="flex-1 overflow-hidden">
			{#if currentView === 'list'}
				<!-- Ticket List View -->
				<div class="h-full overflow-y-auto p-4 space-y-3">
					<button
						on:click={goToCreate}
						class="{currentTheme.buttonBg} {currentTheme.buttonHover} {currentTheme.buttonText} 
							w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Create New Ticket
					</button>

					{#if savedTickets.length > 0}
						<div class="space-y-2">
							<h4 class="text-sm font-medium {currentTheme.inputText} opacity-70">Your Tickets</h4>
							{#each savedTickets as ticket}
								<button
									on:click={() => handleLoadTicket(ticket.slug)}
									class="{currentTheme.cardBg} {currentTheme.cardHover} p-3 rounded-lg text-left w-full transition-colors relative"
								>
									<div class="flex items-start justify-between gap-2">
										<div class="flex items-center gap-2 flex-1 min-w-0">
											<!-- Unread indicator - cyan dot -->
											{#if ticket.unreadCount && ticket.unreadCount > 0}
												<div class="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0" title="{ticket.unreadCount} unread message{ticket.unreadCount > 1 ? 's' : ''}"></div>
											{/if}
											<div class="flex-1 min-w-0">
												<p class="{currentTheme.inputText} font-medium text-sm truncate">{ticket.title}</p>
												<p class="text-xs opacity-60 {currentTheme.inputText}">#{ticket.slug}</p>
											</div>
										</div>
										<span class="{getStatusColor(ticket.status)} text-white text-xs px-2 py-1 rounded-full">
											{getStatusLabel(ticket.status)}
										</span>
									</div>
								</button>
							{/each}
						</div>
					{:else}
						<div class="text-center py-8">
							<p class="{currentTheme.inputText} opacity-60 text-sm">No tickets yet</p>
						</div>
					{/if}

					<!-- Load by Slug -->
					<div class="mt-6 pt-4 border-t {currentTheme.chatBorder}">
						<h4 class="text-sm font-medium {currentTheme.inputText} opacity-70 mb-2">Have a ticket ID?</h4>
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={ticketSlug}
								placeholder="Enter ticket ID"
								class="{currentTheme.inputBg} {currentTheme.inputBorder} {currentTheme.inputFocus} 
									{currentTheme.inputText} flex-1 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2"
							/>
							<button
								on:click={() => handleLoadTicket(ticketSlug)}
								disabled={!ticketSlug.trim() || isLoadingTicket}
								class="{currentTheme.sendButtonBg} {currentTheme.sendButtonText} px-4 py-2 rounded-lg 
									text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{isLoadingTicket ? '...' : 'Load'}
							</button>
						</div>
						{#if ticketError}
							<p class="text-red-500 text-xs mt-2">{ticketError}</p>
						{/if}
					</div>
				</div>

			{:else if currentView === 'create'}
				<!-- Create Ticket View -->
				<div class="h-full overflow-y-auto p-4">
					<div class="space-y-4">
						<div>
							<label for="ticket-title" class="block text-sm font-medium {currentTheme.inputText} mb-1">Title</label>
							<input
								id="ticket-title"
								type="text"
								bind:value={title}
								placeholder="Brief summary of your issue"
								maxlength="200"
								class="{currentTheme.inputBg} {currentTheme.inputBorder} {currentTheme.inputFocus} 
									{currentTheme.inputText} w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
							/>
						</div>

						<div>
							<label for="ticket-description" class="block text-sm font-medium {currentTheme.inputText} mb-1">Description</label>
							<textarea
								id="ticket-description"
								bind:value={description}
								placeholder="Provide detailed information about your issue..."
								rows="8"
								maxlength="5000"
								class="{currentTheme.inputBg} {currentTheme.inputBorder} {currentTheme.inputFocus} 
									{currentTheme.inputText} w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2 resize-none"
							></textarea>
							<p class="text-xs {currentTheme.inputText} opacity-50 mt-1">
								{description.length}/5000 characters
							</p>
						</div>

						{#if createError}
							<div class="bg-red-500 bg-opacity-10 border border-red-500 rounded-lg p-3">
								<p class="text-red-500 text-sm">{createError}</p>
							</div>
						{/if}

						<button
							on:click={handleCreateTicket}
							disabled={isCreating || !title.trim() || !description.trim()}
							class="{currentTheme.buttonBg} {currentTheme.buttonHover} {currentTheme.buttonText} 
								w-full py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isCreating ? 'Creating...' : 'Create Ticket'}
						</button>
					</div>
				</div>

			{:else if currentView === 'view' && currentTicket}
				<!-- View Ticket & Messages -->
				<div class="h-full flex flex-col">
					<!-- Ticket Info -->
					<div class="{currentTheme.cardBg} p-4 border-b {currentTheme.chatBorder}">
						<div class="flex items-start justify-between gap-2 mb-2">
							<div class="flex-1">
								<p class="{currentTheme.inputText} text-xs opacity-60">#{currentTicket.slug}</p>
							</div>
							<span class="{getStatusColor(currentTicket.status)} text-white text-xs px-2 py-1 rounded-full">
								{getStatusLabel(currentTicket.status)}
							</span>
						</div>
						<p class="{currentTheme.inputText} text-sm">{currentTicket.description}</p>
					</div>

					<!-- Messages -->
					<div class="flex-1 overflow-y-auto p-4 space-y-3">
						{#each currentTicket.messages as message}
							<div class="flex {message.author === 'user' ? 'justify-end' : 'justify-start'}">
								<div class="max-w-[80%]">
									<div class="{message.author === 'user' ? currentTheme.userMessageBg : currentTheme.adminMessageBg} 
										{message.author === 'user' ? currentTheme.userMessageText : currentTheme.adminMessageText} 
										rounded-lg p-3">
										<p class="text-sm whitespace-pre-wrap break-words">{message.content}</p>
									</div>
									<p class="text-xs {currentTheme.inputText} opacity-50 mt-1 
										{message.author === 'user' ? 'text-right' : 'text-left'} flex items-center gap-1 {message.author === 'user' ? 'justify-end' : 'justify-start'}">
										<span>{message.author === 'admin' ? 'Support' : 'You'} · {formatDate(message.timestamp)}</span>
										<!-- Read indicator - show on user's own messages when admin has read them -->
										{#if message.author === 'user' && message.read_by?.includes('admin')}
											<svg class="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
											</svg>
										{/if}
									</p>
								</div>
							</div>
						{/each}
						<!-- Scroll target -->
						<div bind:this={messagesEndRef}></div>
					</div>

					<!-- Message Input -->
					<div class="p-4 border-t {currentTheme.chatBorder}">
						{#if messageError}
							<p class="text-red-500 text-xs mb-2">{messageError}</p>
						{/if}
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={messageContent}
								on:keypress={(e) => e.key === 'Enter' && !isSendingMessage && handleSendMessage()}
								placeholder="Type your message..."
								disabled={isSendingMessage}
								class="{currentTheme.inputBg} {currentTheme.inputBorder} {currentTheme.inputFocus} 
									{currentTheme.inputText} flex-1 rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
							/>
							<button
								on:click={handleSendMessage}
								disabled={!messageContent.trim() || isSendingMessage}
								class="{currentTheme.sendButtonBg} {currentTheme.sendButtonText} px-4 py-2 rounded-lg 
									font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{#if isSendingMessage}
									<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
											d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
									</svg>
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}


	// --- End of inlined MessageContent logic ---

	/**
	 * Initialize an anonymous session for the Fleety chat proxy
	 * Works for both authenticated and unauthenticated users
	 */
	async function initializeSession() {
		try {
			console.log('🔄 Initializing Fleety chat session...');
			console.log('Project ID:', FLEETY_PROJECT_ID);
			console.log('Origin:', window.location.origin);
			
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			
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
												<div class="message-content {currentTheme.chatBg.includes('white') ? 'light' : 'dark'}">
							{@html formatMessageContent(message.text, message.isUser)}
						</div>
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