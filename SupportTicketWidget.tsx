import React, { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';

// Configure marked options
marked.setOptions({
    breaks: true,
    gfm: true
});

const API_BASE = 'https://api.fleety.dev/v1';
const WS_BASE = 'wss://api.fleety.dev/v1';

interface Message {
    id: string;
    author: 'user' | 'admin' | 'system';
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
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    created_at: string;
    updated_at: string;
    messages: Message[];
}

interface SupportTicketWidgetProps {
    projectId: string;
    dockPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    theme?: 'light' | 'dark' | 'material' | 'nord' | 'fleety' | 'system';
    accentColor?: string;
}

const SupportTicketWidget: React.FC<SupportTicketWidgetProps> = ({ 
    projectId, 
    dockPosition = 'bottom-right', 
    theme = 'light',
    accentColor 
}) => {
    // State
    const [isBrowser, setIsBrowser] = useState<boolean>(typeof window !== 'undefined');
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isClosing, setIsClosing] = useState<boolean>(false);
    const [activeView, setActiveView] = useState<'list' | 'create' | 'view'>('list'); // 'list' | 'create' | 'view'
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messageInput, setMessageInput] = useState<string>('');
    const [newTicketTitle, setNewTicketTitle] = useState<string>('');
    const [newTicketDescription, setNewTicketDescription] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [activeTheme, setActiveTheme] = useState<string>(theme);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Refs
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const wsReconnectAttemptsRef = useRef<number>(0);
    const wsReconnectTimeoutRef = useRef<number | null>(null);
    const wsConnectionsRef = useRef<Map<string, WebSocket>>(new Map());
    const scrollTimeoutsRef = useRef<number[]>([]);
    const rateLimitTimerRef = useRef<number | null>(null);

    // Rate limiting state
    const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
    const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
    const [rateLimitCooldown, setRateLimitCooldown] = useState<number>(0);

    const TICKETS_STORAGE_KEY = `fleety_tickets_${projectId}`;

    // Load tickets from localStorage on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const storedTickets = localStorage.getItem(TICKETS_STORAGE_KEY);
        if (storedTickets) {
            try {
                setTickets(JSON.parse(storedTickets));
            } catch (e) {
                console.error('❌ Failed to parse stored tickets:', e);
            }
        }

        // Cleanup
        return () => {
            scrollTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
            scrollTimeoutsRef.current = [];
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            // Close all background WebSocket connections
            wsConnectionsRef.current.forEach((connection) => connection.close());
            wsConnectionsRef.current.clear();
            if (wsReconnectTimeoutRef.current) {
                clearTimeout(wsReconnectTimeoutRef.current);
                wsReconnectTimeoutRef.current = null;
            }
            if (rateLimitTimerRef.current) {
                clearInterval(rateLimitTimerRef.current);
                rateLimitTimerRef.current = null;
            }
        };
    }, [projectId, TICKETS_STORAGE_KEY]);

    // Theme detection for system theme
    useEffect(() => {
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            setActiveTheme(mediaQuery.matches ? 'dark' : 'light');

            const handleChange = (e: MediaQueryListEvent) => {
                setActiveTheme(e.matches ? 'dark' : 'light');
            };

            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            setActiveTheme(theme);
        }
    }, [theme]);

    // Get position styles
    const getPositionStyles = () => {
        switch (dockPosition) {
            case 'bottom-left':
                return { bottom: '20px', left: '20px' };
            case 'bottom-right':
                return { bottom: '20px', right: '20px' };
            case 'top-left':
                return { top: '20px', left: '20px' };
            case 'top-right':
                return { top: '20px', right: '20px' };
            default:
                return { bottom: '20px', right: '20px' };
        }
    };

    // Save tickets to localStorage
    const saveTicketsToStorage = useCallback((currentTickets: Ticket[]) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(currentTickets));
        }
    }, [TICKETS_STORAGE_KEY]);

    // Handle rate limit errors
    const handleRateLimitError = (errorMsg: string) => {
        let cooldown = 1; // Default 1 minute

        // Parse rate limit info from error message
        if (errorMsg.includes('3 tickets per hour')) {
            setRateLimitMessage('Rate limit: Maximum 3 tickets per hour. Please try again later.');
            cooldown = 60; // 60 minutes
        } else if (errorMsg.includes('6 messages per minute')) {
            setRateLimitMessage('Rate limit: Maximum 6 messages per minute. Please slow down.');
            cooldown = 1; // 1 minute
        } else if (errorMsg.toLowerCase().includes('rate limit')) {
            setRateLimitMessage(errorMsg);
            cooldown = 1; // Default 1 minute
        } else {
            return false; // Not a rate limit error
        }
        
        setIsRateLimited(true);
        setRateLimitCooldown(cooldown);

        // Start countdown timer
        let secondsLeft = cooldown * 60;
        if (rateLimitTimerRef.current) {
            clearInterval(rateLimitTimerRef.current);
        }

        rateLimitTimerRef.current = window.setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                setIsRateLimited(false);
                setRateLimitMessage(null);
                setRateLimitCooldown(0);
                if (rateLimitTimerRef.current) {
                    clearInterval(rateLimitTimerRef.current);
                    rateLimitTimerRef.current = null;
                }
            }
        }, 1000);

        return true;
    };

    // Format cooldown time for display
    const formatCooldownTime = () => {
        if (!rateLimitCooldown) return '';

        const totalSeconds = rateLimitCooldown * 60;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    };

    // Auto-scroll to bottom
    const autoScroll = useCallback(() => {
        const timeoutId = window.setTimeout(() => {
            if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
            scrollTimeoutsRef.current = scrollTimeoutsRef.current.filter((id) => id !== timeoutId);
        }, 100);
        scrollTimeoutsRef.current.push(timeoutId);
    }, []);

    // Mark messages as read
    const markMessagesAsRead = useCallback(async (slug: string) => {
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
    }, [projectId]);

    // Refresh ticket data without showing loading state
    const refreshTicket = useCallback(async (slug: string) => {
        try {
            const response = await fetch(`${API_BASE}/tickets/${projectId}/${slug}`);
            if (!response.ok) {
                console.warn('⚠️  [refreshTicket] Response not OK:', response.status);
                return;
            }

            const ticketData = await response.json();

            // Update selectedTicket if we are viewing it
            setSelectedTicket(prevSelected => {
                if (prevSelected && prevSelected.slug === slug) {
                    // updating selectedTicket with new data
                    // message count changed check could be here but we just update
                    setTimeout(() => autoScroll(), 0);
                    // Mark as read
                    setTimeout(() => markMessagesAsRead(slug), 500);
                    return ticketData;
                }
                return prevSelected;
            });

            // Update in tickets array
            setTickets(prevTickets => {
                const ticketIndex = prevTickets.findIndex((t) => t.slug === slug);
                let newTickets = [...prevTickets];
                if (ticketIndex !== -1) {
                    newTickets[ticketIndex] = ticketData;
                } else {
                    // ticket not found in tickets array
                }
                saveTicketsToStorage(newTickets);
                return newTickets;
            });
        } catch (error) {
            console.error('❌ [refreshTicket] Error:', error);
        }
    }, [projectId, autoScroll, markMessagesAsRead, saveTicketsToStorage]);

    // Connect to WebSocket for a ticket
    const connectWebSocket = useCallback((ticketSlug: string) => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        const wsUrl = `${WS_BASE}/tickets/${projectId}/${ticketSlug}/ws`;

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                wsReconnectAttemptsRef.current = 0;
            };

            wsRef.current.onmessage = (event) => {
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
            wsRef.current.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };

            wsRef.current.onclose = () => {
                wsRef.current = null;

                // Attempt to reconnect with exponential backoff
                // We need to check if we are still viewing this ticket. 
                // Since this is a closure, we might need to check a ref or current state.
                // For simplicity, we'll rely on the fact that if we switch views, we close the socket.
                // But if we are still in 'view' mode and selectedTicket matches, we reconnect.
                // However, accessing state in callback might be stale. 
                // We will check if activeView is 'view' via a ref if we had one, or just try to reconnect if not manually closed.
                
                if (wsReconnectAttemptsRef.current < 5) {
                    wsReconnectAttemptsRef.current++;
                    const delay = Math.min(1000 * Math.pow(2, wsReconnectAttemptsRef.current), 30000);

                    wsReconnectTimeoutRef.current = window.setTimeout(() => {
                        // We should only reconnect if we are still supposed to be connected to this ticket
                        // Ideally we check if selectedTicket.slug === ticketSlug
                        // But we can't easily access current state here without refs.
                        // For now, we'll just try to reconnect. If the component unmounted or view changed, 
                        // the cleanup function or showListView would have cleared the timeout or closed the socket.
                        connectWebSocket(ticketSlug);
                    }, delay);
                }
            };
        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
        }
    }, [projectId, refreshTicket]);

    // Load ticket in background to update unread count
    const loadTicketInBackground = useCallback(async (slug: string) => {
        try {
            const response = await fetch(`${API_BASE}/tickets/${projectId}/${slug}`);
            if (response.ok) {
                const ticketData = await response.json();
                setTickets(prevTickets => {
                    const ticketIndex = prevTickets.findIndex((t) => t.slug === slug);
                    if (ticketIndex !== -1) {
                        const newTickets = [...prevTickets];
                        newTickets[ticketIndex] = ticketData;
                        saveTicketsToStorage(newTickets);
                        return newTickets;
                    }
                    return prevTickets;
                });
            }
        } catch (error) {
            console.error('❌ Failed to load ticket in background:', error);
        }
    }, [projectId, saveTicketsToStorage]);

    // Connect to WebSocket for background ticket updates
    const connectBackgroundWebSocket = useCallback((ticketSlug: string) => {
        const wsUrl = `${WS_BASE}/tickets/${projectId}/${ticketSlug}/ws`;

        try {
            const bgWs = new WebSocket(wsUrl);

            bgWs.onopen = () => {
                wsConnectionsRef.current.set(ticketSlug, bgWs);
            };

            bgWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // background message received

                    // Only update if we're not currently viewing this ticket
                    // We need to check selectedTicket. Since we are in a callback, we need a ref or functional update.
                    // But here we just trigger loadTicketInBackground.
                    // The check "if (!selectedTicket || selectedTicket.slug !== ticketSlug)" 
                    // is hard to do perfectly without access to latest state.
                    // However, if we are viewing the ticket, we should have closed the background connection for it.
                    // So if this connection exists, we are likely not viewing it (or logic in loadTicket handles closing it).
                    
                    if (data.type === 'new_message' || data.type === 'ticket_update') {
                        // Defer the update
                        setTimeout(() => {
                            loadTicketInBackground(ticketSlug);
                        }, 0);
                    }
                } catch (e) {
                    console.error('❌ [BgWebSocket] Failed to parse message:', e);
                }
            };
            bgWs.onerror = (error) => {
                console.error('❌ Background WebSocket error:', ticketSlug, error);
            };

            bgWs.onclose = () => {
                wsConnectionsRef.current.delete(ticketSlug);
            };

            wsConnectionsRef.current.set(ticketSlug, bgWs);
        } catch (error) {
            console.error('❌ Failed to create background WebSocket:', error);
        }
    }, [projectId, loadTicketInBackground]);

    // Connect WebSocket for all tickets in the list (for background updates)
    const connectAllTicketWebSockets = useCallback(() => {
        tickets.forEach((ticket) => {
            if (!wsConnectionsRef.current.has(ticket.slug)) {
                connectBackgroundWebSocket(ticket.slug);
            }
        });
    }, [tickets, connectBackgroundWebSocket]);

    // Create a new ticket
    const createTicket = async () => {
        if (!newTicketTitle.trim() || !newTicketDescription.trim() || isLoading) return;

        // Check if rate limited
        if (isRateLimited) {
            setErrorMessage(rateLimitMessage || 'Rate limit active. Please wait before creating another ticket.');
            setTimeout(() => {
                setErrorMessage(null);
            }, 3000);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        setSuccessMessage(null);

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
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = errorData.error || `HTTP ${response.status}`;

                // Handle rate limit errors
                if (response.status === 429) {
                    handleRateLimitError('Rate limit exceeded'); // Force trigger rate limit state
                    setErrorMessage(rateLimitMessage || error);
                } else if (handleRateLimitError(error)) {
                    setErrorMessage(rateLimitMessage || error);
                } else if (response.status === 404) {
                    setErrorMessage('Project not found. Please check your Project ID.');
                } else {
                    throw new Error(error);
                }
                return;
            }

            const newTicket = await response.json();

            // Add to tickets array
            const updatedTickets = [newTicket, ...tickets];
            setTickets(updatedTickets);
            saveTicketsToStorage(updatedTickets);

            // Clear form
            setNewTicketTitle('');
            setNewTicketDescription('');

            // Show success message
            setSuccessMessage(`Ticket #${newTicket.slug} created successfully!`);
            setTimeout(() => {
                setSuccessMessage(null);
            }, 3000);

            // Load the ticket (which will connect WebSocket)
            await loadTicket(newTicket.slug);
        } catch (error) {
            console.error('❌ Create ticket error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create ticket');
            setTimeout(() => {
                setErrorMessage(null);
            }, 5000);
        } finally {
            setIsLoading(false);
        }
    };

    // Load ticket details
    const loadTicket = async (slug: string) => {
        setIsLoading(true);
        setErrorMessage(null);

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

            const ticketData = await response.json();

            setSelectedTicket(ticketData);

            // Update in tickets array
            setTickets(prevTickets => {
                const ticketIndex = prevTickets.findIndex((t) => t.slug === slug);
                let newTickets = [...prevTickets];
                if (ticketIndex !== -1) {
                    newTickets[ticketIndex] = ticketData;
                } else {
                    // Add to tickets array if not present
                    newTickets = [ticketData, ...newTickets];
                }
                saveTicketsToStorage(newTickets);
                return newTickets;
            });

            // Close background WebSocket for this ticket since we're viewing it
            const bgWs = wsConnectionsRef.current.get(slug);
            if (bgWs) {
                bgWs.close();
                wsConnectionsRef.current.delete(slug);
            }

            // Connect to WebSocket for real-time updates
            connectWebSocket(slug);

            // Mark messages as read
            setTimeout(() => markMessagesAsRead(slug), 500);

            // Auto-scroll
            autoScroll();

            setActiveView('view');
        } catch (error) {
            console.error('❌ Load ticket error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load ticket');
            setTimeout(() => {
                setErrorMessage(null);
            }, 5000);
        } finally {
            setIsLoading(false);
        }
    };

    // Send message to ticket
    const sendMessage = async () => {
        if (!messageInput.trim() || !selectedTicket || isLoading) return;

        // Check if rate limited
        if (isRateLimited) {
            setErrorMessage(rateLimitMessage || 'Rate limit active. Please wait before sending another message.');
            setTimeout(() => {
                setErrorMessage(null);
            }, 3000);
            return;
        }

        const content = messageInput.trim();
        setMessageInput('');
        setIsLoading(true);
        setErrorMessage(null);

        // Optimistic update
        const optimisticId = 'temp-' + Date.now();
        const optimisticMessage: Message = {
            id: optimisticId,
            author: 'user',
            content: content,
            timestamp: new Date().toISOString(),
            read_by: ['user']
        };

        const previousSelectedTicket = { ...selectedTicket };

        // Update UI immediately
        const updatedTicket = {
            ...selectedTicket,
            messages: [...selectedTicket.messages, optimisticMessage]
        };
        setSelectedTicket(updatedTicket);

        // Update in tickets array (but don't save to storage to avoid persisting temp ID)
        setTickets(prevTickets => {
            const ticketIndex = prevTickets.findIndex((t) => t.slug === selectedTicket.slug);
            if (ticketIndex !== -1) {
                const newTickets = [...prevTickets];
                newTickets[ticketIndex] = { ...updatedTicket };
                return newTickets;
            }
            return prevTickets;
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
                if (response.status === 429) {
                    handleRateLimitError('Rate limit exceeded');
                    setErrorMessage(rateLimitMessage || error);
                    setMessageInput(content); // Restore message
                    
                    // Revert optimistic update
                    setSelectedTicket(previousSelectedTicket);
                    setTickets(prevTickets => {
                        const ticketIndex = prevTickets.findIndex((t) => t.slug === previousSelectedTicket.slug);
                        if (ticketIndex !== -1) {
                            const newTickets = [...prevTickets];
                            newTickets[ticketIndex] = previousSelectedTicket;
                            return newTickets;
                        }
                        return prevTickets;
                    });
                } else if (handleRateLimitError(error)) {
                    setErrorMessage(rateLimitMessage || error);
                    setMessageInput(content); // Restore message

                    // Revert optimistic update
                    setSelectedTicket(previousSelectedTicket);
                    setTickets(prevTickets => {
                        const ticketIndex = prevTickets.findIndex((t) => t.slug === previousSelectedTicket.slug);
                        if (ticketIndex !== -1) {
                            const newTickets = [...prevTickets];
                            newTickets[ticketIndex] = previousSelectedTicket;
                            return newTickets;
                        }
                        return prevTickets;
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
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send message');
            setMessageInput(content); // Restore message

            // Revert optimistic update
            setSelectedTicket(previousSelectedTicket);
            setTickets(prevTickets => {
                const ticketIndex = prevTickets.findIndex((t) => t.slug === selectedTicket.slug);
                if (ticketIndex !== -1) {
                    const newTickets = [...prevTickets];
                    newTickets[ticketIndex] = { ...previousSelectedTicket };
                    return newTickets;
                }
                return prevTickets;
            });

            setTimeout(() => {
                setErrorMessage(null);
            }, 5000);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (activeView === 'view') {
                sendMessage();
            }
        }
    };

    // Toggle widget
    const toggleWidget = () => {
        if (isOpen) {
            setIsClosing(true);
            setTimeout(() => {
                setIsOpen(false);
                setIsClosing(false);
                // Close WebSocket when closing widget
                if (wsRef.current) {
                    wsRef.current.close();
                    wsRef.current = null;
                }
                setActiveView('list');
                setSelectedTicket(null);
            }, 300);
        } else {
            setIsOpen(true);
            // Connect WebSocket for all tickets when opening
            connectAllTicketWebSockets();
        }
    };

    // Navigate to create view
    const showCreateView = () => {
        setActiveView('create');
        setNewTicketTitle('');
        setNewTicketDescription('');
        setErrorMessage(null);
        setSuccessMessage(null);
    };

    // Navigate to list view
    const showListView = () => {
        const previousTicketSlug = selectedTicket?.slug;

        setActiveView('list');
        setSelectedTicket(null);

        // Close active ticket WebSocket
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Reconnect background WebSocket for the ticket we just left
        if (previousTicketSlug && !wsConnectionsRef.current.has(previousTicketSlug)) {
            connectBackgroundWebSocket(previousTicketSlug);
        }
    };

    // Format message content
    const formatMessageContent = (content: string, isUser: boolean) => {
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
                return marked.parse(content);
            } catch (error) {
                console.error('Error parsing markdown:', error);
                return content.replace(/\n/g, '<br>');
            }
        }
    };

    // Get unread count for a ticket
    const getUnreadCount = (ticket: Ticket) => {
        return ticket.messages.filter((m) => m.author === 'admin' && !m.read_by.includes('user'))
            .length;
    };

    // Format date
    const formatDate = (dateString: string) => {
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
    };

    // Format timestamp
    const formatTimestamp = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isBrowser) return null;

    return (
        <>
            <style>{STYLES}</style>
            <div
                className="ticket-widget-container"
                data-theme={activeTheme}
                data-dock={dockPosition}
                style={getPositionStyles()}
            >
                {(isOpen || isClosing) && (
                    <div className={`ticket-window ${isClosing ? 'closing' : ''}`}>
                        {/* Header */}
                        <div className="ticket-header">
                            <div className="header-content">
                                {activeView === 'list' ? (
                                    <>
                                        <div className="header-icon">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="2"/>
                                                <path d="M9 12H15M9 16H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                            </svg>
                                        </div>
                                        <div className="header-text">
                                            <div className="header-title">Support Tickets</div>
                                            <div className="header-subtitle">
                                                {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </>
                                ) : activeView === 'create' ? (
                                    <>
                                        <button className="back-button" onClick={showListView} aria-label="Back to list">
                                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                <path
                                                    d="M12 4L6 10L12 16"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                        <div className="header-text">
                                            <div className="header-title">Create Ticket</div>
                                        </div>
                                    </>
                                ) : activeView === 'view' && selectedTicket ? (
                                    <>
                                        <button className="back-button" onClick={showListView} aria-label="Back to list">
                                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                <path
                                                    d="M12 4L6 10L12 16"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                        <div className="header-text">
                                            <div className="header-title">{selectedTicket.title}</div>
                                            <div className="header-subtitle">
                                                <span style={{ opacity: 0.8 }}>#{selectedTicket.slug}</span>
                                            </div>
                                        </div>
                                        <span className={`status-badge status-${selectedTicket.status}`}>
                                            {selectedTicket.status.replace(/_/g, ' ')}
                                        </span>
                                    </>
                                ) : null}
                            </div>
                            <button className="close-button" onClick={toggleWidget} aria-label="Close tickets">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="ticket-content">
                            {activeView === 'list' ? (
                                /* Tickets List */
                                <>
                                    <div className="tickets-list">
                                        {errorMessage && (
                                            <div className="error-message">{errorMessage}</div>
                                        )}
                                        {isRateLimited && rateLimitMessage && (
                                            <div className="rate-limit-notice">
                                                <div className="rate-limit-icon">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                                                        <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                    </svg>
                                                </div>
                                                <div className="rate-limit-text">
                                                    <strong>Rate Limit Active</strong>
                                                    <p>{rateLimitMessage}</p>
                                                </div>
                                            </div>
                                        )}
                                        {tickets.length === 0 ? (
                                            <div className="empty-state">
                                                <div className="empty-icon">
                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                                        <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                                        <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                                                    </svg>
                                                </div>
                                                <div className="empty-title">No tickets yet</div>
                                                <div className="empty-text">Create your first support ticket to get started</div>
                                            </div>
                                        ) : (
                                            tickets.map((ticket) => (
                                                <button key={ticket.slug} className="ticket-item" onClick={() => loadTicket(ticket.slug)}>
                                                    <div className="ticket-item-header">
                                                        <div className="ticket-item-title">{ticket.title}</div>
                                                        <span className={`status-badge status-${ticket.status}`}>
                                                            {ticket.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="ticket-item-meta">
                                                        <span className="ticket-item-slug">#{ticket.slug}</span>
                                                        <span className="ticket-item-date">{formatDate(ticket.created_at)}</span>
                                                        {getUnreadCount(ticket) > 0 && (
                                                            <span className="unread-badge">{getUnreadCount(ticket)}</span>
                                                        )}
                                                    </div>
                                                    <div className="ticket-item-description">
                                                        {ticket.description.substring(0, 100)}{ticket.description.length > 100
                                                            ? '...'
                                                            : ''}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>

                                    {/* Create Button */}
                                    <div className="action-bar">
                                        <button className="create-ticket-button" onClick={showCreateView}>
                                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                <path
                                                    d="M10 4V16M4 10H16"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            Create New Ticket
                                        </button>
                                    </div>
                                </>
                            ) : activeView === 'create' ? (
                                /* Create Ticket Form */
                                <div className="create-form">
                                    {successMessage && (
                                        <div className="success-message">{successMessage}</div>
                                    )}
                                    {errorMessage && (
                                        <div className="error-message">{errorMessage}</div>
                                    )}
                                    {isRateLimited && rateLimitMessage && (
                                        <div className="rate-limit-notice">
                                            <div className="rate-limit-icon">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                                                    <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                </svg>
                                            </div>
                                            <div className="rate-limit-text">
                                                <strong>Rate Limit Active</strong>
                                                <p>{rateLimitMessage}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label htmlFor="ticket-title">Title</label>
                                        <input
                                            id="ticket-title"
                                            type="text"
                                            className="form-input"
                                            value={newTicketTitle}
                                            onChange={(e) => setNewTicketTitle(e.target.value)}
                                            placeholder="Brief description of your issue"
                                            disabled={isLoading || isRateLimited}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="ticket-description">Description</label>
                                        <textarea
                                            id="ticket-description"
                                            className="form-textarea"
                                            value={newTicketDescription}
                                            onChange={(e) => setNewTicketDescription(e.target.value)}
                                            placeholder="Provide detailed information about your issue..."
                                            rows={8}
                                            disabled={isLoading || isRateLimited}
                                        ></textarea>
                                    </div>

                                    <button
                                        className="submit-button"
                                        onClick={createTicket}
                                        disabled={!newTicketTitle.trim() ||
                                            !newTicketDescription.trim() ||
                                            isLoading ||
                                            isRateLimited}
                                    >
                                        {isLoading ? 'Creating...' : isRateLimited ? 'Rate Limited' : 'Create Ticket'}
                                    </button>
                                </div>
                            ) : activeView === 'view' && selectedTicket ? (
                                /* Ticket View */
                                <div className="ticket-view">
                                    {/* Messages */}
                                    <div className="messages-section">
                                        <div className="messages-container" ref={messagesContainerRef}>
                                            {/* Initial ticket description as first message */}
                                            <div
                                                className="message"
                                                style={{ alignSelf: 'flex-end', alignItems: 'flex-end' }}
                                            >
                                                <div
                                                    className="message-content"
                                                    style={{ background: 'var(--user-msg-bg)', color: 'var(--user-msg-text)', borderBottomRightRadius: '4px' }}
                                                >
                                                    {selectedTicket.description}
                                                </div>
                                                <div className="message-time">
                                                    {formatTimestamp(selectedTicket.created_at)}
                                                    <span className="message-author">You</span>
                                                </div>
                                            </div>
                                            
                                            {/* Subsequent messages */}
                                            {selectedTicket.messages.map((message) => (
                                                <div
                                                    key={message.id}
                                                    className="message"
                                                    style={{
                                                        alignSelf: message.author === 'user' ? 'flex-end' : 'flex-start',
                                                        alignItems: message.author === 'user' ? 'flex-end' : 'flex-start'
                                                    }}
                                                >
                                                    <div
                                                        className="message-content"
                                                        style={{
                                                            background: message.author === 'user' ? 'var(--user-msg-bg)' : 'var(--admin-msg-bg)',
                                                            color: message.author === 'user' ? 'var(--user-msg-text)' : 'var(--admin-msg-text)',
                                                            [message.author === 'user' ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: '4px'
                                                        }}
                                                        dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content, message.author === 'user') }}
                                                    />
                                                    <div className="message-time">
                                                        {formatTimestamp(message.timestamp)}
                                                        {message.author === 'user' ? (
                                                            <span className="message-author">You</span>
                                                        ) : (
                                                            <span className="message-author">Support</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Message Input */}
                                    {selectedTicket.status !== 'closed' ? (
                                        <div className="message-input-container">
                                            {errorMessage && (
                                                <div className="error-message-inline">{errorMessage}</div>
                                            )}
                                            {isRateLimited && rateLimitMessage && (
                                                <div className="rate-limit-notice-inline">
                                                    <span className="rate-limit-icon-small">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                                                            <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                        </svg>
                                                    </span>
                                                    <span>{rateLimitMessage}</span>
                                                </div>
                                            )}
                                            <div className="input-wrapper">
                                                <textarea
                                                    className="message-input"
                                                    value={messageInput}
                                                    onChange={(e) => setMessageInput(e.target.value)}
                                                    onKeyDown={handleKeyPress}
                                                    placeholder="Type your message..."
                                                    rows={2}
                                                    disabled={isLoading || isRateLimited}
                                                ></textarea>
                                                <button
                                                    className="send-button"
                                                    onClick={sendMessage}
                                                    disabled={!messageInput.trim() || isLoading || isRateLimited}
                                                    aria-label="Send message"
                                                    title={isRateLimited ? 'Rate limited' : 'Send message'}
                                                >
                                                    <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="send-icon">
                                                        <path
                                                            d="M2 10L18 2L10 18L8 11L2 10Z"
                                                            fill="currentColor"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                            strokeLinejoin="round"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="ticket-closed-notice">
                                            This ticket is closed. No new messages can be added.
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

                {/* Floating Button */}
                <button className="ticket-toggle-button" onClick={toggleWidget} aria-label="Toggle tickets">
                    <div className={`icon-container ${isOpen ? 'open' : ''}`}>
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="icon icon-default"
                        >
                            <path
                                d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M9 12H15M9 16H13"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            className="icon icon-close"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </div>
                    {tickets.some((t) => getUnreadCount(t) > 0) && (
                        <span className="notification-dot"></span>
                    )}
                </button>
            </div>
        </>
    );
};

const STYLES = `
    .ticket-widget-container {
        position: fixed;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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

    .ticket-widget-container[data-theme='fleety'] .close-button,
    .ticket-widget-container[data-theme='fleety'] .back-button,
    .ticket-widget-container[data-theme='fleety'] .create-ticket-button,
    .ticket-widget-container[data-theme='fleety'] .submit-button,
    .ticket-widget-container[data-theme='fleety'] .send-button,
    .ticket-widget-container[data-theme='fleety'] .ticket-toggle-button {
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

    .ticket-window.closing {
        animation: slideDown 0.3s ease-in forwards;
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

    @keyframes slideDown {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(20px);
        }
    }

    /* Header */
    .ticket-header {
        background: var(--accent-color);
        color: #ffffff;
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
        color: inherit;
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
        text-align: left;
    }

    .header-title {
        font-weight: 600;
        font-size: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: left;
    }

    .header-subtitle {
        font-size: 13px;
        opacity: 0.9;
        margin-top: 2px;
        text-align: left;
    }

    .close-button {
        background: transparent;
        border: none;
        color: inherit;
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
        color: #ffffff;
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
        color: #ffffff;
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
    }

    .message-content * {
        margin: 0;
        padding: 0;
        font-size: 14px;
        line-height: 1.5;
        font-weight: normal;
    }

    .message-content ul,
    .message-content ol {
        padding-left: 20px;
    }

    .message-content code {
        font-size: 13px;
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
        color: #ffffff;
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

    .send-icon {
        width: 20px;
        height: 20px;
        min-width: 20px;
        min-height: 20px;
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

    /* Icon Animation */
    .icon-container {
        position: relative;
        width: 24px;
        height: 24px;
    }

    .ticket-toggle-button .icon {
        width: 24px;
        height: 24px;
        position: absolute;
        top: 0;
        left: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
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

    /* Toggle Button */
    .ticket-toggle-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--accent-color);
        color: #ffffff;
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
`;

export default SupportTicketWidget;
