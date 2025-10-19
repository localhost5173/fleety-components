<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';

	// Component props
	let {
		projectId,
		theme = 'fleety',
		dockPosition = 'bottom-left',
		onOpen = $bindable()
	}: {
		projectId: string;
		theme?: 'fleety' | 'material' | 'midnight';
		dockPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
			onOpen?: (options?: { view?: 'list' | 'create' | 'view'; prefillDescription?: string; prefillTitle?: string }) => void;
	} = $props();

	// API Configuration
	const API_URL = "https://api.fleety.dev/v1";

	// === WebSocket Types and Service (Inlined) ===
	type WSMessageType = 
		| 'new_message' 
		| 'status_change' 
		| 'ticket_update' 
		| 'error' 
		| 'subscribed';

	interface WSMessage {
		type: WSMessageType;
		payload: any;
	}

	type TicketWSCallback = (message: WSMessage) => void;

	// WebSocket Service for managing ticket connections
	class TicketWebSocketService {
		private connections: Map<string, WebSocket> = new Map();
		private callbacks: Map<string, Set<TicketWSCallback>> = new Map();
		private reconnectAttempts: Map<string, number> = new Map();
		private maxReconnectAttempts = 5;
		private reconnectDelay = 1000; // Start with 1 second
		private connecting: Map<string, Promise<WebSocket>> = new Map();

		/**
		 * Connect to a ticket's WebSocket for real-time updates
		 */
		connect(projectId: string, ticketSlug: string, callback: TicketWSCallback): () => void {
			const key = `${projectId}/${ticketSlug}`;
			
			// Ensure a callback set exists
			if (!this.callbacks.has(key)) {
				this.callbacks.set(key, new Set());
			}
			this.callbacks.get(key)!.add(callback);

			// If already connected, we're done
			if (this.connections.has(key)) {
				return () => this.removeCallback(key, callback);
			}

			// If connecting, wait for the existing connection promise
			if (this.connecting.has(key)) {
				return () => this.removeCallback(key, callback);
			}

			// Start a new connection
			const connectionPromise = new Promise<WebSocket>((resolve, reject) => {
				const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
				const backendUrl = "https://api.fleety.dev";
				const wsUrl = `${protocol}//${backendUrl.replace(/^https?:\/\//, '')}/v1/tickets/${projectId}/${ticketSlug}/ws`;
				const ws = new WebSocket(wsUrl);

				ws.onopen = () => {
					console.log(`WebSocket connected for ticket: ${ticketSlug}`);
					this.connections.set(key, ws);
					this.reconnectAttempts.set(key, 0);
					this.connecting.delete(key);
					resolve(ws);
				};

				ws.onmessage = (event) => {
					try {
						const message: WSMessage = JSON.parse(event.data);
						this.notifyCallbacks(key, message);
					} catch (error) {
						console.error('Error parsing WebSocket message:', error);
					}
				};

				ws.onerror = (error) => {
					console.error(`WebSocket error for ticket ${ticketSlug}:`, error);
					this.connecting.delete(key);
					reject(error);
				};

				ws.onclose = () => {
					console.log(`WebSocket closed for ticket: ${ticketSlug}`);
					this.connections.delete(key);
					this.connecting.delete(key);
					this.attemptReconnect(projectId, ticketSlug);
				};
			});

			this.connecting.set(key, connectionPromise);

			// Return unsubscribe function
			return () => this.removeCallback(key, callback);
		}

		/**
		 * Disconnect from a ticket's WebSocket
		 */
		disconnect(projectId: string, ticketSlug: string) {
			const key = `${projectId}/${ticketSlug}`;
			const ws = this.connections.get(key);
			if (ws) {
				// Prevent reconnection attempts when explicitly disconnecting
				this.reconnectAttempts.delete(key);
				ws.close();
				this.connections.delete(key);
				this.callbacks.delete(key);
			}
		}

		/**
		 * Disconnect all WebSocket connections
		 */
		disconnectAll() {
			this.connections.forEach((ws) => ws.close());
			this.connections.clear();
			this.callbacks.clear();
			this.reconnectAttempts.clear();
			this.connecting.clear();
		}

		/**
		 * Send a message through the WebSocket
		 */
		send(projectId: string, ticketSlug: string, message: any) {
			const key = `${projectId}/${ticketSlug}`;
			const ws = this.connections.get(key);
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(message));
			}
		}

		private removeCallback(key: string, callback: TicketWSCallback) {
			const callbacks = this.callbacks.get(key);
			if (callbacks) {
				callbacks.delete(callback);
				// If no more callbacks are listening, close the connection
				if (callbacks.size === 0) {
					const ws = this.connections.get(key);
					if (ws) {
						this.reconnectAttempts.delete(key);
						ws.close();
						this.connections.delete(key);
						this.callbacks.delete(key);
					}
				}
			}
		}

		private notifyCallbacks(key: string, message: WSMessage) {
			const callbacks = this.callbacks.get(key);
			if (callbacks) {
				callbacks.forEach(callback => callback(message));
			}
		}

		private attemptReconnect(projectId: string, ticketSlug: string) {
			const key = `${projectId}/${ticketSlug}`;
			const attempts = this.reconnectAttempts.get(key) || 0;
			
			if (attempts >= this.maxReconnectAttempts) {
				console.log(`Max reconnection attempts reached for ticket: ${ticketSlug}`);
				this.reconnectAttempts.delete(key);
				return;
			}

			const callbacks = this.callbacks.get(key);
			if (!callbacks || callbacks.size === 0) {
				// No one is listening anymore, don't reconnect
				this.reconnectAttempts.delete(key);
				return;
			}

			const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
			console.log(`Reconnecting to ticket ${ticketSlug} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);

			setTimeout(() => {
				this.reconnectAttempts.set(key, attempts + 1);
				
				// Re-establish connection with existing callbacks
				const existingCallbacks = Array.from(callbacks);
				this.callbacks.delete(key);
				
				existingCallbacks.forEach(callback => {
					this.connect(projectId, ticketSlug, callback);
				});
			}, delay);
		}
	}

	// Create singleton instance for this component
	const ticketWS = new TicketWebSocketService();

	interface Ticket {
		id: string;
		slug: string;
		title: string;
		description: string;
		status: 'open' | 'in_progress' | 'resolved' | 'closed';
		created_at: string;
		updated_at: string;
		created_by_ai: boolean;
		messages: TicketMessage[];
	}

	interface TicketMessage {
		id: string;
		author: 'user' | 'admin' | 'system';
		content: string;
		timestamp: string;
		read_by: ('user' | 'admin')[]; // Array of who has read this message
		type?: 'message' | 'status_change';
		metadata?: {
			old_status?: string;
			new_status?: string;
		};
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
			// Handle rate limiting
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				const retryMessage = retryAfter 
					? `Please wait ${retryAfter} seconds before creating another ticket.`
					: 'Please wait before creating another ticket.';
				throw new Error(`rate_limit:${result.message || 'You\'re creating tickets too fast.'} ${retryMessage}`);
			}
			// Handle insufficient credits
			if (response.status === 402) {
				throw new Error(`credits_depleted:${result.message || 'This project has run out of credits. AI features are disabled.'}`);
			}
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

		const response = await fetch(`${API_URL}/tickets/${projectId}/${slug}`, { headers });

		const result = await response.json();

		if (!response.ok) {
			// Handle rate limiting
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				const retryMessage = retryAfter 
					? `Please wait ${retryAfter} seconds before trying again.`
					: 'Please wait before trying again.';
				throw new Error(`rate_limit:${result.message || 'You\'re sending requests too fast.'} ${retryMessage}`);
			}
			// Handle insufficient credits
			if (response.status === 402) {
				throw new Error(`credits_depleted:${result.message || 'This project has run out of credits. AI features are disabled.'}`);
			}
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

		const response = await fetch(`${API_URL}/tickets/${projectId}/${slug}/messages`, {
			method: 'POST',
			headers,
			body: JSON.stringify(data)
		});

		const result = await response.json();

		if (!response.ok) {
			// Handle rate limiting
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				const retryMessage = retryAfter 
					? `Please wait ${retryAfter} seconds before sending another message.`
					: 'Please wait before sending another message.';
				throw new Error(`rate_limit:${result.message || 'You\'re sending messages too fast.'} ${retryMessage}`);
			}
			// Handle insufficient credits
			if (response.status === 402) {
				throw new Error(`credits_depleted:${result.message || 'This project has run out of credits. AI features are disabled.'}`);
			}
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
	 * Mark all messages in a ticket as read by a specific reader (user or admin)
	 */
	async function markMessagesAsRead(slug: string, reader: 'user' | 'admin'): Promise<void> {
		const response = await fetch(`${API_URL}/tickets/${projectId}/${slug}/messages/read`, {
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

	// UI State
	let isOpen = $state(false);
	let currentView = $state<'list' | 'create' | 'view'>('create');
	
	// Ticket Creation
	let title = $state('');
	let description = $state('');
	let isCreating = $state(false);
	let createError = $state('');

	// Ticket Viewing
	let currentTicket = $state<Ticket | null>(null);
	let ticketSlug = $state('');
	let messageContent = $state('');
	let isSendingMessage = $state(false);
	let messageError = $state('');
	let isLoadingTicket = $state(false);
	let ticketError = $state('');

	// Saved tickets (stored in localStorage)
	let savedTickets = $state<Array<{ slug: string; title: string; status: string; unreadCount?: number }>>([]);

	// Calculate total unread messages across all tickets
	let totalUnreadCount = $derived(savedTickets.reduce((sum, ticket) => sum + (ticket.unreadCount || 0), 0));

	// Chat dimensions
	let chatWidth = $state(380);
	let chatHeight = $state(550);
	let minWidth = 320;
	let maxWidth = 500;
	let minHeight = 450;
	let maxHeight = 700;

	// WebSocket
	let wsUnsubscribe = $state<(() => void) | null>(null);
	let wsUnsubscribes = $state(new Map<string, () => void>()); // Track all active WS connections

	// Auto-scroll
	let messagesEndRef = $state<HTMLDivElement>();

	// No theme configuration needed - using CSS classes
	
	// Responsive positioning - account for sidebar on desktop
	let isMobile = $state(false);

	onMount(() => {
		// Check mobile on mount
		const checkMobile = () => {
			isMobile = window.innerWidth < 768;
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		
		// Continue with existing onMount logic
		loadSavedTickets();
		// Connect WebSocket for all saved tickets on mount
		connectAllTicketWebSockets();
		
		// Listen for ticket creation events from SupportChat
		const handleTicketCreated = (event: CustomEvent<{ ticketSlug: string }>) => {
			console.log('🎫 SupportTicketWidget received ticket-created event:', event.detail.ticketSlug);
			
			// Open the widget
			isOpen = true;
			
			// Load the ticket
			handleLoadTicket(event.detail.ticketSlug);
		};
		
		window.addEventListener('ticket-created', handleTicketCreated as EventListener);
		
		// Cleanup listeners on component destroy
		return () => {
			window.removeEventListener('ticket-created', handleTicketCreated as EventListener);
			window.removeEventListener('resize', checkMobile);
		};
	});

	onDestroy(() => {
		if (wsUnsubscribe) {
			wsUnsubscribe();
		}
		// Disconnect all background WebSocket connections
		disconnectAllTicketWebSockets();
	});

	function loadSavedTickets() {
		const saved = localStorage.getItem('supportTickets');
		if (saved) {
			savedTickets = JSON.parse(saved);
		}
	}

	// Connect WebSocket for all saved tickets to receive updates in background
	function connectAllTicketWebSockets() {
		savedTickets.forEach(ticket => {
			if (!wsUnsubscribes.has(ticket.slug)) {
				const unsubscribe = ticketWS.connect(projectId, ticket.slug, (message) => handleBackgroundWebSocketMessage(ticket.slug, message));
				wsUnsubscribes.set(ticket.slug, unsubscribe);
			}
		});
	}

	// Disconnect all background WebSocket connections
	function disconnectAllTicketWebSockets() {
		wsUnsubscribes.forEach((unsubscribe) => unsubscribe());
		wsUnsubscribes.clear();
	}

	// Handle WebSocket messages for background tickets (not currently viewing)
	async function handleBackgroundWebSocketMessage(ticketSlug: string, message: WSMessage) {
		// If this is the currently open ticket AND the widget is open, let the main handler deal with it
		if (isOpen && currentTicket && currentTicket.slug === ticketSlug && currentView === 'view') {
			return;
		}

		// Update the ticket in the saved list based on the WebSocket message
		switch (message.type) {
			case 'ticket_update':
			case 'new_message':
			case 'status_change':
				try {
					const updated = await getTicket(ticketSlug);
					const unreadCount = updated.messages.filter(msg => 
						msg.author === 'admin' && !msg.read_by?.includes('user')
					).length;
					
					// Update the ticket in the list
					savedTickets = savedTickets.map(t => 
						t.slug === ticketSlug 
							? { ...t, status: updated.status, unreadCount } 
							: t
					);
					localStorage.setItem('supportTickets', JSON.stringify(savedTickets));
				} catch (err) {
					console.error('Error refreshing background ticket:', err);
				}
				break;
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

		// Ensure WebSocket connection for this ticket (for background updates)
		if (!wsUnsubscribes.has(ticket.slug)) {
			const unsubscribe = ticketWS.connect(projectId, ticket.slug, (message) => handleBackgroundWebSocketMessage(ticket.slug, message));
			wsUnsubscribes.set(ticket.slug, unsubscribe);
		}
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
				project_id: projectId,
				title: title.trim(),
				description: description.trim()
			});

			saveTicketToList(ticket);
			currentTicket = ticket;
			currentView = 'view';
			title = '';
			description = '';
			// Connect to WebSocket for real-time updates
			wsUnsubscribe = ticketWS.connect(projectId, ticket.slug, handleWebSocketMessage);
		} catch (error: any) {
			// Display user-friendly rate limit message
			const errorMsg = error.message || 'Failed to create ticket';
			createError = errorMsg.includes('rate_limit:') 
				? '⏰ ' + errorMsg.replace('rate_limit:', '')
				: errorMsg.includes('credits_depleted:')
				? '💳 ' + errorMsg.replace('credits_depleted:', '')
				: errorMsg;
		} finally {
			isCreating = false;
		}
	}

	async function handleLoadTicket(slug: string) {
		if (!slug.trim()) return;
		
		// Unsubscribe from previous ticket
		if (wsUnsubscribe) {
			wsUnsubscribe();
			wsUnsubscribe = null;
		}

		isLoadingTicket = true;
		ticketError = '';

		try {
			const ticket = await getTicket(slug.trim());
			currentTicket = ticket;
			currentView = 'view';
			
			// Save ticket to localStorage (if new, it will be added to the list)
			saveTicketToList(ticket);
			
			// Mark all admin messages as read by user
			try {
				await markMessagesAsRead(slug.trim(), 'user');
				// Refresh to get updated read_by status
				const refreshed = await getTicket(slug.trim());
				currentTicket = refreshed;
				// Update saved tickets with zero unread count
				savedTickets = savedTickets.map(t => 
					t.slug === slug.trim() ? { ...t, unreadCount: 0, status: refreshed.status } : t
				);
				localStorage.setItem('supportTickets', JSON.stringify(savedTickets));
			} catch (readErr) {
				console.error('Error marking messages as read:', readErr);
			}
			
			// Subscribe to WebSocket updates for the active ticket
			wsUnsubscribe = ticketWS.connect(projectId, slug.trim(), handleWebSocketMessage);
			
			// Scroll to bottom after loading
			scrollToBottom();
		} catch (error: any) {
			// Display user-friendly rate limit message
			const errorMsg = error.message || 'Failed to load ticket';
			ticketError = errorMsg.includes('rate_limit:') 
				? '⏰ ' + errorMsg.replace('rate_limit:', '')
				: errorMsg.includes('credits_depleted:')
				? '💳 ' + errorMsg.replace('credits_depleted:', '')
				: errorMsg;
		} finally {
			isLoadingTicket = false;
		}
	}

	function handleWebSocketMessage(message: WSMessage) {
		if (!currentTicket) return;

		console.log('WebSocket message received:', message);

		switch (message.type) {
			case 'ticket_update':
				// Full ticket update
				currentTicket = message.payload as Ticket;
				saveTicketToList(currentTicket);
				scrollToBottom();
				// Mark as read since we're viewing the ticket
				markMessagesAsRead(currentTicket.slug, 'user').catch(err => 
					console.error('Error marking messages as read:', err)
				);
				break;
			
			case 'new_message':
				// New message added - refresh ticket
				refreshCurrentTicket();
				break;
			
			case 'status_change':
				// Status changed - refresh ticket
				refreshCurrentTicket();
				break;
		}
	}

	async function refreshCurrentTicket() {
		if (!currentTicket) return;
		
		try {
			const updated = await getTicket(currentTicket.slug);
			currentTicket = updated;
			saveTicketToList(updated);
			scrollToBottom();
			// Mark as read since we're viewing the ticket
			await markMessagesAsRead(currentTicket.slug, 'user');
			// Update unread count to 0 in saved tickets
			savedTickets = savedTickets.map(t => 
				t.slug === currentTicket!.slug ? { ...t, unreadCount: 0 } : t
			);
			localStorage.setItem('supportTickets', JSON.stringify(savedTickets));
		} catch (err) {
			console.error('Error refreshing ticket:', err);
		}
	}

	async function handleSendMessage() {
		if (!messageContent.trim() || !currentTicket) return;

		isSendingMessage = true;
		messageError = '';

		// Store the message content before clearing
		const userMessage = messageContent.trim();
		
		// Optimistically add message to UI immediately
		const optimisticMessage: TicketMessage = {
			id: `temp-${Date.now()}`,
			author: 'user',
			content: userMessage,
			timestamp: new Date().toISOString(),
			read_by: ['user']
		};
		
		currentTicket.messages = [...currentTicket.messages, optimisticMessage];
		messageContent = '';
		scrollToBottom();

		try {
			await addMessage(currentTicket.slug, {
				author: 'user',
				content: userMessage
			});

			// WebSocket will replace the optimistic message with the real one
			// Scroll to bottom after sending
			scrollToBottom();
		} catch (error: any) {
			// Remove optimistic message on error
			currentTicket.messages = currentTicket.messages.filter(m => m.id !== optimisticMessage.id);
			// Restore message content so user can try again
			messageContent = userMessage;
			
			// Display user-friendly rate limit message
			const errorMsg = error.message || 'Failed to send message';
			messageError = errorMsg.includes('rate_limit:') 
				? '⏰ ' + errorMsg.replace('rate_limit:', '')
				: errorMsg.includes('credits_depleted:')
				? '💳 ' + errorMsg.replace('credits_depleted:', '')
				: errorMsg;
		} finally {
			isSendingMessage = false;
		}
	}

	function handleClose() {
		isOpen = false;
		// Disconnect only the active ticket's WebSocket (the one being viewed)
		if (wsUnsubscribe) {
			wsUnsubscribe();
			wsUnsubscribe = null;
		}
		// Keep background WebSocket connections active for notifications
	}


	function handleOpen(options?: { view?: 'list' | 'create' | 'view'; prefillDescription?: string; prefillTitle?: string }) {
	   isOpen = true;
	   // Set the view if specified
	   if (options?.view) {
		   currentView = options.view;
	   }
	   // Prefill description if specified
	   if (options?.prefillDescription) {
		   description = options.prefillDescription;
	   }
	   // Prefill title if specified
	   if (options?.prefillTitle) {
		   title = options.prefillTitle;
	   }
	   // Refresh unread counts when widget opens
	   refreshUnreadCounts();
	   if (currentView === 'view' && currentTicket && !wsUnsubscribe) {
		   // Reconnect WebSocket if needed
		   wsUnsubscribe = ticketWS.connect(projectId, currentTicket.slug, handleWebSocketMessage);
	   }
	}

	// Expose handleOpen via bindable
	onOpen = handleOpen;

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
		// Disconnect WebSocket when leaving ticket view
		if (wsUnsubscribe) {
			wsUnsubscribe();
			wsUnsubscribe = null;
		}
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

	// Helper function to check if a message is from an admin
	// Returns true if author is "admin" or any other value that's not "user" or "system"
	function isAdminMessage(author: string): boolean {
		return author !== 'user' && author !== 'system';
	}

	// Helper function to get display name for a message author in the user widget
	function getAuthorDisplayName(author: string): string {
		if (author === 'user') return 'You';
		if (author === 'system') return 'System';
		if (author === 'admin') return 'Support';
		// If it's not one of the standard values, it's an admin's actual name
		return author;
	}

	function getStatusLabel(status: string): string {
		return status.replace('_', ' ').toUpperCase();
	}
</script>

<!-- Floating Action Button -->
{#if !isOpen}
	<button
		onclick={() => handleOpen()}
		class="ticket-fab theme-{theme} dock-{dockPosition} {isMobile ? 'mobile' : 'desktop'}"
		transition:fade={{ duration: 200 }}
		aria-label="Open Support Tickets"
	>
		<div class="fab-icon-wrapper">
			<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
					d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
			</svg>
			<!-- Blue dot indicator for unread messages -->
			{#if totalUnreadCount > 0}
				<div class="unread-indicator"></div>
			{/if}
		</div>
	</button>
{/if}

<!-- Chat Widget -->
{#if isOpen}
	<div
		class="ticket-widget theme-{theme} dock-{dockPosition} {isMobile ? 'mobile' : 'desktop'}"
		style="width: {chatWidth}px; height: {chatHeight}px;"
		transition:fly={{ y: 50, duration: 300 }}
	>
		<!-- Header -->
		<div class="widget-header">
			<div class="header-left">
				{#if currentView !== 'list'}
					<button onclick={goToList} class="back-button" aria-label="Back to list">
						<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
				{/if}
				<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
						d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
				</svg>
				<h3 class="header-title">
					{#if currentView === 'list'}Support Tickets{/if}
					{#if currentView === 'create'}Create Ticket{/if}
					{#if currentView === 'view' && currentTicket}
						<span class="ticket-title-sm">{currentTicket.title}</span>
					{/if}
				</h3>
			</div>
			<button onclick={handleClose} class="close-button" aria-label="Close">
				<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>		<!-- Content -->
		<div class="widget-content">
			{#if currentView === 'list'}
				<!-- Ticket List View -->
				<div class="ticket-list-view">
					<button onclick={goToCreate} class="create-ticket-button">
						<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Create New Ticket
					</button>

					{#if savedTickets.length > 0}
						<div class="tickets-section">
							<h4 class="section-title">Your Tickets</h4>
							{#each savedTickets as ticket}
								<button
									onclick={() => handleLoadTicket(ticket.slug)}
									class="ticket-card"
								>
									<div class="ticket-card-content">
										<div class="ticket-card-left">
											<!-- Unread indicator - blue dot -->
											{#if ticket.unreadCount && ticket.unreadCount > 0}
												<div class="unread-dot" title="{ticket.unreadCount} unread message{ticket.unreadCount > 1 ? 's' : ''}"></div>
											{/if}
											<div class="ticket-info">
												<p class="ticket-title">{ticket.title}</p>
												<p class="ticket-slug">#{ticket.slug}</p>
											</div>
										</div>
										<span class="status-badge status-{ticket.status}">
											{getStatusLabel(ticket.status)}
										</span>
									</div>
								</button>
							{/each}
						</div>
					{:else}
						<div class="empty-state">
							<p>No tickets yet</p>
						</div>
					{/if}

					<!-- Load by Slug -->
					<div class="load-by-slug-section">
						<h4 class="section-title">Have a ticket ID?</h4>
						<div class="slug-input-wrapper">
							<input
								type="text"
								bind:value={ticketSlug}
								onkeypress={(e) => {
									if (e.key === 'Enter' && ticketSlug.trim() && !isLoadingTicket) {
										handleLoadTicket(ticketSlug);
									}
								}}
								placeholder="Enter ticket ID"
								class="slug-input"
							/>
							<button
								onclick={() => handleLoadTicket(ticketSlug)}
								disabled={!ticketSlug.trim() || isLoadingTicket}
								class="load-button"
							>
								{isLoadingTicket ? '...' : 'Load'}
					</button>
				</div>
				{#if ticketError}
					<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-2">
						<p class="text-red-400 text-sm">{ticketError}</p>
					</div>
				{/if}
			</div>
		</div>			{:else if currentView === 'create'}
				<!-- Create Ticket View -->
				<div class="create-ticket-view">
					<div class="create-form">
						<div class="form-field">
							<label for="ticket-title" class="form-label">Title</label>
							<input
								id="ticket-title"
								type="text"
								bind:value={title}
								placeholder="Brief summary of your issue"
								maxlength="200"
								class="form-input"
							/>
						</div>

						<div class="form-field">
							<label for="ticket-description" class="form-label">Description</label>
							<textarea
								id="ticket-description"
								bind:value={description}
								placeholder="Provide detailed information about your issue..."
								rows="8"
								maxlength="5000"
								class="form-textarea"
							></textarea>
							<p class="char-counter">
								{description.length}/5000 characters
							</p>
						</div>

				{#if createError}
					<div class="error-message">
						<p>{createError}</p>
					</div>
				{/if}						<button
							onclick={handleCreateTicket}
							disabled={isCreating || !title.trim() || !description.trim()}
							class="submit-button"
						>
							{isCreating ? 'Creating...' : 'Create Ticket'}
						</button>
					</div>
				</div>

			{:else if currentView === 'view' && currentTicket}
				<!-- View Ticket & Messages -->
				<div class="view-ticket-container">
					<!-- Ticket Info -->
					<div class="ticket-info-header">
						<div class="ticket-info-content">
							<div class="ticket-slug-wrapper">
								<p class="ticket-slug-text">#{currentTicket.slug}</p>
							</div>
							<span class="status-badge status-{currentTicket.status}">
								{getStatusLabel(currentTicket.status)}
							</span>
						</div>
						<p class="ticket-description">{currentTicket.description}</p>
					</div>

					<!-- Messages -->
					<div class="messages-list">
						{#each currentTicket.messages as message}
							{#if message.type === 'status_change' && message.author === 'system'}
								<!-- System message for status changes - centered and distinct -->
								<div class="system-message-wrapper">
									<div class="system-message-container">
										<!-- Connecting line above -->
										<div class="connector-line-top"></div>
										
										<div class="system-message">
											<div class="system-message-content">
												<div class="status-icon-wrapper">
													<svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
															d="M13 10V3L4 14h7v7l9-11h-7z" />
													</svg>
												</div>
												<span class="system-message-text">{message.content}</span>
											</div>
											<div class="system-message-timestamp">
												{formatDate(message.timestamp)}
											</div>
										</div>
										
										<!-- Connecting line below -->
										<div class="connector-line-bottom"></div>
									</div>
								</div>
							{:else}
								<!-- Regular message -->
								<div class="chat-message {message.author === 'user' ? 'user' : 'admin'}">
									<div class="message-bubble-wrapper">
										<div class="message-bubble {message.author === 'user' ? 'user' : 'admin'}">
											<p class="message-text">{message.content}</p>
										</div>
										<p class="message-meta {message.author === 'user' ? 'user' : 'admin'}">
											<span>{getAuthorDisplayName(message.author)} · {formatDate(message.timestamp)}</span>
											<!-- Read indicator - show on user's own messages when admin has read them -->
											{#if message.author === 'user' && message.read_by?.includes('admin')}
												<svg class="read-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
												</svg>
											{/if}
										</p>
									</div>
								</div>
							{/if}
						{/each}
						<!-- Scroll target -->
						<div bind:this={messagesEndRef}></div>
					</div>

					<!-- Message Input -->
					<div class="message-input-area">
						{#if messageError}
							<div class="error-message">
								<p>{messageError}</p>
							</div>
						{/if}
						<div class="message-input-wrapper">
							<input
								type="text"
								bind:value={messageContent}
								onkeypress={(e) => e.key === 'Enter' && !isSendingMessage && handleSendMessage()}
								placeholder="Type your message..."
								disabled={isSendingMessage}
								class="message-input-field"
							/>
							<button
								onclick={handleSendMessage}
								disabled={!messageContent.trim() || isSendingMessage}
								class="message-send-button"
							>
								{#if isSendingMessage}
									<svg class="spinner-icon" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else}
									<svg class="send-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

<style>
	/* === Animations === */
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* === Floating Action Button === */
	.ticket-fab {
		position: fixed;
		z-index: 1100;
		border-radius: 50%;
		padding: 1rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		transition: all 0.2s;
		border: none;
		cursor: pointer;
	}

	.ticket-fab:hover {
		transform: scale(1.1);
	}

	/* FAB positioning */
	.ticket-fab.dock-bottom-right {
		bottom: 1rem;
		right: 1rem;
	}

	.ticket-fab.dock-bottom-left.desktop {
		bottom: 1rem;
		left: 1rem;
	}

	.ticket-fab.dock-bottom-left.mobile {
		bottom: 1rem;
		left: 1rem;
	}

	.ticket-fab.dock-top-right {
		top: 1rem;
		right: 1rem;
	}

	.ticket-fab.dock-top-left.desktop {
		top: 1rem;
		left: 1rem;
	}

	.ticket-fab.dock-top-left.mobile {
		top: 1rem;
		left: 1rem;
	}

	/* FAB theme colors */
	.ticket-fab.theme-fleety {
		background: #facc15;
		color: #000;
	}

	.ticket-fab.theme-fleety:hover {
		background: #fde047;
	}

	.ticket-fab.theme-material {
		background: #2563eb;
		color: #fff;
	}

	.ticket-fab.theme-material:hover {
		background: #1d4ed8;
	}

	.ticket-fab.theme-midnight {
		background: #9333ea;
		color: #fff;
	}

	.ticket-fab.theme-midnight:hover {
		background: #7e22ce;
	}

	.fab-icon-wrapper {
		position: relative;
	}

	.fab-icon-wrapper .icon {
		width: 1.5rem;
		height: 1.5rem;
	}

	.unread-indicator {
		position: absolute;
		top: -0.25rem;
		right: -0.25rem;
		width: 0.625rem;
		height: 0.625rem;
		background: #3b82f6;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	/* === Ticket Widget === */
	.ticket-widget {
		position: fixed;
		z-index: 1100;
		border-radius: 0.5rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		border: 2px solid;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Widget positioning */
	.ticket-widget.dock-bottom-right {
		bottom: 1rem;
		right: 1rem;
	}

	.ticket-widget.dock-bottom-left.desktop {
		bottom: 1rem;
		left: 1rem;
	}

	.ticket-widget.dock-bottom-left.mobile {
		bottom: 1rem;
		left: 1rem;
	}

	.ticket-widget.dock-top-right {
		top: 1rem;
		right: 1rem;
	}

	.ticket-widget.dock-top-left.desktop {
		top: 1rem;
		left: 1rem;
	}

	.ticket-widget.dock-top-left.mobile {
		top: 1rem;
		left: 1rem;
	}

	/* Widget theme colors */
	.ticket-widget.theme-fleety {
		background: #111827;
		border-color: #374151;
	}

	.ticket-widget.theme-material {
		background: #fff;
		border-color: #d1d5db;
	}

	.ticket-widget.theme-midnight {
		background: #0f172a;
		border-color: #6b21a8;
	}

	/* === Widget Header === */
	.widget-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
	}

	.theme-fleety .widget-header {
		background: #facc15;
		color: #000;
	}

	.theme-material .widget-header {
		background: #2563eb;
		color: #fff;
	}

	.theme-midnight .widget-header {
		background: linear-gradient(to right, #581c87, #312e81);
		color: #e9d5ff;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.back-button,
	.close-button {
		background: none;
		border: none;
		cursor: pointer;
		transition: opacity 0.2s;
		color: inherit;
	}

	.back-button:hover,
	.close-button:hover {
		opacity: 0.8;
	}

	.icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	.header-title {
		font-weight: 600;
	}

	.ticket-title-sm {
		font-size: 0.875rem;
	}

	/* === Widget Content === */
	.widget-content {
		flex: 1;
		overflow: hidden;
	}

	.ticket-list-view {
		height: 100%;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.create-ticket-button {
		width: 100%;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		transition: background-color 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: none;
		cursor: pointer;
	}

	.theme-fleety .create-ticket-button {
		background: #facc15;
		color: #000;
	}

	.theme-fleety .create-ticket-button:hover {
		background: #fde047;
	}

	.theme-material .create-ticket-button {
		background: #2563eb;
		color: #fff;
	}

	.theme-material .create-ticket-button:hover {
		background: #1d4ed8;
	}

	.theme-midnight .create-ticket-button {
		background: #9333ea;
		color: #fff;
	}

	.theme-midnight .create-ticket-button:hover {
		background: #7e22ce;
	}

	/* === Tickets Section === */
	.tickets-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-title {
		font-size: 0.875rem;
		font-weight: 500;
		opacity: 0.7;
		margin-bottom: 0.5rem;
	}

	.theme-fleety .section-title {
		color: #fff;
	}

	.theme-material .section-title {
		color: #111827;
	}

	.theme-midnight .section-title {
		color: #f0e9ff;
	}

	/* === Ticket Card === */
	.ticket-card {
		padding: 0.75rem;
		border-radius: 0.5rem;
		text-align: left;
		width: 100%;
		transition: background-color 0.2s;
		border: none;
		cursor: pointer;
		position: relative;
	}

	.theme-fleety .ticket-card {
		background: #1f2937;
		color: #fff;
	}

	.theme-fleety .ticket-card:hover {
		background: #374151;
	}

	.theme-material .ticket-card {
		background: #f9fafb;
		color: #111827;
	}

	.theme-material .ticket-card:hover {
		background: #f3f4f6;
	}

	.theme-midnight .ticket-card {
		background: #1e293b;
		color: #f0e9ff;
	}

	.theme-midnight .ticket-card:hover {
		background: #334155;
	}

	.ticket-card-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.ticket-card-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.unread-dot {
		width: 0.5rem;
		height: 0.5rem;
		background: #3b82f6;
		border-radius: 50%;
		flex-shrink: 0;
		animation: pulse 2s infinite;
	}

	.ticket-info {
		flex: 1;
		min-width: 0;
	}

	.ticket-title {
		font-weight: 500;
		font-size: 0.875rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ticket-slug {
		font-size: 0.75rem;
		opacity: 0.6;
	}

	/* === Status Badge === */
	.status-badge {
		color: #fff;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.status-badge.status-open {
		background: #22c55e;
	}

	.status-badge.status-in_progress {
		background: #3b82f6;
	}

	.status-badge.status-resolved {
		background: #a855f7;
	}

	.status-badge.status-closed {
		background: #6b7280;
	}

	/* === Empty State === */
	.empty-state {
		text-align: center;
		padding: 2rem 0;
	}

	.empty-state p {
		opacity: 0.6;
		font-size: 0.875rem;
	}

	.theme-fleety .empty-state p {
		color: #fff;
	}

	.theme-material .empty-state p {
		color: #111827;
	}

	.theme-midnight .empty-state p {
		color: #f0e9ff;
	}

	/* === Load by Slug Section === */
	.load-by-slug-section {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid;
	}

	.theme-fleety .load-by-slug-section {
		border-color: #374151;
	}

	.theme-material .load-by-slug-section {
		border-color: #d1d5db;
	}

	.theme-midnight .load-by-slug-section {
		border-color: #6b21a8;
	}

	.slug-input-wrapper {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.slug-input {
		flex: 1;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid;
		outline: none;
		box-sizing: border-box;
	}

	.slug-input:focus {
		outline: none;
		box-shadow: 0 0 0 2px currentColor;
	}

	.theme-fleety .slug-input {
		background: #1f2937;
		border-color: #4b5563;
		color: #fff;
	}

	.theme-fleety .slug-input:focus {
		border-color: #facc15;
		box-shadow: 0 0 0 2px #facc15;
	}

	.theme-material .slug-input {
		background: #f9fafb;
		border-color: #d1d5db;
		color: #111827;
	}

	.theme-material .slug-input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 2px #2563eb;
	}

	.theme-midnight .slug-input {
		background: #1e293b;
		border-color: #581c87;
		color: #f0e9ff;
	}

	.theme-midnight .slug-input:focus {
		border-color: #a855f7;
		box-shadow: 0 0 0 2px #a855f7;
	}

	.load-button {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		transition: background-color 0.2s;
		border: none;
		cursor: pointer;
	}

	.load-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.theme-fleety .load-button {
		background: #facc15;
		color: #000;
	}

	.theme-material .load-button {
		background: #2563eb;
		color: #fff;
	}

	.theme-midnight .load-button {
		background: #9333ea;
		color: #fff;
	}

	/* === Create Ticket View === */
	.create-ticket-view {
		height: 100%;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 1rem;
	}

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
	}

	.form-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.theme-fleety .form-label {
		color: #fff;
	}

	.theme-material .form-label {
		color: #111827;
	}

	.theme-midnight .form-label {
		color: #f0e9ff;
	}

	.form-input,
	.form-textarea {
		width: 100%;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid;
		outline: none;
		font-size: 0.875rem;
		box-sizing: border-box;
	}

	.form-textarea {
		resize: none;
	}

	.form-input:focus,
	.form-textarea:focus {
		outline: none;
		box-shadow: 0 0 0 2px currentColor;
	}

	.theme-fleety .form-input,
	.theme-fleety .form-textarea {
		background: #1f2937;
		border-color: #4b5563;
		color: #fff;
	}

	.theme-fleety .form-input:focus,
	.theme-fleety .form-textarea:focus {
		border-color: #facc15;
		box-shadow: 0 0 0 2px #facc15;
	}

	.theme-material .form-input,
	.theme-material .form-textarea {
		background: #f9fafb;
		border-color: #d1d5db;
		color: #111827;
	}

	.theme-material .form-input:focus,
	.theme-material .form-textarea:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 2px #2563eb;
	}

	.theme-midnight .form-input,
	.theme-midnight .form-textarea {
		background: #1e293b;
		border-color: #581c87;
		color: #f0e9ff;
	}

	.theme-midnight .form-input:focus,
	.theme-midnight .form-textarea:focus {
		border-color: #a855f7;
		box-shadow: 0 0 0 2px #a855f7;
	}

	.char-counter {
		font-size: 0.75rem;
		opacity: 0.5;
		margin-top: 0.25rem;
	}

	.theme-fleety .char-counter {
		color: #fff;
	}

	.theme-material .char-counter {
		color: #111827;
	}

	.theme-midnight .char-counter {
		color: #f0e9ff;
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 0.5rem;
		padding: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.error-message p {
		color: #f87171;
		font-size: 0.875rem;
	}

	.submit-button {
		width: 100%;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		transition: background-color 0.2s;
		border: none;
		cursor: pointer;
	}

	.submit-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.theme-fleety .submit-button:not(:disabled) {
		background: #facc15;
		color: #000;
	}

	.theme-fleety .submit-button:not(:disabled):hover {
		background: #fde047;
	}

	.theme-material .submit-button:not(:disabled) {
		background: #2563eb;
		color: #fff;
	}

	.theme-material .submit-button:not(:disabled):hover {
		background: #1d4ed8;
	}

	.theme-midnight .submit-button:not(:disabled) {
		background: #9333ea;
		color: #fff;
	}

	.theme-midnight .submit-button:not(:disabled):hover {
		background: #7e22ce;
	}

	/* === View Ticket === */
	.view-ticket-container {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.ticket-info-header {
		padding: 1rem;
		border-bottom: 1px solid;
	}

	.theme-fleety .ticket-info-header {
		background: #1f2937;
		border-color: #374151;
	}

	.theme-material .ticket-info-header {
		background: #f9fafb;
		border-color: #d1d5db;
	}

	.theme-midnight .ticket-info-header {
		background: #1e293b;
		border-color: #6b21a8;
	}

	.ticket-info-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.ticket-slug-wrapper {
		flex: 1;
	}

	.ticket-slug-text {
		font-size: 0.75rem;
		opacity: 0.6;
	}

	.theme-fleety .ticket-slug-text {
		color: #fff;
	}

	.theme-material .ticket-slug-text {
		color: #111827;
	}

	.theme-midnight .ticket-slug-text {
		color: #f0e9ff;
	}

	.ticket-description {
		font-size: 0.875rem;
	}

	.theme-fleety .ticket-description {
		color: #fff;
	}

	.theme-material .ticket-description {
		color: #111827;
	}

	.theme-midnight .ticket-description {
		color: #f0e9ff;
	}

	/* === Messages List === */
	.messages-list {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* === System Messages === */
	.system-message-wrapper {
		display: flex;
		justify-content: center;
		margin: 1rem 0;
	}

	.system-message-container {
		position: relative;
		max-width: 85%;
	}

	.connector-line-top {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%) translateY(-100%);
		height: 0.75rem;
		width: 1px;
		background: linear-gradient(to bottom, transparent, rgba(250, 204, 21, 0.2));
	}

	.connector-line-bottom {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%) translateY(100%);
		height: 0.75rem;
		width: 1px;
		background: linear-gradient(to bottom, rgba(250, 204, 21, 0.2), transparent);
	}

	.system-message {
		border: 1px solid rgba(250, 204, 21, 0.2);
		border-radius: 0.75rem;
		padding: 0.625rem 1rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.theme-fleety .system-message {
		background: #1f2937;
	}

	.theme-material .system-message {
		background: #f9fafb;
	}

	.theme-midnight .system-message {
		background: #1e293b;
	}

	.system-message-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.75rem;
	}

	.theme-fleety .system-message-content {
		color: #fff;
	}

	.theme-material .system-message-content {
		color: #111827;
	}

	.theme-midnight .system-message-content {
		color: #f0e9ff;
	}

	.status-icon-wrapper {
		background: rgba(250, 204, 21, 0.1);
		padding: 0.375rem;
		border-radius: 50%;
	}

	.status-icon {
		width: 0.875rem;
		height: 0.875rem;
		color: #facc15;
	}

	.system-message-text {
		font-weight: 500;
		opacity: 0.8;
	}

	.system-message-timestamp {
		font-size: 0.75rem;
		opacity: 0.5;
		margin-top: 0.375rem;
		text-align: center;
		font-family: monospace;
	}

	.theme-fleety .system-message-timestamp {
		color: #fff;
	}

	.theme-material .system-message-timestamp {
		color: #111827;
	}

	.theme-midnight .system-message-timestamp {
		color: #f0e9ff;
	}

	/* === Chat Messages === */
	.chat-message {
		display: flex;
	}

	.chat-message.user {
		justify-content: flex-end;
	}

	.chat-message.admin {
		justify-content: flex-start;
	}

	.message-bubble-wrapper {
		max-width: 80%;
	}

	.message-bubble {
		border-radius: 0.5rem;
		padding: 0.75rem;
	}

	.theme-fleety .message-bubble.user {
		background: #facc15;
		color: #000;
	}

	.theme-fleety .message-bubble.admin {
		background: #1f2937;
		color: #fff;
	}

	.theme-material .message-bubble.user {
		background: #2563eb;
		color: #fff;
	}

	.theme-material .message-bubble.admin {
		background: #f3f4f6;
		color: #111827;
	}

	.theme-midnight .message-bubble.user {
		background: linear-gradient(to right, #9333ea, #6366f1);
		color: #fff;
	}

	.theme-midnight .message-bubble.admin {
		background: #1e293b;
		color: #f0e9ff;
	}

	.message-text {
		font-size: 0.875rem;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.message-meta {
		font-size: 0.75rem;
		opacity: 0.5;
		margin-top: 0.25rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.message-meta.user {
		text-align: right;
		justify-content: flex-end;
	}

	.message-meta.admin {
		text-align: left;
		justify-content: flex-start;
	}

	.theme-fleety .message-meta {
		color: #fff;
	}

	.theme-material .message-meta {
		color: #111827;
	}

	.theme-midnight .message-meta {
		color: #f0e9ff;
	}

	.read-icon {
		width: 0.75rem;
		height: 0.75rem;
		opacity: 0.7;
	}

	/* === Message Input Area === */
	.message-input-area {
		padding: 1rem;
		border-top: 1px solid;
	}

	.theme-fleety .message-input-area {
		border-color: #374151;
	}

	.theme-material .message-input-area {
		border-color: #d1d5db;
	}

	.theme-midnight .message-input-area {
		border-color: #6b21a8;
	}

	.message-input-wrapper {
		display: flex;
		gap: 0.5rem;
	}

	.message-input-field {
		flex: 1;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid;
		outline: none;
		box-sizing: border-box;
	}

	.message-input-field:focus {
		outline: none;
		box-shadow: 0 0 0 2px currentColor;
	}

	.message-input-field:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.theme-fleety .message-input-field {
		background: #1f2937;
		border-color: #4b5563;
		color: #fff;
	}

	.theme-fleety .message-input-field:focus {
		border-color: #facc15;
		box-shadow: 0 0 0 2px #facc15;
	}

	.theme-material .message-input-field {
		background: #f9fafb;
		border-color: #d1d5db;
		color: #111827;
	}

	.theme-material .message-input-field:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 2px #2563eb;
	}

	.theme-midnight .message-input-field {
		background: #1e293b;
		border-color: #581c87;
		color: #f0e9ff;
	}

	.theme-midnight .message-input-field:focus {
		border-color: #a855f7;
		box-shadow: 0 0 0 2px #a855f7;
	}

	.message-send-button {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		transition: background-color 0.2s;
		border: none;
		cursor: pointer;
	}

	.message-send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.theme-fleety .message-send-button:not(:disabled) {
		background: #facc15;
		color: #000;
	}

	.theme-material .message-send-button:not(:disabled) {
		background: #2563eb;
		color: #fff;
	}

	.theme-midnight .message-send-button:not(:disabled) {
		background: #9333ea;
		color: #fff;
	}

	.spinner-icon,
	.send-icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.spinner-icon {
		animation: spin 1s linear infinite;
	}
</style>
