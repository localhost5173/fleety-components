<script lang="ts">
	import { marked } from 'marked';
	import { untrack, onMount } from 'svelte';

	// Props
	interface Props {
		projectId: string;
		dockPosition?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
		theme?: 'light' | 'dark' | 'system' | 'material' | 'nord' | 'fleety';
		accentColor?: string;
	}

	const { projectId, dockPosition = 'bottom-right', theme = 'light' }: Props = $props();

	// Configure marked options
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	// Types
	interface TicketMessage {
		id: string;
		author: 'user' | 'admin';
		content: string;
		timestamp: string;
		read_by: string[];
	}

	interface Ticket {
		id: string;
		slug: string;
		project_id: string;
		title: string;
		description: string;
		status: 'open' | 'closed';
		created_at: string;
		messages: TicketMessage[];
	}

	// Check if running in browser
	let isBrowser = $state(typeof window !== 'undefined');

	// State
	let isOpen = $state(false);
	let activeView = $state<'list' | 'create' | 'view'>('list');
	let tickets = $state<Ticket[]>([]);
	let selectedTicket = $state<Ticket | null>(null);
	let messageInput = $state('');
	let newTicketTitle = $state('');
	let newTicketDescription = $state('');
	let isLoading = $state(false);
	let activeTheme = $state(theme);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let messagesContainer = $state<HTMLDivElement | null>(null);

	// WebSocket
	let ws = $state<WebSocket | null>(null);
	let wsReconnectAttempts = $state(0);
	let wsReconnectTimeout: number | null = null;

	// Rate limiting state
	let isRateLimited = $state(false);
	let rateLimitMessage = $state<string | null>(null);
	let rateLimitCooldown = $state(0);
	let rateLimitTimer: number | null = null;

	// Non-reactive state
	let scrollTimeouts: number[] = [];

	// API Base URLs - hardcoded to production
	const API_BASE = 'https://api.fleety.dev';
	const WS_BASE = 'wss://api.fleety.dev/v1';
	const TICKETS_STORAGE_KEY = `fleety_tickets_${projectId}`;

	// Debug: Log the URLs being used

	// Load tickets from localStorage on mount
	onMount(() => {
		if (typeof window === 'undefined') return;

		const storedTickets = localStorage.getItem(TICKETS_STORAGE_KEY);
		if (storedTickets) {
				try {
					tickets = JSON.parse(storedTickets);
				} catch (e) {
				console.error('❌ Failed to parse stored tickets:', e);
			}
		}

		// Cleanup
		return () => {
			scrollTimeouts.forEach((timeout) => clearTimeout(timeout));
			scrollTimeouts = [];
			if (ws) {
				ws.close();
				ws = null;
			}
			// Close all background WebSocket connections
			wsConnections.forEach((connection) => connection.close());
			wsConnections.clear();
			if (wsReconnectTimeout) {
				clearTimeout(wsReconnectTimeout);
				wsReconnectTimeout = null;
			}
			if (rateLimitTimer) {
				clearInterval(rateLimitTimer);
				rateLimitTimer = null;
			}
		};
	});

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

	// Get position styles
	const getPositionStyles = (): string => {
		switch (dockPosition) {
			case 'bottom-left':
				return 'bottom: 20px; left: 20px;';
			case 'bottom-right':
				return 'bottom: 20px; right: 20px;';
			case 'top-left':
				return 'top: 20px; left: 20px;';
			case 'top-right':
				return 'top: 20px; right: 20px;';
			default:
				return 'bottom: 20px; right: 20px;';
		}
	};

	// Save tickets to localStorage
	function saveTicketsToStorage() {
		if (typeof window !== 'undefined') {
			localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
		}
	}

	// Handle rate limit errors
	function handleRateLimitError(errorMsg: string) {
		isRateLimited = true;

		// Parse rate limit info from error message
		if (errorMsg.includes('3 tickets per hour')) {
			rateLimitMessage = 'Rate limit: Maximum 3 tickets per hour. Please try again later.';
			rateLimitCooldown = 60; // 60 minutes
		} else if (errorMsg.includes('6 messages per minute')) {
			rateLimitMessage = 'Rate limit: Maximum 6 messages per minute. Please slow down.';
			rateLimitCooldown = 1; // 1 minute
		} else if (errorMsg.toLowerCase().includes('rate limit')) {
			rateLimitMessage = errorMsg;
			rateLimitCooldown = 1; // Default 1 minute
		} else {
			return false; // Not a rate limit error
		}

		// Start countdown timer
		let secondsLeft = rateLimitCooldown * 60;
		if (rateLimitTimer) {
			clearInterval(rateLimitTimer);
		}

		rateLimitTimer = window.setInterval(() => {
			secondsLeft--;
			if (secondsLeft <= 0) {
				isRateLimited = false;
				rateLimitMessage = null;
				rateLimitCooldown = 0;
				if (rateLimitTimer) {
					clearInterval(rateLimitTimer);
					rateLimitTimer = null;
				}
			}
		}, 1000);

		return true;
	}

	// Format cooldown time for display
	function formatCooldownTime(): string {
		if (!rateLimitCooldown) return '';

		const totalSeconds = rateLimitCooldown * 60;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;

		if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		}
		return `${seconds}s`;
	}

	// Connect to WebSocket for a ticket
	function connectWebSocket(ticketSlug: string) {
		if (ws) {
			ws.close();
			ws = null;
		}

	const wsUrl = `${WS_BASE}/tickets/${projectId}/${ticketSlug}/ws`;

		try {
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				wsReconnectAttempts = 0;
			};

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					// message received

					if (data.type === 'new_message') {
						// Refresh ticket to get the new message
						refreshTicket(ticketSlug);
					} else if (data.type === 'status_change') {
						// Refresh ticket to get status update
						refreshTicket(ticketSlug);
					} else if (data.type === 'ticket_update') {
						// Refresh ticket to get the full update (handles admin messages)
						refreshTicket(ticketSlug);
					} else if (data.type === 'subscribed') {
					} else if (data.type === 'error') {
						console.error('❌ [WebSocket] Server error:', data.payload);
						// Don't close connection on error, server will close if needed
					} else {
					}
				} catch (e) {
					console.error('❌ [WebSocket] Failed to parse message:', e);
				}
			};
			ws.onerror = (error) => {
				console.error('❌ WebSocket error:', error);
			};

			ws.onclose = () => {
				ws = null;

				// Attempt to reconnect with exponential backoff
				if (selectedTicket && selectedTicket.slug === ticketSlug && wsReconnectAttempts < 5) {
					wsReconnectAttempts++;
					const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000);

					wsReconnectTimeout = window.setTimeout(() => {
						connectWebSocket(ticketSlug);
					}, delay);
				}
			};
		} catch (error) {
			console.error('❌ Failed to create WebSocket:', error);
		}
	}

	// Auto-scroll to bottom
	function autoScroll() {
		const timeoutId = window.setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
			scrollTimeouts = scrollTimeouts.filter((id) => id !== timeoutId);
		}, 100);
		scrollTimeouts.push(timeoutId);
	}

	// Create a new ticket
	async function createTicket() {
		if (!newTicketTitle.trim() || !newTicketDescription.trim() || isLoading) return;

		// Check if rate limited
		if (isRateLimited) {
			errorMessage =
				rateLimitMessage || 'Rate limit active. Please wait before creating another ticket.';
			setTimeout(() => {
				errorMessage = null;
			}, 3000);
			return;
		}

		isLoading = true;
		errorMessage = null;
		successMessage = null;

		try {
			const response = await fetch(`${API_BASE}/tickets`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					project_id: projectId,
					title: newTicketTitle.trim(),
					description: newTicketDescription.trim()
				})
			});			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const error = errorData.error || `HTTP ${response.status}`;

				// Handle rate limit errors
				if (response.status === 429 || handleRateLimitError(error)) {
					errorMessage = rateLimitMessage || error;
				} else {
					throw new Error(error);
				}
				return;
			}

			const newTicket: Ticket = await response.json();

			// Add to tickets array
			tickets = [newTicket, ...tickets];
			saveTicketsToStorage();

			// Clear form
			newTicketTitle = '';
			newTicketDescription = '';

			// Show success message
			successMessage = `Ticket #${newTicket.slug} created successfully!`;
			setTimeout(() => {
				successMessage = null;
			}, 3000);

			// Load the ticket (which will connect WebSocket)
			await loadTicket(newTicket.slug);
		} catch (error) {
			console.error('❌ Create ticket error:', error);
			errorMessage = error instanceof Error ? error.message : 'Failed to create ticket';
			setTimeout(() => {
				errorMessage = null;
			}, 5000);
		} finally {
			isLoading = false;
		}
	}

	// Load ticket details
	async function loadTicket(slug: string) {
		isLoading = true;
		errorMessage = null;

			try {
				const response = await fetch(`${API_BASE}/tickets/${projectId}/${slug}`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const error = errorData.error || `HTTP ${response.status}`;

				// Check if it's a rate limit error
				if (response.status === 429 || error.toLowerCase().includes('rate limit')) {
					handleRateLimitError(error);
					return;
				}

				throw new Error(error);
			}

			const ticketData: Ticket = await response.json();

			selectedTicket = ticketData;

			// Update in tickets array
			untrack(() => {
				const ticketIndex = tickets.findIndex((t) => t.slug === slug);
				if (ticketIndex !== -1) {
					tickets[ticketIndex] = ticketData;
					tickets = [...tickets];
				} else {
					// Add to tickets array if not present
					tickets = [ticketData, ...tickets];
				}
				saveTicketsToStorage();
			});

			// Close background WebSocket for this ticket since we're viewing it
			const bgWs = wsConnections.get(slug);
			if (bgWs) {
				bgWs.close();
				wsConnections.delete(slug);
			}

			// Connect to WebSocket for real-time updates
			connectWebSocket(slug);

			// Mark messages as read
			setTimeout(() => markMessagesAsRead(slug), 500);

			// Auto-scroll
			autoScroll();

			activeView = 'view';
		} catch (error) {
			console.error('❌ Load ticket error:', error);
			errorMessage = error instanceof Error ? error.message : 'Failed to load ticket';
			setTimeout(() => {
				errorMessage = null;
			}, 5000);
		} finally {
			isLoading = false;
		}
	}

	// Send message to ticket
	async function sendMessage() {
		if (!messageInput.trim() || !selectedTicket || isLoading) return;

		// Check if rate limited
		if (isRateLimited) {
			errorMessage =
				rateLimitMessage || 'Rate limit active. Please wait before sending another message.';
			setTimeout(() => {
				errorMessage = null;
			}, 3000);
			return;
		}

		const content = messageInput.trim();
		messageInput = '';
		isLoading = true;
		errorMessage = null;

		// Optimistic update
		const optimisticId = 'temp-' + Date.now();
		const optimisticMessage: TicketMessage = {
			id: optimisticId,
			author: 'user',
			content: content,
			timestamp: new Date().toISOString(),
			read_by: ['user']
		};

		const previousSelectedTicket = { ...selectedTicket };

		// Update UI immediately
		selectedTicket = {
			...selectedTicket,
			messages: [...selectedTicket.messages, optimisticMessage]
		};

		// Update in tickets array (but don't save to storage to avoid persisting temp ID)
		untrack(() => {
			const ticketIndex = tickets.findIndex((t) => t.slug === selectedTicket!.slug);
			if (ticketIndex !== -1 && selectedTicket) {
				tickets[ticketIndex] = { ...selectedTicket };
				tickets = [...tickets];
			}
		});

		// Auto-scroll
		autoScroll();

		try {
			const response = await fetch(
				`${API_BASE}/tickets/${projectId}/${selectedTicket.slug}/messages`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						author: 'user',
						content: content
					})
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const error = errorData.error || `HTTP ${response.status}`;

				// Handle rate limit errors
				if (response.status === 429 || handleRateLimitError(error)) {
					errorMessage = rateLimitMessage || error;
					messageInput = content; // Restore message

					// Revert optimistic update
					selectedTicket = previousSelectedTicket;
					untrack(() => {
						const ticketIndex = tickets.findIndex((t) => t.slug === previousSelectedTicket.slug);
						if (ticketIndex !== -1) {
							tickets[ticketIndex] = previousSelectedTicket;
							tickets = [...tickets];
						}
					});
				} else {
					throw new Error(error);
				}
				return;
			}

			// message sent

			// Reload ticket to get the new message (replaces optimistic one)
			await loadTicket(selectedTicket.slug);
		} catch (error) {
			console.error('❌ Send message error:', error);
			errorMessage = error instanceof Error ? error.message : 'Failed to send message';
			messageInput = content; // Restore message

			// Revert optimistic update
			selectedTicket = previousSelectedTicket;
			untrack(() => {
				const ticketIndex = tickets.findIndex((t) => t.slug === selectedTicket!.slug);
				if (ticketIndex !== -1 && selectedTicket) {
					tickets[ticketIndex] = { ...selectedTicket };
					tickets = [...tickets];
				}
			});

			setTimeout(() => {
				errorMessage = null;
			}, 5000);
		} finally {
			isLoading = false;
		}
	}

	// Mark messages as read
	async function markMessagesAsRead(slug: string) {
		try {
			await fetch(`${API_BASE}/tickets/${projectId}/${slug}/messages/read`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					reader: 'user'
				})
			});
		} catch (error) {
			console.error('❌ Mark as read error:', error);
		}
	}

	// Handle key press
	function handleKeyPress(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (activeView === 'view') {
				sendMessage();
			}
		}
	}

	// Toggle widget
	function toggleWidget() {
		isOpen = !isOpen;
		if (isOpen) {
			// Connect WebSocket for all tickets when opening
			connectAllTicketWebSockets();
		} else {
			// Close WebSocket when closing widget
			if (ws) {
				ws.close();
				ws = null;
			}
			activeView = 'list';
			selectedTicket = null;
		}
	}

	// Connect WebSocket for all tickets in the list (for background updates)
	function connectAllTicketWebSockets() {
		// Create a snapshot of tickets to avoid reactivity issues
		const ticketsSnapshot = [...tickets];
		ticketsSnapshot.forEach((ticket) => {
			if (!wsConnections.has(ticket.slug)) {
				connectBackgroundWebSocket(ticket.slug);
			}
		});
	}

	// WebSocket connections map for background monitoring
	let wsConnections = new Map<string, WebSocket>();

	// Connect to WebSocket for background ticket updates
	function connectBackgroundWebSocket(ticketSlug: string) {
	const wsUrl = `${WS_BASE}/tickets/${projectId}/${ticketSlug}/ws`;

		try {
			const bgWs = new WebSocket(wsUrl);

			bgWs.onopen = () => {
				wsConnections.set(ticketSlug, bgWs);
			};

			bgWs.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					// background message received

					// Only update if we're not currently viewing this ticket
					if (!selectedTicket || selectedTicket.slug !== ticketSlug) {
						// will update ticket in background
						if (data.type === 'new_message' || data.type === 'ticket_update') {
							// Defer the update to avoid reactive context issues
							setTimeout(() => {
								loadTicketInBackground(ticketSlug);
							}, 0);
						}
					} else {
						// skipping update (ticket is currently being viewed)
					}
				} catch (e) {
					console.error('❌ [BgWebSocket] Failed to parse message:', e);
				}
			};
			bgWs.onerror = (error) => {
				console.error('❌ Background WebSocket error:', ticketSlug, error);
			};

			bgWs.onclose = () => {
				wsConnections.delete(ticketSlug);
			};

			wsConnections.set(ticketSlug, bgWs);
		} catch (error) {
			console.error('❌ Failed to create background WebSocket:', error);
		}
	}

	// Load ticket in background to update unread count
	async function loadTicketInBackground(slug: string) {
		try {
			const response = await fetch(`${API_BASE}/tickets/${projectId}/${slug}`);
			if (response.ok) {
				const ticketData: Ticket = await response.json();
				untrack(() => {
					const ticketIndex = tickets.findIndex((t) => t.slug === slug);
					if (ticketIndex !== -1) {
						tickets[ticketIndex] = ticketData;
						tickets = [...tickets];
						saveTicketsToStorage();
					}
				});
			}
		} catch (error) {
			console.error('❌ Failed to load ticket in background:', error);
		}
	}

	// Navigate to create view
	function showCreateView() {
		activeView = 'create';
		newTicketTitle = '';
		newTicketDescription = '';
		errorMessage = null;
		successMessage = null;
	}

	// Navigate to list view
	function showListView() {
		const previousTicketSlug = selectedTicket?.slug;

		activeView = 'list';
		selectedTicket = null;

		// Close active ticket WebSocket
		if (ws) {
			ws.close();
			ws = null;
		}

		// Reconnect background WebSocket for the ticket we just left
		if (previousTicketSlug && !wsConnections.has(previousTicketSlug)) {
			connectBackgroundWebSocket(previousTicketSlug);
		}
	}

	// Format message content
	function formatMessageContent(content: string, isUser: boolean): string {
		if (isUser) {
			return content
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;')
				.replace(/\n/g, '<br>');
		} else {
			try {
				return marked.parse(content) as string;
			} catch (error) {
				console.error('Error parsing markdown:', error);
				return content.replace(/\n/g, '<br>');
			}
		}
	}

	// Get unread count for a ticket
	function getUnreadCount(ticket: Ticket): number {
		return ticket.messages.filter((m) => m.author === 'admin' && !m.read_by.includes('user'))
			.length;
	}

	// Format date
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

		return date.toLocaleDateString([], {
			month: 'short',
			day: 'numeric'
		});
	}

	// Format timestamp
	function formatTimestamp(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Refresh ticket data without showing loading state
	async function refreshTicket(slug: string) {
		try {
			const response = await fetch(`${API_BASE}/tickets/${projectId}/${slug}`);
			if (!response.ok) {
				console.warn('⚠️  [refreshTicket] Response not OK:', response.status);
				return;
			}

			const ticketData: Ticket = await response.json();

			// Update selectedTicket if we are viewing it
			if (selectedTicket && selectedTicket.slug === slug) {
				// updating selectedTicket with new data
				const oldMessageCount = selectedTicket.messages.length;
				selectedTicket = ticketData;
				// message count changed
				autoScroll();
				// Mark as read
				setTimeout(() => markMessagesAsRead(slug), 500);
			} else {
				// Not updating selectedTicket (viewing different ticket or no ticket selected)
			}

			// Update in tickets array
			untrack(() => {
				const ticketIndex = tickets.findIndex((t) => t.slug === slug);
				if (ticketIndex !== -1) {
					// updating ticket in tickets array at index: ticketIndex
					tickets[ticketIndex] = ticketData;
					tickets = [...tickets];
				} else {
					// ticket not found in tickets array
				}
				saveTicketsToStorage();
			});
		} catch (error) {
			console.error('❌ [refreshTicket] Error:', error);
		}
	}
</script>

{#if isBrowser}
	<div
		class="ticket-widget-container"
		data-theme={activeTheme}
		data-dock={dockPosition}
		style={getPositionStyles()}
	>
		{#if isOpen}
			<div class="ticket-window">
				<!-- Header -->
				<div class="ticket-header">
					<div class="header-content">
						{#if activeView === 'list'}
							<div class="header-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
									<path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
									<rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="2"/>
									<path d="M9 12H15M9 16H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								</svg>
							</div>
							<div class="header-text">
								<div class="header-title">Support Tickets</div>
								<div class="header-subtitle">
									{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
								</div>
							</div>
						{:else if activeView === 'create'}
							<button class="back-button" onclick={showListView} aria-label="Back to list">
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
									<path
										d="M12 4L6 10L12 16"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
							<div class="header-text">
								<div class="header-title">Create Ticket</div>
							</div>
						{:else if activeView === 'view' && selectedTicket}
							<button class="back-button" onclick={showListView} aria-label="Back to list">
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
									<path
										d="M12 4L6 10L12 16"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
							<div class="header-text">
								<div class="header-title">{selectedTicket.title}</div>
								<div class="header-subtitle">
									<span style="opacity: 0.8;">#{selectedTicket.slug}</span>
								</div>
							</div>
							<span class="status-badge status-{selectedTicket.status}">
								{selectedTicket.status.replace(/_/g, ' ')}
							</span>
						{/if}
					</div>
					<button class="close-button" onclick={toggleWidget} aria-label="Close tickets">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
							<path
								d="M15 5L5 15M5 5L15 15"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							/>
						</svg>
					</button>
				</div>

				<!-- Content -->
				<div class="ticket-content">
					{#if activeView === 'list'}
						<!-- Tickets List -->
						<div class="tickets-list">
							{#if errorMessage}
								<div class="error-message">{errorMessage}</div>
							{/if}
							{#if isRateLimited && rateLimitMessage}
								<div class="rate-limit-notice">
									<div class="rate-limit-icon">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
											<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
											<path d="M12 7V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
										</svg>
									</div>
									<div class="rate-limit-text">
										<strong>Rate Limit Active</strong>
										<p>{rateLimitMessage}</p>
									</div>
								</div>
							{/if}
							{#if tickets.length === 0}
								<div class="empty-state">
									<div class="empty-icon">
										<svg width="48" height="48" viewBox="0 0 24 24" fill="none">
											<path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
											<rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.5"/>
										</svg>
									</div>
									<div class="empty-title">No tickets yet</div>
									<div class="empty-text">Create your first support ticket to get started</div>
								</div>
							{:else}
								{#each tickets as ticket (ticket.slug)}
									<button class="ticket-item" onclick={() => loadTicket(ticket.slug)}>
										<div class="ticket-item-header">
											<div class="ticket-item-title">{ticket.title}</div>
											<span class="status-badge status-{ticket.status}">
												{ticket.status.replace(/_/g, ' ')}
											</span>
										</div>
										<div class="ticket-item-meta">
											<span class="ticket-item-slug">#{ticket.slug}</span>
											<span class="ticket-item-date">{formatDate(ticket.created_at)}</span>
											{#if getUnreadCount(ticket) > 0}
												<span class="unread-badge">{getUnreadCount(ticket)}</span>
											{/if}
										</div>
										<div class="ticket-item-description">
											{ticket.description.substring(0, 100)}{ticket.description.length > 100
												? '...'
												: ''}
										</div>
									</button>
								{/each}
							{/if}
						</div>

						<!-- Create Button -->
						<div class="action-bar">
							<button class="create-ticket-button" onclick={showCreateView}>
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
									<path
										d="M10 4V16M4 10H16"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
									/>
								</svg>
								Create New Ticket
							</button>
						</div>
					{:else if activeView === 'create'}
						<!-- Create Ticket Form -->
						<div class="create-form">
							{#if successMessage}
								<div class="success-message">{successMessage}</div>
							{/if}
							{#if errorMessage}
								<div class="error-message">{errorMessage}</div>
							{/if}
							{#if isRateLimited && rateLimitMessage}
								<div class="rate-limit-notice">
									<div class="rate-limit-icon">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
											<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
											<path d="M12 7V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
										</svg>
									</div>
									<div class="rate-limit-text">
										<strong>Rate Limit Active</strong>
										<p>{rateLimitMessage}</p>
										{#if rateLimitCooldown > 0}
											<p class="rate-limit-cooldown">Cooldown: {formatCooldownTime()}</p>
										{/if}
									</div>
								</div>
							{/if}

							<div class="form-group">
								<label for="ticket-title">Title</label>
								<input
									id="ticket-title"
									type="text"
									class="form-input"
									bind:value={newTicketTitle}
									placeholder="Brief description of your issue"
									disabled={isLoading || isRateLimited}
								/>
							</div>

							<div class="form-group">
								<label for="ticket-description">Description</label>
								<textarea
									id="ticket-description"
									class="form-textarea"
									bind:value={newTicketDescription}
									placeholder="Provide detailed information about your issue..."
									rows="8"
									disabled={isLoading || isRateLimited}
								></textarea>
							</div>

							<button
								class="submit-button"
								onclick={createTicket}
								disabled={!newTicketTitle.trim() ||
									!newTicketDescription.trim() ||
									isLoading ||
									isRateLimited}
							>
								{isLoading ? 'Creating...' : isRateLimited ? 'Rate Limited' : 'Create Ticket'}
							</button>
						</div>
					{:else if activeView === 'view' && selectedTicket}
						<!-- Ticket View -->
						<div class="ticket-view">
							<!-- Messages -->
							<div class="messages-section">
								<div class="messages-container" bind:this={messagesContainer}>
									<!-- Initial ticket description as first message -->
									<div
										class="message"
										style="align-self: flex-end; align-items: flex-end;"
									>
										<div
											class="message-content"
											style="background: var(--user-msg-bg); color: var(--user-msg-text); border-bottom-right-radius: 4px;"
										>
											{selectedTicket.description}
										</div>
										<div class="message-time">
											{formatTimestamp(selectedTicket.created_at)}
											<span class="message-author">You</span>
										</div>
									</div>
									
									<!-- Subsequent messages -->
									{#each selectedTicket.messages as message (message.id)}
										<div
											class="message"
											style="align-self: {message.author === 'user'
												? 'flex-end'
												: 'flex-start'}; align-items: {message.author === 'user'
												? 'flex-end'
												: 'flex-start'};"
										>
											<div
												class="message-content"
												style="background: {message.author === 'user'
													? 'var(--user-msg-bg)'
													: 'var(--admin-msg-bg)'}; color: {message.author === 'user'
													? 'var(--user-msg-text)'
													: 'var(--admin-msg-text)'}; border-bottom-{message.author === 'user'
													? 'right'
													: 'left'}-radius: 4px;"
											>
												{message.content}
											</div>
											<div class="message-time">
												{formatTimestamp(message.timestamp)}
												{#if message.author === 'user'}
													<span class="message-author">You</span>
												{:else}
													<span class="message-author">Support</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>

							<!-- Message Input -->
							{#if selectedTicket.status !== 'closed'}
								<div class="message-input-container">
									{#if errorMessage}
										<div class="error-message-inline">{errorMessage}</div>
									{/if}
									{#if isRateLimited && rateLimitMessage}
										<div class="rate-limit-notice-inline">
											<span class="rate-limit-icon-small">
												<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
													<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
													<path d="M12 7V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
												</svg>
											</span>
											<span>{rateLimitMessage}</span>
											{#if rateLimitCooldown > 0}
												<span class="rate-limit-cooldown-small">({formatCooldownTime()})</span>
											{/if}
										</div>
									{/if}
									<div class="input-wrapper">
										<textarea
											class="message-input"
											bind:value={messageInput}
											onkeydown={handleKeyPress}
											placeholder="Type your message..."
											rows="2"
											disabled={isLoading || isRateLimited}
										></textarea>
										<button
											class="send-button"
											onclick={sendMessage}
											disabled={!messageInput.trim() || isLoading || isRateLimited}
											aria-label="Send message"
											title={isRateLimited ? 'Rate limited' : 'Send message'}
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
							{:else}
								<div class="ticket-closed-notice">
									This ticket is closed. No new messages can be added.
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Floating Button -->
		<button class="ticket-toggle-button" onclick={toggleWidget} aria-label="Toggle tickets">
			{#if isOpen}
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
					<path
						d="M19 9L12 16L5 9"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{:else}
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
					<path
						d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M9 12H15M9 16H13"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{/if}
			{#if tickets.some((t) => getUnreadCount(t) > 0)}
				<span class="notification-dot"></span>
			{/if}
		</button>
	</div>
{/if}

<style>
	.ticket-widget-container {
		position: fixed;
		z-index: 9999;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	/* Theme Variables */
	.ticket-widget-container[data-theme='light'] {
		--bg-primary: #ffffff;
		--bg-secondary: #f9fafb;
		--bg-hover: #f3f4f6;
		--text-primary: #111827;
		--text-secondary: #6b7280;
		--border-color: #e5e7eb;
		--accent-color: var(--custom-accent, #3b82f6);
		--user-msg-bg: var(--custom-accent, #3b82f6);
		--user-msg-text: #ffffff;
		--admin-msg-bg: #e5e7eb;
		--admin-msg-text: #111827;
		--shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
		--success-bg: #d1fae5;
		--success-text: #065f46;
		--error-bg: #fee2e2;
		--error-text: #991b1b;
	}

	.ticket-widget-container[data-theme='dark'] {
		--bg-primary: #1e1e1e;
		--bg-secondary: #2d2d2d;
		--bg-hover: #3a3a3a;
		--text-primary: #eaeaea;
		--text-secondary: #9ca3af;
		--border-color: #404040;
		--accent-color: var(--custom-accent, #3b82f6);
		--user-msg-bg: var(--custom-accent, #3b82f6);
		--user-msg-text: #ffffff;
		--admin-msg-bg: #404040;
		--admin-msg-text: #eaeaea;
		--shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
		--success-bg: #064e3b;
		--success-text: #d1fae5;
		--error-bg: #7f1d1d;
		--error-text: #fecaca;
	}

	.ticket-widget-container[data-theme='material'] {
		--bg-primary: #ffffff;
		--bg-secondary: #fafafa;
		--bg-hover: #f5f5f5;
		--text-primary: #212121;
		--text-secondary: #757575;
		--border-color: #e0e0e0;
		--accent-color: var(--custom-accent, #1976d2);
		--user-msg-bg: var(--custom-accent, #1976d2);
		--user-msg-text: #ffffff;
		--admin-msg-bg: #eeeeee;
		--admin-msg-text: #212121;
		--shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
		--success-bg: #c8e6c9;
		--success-text: #1b5e20;
		--error-bg: #ffcdd2;
		--error-text: #b71c1c;
	}

	.ticket-widget-container[data-theme='nord'] {
		--bg-primary: #2e3440;
		--bg-secondary: #3b4252;
		--bg-hover: #434c5e;
		--text-primary: #eceff4;
		--text-secondary: #d8dee9;
		--border-color: #4c566a;
		--accent-color: #88c0d0;
		--user-msg-bg: #88c0d0;
		--user-msg-text: #2e3440;
		--admin-msg-bg: #434c5e;
		--admin-msg-text: #eceff4;
		--shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
		--success-bg: #a3be8c;
		--success-text: #2e3440;
		--error-bg: #bf616a;
		--error-text: #eceff4;
	}

	.ticket-widget-container[data-theme='fleety'] {
		--bg-primary: #232627;
		--bg-secondary: #2d3133;
		--bg-hover: #363a3c;
		--text-primary: #ffffff;
		--text-secondary: #b8babb;
		--border-color: #3d4245;
		--accent-color: #f1be00;
		--user-msg-bg: #f1be00;
		--user-msg-text: #232627;
		--admin-msg-bg: #454a4d;
		--admin-msg-text: #ffffff;
		--shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
		--success-bg: #4a5a3e;
		--success-text: #a8d08d;
		--error-bg: #5a3e3e;
		--error-text: #f5a9a9;
	}

	/* Fleety theme: Black text on yellow backgrounds for better contrast */
	.ticket-widget-container[data-theme='fleety'] .ticket-header {
		color: #232627;
	}

	.ticket-widget-container[data-theme='fleety'] .close-button {
		color: #232627;
	}

	.ticket-widget-container[data-theme='fleety'] .back-button {
		color: #232627;
	}

	/* Ticket Window */
	.ticket-window {
		position: absolute;
		bottom: 80px;
		right: 0;
		width: 420px;
		max-width: calc(100vw - 40px);
		height: 650px;
		max-height: calc(100vh - 120px);
		background: var(--bg-primary);
		border-radius: 12px;
		box-shadow: var(--shadow);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: slideUp 0.3s ease-out;
	}

	/* Position based on dock */
	.ticket-widget-container[data-dock='bottom-right'] .ticket-window {
		bottom: 80px;
		right: 0;
		left: auto;
		top: auto;
	}

	.ticket-widget-container[data-dock='bottom-left'] .ticket-window {
		bottom: 80px;
		left: 0;
		right: auto;
		top: auto;
	}

	.ticket-widget-container[data-dock='top-right'] .ticket-window {
		top: 80px;
		right: 0;
		bottom: auto;
		left: auto;
	}

	.ticket-widget-container[data-dock='top-left'] .ticket-window {
		top: 80px;
		left: 0;
		bottom: auto;
		right: auto;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Header */
	.ticket-header {
		background: var(--accent-color);
		color: white;
		padding: 16px 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}

	.header-icon {
		font-size: 24px;
		flex-shrink: 0;
	}

	.back-button {
		background: transparent;
		border: none;
		color: white;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background 0.2s;
		flex-shrink: 0;
	}

	.back-button:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.header-text {
		flex: 1;
		min-width: 0;
	}

	.header-title {
		font-weight: 600;
		font-size: 16px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-subtitle {
		font-size: 13px;
		opacity: 0.9;
		margin-top: 2px;
	}

	.close-button {
		background: transparent;
		border: none;
		color: white;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background 0.2s;
		flex-shrink: 0;
	}

	.close-button:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	/* Content */
	.ticket-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	/* Tickets List */
	.tickets-list {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--bg-secondary);
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		text-align: center;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.empty-text {
		font-size: 14px;
		color: var(--text-secondary);
		max-width: 300px;
	}

	.ticket-item {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 14px;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ticket-item:hover {
		background: var(--bg-hover);
		border-color: var(--accent-color);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}

	.ticket-item-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}

	.ticket-item-title {
		font-weight: 600;
		font-size: 15px;
		color: var(--text-primary);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status-badge {
		display: inline-block;
		padding: 3px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	/* Status badge in header needs margin */
	.ticket-header .status-badge {
		margin-left: 12px;
	}

	.status-badge.status-open {
		background: #10b981;
		color: white;
	}

	.status-badge.status-in_progress {
		background: #3b82f6;
		color: white;
	}

	.status-badge.status-resolved {
		background: #8b5cf6;
		color: white;
	}

	.status-badge.status-closed {
		background: var(--text-secondary);
		color: white;
	}

	.ticket-item-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-secondary);
	}

	.ticket-item-slug {
		font-weight: 500;
	}

	.ticket-item-date {
		flex: 1;
	}

	.unread-badge {
		background: #ef4444;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 600;
	}

	.ticket-item-description {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	/* Action Bar */
	.action-bar {
		padding: 16px;
		background: var(--bg-primary);
		border-top: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.create-ticket-button {
		width: 100%;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		padding: 12px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition:
			opacity 0.2s,
			transform 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.ticket-widget-container[data-theme='fleety'] .create-ticket-button {
		color: #232627;
	}

	.create-ticket-button:hover {
		opacity: 0.9;
		transform: scale(1.02);
	}

	.create-ticket-button:active {
		transform: scale(0.98);
	}

	/* Create Form */
	.create-form {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		background: var(--bg-secondary);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-group label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.form-input,
	.form-textarea {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 14px;
		font-family: inherit;
		color: var(--text-primary);
		transition: border-color 0.2s;
	}

	.form-input:focus,
	.form-textarea:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.form-input::placeholder,
	.form-textarea::placeholder {
		color: var(--text-secondary);
	}

	.form-input:disabled,
	.form-textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.form-textarea {
		resize: vertical;
		min-height: 120px;
	}

	.submit-button {
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		padding: 12px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition:
			opacity 0.2s,
			transform 0.1s;
		margin-top: auto;
	}

	.ticket-widget-container[data-theme='fleety'] .submit-button {
		color: #232627;
	}

	.submit-button:hover:not(:disabled) {
		opacity: 0.9;
		transform: scale(1.02);
	}

	.submit-button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.submit-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Ticket View */
	.ticket-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.ticket-details {
		padding: 16px 20px;
		background: var(--bg-primary);
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.ticket-title-section {
		margin-bottom: 12px;
	}

	.ticket-title-section h3 {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 6px 0;
	}

	.ticket-meta {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.ticket-description-section {
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
	}

	.description-content {
		font-size: 14px;
		color: var(--text-primary);
		line-height: 1.5;
	}

	/* Messages Section */
	.messages-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-secondary);
	}

	.messages-header {
		padding: 12px 20px;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	.messages-count {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.message {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 80%;
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

	.message-content {
		padding: 10px 14px;
		border-radius: 12px;
		font-size: 14px;
		line-height: 1.5;
		word-wrap: break-word;
		white-space: pre-wrap;
	}

	.message-time {
		font-size: 11px;
		color: var(--text-secondary);
		padding: 0 4px;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.message-author {
		font-weight: 600;
	}

	/* Message Input */
	.message-input-container {
		padding: 16px 20px;
		background: var(--bg-primary);
		border-top: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.error-message-inline {
		background: var(--error-bg);
		color: var(--error-text);
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
		margin-bottom: 12px;
	}

	.input-wrapper {
		display: flex;
		gap: 12px;
		align-items: flex-end;
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
		resize: none;
		max-height: 100px;
		transition: border-color 0.2s;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.message-input::placeholder {
		color: var(--text-secondary);
	}

	.message-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

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

	.ticket-widget-container[data-theme='fleety'] .send-button {
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

	.ticket-closed-notice {
		padding: 16px;
		text-align: center;
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: 13px;
		border-top: 1px solid var(--border-color);
	}

	/* Messages */
	.success-message {
		background: var(--success-bg);
		color: var(--success-text);
		padding: 12px;
		border-radius: 8px;
		font-size: 14px;
		text-align: center;
		font-weight: 500;
	}

	.error-message {
		background: var(--error-bg);
		color: var(--error-text);
		padding: 12px;
		border-radius: 8px;
		font-size: 14px;
		text-align: center;
		font-weight: 500;
	}

	/* Rate Limit Notices */
	.rate-limit-notice {
		background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%);
		border: 1px solid #ffc107;
		color: #856404;
		padding: 16px;
		border-radius: 8px;
		margin-bottom: 16px;
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.ticket-widget-container[data-theme='dark'] .rate-limit-notice,
	.ticket-widget-container[data-theme='nord'] .rate-limit-notice,
	.ticket-widget-container[data-theme='fleety'] .rate-limit-notice {
		background: linear-gradient(135deg, #4a3f1a 0%, #5a4f2a 100%);
		border-color: #9e7e00;
		color: #ffd54f;
	}

	.rate-limit-icon {
		font-size: 24px;
		flex-shrink: 0;
	}

	.rate-limit-text {
		flex: 1;
	}

	.rate-limit-text strong {
		display: block;
		margin-bottom: 4px;
		font-size: 14px;
	}

	.rate-limit-text p {
		margin: 4px 0;
		font-size: 13px;
		opacity: 0.9;
	}

	.rate-limit-cooldown {
		font-weight: 600;
		margin-top: 8px !important;
	}

	.rate-limit-notice-inline {
		background: #fff8e1;
		border: 1px solid #ffc107;
		color: #856404;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.ticket-widget-container[data-theme='dark'] .rate-limit-notice-inline,
	.ticket-widget-container[data-theme='nord'] .rate-limit-notice-inline,
	.ticket-widget-container[data-theme='fleety'] .rate-limit-notice-inline {
		background: #4a3f1a;
		border-color: #9e7e00;
		color: #ffd54f;
	}

	.rate-limit-icon-small {
		font-size: 16px;
	}

	.rate-limit-cooldown-small {
		font-weight: 600;
		margin-left: auto;
	}

	/* Toggle Button */
	.ticket-toggle-button {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: var(--accent-color);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition:
			transform 0.2s,
			box-shadow 0.2s;
		position: relative;
	}

	.ticket-widget-container[data-theme='fleety'] .ticket-toggle-button {
		color: #232627;
	}

	.ticket-toggle-button:hover {
		transform: scale(1.05);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	.ticket-toggle-button:active {
		transform: scale(0.95);
	}

	.notification-dot {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 12px;
		height: 12px;
		background: #ef4444;
		border: 2px solid white;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.1);
		}
	}

	/* Scrollbar Styling */
	.tickets-list::-webkit-scrollbar,
	.messages-container::-webkit-scrollbar,
	.create-form::-webkit-scrollbar {
		width: 6px;
	}

	.tickets-list::-webkit-scrollbar-track,
	.messages-container::-webkit-scrollbar-track,
	.create-form::-webkit-scrollbar-track {
		background: transparent;
	}

	.tickets-list::-webkit-scrollbar-thumb,
	.messages-container::-webkit-scrollbar-thumb,
	.create-form::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 3px;
	}

	.tickets-list::-webkit-scrollbar-thumb:hover,
	.messages-container::-webkit-scrollbar-thumb:hover,
	.create-form::-webkit-scrollbar-thumb:hover {
		background: var(--text-secondary);
	}

	/* Mobile Responsiveness */
	@media (max-width: 480px) {
		.ticket-window {
			width: calc(100vw - 40px);
			height: calc(100vh - 140px);
		}

		.ticket-toggle-button {
			width: 56px;
			height: 56px;
		}
	}
</style>
