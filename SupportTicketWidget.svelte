<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';

	// API Configuration
	const API_URL = 'https://api.fleety.dev/api';

	interface Ticket {
		id: string;
		slug: string;
		project_id: string;
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

	// Fleety Project Configuration
	const FLEETY_PROJECT_ID = import.meta.env.VITE_FLEETY_PROJECT_ID;

	// Component props
	export let theme: 'fleety' | 'material' | 'midnight' = 'fleety';
	export let dockPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';

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
