(function(window) {
    'use strict';

    // CSS Styles
    const styles = `
    .ticket-widget-container {
		position: fixed;
		z-index: 9999;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

    .ticket-widget-container * {
        box-sizing: border-box;
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
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
	}

    .ticket-window.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: all;
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
        width: 100%;
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

	.create-ticket-button,
	.load-ticket-button {
		width: 100%;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		padding: 12px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s, transform 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.load-ticket-button {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		margin-top: 8px;
	}

	.ticket-widget-container[data-theme='fleety'] .create-ticket-button {
		color: #232627;
	}

	.create-ticket-button:hover,
	.load-ticket-button:hover {
		opacity: 0.9;
		transform: scale(1.02);
	}

	.create-ticket-button:active,
	.load-ticket-button:active {
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
        width: 100%;
        box-sizing: border-box;
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
		transition: opacity 0.2s, transform 0.1s;
		margin-top: auto;
        width: 100%;
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

	/* Load Ticket Modal */
	.load-ticket-modal {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		padding: 20px;
	}

	.load-ticket-content {
		background: var(--bg-primary);
		border-radius: 12px;
		padding: 24px;
		max-width: 400px;
		width: 100%;
		box-shadow: var(--shadow);
	}

	.load-ticket-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 16px;
	}

	.load-ticket-input {
		width: 100%;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 14px;
		font-family: inherit;
		color: var(--text-primary);
		margin-bottom: 16px;
		box-sizing: border-box;
	}

	.load-ticket-input:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.load-ticket-input::placeholder {
		color: var(--text-secondary);
	}

	.load-ticket-actions {
		display: flex;
		gap: 8px;
	}

	.load-ticket-submit,
	.load-ticket-cancel {
		flex: 1;
		border: none;
		border-radius: 8px;
		padding: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.load-ticket-submit {
		background: var(--accent-color);
		color: white;
	}

	.ticket-widget-container[data-theme='fleety'] .load-ticket-submit {
		color: #232627;
	}

	.load-ticket-cancel {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.load-ticket-submit:hover,
	.load-ticket-cancel:hover {
		opacity: 0.8;
	}

	.load-ticket-submit:disabled {
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
		padding: 8px 12px;
		border-radius: 8px;
		font-size: 14px;
		line-height: 1.4;
		word-wrap: break-word;
		white-space: normal;
	}

    .message-content p {
        margin: 0 0 4px 0;
    }

    .message-content p:last-child {
        margin-bottom: 0;
    }

    .message-content h1, .message-content h2, .message-content h3, .message-content h4, .message-content h5, .message-content h6 {
        margin: 8px 0 4px 0;
        font-size: 1.1em;
        font-weight: 600;
        line-height: 1.2;
    }

    .message-content h1:first-child, .message-content h2:first-child, .message-content h3:first-child {
        margin-top: 0;
    }

    .message-content ul, .message-content ol {
        margin: 0 0 4px 0;
        padding-left: 20px;
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
        width: 100%;
        box-sizing: border-box;
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
		transition: opacity 0.2s, transform 0.1s;
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
		transition: transform 0.2s, box-shadow 0.2s;
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
		0%, 100% {
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
    `;

    // Icons
    const icons = {
        list: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="2"/><path d="M9 12H15M9 16H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        back: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        close: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        rateLimit: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        empty: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>`,
        create: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        send: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 10L18 2L10 18L8 11L2 10Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
        search: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 12L17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        ticket: `<svg class="icon icon-default" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M9 12H15M9 16H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        cross: `<svg class="icon icon-close" width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        rateLimitSmall: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    };

    class FleetySupportWidget {
        constructor(config) {
            if (!config.projectId) {
                console.error('FleetySupportWidget: projectId is required');
                return;
            }

            this.projectId = config.projectId;
            this.dockPosition = config.dockPosition || 'bottom-right';
            this.theme = config.theme || 'light';
            this.accentColor = config.accentColor;

            // State
            this.isOpen = false;
            this.activeView = 'list';
            this.tickets = [];
            this.selectedTicket = null;
            this.messageInput = '';
            this.newTicketTitle = '';
            this.newTicketDescription = '';
            this.isLoading = false;
            this.activeTheme = this.theme;
            this.errorMessage = null;
            this.successMessage = null;
            this.isLoadTicketModalOpen = false;
            this.loadTicketInput = '';
            
            // WebSocket
            this.ws = null;
            this.wsReconnectAttempts = 0;
            this.wsReconnectTimeout = null;
            this.wsConnections = new Map();

            // Rate limiting
            this.isRateLimited = false;
            this.rateLimitMessage = null;
            this.rateLimitCooldown = 0;
            this.rateLimitTimer = null;

            // Constants
            this.API_BASE = 'https://api.fleety.dev/v1';
            this.WS_BASE = 'wss://api.fleety.dev/v1';
            this.TICKETS_STORAGE_KEY = `fleety_tickets_${this.projectId}`;

            this.init();
        }

        async init() {
            await this.loadDependencies();
            this.injectStyles();
            this.setupTheme();
            this.loadTicketsFromStorage();
            this.createWidget();
            this.connectAllTicketWebSockets();
            this.setupEventListeners();
        }

        setupEventListeners() {
            // Listen for ticket-created events from chat widget
            window.addEventListener('ticket-created', (event) => {
                const ticketSlug = event.detail?.ticketSlug;
                if (ticketSlug) {
                    // Open the widget if it's closed
                    if (!this.isOpen) {
                        this.isOpen = true;
                    }
                    // Load and display the ticket
                    this.loadTicket(ticketSlug);
                }
            });
        }

        async loadDependencies() {
            if (typeof marked === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
                document.head.appendChild(script);
                await new Promise(resolve => script.onload = resolve);
                if (window.marked) {
                    window.marked.setOptions({ breaks: true, gfm: true });
                }
            } else {
                window.marked.setOptions({ breaks: true, gfm: true });
            }
        }

        injectStyles() {
            const styleEl = document.createElement('style');
            styleEl.textContent = styles;
            if (this.accentColor) {
                styleEl.textContent += `
                    .ticket-widget-container {
                        --custom-accent: ${this.accentColor};
                    }
                `;
            }
            document.head.appendChild(styleEl);
        }

        setupTheme() {
            if (this.theme === 'system') {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                this.activeTheme = mediaQuery.matches ? 'dark' : 'light';
                mediaQuery.addEventListener('change', (e) => {
                    this.activeTheme = e.matches ? 'dark' : 'light';
                    this.updateTheme();
                });
            }
            this.updateTheme();
        }

        updateTheme() {
            if (this.container) {
                this.container.setAttribute('data-theme', this.activeTheme);
            }
        }

        loadTicketsFromStorage() {
            const storedTickets = localStorage.getItem(this.TICKETS_STORAGE_KEY);
            if (storedTickets) {
                try {
                    this.tickets = JSON.parse(storedTickets);
                } catch (e) {
                    console.error('Failed to parse stored tickets:', e);
                }
            }
        }

        saveTicketsToStorage() {
            localStorage.setItem(this.TICKETS_STORAGE_KEY, JSON.stringify(this.tickets));
        }

        createWidget() {
            this.container = document.createElement('div');
            this.container.className = 'ticket-widget-container';
            this.container.setAttribute('data-theme', this.activeTheme);
            this.container.setAttribute('data-dock', this.dockPosition);
            
            // Set position styles
            let posStyle = '';
            switch (this.dockPosition) {
                case 'bottom-left': posStyle = 'bottom: 20px; left: 20px;'; break;
                case 'bottom-right': posStyle = 'bottom: 20px; right: 20px;'; break;
                case 'top-left': posStyle = 'top: 20px; left: 20px;'; break;
                case 'top-right': posStyle = 'top: 20px; right: 20px;'; break;
                default: posStyle = 'bottom: 20px; right: 20px;';
            }
            this.container.style.cssText = posStyle;

            this.render();
            document.body.appendChild(this.container);
        }

        render() {
            if (!this.container) return;
            
            // Ensure structure exists
            let windowEl = this.container.querySelector('.ticket-window');
            let btnEl = this.container.querySelector('.ticket-toggle-button');

            if (!windowEl) {
                this.container.innerHTML = `
                    <div class="ticket-window"></div>
                    <button class="ticket-toggle-button"></button>
                `;
                windowEl = this.container.querySelector('.ticket-window');
                btnEl = this.container.querySelector('.ticket-toggle-button');
                
                // Attach toggle listener once
                btnEl.onclick = () => this.toggleWidget();
            }

            // Update Window Content
            const headerHtml = this.getHeaderHtml();
            const contentHtml = this.getContentHtml();
            
            windowEl.innerHTML = `
                ${headerHtml}
                <div class="ticket-content">
                    ${contentHtml}
                </div>
            `;

            // Update Classes
            if (this.isOpen) {
                windowEl.classList.add('open');
            } else {
                windowEl.classList.remove('open');
            }

            // Update Button Content (Icon Animation)
            const unreadCount = this.tickets.reduce((acc, t) => acc + (this.getUnreadCount(t) > 0 ? 1 : 0), 0);
            const hasUnread = unreadCount > 0;
            
            btnEl.setAttribute('aria-label', this.isOpen ? "Close tickets" : "Open tickets");
            
            let iconContainer = btnEl.querySelector('.icon-container');
            if (!iconContainer) {
                // Initial render of button content
                btnEl.innerHTML = `
                    <div class="icon-container ${this.isOpen ? 'open' : ''}">
                        ${icons.ticket}
                        ${icons.cross}
                    </div>
                `;
                iconContainer = btnEl.querySelector('.icon-container');
            } else {
                // Update class only to preserve transitions
                if (this.isOpen) {
                    iconContainer.classList.add('open');
                } else {
                    iconContainer.classList.remove('open');
                }
            }

            // Handle notification dot
            let dot = btnEl.querySelector('.notification-dot');
            if (hasUnread) {
                if (!dot) {
                    dot = document.createElement('span');
                    dot.className = 'notification-dot';
                    btnEl.appendChild(dot);
                }
            } else {
                if (dot) {
                    dot.remove();
                }
            }

            // Re-attach event listeners
            if (this.isOpen) {
                const closeBtn = this.container.querySelector('.close-button');
                if (closeBtn) closeBtn.onclick = () => this.toggleWidget();

                const backBtn = this.container.querySelector('.back-button');
                if (backBtn) backBtn.onclick = () => this.showListView();

                const createBtn = this.container.querySelector('.create-ticket-button');
                if (createBtn) createBtn.onclick = () => this.showCreateView();

                const loadTicketBtn = this.container.querySelector('.load-ticket-button');
                if (loadTicketBtn) loadTicketBtn.onclick = () => this.showLoadTicketModal();

                const loadTicketSubmit = this.container.querySelector('.load-ticket-submit');
                if (loadTicketSubmit) loadTicketSubmit.onclick = () => this.handleLoadTicketSubmit();

                const loadTicketCancel = this.container.querySelector('.load-ticket-cancel');
                if (loadTicketCancel) loadTicketCancel.onclick = () => this.hideLoadTicketModal();

                const loadTicketInput = this.container.querySelector('.load-ticket-input');
                if (loadTicketInput) {
                    loadTicketInput.oninput = (e) => { 
                        this.loadTicketInput = e.target.value; 
                        this.updateLoadTicketButton(); 
                    };
                    loadTicketInput.onkeydown = (e) => {
                        if (e.key === 'Enter' && this.loadTicketInput.trim()) {
                            this.handleLoadTicketSubmit();
                        } else if (e.key === 'Escape') {
                            this.hideLoadTicketModal();
                        }
                    };
                    loadTicketInput.value = this.loadTicketInput;
                    setTimeout(() => loadTicketInput.focus(), 0);
                }

                const submitBtn = this.container.querySelector('.submit-button');

                if (submitBtn) submitBtn.onclick = () => this.createTicket();

                const sendBtn = this.container.querySelector('.send-button');
                if (sendBtn) sendBtn.onclick = () => this.sendMessage();

                // Inputs
                const titleInput = this.container.querySelector('#ticket-title');
                if (titleInput) {
                    titleInput.oninput = (e) => { this.newTicketTitle = e.target.value; this.updateSubmitButton(); };
                    titleInput.value = this.newTicketTitle;
                }

                const descInput = this.container.querySelector('#ticket-description');
                if (descInput) {
                    descInput.oninput = (e) => { this.newTicketDescription = e.target.value; this.updateSubmitButton(); };
                    descInput.value = this.newTicketDescription;
                }

                const msgInput = this.container.querySelector('.message-input');
                if (msgInput) {
                    msgInput.oninput = (e) => { this.messageInput = e.target.value; this.updateSendButton(); };
                    msgInput.onkeydown = (e) => this.handleKeyPress(e);
                    msgInput.value = this.messageInput;
                    // Focus input if view is 'view'
                    if (this.activeView === 'view') setTimeout(() => msgInput.focus(), 0);
                }

                // Ticket items
                const ticketItems = this.container.querySelectorAll('.ticket-item');
                ticketItems.forEach((item, index) => {
                    item.onclick = () => this.loadTicket(this.tickets[index].slug);
                });

                // Scroll to bottom of messages
                if (this.activeView === 'view') {
                    this.autoScroll();
                }
            }
        }

        updateSubmitButton() {
            const btn = this.container.querySelector('.submit-button');
            if (btn) {
                btn.disabled = !this.newTicketTitle.trim() || !this.newTicketDescription.trim() || this.isLoading || this.isRateLimited;
            }
        }

        updateSendButton() {
            const btn = this.container.querySelector('.send-button');
            if (btn) {
                btn.disabled = !this.messageInput.trim() || this.isLoading || this.isRateLimited;
            }
        }

        getHeaderHtml() {
            if (this.activeView === 'list') {
                return `
                    <div class="ticket-header">
                        <div class="header-content">
                            <div class="header-icon">${icons.list}</div>
                            <div class="header-text">
                                <div class="header-title">Support Tickets</div>
                                <div class="header-subtitle">${this.tickets.length} ticket${this.tickets.length !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                        <button class="close-button" aria-label="Close tickets">${icons.close}</button>
                    </div>
                `;
            } else if (this.activeView === 'create') {
                return `
                    <div class="ticket-header">
                        <div class="header-content">
                            <button class="back-button" aria-label="Back to list">${icons.back}</button>
                            <div class="header-text">
                                <div class="header-title">Create Ticket</div>
                            </div>
                        </div>
                        <button class="close-button" aria-label="Close tickets">${icons.close}</button>
                    </div>
                `;
            } else if (this.activeView === 'view' && this.selectedTicket) {
                return `
                    <div class="ticket-header">
                        <div class="header-content">
                            <button class="back-button" aria-label="Back to list">${icons.back}</button>
                            <div class="header-text">
                                <div class="header-title">${this.escapeHtml(this.selectedTicket.title)}</div>
                                <div class="header-subtitle"><span style="opacity: 0.8;">#${this.selectedTicket.slug}</span></div>
                            </div>
                            <span class="status-badge status-${this.selectedTicket.status}">${this.selectedTicket.status.replace(/_/g, ' ')}</span>
                        </div>
                        <button class="close-button" aria-label="Close tickets">${icons.close}</button>
                    </div>
                `;
            }
            return '';
        }

        getContentHtml() {
            let contentHtml = '';
            
            if (this.activeView === 'list') {
                contentHtml = `
                    <div class="tickets-list">
                        ${this.errorMessage ? `<div class="error-message">${this.errorMessage}</div>` : ''}
                        ${this.isRateLimited && this.rateLimitMessage ? `
                            <div class="rate-limit-notice">
                                <div class="rate-limit-icon">${icons.rateLimit}</div>
                                <div class="rate-limit-text">
                                    <strong>Rate Limit Active</strong>
                                    <p>${this.rateLimitMessage}</p>
                                </div>
                            </div>
                        ` : ''}
                        ${this.tickets.length === 0 ? `
                            <div class="empty-state">
                                <div class="empty-icon">${icons.empty}</div>
                                <div class="empty-title">No tickets yet</div>
                                <div class="empty-text">Create your first support ticket to get started</div>
                            </div>
                        ` : this.tickets.map(ticket => `
                            <button class="ticket-item">
                                <div class="ticket-item-header">
                                    <div class="ticket-item-title">${this.escapeHtml(ticket.title)}</div>
                                    <span class="status-badge status-${ticket.status}">${ticket.status.replace(/_/g, ' ')}</span>
                                </div>
                                <div class="ticket-item-meta">
                                    <span class="ticket-item-slug">#${ticket.slug}</span>
                                    <span class="ticket-item-date">${this.formatDate(ticket.created_at)}</span>
                                    ${this.getUnreadCount(ticket) > 0 ? `<span class="unread-badge">${this.getUnreadCount(ticket)}</span>` : ''}
                                </div>
                                <div class="ticket-item-description">
                                    ${this.escapeHtml(ticket.description.substring(0, 100))}${ticket.description.length > 100 ? '...' : ''}
                                </div>
                            </button>
                        `).join('')}
                    </div>
                    <div class="action-bar">
                        <button class="create-ticket-button">
                            ${icons.create}
                            Create New Ticket
                        </button>
                        <button class="load-ticket-button">
                            ${icons.search}
                            Load Ticket by ID
                        </button>
                    </div>
                `;
            } else if (this.activeView === 'create') {
                contentHtml = `
                    <div class="create-form">
                        ${this.successMessage ? `<div class="success-message">${this.successMessage}</div>` : ''}
                        ${this.errorMessage ? `<div class="error-message">${this.errorMessage}</div>` : ''}
                        ${this.isRateLimited && this.rateLimitMessage ? `
                            <div class="rate-limit-notice">
                                <div class="rate-limit-icon">${icons.rateLimit}</div>
                                <div class="rate-limit-text">
                                    <strong>Rate Limit Active</strong>
                                    <p>${this.rateLimitMessage}</p>
                                    ${this.rateLimitCooldown > 0 ? `<p class="rate-limit-cooldown">Cooldown: ${this.formatCooldownTime()}</p>` : ''}
                                </div>
                            </div>
                        ` : ''}
                        <div class="form-group">
                            <label for="ticket-title">Title</label>
                            <input id="ticket-title" type="text" class="form-input" placeholder="Brief description of your issue" ${this.isLoading || this.isRateLimited ? 'disabled' : ''}>
                        </div>
                        <div class="form-group">
                            <label for="ticket-description">Description</label>
                            <textarea id="ticket-description" class="form-textarea" placeholder="Provide detailed information about your issue..." rows="8" ${this.isLoading || this.isRateLimited ? 'disabled' : ''}></textarea>
                        </div>
                        <button class="submit-button" ${!this.newTicketTitle.trim() || !this.newTicketDescription.trim() || this.isLoading || this.isRateLimited ? 'disabled' : ''}>
                            ${this.isLoading ? 'Creating...' : this.isRateLimited ? 'Rate Limited' : 'Create Ticket'}
                        </button>
                    </div>
                `;
            } else if (this.activeView === 'view' && this.selectedTicket) {
                contentHtml = `
                    <div class="ticket-view">
                        <div class="messages-section">
                            <div class="messages-container">
                                <div class="message" style="align-self: flex-end; align-items: flex-end;">
                                    <div class="message-content" style="background: var(--user-msg-bg); color: var(--user-msg-text); border-bottom-right-radius: 4px;">
                                        ${this.escapeHtml(this.selectedTicket.description)}
                                    </div>
                                    <div class="message-time">
                                        ${this.formatTimestamp(this.selectedTicket.created_at)}
                                        <span class="message-author">You</span>
                                    </div>
                                </div>
                                ${this.selectedTicket.messages.map(message => `
                                    <div class="message" style="align-self: ${message.author === 'user' ? 'flex-end' : 'flex-start'}; align-items: ${message.author === 'user' ? 'flex-end' : 'flex-start'};">
                                        <div class="message-content" style="background: ${message.author === 'user' ? 'var(--user-msg-bg)' : 'var(--admin-msg-bg)'}; color: ${message.author === 'user' ? 'var(--user-msg-text)' : 'var(--admin-msg-text)'}; border-bottom-${message.author === 'user' ? 'right' : 'left'}-radius: 4px;">
                                            ${this.formatMessageContent(message.content, message.author === 'user')}
                                        </div>
                                        <div class="message-time">
                                            ${this.formatTimestamp(message.timestamp)}
                                            ${message.author === 'user' ? '<span class="message-author">You</span>' : '<span class="message-author">Support</span>'}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${this.selectedTicket.status !== 'closed' ? `
                            <div class="message-input-container">
                                ${this.errorMessage ? `<div class="error-message-inline">${this.errorMessage}</div>` : ''}
                                ${this.isRateLimited && this.rateLimitMessage ? `
                                    <div class="rate-limit-notice-inline">
                                        <span class="rate-limit-icon-small">${icons.rateLimitSmall}</span>
                                        <span>${this.rateLimitMessage}</span>
                                        ${this.rateLimitCooldown > 0 ? `<span class="rate-limit-cooldown-small">(${this.formatCooldownTime()})</span>` : ''}
                                    </div>
                                ` : ''}
                                <div class="input-wrapper">
                                    <textarea class="message-input" placeholder="Type your message..." rows="2" ${this.isLoading || this.isRateLimited ? 'disabled' : ''}></textarea>
                                    <button class="send-button" aria-label="Send message" ${!this.messageInput.trim() || this.isLoading || this.isRateLimited ? 'disabled' : ''}>
                                        ${icons.send}
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div class="ticket-closed-notice">This ticket is closed. No new messages can be added.</div>
                        `}
                    </div>
                `;
            }
            
            // Add load ticket modal if shown
            const modalHtml = this.isLoadTicketModalOpen ? `
                <div class="load-ticket-modal">
                    <div class="load-ticket-content">
                        <div class="load-ticket-title">Load Ticket by ID</div>
                        <input 
                            type="text" 
                            class="load-ticket-input" 
                            placeholder="e.g., genius-cobra-286 or #genius-cobra-286"
                            ${this.isLoading ? 'disabled' : ''}
                        />
                        <div class="load-ticket-actions">
                            <button class="load-ticket-cancel">Cancel</button>
                            <button class="load-ticket-submit" ${!this.loadTicketInput.trim() || this.isLoading ? 'disabled' : ''}>
                                ${this.isLoading ? 'Loading...' : 'Load Ticket'}
                            </button>
                        </div>
                    </div>
                </div>
            ` : '';
            
            return contentHtml + modalHtml;
        }

        // Logic Methods
        toggleWidget() {
            this.isOpen = !this.isOpen;
            if (this.isOpen) {
                this.connectAllTicketWebSockets();
            } else {
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
                this.activeView = 'list';
                this.selectedTicket = null;
            }
            this.render();
        }

        showListView() {
            const previousTicketSlug = this.selectedTicket?.slug;
            this.activeView = 'list';
            this.selectedTicket = null;
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            if (previousTicketSlug && !this.wsConnections.has(previousTicketSlug)) {
                this.connectBackgroundWebSocket(previousTicketSlug);
            }
            this.render();
        }

        showCreateView() {
            this.activeView = 'create';
            this.newTicketTitle = '';
            this.newTicketDescription = '';
            this.errorMessage = null;
            this.successMessage = null;
            this.render();
        }

        showLoadTicketModal() {
            this.isLoadTicketModalOpen = true;
            this.loadTicketInput = '';
            this.render();
        }

        hideLoadTicketModal() {
            this.isLoadTicketModalOpen = false;
            this.loadTicketInput = '';
            this.errorMessage = null;
            this.render();
        }

        updateLoadTicketButton() {
            const btn = this.container.querySelector('.load-ticket-submit');
            if (btn) {
                btn.disabled = !this.loadTicketInput.trim() || this.isLoading;
            }
        }

        async handleLoadTicketSubmit() {
            if (!this.loadTicketInput.trim() || this.isLoading) return;

            // Strip the # if present
            let ticketId = this.loadTicketInput.trim();
            if (ticketId.startsWith('#')) {
                ticketId = ticketId.substring(1);
            }

            this.hideLoadTicketModal();
            await this.loadTicket(ticketId);
        }

        async createTicket() {
            if (!this.newTicketTitle.trim() || !this.newTicketDescription.trim() || this.isLoading) return;
            if (this.isRateLimited) return;

            this.isLoading = true;
            this.errorMessage = null;
            this.successMessage = null;
            this.render();

            try {
                const response = await fetch(`${this.API_BASE}/tickets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: this.projectId,
                        title: this.newTicketTitle.trim(),
                        description: this.newTicketDescription.trim()
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const error = errorData.error || `HTTP ${response.status}`;
                    if (response.status === 429 || this.handleRateLimitError(error)) {
                        this.errorMessage = this.rateLimitMessage || error;
                    } else {
                        throw new Error(error);
                    }
                    this.isLoading = false;
                    this.render();
                    return;
                }

                const newTicket = await response.json();
                this.tickets = [newTicket, ...this.tickets];
                this.saveTicketsToStorage();
                this.newTicketTitle = '';
                this.newTicketDescription = '';
                this.successMessage = `Ticket #${newTicket.slug} created successfully!`;
                
                setTimeout(() => { this.successMessage = null; this.render(); }, 3000);
                
                await this.loadTicket(newTicket.slug);
            } catch (error) {
                console.error('Create ticket error:', error);
                this.errorMessage = error.message || 'Failed to create ticket';
                setTimeout(() => { this.errorMessage = null; this.render(); }, 5000);
            } finally {
                this.isLoading = false;
                this.render();
            }
        }

        async loadTicket(slug) {
            this.isLoading = true;
            this.errorMessage = null;
            this.render();

            try {
                const response = await fetch(`${this.API_BASE}/tickets/${this.projectId}/${slug}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const error = errorData.error || `HTTP ${response.status}`;
                    if (response.status === 429 || error.toLowerCase().includes('rate limit')) {
                        this.handleRateLimitError(error);
                        this.isLoading = false;
                        this.render();
                        return;
                    }
                    throw new Error(error);
                }

                const ticketData = await response.json();
                this.selectedTicket = ticketData;

                const ticketIndex = this.tickets.findIndex(t => t.slug === slug);
                if (ticketIndex !== -1) {
                    this.tickets[ticketIndex] = ticketData;
                } else {
                    this.tickets = [ticketData, ...this.tickets];
                }
                this.saveTicketsToStorage();

                const bgWs = this.wsConnections.get(slug);
                if (bgWs) {
                    bgWs.close();
                    this.wsConnections.delete(slug);
                }

                this.connectWebSocket(slug);
                setTimeout(() => this.markMessagesAsRead(slug), 500);
                this.activeView = 'view';
                this.render();
                this.autoScroll();
            } catch (error) {
                console.error('Load ticket error:', error);
                this.errorMessage = error.message || 'Failed to load ticket';
                setTimeout(() => { this.errorMessage = null; this.render(); }, 5000);
            } finally {
                this.isLoading = false;
                this.render();
            }
        }

        async sendMessage() {
            if (!this.messageInput.trim() || !this.selectedTicket || this.isLoading) return;
            if (this.isRateLimited) return;

            const content = this.messageInput.trim();
            this.messageInput = '';
            this.isLoading = true;
            this.errorMessage = null;

            // Optimistic update
            const optimisticId = 'temp-' + Date.now();
            const optimisticMessage = {
                id: optimisticId,
                author: 'user',
                content: content,
                timestamp: new Date().toISOString(),
                read_by: ['user']
            };

            const previousSelectedTicket = JSON.parse(JSON.stringify(this.selectedTicket));
            this.selectedTicket.messages.push(optimisticMessage);
            
            const ticketIndex = this.tickets.findIndex(t => t.slug === this.selectedTicket.slug);
            if (ticketIndex !== -1) {
                this.tickets[ticketIndex] = JSON.parse(JSON.stringify(this.selectedTicket));
            }
            
            this.render();
            this.autoScroll();

            try {
                const response = await fetch(`${this.API_BASE}/tickets/${this.projectId}/${this.selectedTicket.slug}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ author: 'user', content: content })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const error = errorData.error || `HTTP ${response.status}`;
                    
                    if (response.status === 429 || this.handleRateLimitError(error)) {
                        this.errorMessage = this.rateLimitMessage || error;
                        this.messageInput = content;
                        this.selectedTicket = previousSelectedTicket;
                        if (ticketIndex !== -1) this.tickets[ticketIndex] = previousSelectedTicket;
                    } else {
                        throw new Error(error);
                    }
                    this.isLoading = false;
                    this.render();
                    return;
                }

                await this.loadTicket(this.selectedTicket.slug);
            } catch (error) {
                console.error('Send message error:', error);
                this.errorMessage = error.message || 'Failed to send message';
                this.messageInput = content;
                this.selectedTicket = previousSelectedTicket;
                if (ticketIndex !== -1) this.tickets[ticketIndex] = previousSelectedTicket;
                setTimeout(() => { this.errorMessage = null; this.render(); }, 5000);
            } finally {
                this.isLoading = false;
                this.render();
            }
        }

        handleKeyPress(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        }

        autoScroll() {
            setTimeout(() => {
                const container = this.container.querySelector('.messages-container');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            }, 100);
        }

        // Helpers
        escapeHtml(unsafe) {
            if (!unsafe) return '';
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        formatMessageContent(content, isUser) {
            if (isUser) {
                return this.escapeHtml(content).replace(/\n/g, '<br>');
            } else {
                try {
                    return window.marked ? window.marked.parse(content) : this.escapeHtml(content).replace(/\n/g, '<br>');
                } catch (error) {
                    return this.escapeHtml(content).replace(/\n/g, '<br>');
                }
            }
        }

        formatDate(dateString) {
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

            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }

        formatTimestamp(dateString) {
            return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        getUnreadCount(ticket) {
            return ticket.messages.filter(m => m.author === 'admin' && !m.read_by.includes('user')).length;
        }

        handleRateLimitError(errorMsg) {
            this.isRateLimited = true;
            if (errorMsg.includes('3 tickets per hour')) {
                this.rateLimitMessage = 'Rate limit: Maximum 3 tickets per hour. Please try again later.';
                this.rateLimitCooldown = 60;
            } else if (errorMsg.includes('6 messages per minute')) {
                this.rateLimitMessage = 'Rate limit: Maximum 6 messages per minute. Please slow down.';
                this.rateLimitCooldown = 1;
            } else if (errorMsg.toLowerCase().includes('rate limit')) {
                this.rateLimitMessage = errorMsg;
                this.rateLimitCooldown = 1;
            } else {
                return false;
            }

            let secondsLeft = this.rateLimitCooldown * 60;
            if (this.rateLimitTimer) clearInterval(this.rateLimitTimer);

            this.rateLimitTimer = setInterval(() => {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    this.isRateLimited = false;
                    this.rateLimitMessage = null;
                    this.rateLimitCooldown = 0;
                    clearInterval(this.rateLimitTimer);
                    this.rateLimitTimer = null;
                    this.render();
                }
            }, 1000);
            
            this.render();
            return true;
        }

        formatCooldownTime() {
            if (!this.rateLimitCooldown) return '';
            const totalSeconds = this.rateLimitCooldown * 60;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        }

        // WebSocket Methods
        connectWebSocket(ticketSlug) {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }

            const wsUrl = `${this.WS_BASE}/tickets/${this.projectId}/${ticketSlug}/ws`;
            try {
                this.ws = new WebSocket(wsUrl);
                this.ws.onopen = () => { this.wsReconnectAttempts = 0; };
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'new_message' || data.type === 'status_change' || data.type === 'ticket_update') {
                            this.refreshTicket(ticketSlug);
                        }
                    } catch (e) { console.error('WebSocket parse error:', e); }
                };
                this.ws.onclose = () => {
                    this.ws = null;
                    if (this.selectedTicket && this.selectedTicket.slug === ticketSlug && this.wsReconnectAttempts < 5) {
                        this.wsReconnectAttempts++;
                        const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
                        this.wsReconnectTimeout = setTimeout(() => this.connectWebSocket(ticketSlug), delay);
                    }
                };
            } catch (error) { console.error('WebSocket error:', error); }
        }

        connectAllTicketWebSockets() {
            this.tickets.forEach(ticket => {
                if (!this.wsConnections.has(ticket.slug)) {
                    this.connectBackgroundWebSocket(ticket.slug);
                }
            });
        }

        connectBackgroundWebSocket(ticketSlug) {
            const wsUrl = `${this.WS_BASE}/tickets/${this.projectId}/${ticketSlug}/ws`;
            try {
                const bgWs = new WebSocket(wsUrl);
                bgWs.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (!this.selectedTicket || this.selectedTicket.slug !== ticketSlug) {
                            if (data.type === 'new_message' || data.type === 'ticket_update') {
                                this.loadTicketInBackground(ticketSlug);
                            }
                        }
                    } catch (e) { console.error('BgWebSocket parse error:', e); }
                };
                bgWs.onclose = () => { this.wsConnections.delete(ticketSlug); };
                this.wsConnections.set(ticketSlug, bgWs);
            } catch (error) { console.error('BgWebSocket error:', error); }
        }

        async loadTicketInBackground(slug) {
            try {
                const response = await fetch(`${this.API_BASE}/tickets/${this.projectId}/${slug}`);
                if (response.ok) {
                    const ticketData = await response.json();
                    const ticketIndex = this.tickets.findIndex(t => t.slug === slug);
                    if (ticketIndex !== -1) {
                        this.tickets[ticketIndex] = ticketData;
                        this.saveTicketsToStorage();
                        this.render();
                    }
                }
            } catch (error) { console.error('Bg load error:', error); }
        }

        async refreshTicket(slug) {
            try {
                const response = await fetch(`${this.API_BASE}/tickets/${this.projectId}/${slug}`);
                if (response.ok) {
                    const ticketData = await response.json();
                    if (this.selectedTicket && this.selectedTicket.slug === slug) {
                        this.selectedTicket = ticketData;
                        this.autoScroll();
                        setTimeout(() => this.markMessagesAsRead(slug), 500);
                    }
                    const ticketIndex = this.tickets.findIndex(t => t.slug === slug);
                    if (ticketIndex !== -1) {
                        this.tickets[ticketIndex] = ticketData;
                        this.saveTicketsToStorage();
                    }
                    this.render();
                }
            } catch (error) { console.error('Refresh error:', error); }
        }

        async markMessagesAsRead(slug) {
            try {
                await fetch(`${this.API_BASE}/tickets/${this.projectId}/${slug}/messages/read`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reader: 'user' })
                });
            } catch (error) { console.error('Mark read error:', error); }
        }
    }

    window.FleetySupportWidget = FleetySupportWidget;
})(window);
