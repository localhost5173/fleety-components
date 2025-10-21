import React, { useState, useEffect, useRef, useCallback } from 'react';

// === Component Styles ===
const styles = `
/* === Animations === */
@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
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

.ticket-fab.dock-bottom-right {
    bottom: 1rem;
    right: 1rem;
}

.ticket-fab.dock-bottom-left.desktop,
.ticket-fab.dock-bottom-left.mobile {
    bottom: 1rem;
    left: 1rem;
}

.ticket-fab.dock-top-right {
    top: 1rem;
    right: 1rem;
}

.ticket-fab.dock-top-left.desktop,
.ticket-fab.dock-top-left.mobile {
    top: 1rem;
    left: 1rem;
}

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

.icon-container {
    position: relative;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.fab-icon-wrapper .icon {
    width: 1.5rem;
    height: 1.5rem;
    position: absolute;
    top: 50%;
    left: calc(50% - 2px);
    transform: translate(-50%, -50%);
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.icon-default {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
}

.icon-close {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(90deg) scale(0.8);
}

.icon-container.open .icon-default {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(-90deg) scale(0.8);
}

.icon-container.open .icon-close {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
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

.ticket-widget {
    position: fixed;
    z-index: 1100;
    border-radius: 0.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 2px solid;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: box-shadow 0.3s;
}

.ticket-widget:hover {
    box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.6);
}

.ticket-widget.resizing {
    user-select: none;
}

.ticket-widget.fullscreen {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    border-radius: 0 !important;
    z-index: 9999 !important;
}

.ticket-widget.dock-bottom-right {
    bottom: 5.5rem;
    right: 1rem;
}

.ticket-widget.dock-bottom-left.desktop,
.ticket-widget.dock-bottom-left.mobile {
    bottom: 5.5rem;
    left: 1rem;
}

.ticket-widget.dock-top-right {
    top: 5.5rem;
    right: 1rem;
}

.ticket-widget.dock-top-left.desktop,
.ticket-widget.dock-top-left.mobile {
    top: 5.5rem;
    left: 1rem;
}

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

.widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
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
    min-width: 0;
    flex: 1;
}

.header-title {
    font-weight: 600;
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ticket-title-sm {
    font-size: 0.875rem;
    font-weight: 600;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.back-button,
.close-button,
.fullscreen-button {
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    color: inherit;
}

.back-button:hover,
.close-button:hover,
.fullscreen-button:hover {
    opacity: 0.8;
    transform: scale(1.1);
}

.icon {
    width: 1rem;
    height: 1rem;
}

.widget-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    justify-content: center;
}

.ticket-list-view {
    height: 100%;
    padding: 1rem;
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 600px;
}

.ticket-list-content {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 0;
}

.create-ticket-button {
    width: auto;
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

.tickets-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
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

.ticket-card {
    padding: 0.4rem 0.6rem;
    border-radius: 0.375rem;
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
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.ticket-card-left {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    min-width: 0;
}

.unread-dot {
    width: 0.4rem;
    height: 0.4rem;
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
    font-size: 0.8125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.3;
    margin-bottom: 0.1rem;
}

.ticket-slug {
    font-size: 0.6875rem;
    opacity: 0.5;
    line-height: 1;
}

.status-badge {
    color: #fff;
    font-size: 0.6875rem;
    padding: 0.15rem 0.4rem;
    border-radius: 9999px;
    flex-shrink: 0;
    line-height: 1;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
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

.load-by-slug-section {
    margin-top: auto;
    padding-top: 1rem;
    padding-bottom: 1rem;
    flex-shrink: 0;
}

.slug-input-wrapper {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
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
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;
}

.load-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.theme-fleety .load-button {
    background: #facc15;
    color: #000;
}

.theme-fleety .load-button:hover:not(:disabled) {
    background: #fde047;
}

.theme-material .load-button {
    background: #2563eb;
    color: #fff;
}

.theme-material .load-button:hover:not(:disabled) {
    background: #1d4ed8;
}

.theme-midnight .load-button {
    background: #9333ea;
    color: #fff;
}

.theme-midnight .load-button:hover:not(:disabled) {
    background: #7e22ce;
}

.create-ticket-view {
    width: 100%;
    height: 100%;
    padding: 1rem;
    overflow-y: auto;
    overscroll-behavior: contain;
}

.create-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-field-flex {
    flex: 1;
    min-height: 0;
}

.form-label {
    font-size: 0.875rem;
    font-weight: 500;
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
    padding: 0.75rem;
    font-size: 0.875rem;
    border: 1px solid;
    outline: none;
    box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    box-shadow: 0 0 0 2px currentColor;
}

.form-textarea {
    resize: none;
}

.form-textarea-flex {
    flex: 1;
    min-height: 100px;
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
    text-align: right;
    opacity: 0.6;
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

.submit-button {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: background-color 0.2s;
    border: none;
    cursor: pointer;
    margin-top: auto;
}

.submit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.theme-fleety .submit-button {
    background: #facc15;
    color: #000;
}

.theme-fleety .submit-button:hover:not(:disabled) {
    background: #fde047;
}

.theme-material .submit-button {
    background: #2563eb;
    color: #fff;
}

.theme-material .submit-button:hover:not(:disabled) {
    background: #1d4ed8;
}

.theme-midnight .submit-button {
    background: #9333ea;
    color: #fff;
}

.theme-midnight .submit-button:hover:not(:disabled) {
    background: #7e22ce;
}

.error-message {
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    margin-top: 0.5rem;
}

.theme-fleety .error-message {
    background: #7f1d1d;
    color: #fecaca;
}

.theme-material .error-message {
    background: #fef2f2;
    color: #dc2626;
}

.theme-midnight .error-message {
    background: #2e1038;
    color: #f9a8d4;
}

.view-ticket-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.ticket-info-header {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid;
}

.theme-fleety .ticket-info-header {
    border-color: #374151;
    color: #fff;
}

.theme-material .ticket-info-header {
    border-color: #d1d5db;
    color: #111827;
}

.theme-midnight .ticket-info-header {
    border-color: #6b21a8;
    color: #f0e9ff;
}

.ticket-info-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
}

.ticket-slug-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.ticket-slug-text {
    font-size: 0.875rem;
    font-weight: 500;
    opacity: 0.7;
}

.ticket-description {
    font-size: 0.875rem;
    opacity: 0.9;
}

.messages-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overscroll-behavior: contain;
}

.system-message-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
}

.system-message-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

.connector-line-top,
.connector-line-bottom {
    width: 1px;
    background: #4b5563;
    height: 1rem;
}

.system-message {
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
}

.theme-fleety .system-message {
    background: #1f2937;
    color: #d1d5db;
}

.theme-material .system-message {
    background: #f3f4f6;
    color: #4b5563;
}

.theme-midnight .system-message {
    background: #1e293b;
    color: #9ca3af;
}

.system-message-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.status-icon-wrapper {
    padding: 0.25rem;
    border-radius: 50%;
}

.theme-fleety .status-icon-wrapper {
    background: #374151;
}

.theme-material .status-icon-wrapper {
    background: #e5e7eb;
}

.theme-midnight .status-icon-wrapper {
    background: #334155;
}

.status-icon {
    width: 0.75rem;
    height: 0.75rem;
}

.system-message-text {
    font-weight: 500;
}

.system-message-timestamp {
    font-size: 0.625rem;
    opacity: 0.7;
}

.chat-message {
    display: flex;
    width: 100%;
}

.chat-message.user {
    justify-content: flex-end;
}

.chat-message.admin {
    justify-content: flex-start;
}

.message-bubble-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.chat-message.user .message-bubble-wrapper {
    align-items: flex-end;
}

.message-bubble {
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    max-width: 70%;
}

.theme-fleety .message-bubble.user {
    background: #facc15;
    color: #000;
}

.theme-fleety .message-bubble.admin {
    background: #374151;
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
    background: #9333ea;
    color: #fff;
}

.theme-midnight .message-bubble.admin {
    background: #334155;
    color: #f0e9ff;
}

.message-text {
    font-size: 0.875rem;
    word-wrap: break-word;
    margin: 0;
    padding: 0;
    line-height: 1.4;
}

.message-meta {
    font-size: 0.75rem;
    opacity: 0.7;
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.message-meta.user {
    justify-content: flex-end;
}

.message-meta.admin {
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
    width: 0.875rem;
    height: 0.875rem;
}

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
    font-size: 0.875rem;
    border: 1px solid;
    outline: none;
    box-sizing: border-box;
}

.message-input-field:focus {
    outline: none;
    box-shadow: 0 0 0 2px currentColor;
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
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: none;
    transition: all 0.2s;
    cursor: pointer;
}

.message-send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.theme-fleety .message-send-button {
    background: #facc15;
    color: #000;
}

.theme-fleety .message-send-button:hover:not(:disabled) {
    background: #fde047;
}

.theme-material .message-send-button {
    background: #2563eb;
    color: #fff;
}

.theme-material .message-send-button:hover:not(:disabled) {
    background: #1d4ed8;
}

.theme-midnight .message-send-button {
    background: #9333ea;
    color: #fff;
}

.theme-midnight .message-send-button:hover:not(:disabled) {
    background: #7e22ce;
}

.send-icon {
    width: 1rem;
    height: 1rem;
}

.spinner-icon {
    width: 1.25rem;
    height: 1.25rem;
    animation: spin 1s linear infinite;
}
`;

// API Configuration
const API_URL = "http://localhost:8080/v1";

// === Type Definitions ===
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

interface SavedTicket {
    slug: string;
    title: string;
    status: string;
    unreadCount?: number;
}

interface SupportTicketWidgetProps {
    projectId: string;
    theme?: 'fleety' | 'material' | 'midnight';
    dockPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    onOpen?: (handler: (options?: OpenOptions) => void) => void;
}

interface OpenOptions {
    view?: 'list' | 'create' | 'view';
    prefillDescription?: string;
    prefillTitle?: string;
}

// === WebSocket Service ===
class TicketWebSocketService {
    private connections: Map<string, WebSocket> = new Map();
    private callbacks: Map<string, Set<TicketWSCallback>> = new Map();
    private reconnectAttempts: Map<string, number> = new Map();
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private connecting: Map<string, Promise<WebSocket>> = new Map();

    connect(projectId: string, ticketSlug: string, callback: TicketWSCallback): () => void {
        const key = `${projectId}/${ticketSlug}`;

        if (!this.callbacks.has(key)) {
            this.callbacks.set(key, new Set());
        }
        this.callbacks.get(key)!.add(callback);

        if (this.connections.has(key)) {
            return () => this.removeCallback(key, callback);
        }

        if (this.connecting.has(key)) {
            return () => this.removeCallback(key, callback);
        }

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
        return () => this.removeCallback(key, callback);
    }

    disconnect(projectId: string, ticketSlug: string): void {
        const key = `${projectId}/${ticketSlug}`;
        const ws = this.connections.get(key);
        if (ws) {
            this.reconnectAttempts.delete(key);
            ws.close();
            this.connections.delete(key);
            this.callbacks.delete(key);
        }
    }

    disconnectAll(): void {
        this.connections.forEach((ws) => ws.close());
        this.connections.clear();
        this.callbacks.clear();
        this.reconnectAttempts.clear();
        this.connecting.clear();
    }

    send(projectId: string, ticketSlug: string, message: any): void {
        const key = `${projectId}/${ticketSlug}`;
        const ws = this.connections.get(key);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    private removeCallback(key: string, callback: TicketWSCallback): void {
        const callbacks = this.callbacks.get(key);
        if (callbacks) {
            callbacks.delete(callback);
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

    private notifyCallbacks(key: string, message: WSMessage): void {
        const callbacks = this.callbacks.get(key);
        if (callbacks) {
            callbacks.forEach(callback => callback(message));
        }
    }

    private attemptReconnect(projectId: string, ticketSlug: string): void {
        const key = `${projectId}/${ticketSlug}`;
        const attempts = this.reconnectAttempts.get(key) || 0;

        if (attempts >= this.maxReconnectAttempts) {
            console.log(`Max reconnection attempts reached for ticket: ${ticketSlug}`);
            this.reconnectAttempts.delete(key);
            return;
        }

        const callbacks = this.callbacks.get(key);
        if (!callbacks || callbacks.size === 0) {
            this.reconnectAttempts.delete(key);
            return;
        }

        const delay = this.reconnectDelay * Math.pow(2, attempts);
        console.log(`Reconnecting to ticket ${ticketSlug} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.reconnectAttempts.set(key, attempts + 1);
            const existingCallbacks = Array.from(callbacks);
            this.callbacks.delete(key);
            existingCallbacks.forEach(callback => {
                this.connect(projectId, ticketSlug, callback);
            });
        }, delay);
    }
}

const ticketWS = new TicketWebSocketService();

// === API Functions ===
async function createTicket(data: CreateTicketRequest): Promise<Ticket> {
    const response = await fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const retryMessage = retryAfter 
                ? `Please wait ${retryAfter} seconds before creating another ticket.` 
                : 'Please wait before creating another ticket.';
            throw new Error(`rate_limit:${result.message || 'You\'re creating tickets too fast.'} ${retryMessage}`);
        }
        if (response.status === 402) {
            throw new Error(`credits_depleted:${result.message || 'This project has run out of credits. AI features are disabled.'}`);
        }
        throw new Error(result.error || 'Failed to create ticket');
    }
    return result;
}

async function getTicket(projectId: string, slug: string, token?: string): Promise<Ticket> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_URL}/tickets/${projectId}/${slug}`, { headers });
    const result = await response.json();
    if (!response.ok) {
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const retryMessage = retryAfter 
                ? `Please wait ${retryAfter} seconds before trying again.` 
                : 'Please wait before trying again.';
            throw new Error(`rate_limit:${result.message || 'You\'re sending requests too fast.'} ${retryMessage}`);
        }
        if (response.status === 402) {
            throw new Error(`credits_depleted:${result.message || 'This project has run out of credits. AI features are disabled.'}`);
        }
        throw new Error(result.error || 'Failed to fetch ticket');
    }
    return result;
}

async function addMessage(projectId: string, slug: string, data: AddMessageRequest, token?: string): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_URL}/tickets/${projectId}/${slug}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const retryMessage = retryAfter 
                ? `Please wait ${retryAfter} seconds before sending another message.` 
                : 'Please wait before sending another message.';
            throw new Error(`rate_limit:${result.message || 'You\'re sending messages too fast.'} ${retryMessage}`);
        }
        if (response.status === 402) {
            throw new Error(`credits_depleted:${result.message || 'This project has run out of credits. AI features are disabled.'}`);
        }
        throw new Error(result.error || 'Failed to add message');
    }
}

async function markMessagesAsRead(projectId: string, slug: string, reader: 'user' | 'admin'): Promise<void> {
    const response = await fetch(`${API_URL}/tickets/${projectId}/${slug}/messages/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reader })
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Failed to mark messages as read');
    }
}

// === Main Component ===
const SupportTicketWidget: React.FC<SupportTicketWidgetProps> = ({
    projectId,
    theme = 'fleety',
    dockPosition = 'bottom-left',
    onOpen: onOpenProp
}) => {
    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'list' | 'create' | 'view'>(() => {
        const saved = localStorage.getItem('supportTickets');
        return saved && JSON.parse(saved).length > 0 ? 'list' : 'create';
    });

    // Ticket Creation
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    // Ticket Viewing
    const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
    const [ticketSlug, setTicketSlug] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [messageError, setMessageError] = useState('');
    const [isLoadingTicket, setIsLoadingTicket] = useState(false);
    const [ticketError, setTicketError] = useState('');

    // Saved tickets (stored in localStorage)
    const [savedTickets, setSavedTickets] = useState<SavedTicket[]>(() => {
        const saved = localStorage.getItem('supportTickets');
        return saved ? JSON.parse(saved) : [];
    });

    // Calculate total unread messages across all tickets
    const totalUnreadCount = savedTickets.reduce((sum, ticket) => sum + (ticket.unreadCount || 0), 0);

    // Chat dimensions
    const [chatWidth, setChatWidth] = useState(380);
    const [chatHeight, setChatHeight] = useState(500);
    const minWidth = 320;
    const maxWidth = 600;
    const minHeight = 400;
    const maxHeight = 700;
    const [isResizing, setIsResizing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // WebSocket
    const wsUnsubscribe = useRef<(() => void) | null>(null);
    const wsUnsubscribes = useRef(new Map<string, () => void>());

    // Auto-scroll
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Responsive positioning
    const [isMobile, setIsMobile] = useState(false);

    const scrollToBottom = () => {
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    const saveTicketToList = (ticket: Ticket) => {
        const unreadCount = ticket.messages.filter(msg =>
            msg.author === 'admin' && !msg.read_by?.includes('user')
        ).length;

        const ticketInfo: SavedTicket = {
            slug: ticket.slug,
            title: ticket.title,
            status: ticket.status,
            unreadCount
        };

        setSavedTickets(prevSavedTickets => {
            const newSavedTickets = [ticketInfo, ...prevSavedTickets.filter(t => t.slug !== ticket.slug)];
            localStorage.setItem('supportTickets', JSON.stringify(newSavedTickets));
            return newSavedTickets;
        });

        if (!wsUnsubscribes.current.has(ticket.slug)) {
            const unsubscribe = ticketWS.connect(projectId, ticket.slug, (message) => handleBackgroundWebSocketMessage(ticket.slug, message));
            wsUnsubscribes.current.set(ticket.slug, unsubscribe);
        }
    };

    const handleBackgroundWebSocketMessage = async (ticketSlug: string, message: WSMessage) => {
        if (isOpen && currentTicket && currentTicket.slug === ticketSlug && currentView === 'view') {
            return;
        }

        switch (message.type) {
            case 'ticket_update':
            case 'new_message':
            case 'status_change':
                try {
                    const updated = await getTicket(projectId, ticketSlug);
                    const unreadCount = updated.messages.filter(msg =>
                        msg.author === 'admin' && !msg.read_by?.includes('user')
                    ).length;

                    setSavedTickets(prev => {
                        const newTickets = prev.map(t =>
                            t.slug === ticketSlug
                                ? { ...t, status: updated.status, unreadCount }
                                : t
                        );
                        localStorage.setItem('supportTickets', JSON.stringify(newTickets));
                        return newTickets;
                    });
                } catch (err) {
                    console.error('Error refreshing background ticket:', err);
                }
                break;
        }
    };

    const handleCreateTicket = async () => {
        if (!title.trim() || !description.trim()) {
            setCreateError('Please fill in all fields');
            return;
        }

        setIsCreating(true);
        setCreateError('');

        try {
            const ticket = await createTicket({
                project_id: projectId,
                title: title.trim(),
                description: description.trim()
            });

            saveTicketToList(ticket);
            setCurrentTicket(ticket);
            setCurrentView('view');
            setTitle('');
            setDescription('');
            wsUnsubscribe.current = ticketWS.connect(projectId, ticket.slug, handleWebSocketMessage);
        } catch (error: any) {
            const errorMsg = error.message || 'Failed to create ticket';
            setCreateError(errorMsg.includes('rate_limit:')
                ? '⏰ ' + errorMsg.replace('rate_limit:', '')
                : errorMsg.includes('credits_depleted:')
                    ? '💳 ' + errorMsg.replace('credits_depleted:', '')
                    : errorMsg);
        } finally {
            setIsCreating(false);
        }
    };

    const handleWebSocketMessage = (message: WSMessage) => {
        if (!currentTicket) return;

        console.log('WebSocket message received:', message);

        switch (message.type) {
            case 'ticket_update':
                setCurrentTicket(message.payload as Ticket);
                saveTicketToList(message.payload as Ticket);
                scrollToBottom();
                markMessagesAsRead(projectId, (message.payload as Ticket).slug, 'user').catch(err =>
                    console.error('Error marking messages as read:', err)
                );
                break;
            case 'new_message':
            case 'status_change':
                refreshCurrentTicket();
                break;
        }
    };

    const refreshCurrentTicket = async () => {
        if (!currentTicket) return;

        try {
            const updated = await getTicket(projectId, currentTicket.slug);
            setCurrentTicket(updated);
            saveTicketToList(updated);
            scrollToBottom();
            await markMessagesAsRead(projectId, currentTicket.slug, 'user');
            setSavedTickets(prev => {
                const newTickets = prev.map(t =>
                    t.slug === currentTicket.slug ? { ...t, unreadCount: 0 } : t
                );
                localStorage.setItem('supportTickets', JSON.stringify(newTickets));
                return newTickets;
            });
        } catch (err) {
            console.error('Error refreshing ticket:', err);
        }
    };

    const handleLoadTicket = async (slug: string) => {
        if (!slug.trim()) return;

        if (wsUnsubscribe.current) {
            wsUnsubscribe.current();
            wsUnsubscribe.current = null;
        }

        setIsLoadingTicket(true);
        setTicketError('');

        try {
            const ticket = await getTicket(projectId, slug.trim());
            setCurrentTicket(ticket);
            setCurrentView('view');
            saveTicketToList(ticket);

            try {
                await markMessagesAsRead(projectId, slug.trim(), 'user');
                const refreshed = await getTicket(projectId, slug.trim());
                setCurrentTicket(refreshed);
                setSavedTickets(prev => {
                    const newTickets = prev.map(t =>
                        t.slug === slug.trim() ? { ...t, unreadCount: 0, status: refreshed.status } : t
                    );
                    localStorage.setItem('supportTickets', JSON.stringify(newTickets));
                    return newTickets;
                });
            } catch (readErr) {
                console.error('Error marking messages as read:', readErr);
            }

            wsUnsubscribe.current = ticketWS.connect(projectId, slug.trim(), handleWebSocketMessage);
            scrollToBottom();
        } catch (error: any) {
            const errorMsg = error.message || 'Failed to load ticket';
            setTicketError(errorMsg.includes('rate_limit:')
                ? '⏰ ' + errorMsg.replace('rate_limit:', '')
                : errorMsg.includes('credits_depleted:')
                    ? '💳 ' + errorMsg.replace('credits_depleted:', '')
                    : errorMsg);
        } finally {
            setIsLoadingTicket(false);
        }
    };

    const handleSendMessage = async () => {
        if (!messageContent.trim() || !currentTicket) return;

        setIsSendingMessage(true);
        setMessageError('');

        const userMessage = messageContent.trim();

        const optimisticMessage: TicketMessage = {
            id: `temp-${Date.now()}`,
            author: 'user',
            content: userMessage,
            timestamp: new Date().toISOString(),
            read_by: ['user']
        };

        setCurrentTicket(prev => prev ? { ...prev, messages: [...prev.messages, optimisticMessage] } : null);
        setMessageContent('');
        scrollToBottom();

        try {
            await addMessage(projectId, currentTicket.slug, {
                author: 'user',
                content: userMessage
            });
            scrollToBottom();
        } catch (error: any) {
            setCurrentTicket(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== optimisticMessage.id) } : null);
            setMessageContent(userMessage);
            const errorMsg = error.message || 'Failed to send message';
            setMessageError(errorMsg.includes('rate_limit:')
                ? '⏰ ' + errorMsg.replace('rate_limit:', '')
                : errorMsg.includes('credits_depleted:')
                    ? '💳 ' + errorMsg.replace('credits_depleted:', '')
                    : errorMsg);
        } finally {
            setIsSendingMessage(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        if (wsUnsubscribe.current) {
            wsUnsubscribe.current();
            wsUnsubscribe.current = null;
        }
    };

    const handleOpen = useCallback((options?: OpenOptions) => {
        setIsOpen(true);
        if (options?.view) setCurrentView(options.view);
        if (options?.prefillDescription) setDescription(options.prefillDescription);
        if (options?.prefillTitle) setTitle(options.prefillTitle);
        refreshUnreadCounts();
        if (currentView === 'view' && currentTicket && !wsUnsubscribe.current) {
            wsUnsubscribe.current = ticketWS.connect(projectId, currentTicket.slug, handleWebSocketMessage);
        }
    }, [projectId, currentTicket, currentView]);

    const refreshUnreadCounts = async () => {
        for (const ticket of savedTickets) {
            try {
                const updated = await getTicket(projectId, ticket.slug);
                const unreadCount = updated.messages.filter(msg =>
                    msg.author === 'admin' && !msg.read_by?.includes('user')
                ).length;

                setSavedTickets(prev => prev.map(t =>
                    t.slug === ticket.slug ? { ...t, unreadCount } : t
                ));
            } catch (err) {
                console.error('Error refreshing ticket:', err);
            }
        }
        localStorage.setItem('supportTickets', JSON.stringify(savedTickets));
    };

    const goToList = () => {
        setCurrentView('list');
        setCurrentTicket(null);
        if (wsUnsubscribe.current) {
            wsUnsubscribe.current();
            wsUnsubscribe.current = null;
        }
    };

    const goToCreate = () => {
        setCurrentView('create');
        setCreateError('');
    };

    const formatDate = (dateString: string): string => {
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
    };

    const getAuthorDisplayName = (author: string): string => {
        if (author === 'user') return 'You';
        if (author === 'system') return 'System';
        if (author === 'admin') return 'Support';
        return author;
    };

    const getStatusLabel = (status: string): string => {
        return status.replace('_', ' ').toUpperCase();
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const getResizeHandles = (position: typeof dockPosition): { corner: 'nw' | 'ne' | 'sw' | 'se'; edges: ('n' | 's' | 'w' | 'e')[] } => {
        switch (position) {
            case 'bottom-right': return { corner: 'nw', edges: ['n', 'w'] };
            case 'bottom-left': return { corner: 'ne', edges: ['n', 'e'] };
            case 'top-right': return { corner: 'sw', edges: ['s', 'w'] };
            case 'top-left': return { corner: 'se', edges: ['s', 'e'] };
        }
    };

    const startResize = (event: React.MouseEvent, direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e') => {
        setIsResizing(true);
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = chatWidth;
        const startHeight = chatHeight;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            let newWidth = startWidth;
            let newHeight = startHeight;

            if (direction.includes('w')) newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
            else if (direction.includes('e')) newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));

            if (direction.includes('n')) newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
            else if (direction.includes('s')) newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));

            setChatWidth(newWidth);
            setChatHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const saved = localStorage.getItem('supportTickets');
        if (saved) setSavedTickets(JSON.parse(saved));

        const handleTicketCreated = (event: Event) => {
            const customEvent = event as CustomEvent<{ ticketSlug: string }>;
            console.log('🎫 SupportTicketWidget received ticket-created event:', customEvent.detail.ticketSlug);
            setIsOpen(true);
            handleLoadTicket(customEvent.detail.ticketSlug);
        };
        window.addEventListener('ticket-created', handleTicketCreated as EventListener);

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (isOpen && !target.closest('.ticket-widget') && !target.closest('.ticket-fab')) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);

        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('ticket-created', handleTicketCreated as EventListener);
            document.removeEventListener('click', handleClickOutside);
            wsUnsubscribes.current.forEach((unsubscribe) => unsubscribe());
            wsUnsubscribes.current.clear();
        };
    }, [isOpen]);

    useEffect(() => {
        if (onOpenProp) {
            onOpenProp(handleOpen);
        }
    }, [onOpenProp, handleOpen]);

    useEffect(() => {
        savedTickets.forEach(ticket => {
            if (!wsUnsubscribes.current.has(ticket.slug)) {
                const unsubscribe = ticketWS.connect(projectId, ticket.slug, (message) => handleBackgroundWebSocketMessage(ticket.slug, message));
                wsUnsubscribes.current.set(ticket.slug, unsubscribe);
            }
        });
    }, [savedTickets, projectId]);

    const resizeHandles = getResizeHandles(dockPosition);

    return (
        <>
            <style>{styles}</style>
            {/* Floating Action Button */}
            <button
                onClick={(e) => { e.stopPropagation(); isOpen ? handleClose() : handleOpen(); }}
                className={`ticket-fab theme-${theme} dock-${dockPosition} ${isMobile ? 'mobile' : 'desktop'}`}
                aria-label={isOpen ? "Close Support Tickets" : "Open Support Tickets"}
            >
                <div className="fab-icon-wrapper">
                    <div className={`icon-container ${isOpen ? 'open' : ''}`}>
                        <svg className="icon icon-default" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <svg className="icon icon-close" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    {totalUnreadCount > 0 && !isOpen && <div className="unread-indicator"></div>}
                </div>
            </button>

            {/* Chat Widget */}
            {isOpen && (
                <div
                    className={`ticket-widget theme-${theme} dock-${dockPosition} ${isMobile ? 'mobile' : 'desktop'} ${isResizing ? 'resizing' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
                    style={isFullscreen ? {} : { width: `${chatWidth}px`, height: `${chatHeight}px` }}
                    role="dialog"
                    aria-label="Support tickets"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    {!isFullscreen && (
                        <>
                            <div
                                role="button"
                                tabIndex={0}
                                onMouseDown={(e) => startResize(e, resizeHandles.corner)}
                                className={`resize-handle corner-${resizeHandles.corner}`}
                                title="Resize widget"
                            />
                            {resizeHandles.edges.map(edge => (
                                <div
                                    key={edge}
                                    role="button"
                                    tabIndex={0}
                                    onMouseDown={(e) => startResize(e, edge)}
                                    className={`resize-handle edge-${edge}`}
                                    title={`Resize ${edge === 'n' || edge === 's' ? 'height' : 'width'}`}
                                />
                            ))}
                        </>
                    )}

                    <div className="widget-header">
                        <div className="header-left">
                            {currentView !== 'list' && (
                                <button onClick={goToList} className="back-button" aria-label="Back to list">
                                    <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <h3 className="header-title">
                                {currentView === 'list' && 'Support Tickets'}
                                {currentView === 'create' && 'Create Ticket'}
                                {currentView === 'view' && currentTicket && (
                                    <span className="ticket-title-sm">{currentTicket.title}</span>
                                )}
                            </h3>
                        </div>
                        <div className="header-right">
                            <button onClick={toggleFullscreen} className="fullscreen-button" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                                {isFullscreen ? (
                                    <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                )}
                            </button>
                            <button onClick={handleClose} className="close-button" aria-label="Minimize">
                                <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="widget-content">
                        {currentView === 'list' && (
                            <div className="ticket-list-view">
                                <div className="ticket-list-content">
                                    <button onClick={goToCreate} className="create-ticket-button">
                                        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                        Create New Ticket
                                    </button>

                                    {savedTickets.length > 0 ? (
                                        <div className="tickets-section">
                                            <h4 className="section-title">Your Tickets</h4>
                                            {savedTickets.map(ticket => (
                                                <button
                                                    key={ticket.slug}
                                                    onClick={() => handleLoadTicket(ticket.slug)}
                                                    className="ticket-card"
                                                >
                                                    <div className="ticket-card-content">
                                                        <div className="ticket-card-left">
                                                            {ticket.unreadCount !== undefined && ticket.unreadCount > 0 && (
                                                                <div className="unread-dot" title={`${ticket.unreadCount} unread message${ticket.unreadCount > 1 ? 's' : ''}`}></div>
                                                            )}
                                                            <div className="ticket-info">
                                                                <p className="ticket-title">{ticket.title}</p>
                                                                <p className="ticket-slug">#{ticket.slug}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`status-badge status-${ticket.status}`}>
                                                            {getStatusLabel(ticket.status)}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <p>No tickets yet</p>
                                        </div>
                                    )}
                                </div>

                                <div className="load-by-slug-section">
                                    <h4 className="section-title">Have a ticket ID?</h4>
                                    <div className="slug-input-wrapper">
                                        <input
                                            type="text"
                                            value={ticketSlug}
                                            onChange={(e) => setTicketSlug(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && ticketSlug.trim() && !isLoadingTicket) {
                                                    handleLoadTicket(ticketSlug);
                                                }
                                            }}
                                            placeholder="Enter ticket ID"
                                            className="slug-input"
                                        />
                                        <button
                                            onClick={() => handleLoadTicket(ticketSlug)}
                                            disabled={!ticketSlug.trim() || isLoadingTicket}
                                            className="load-button"
                                        >
                                            {isLoadingTicket ? '...' : 'Load'}
                                        </button>
                                    </div>
                                    {ticketError && (
                                        <div className="error-message">
                                            <p>{ticketError}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {currentView === 'create' && (
                            <div className="create-ticket-view">
                                <div className="create-form">
                                    <div className="form-field">
                                        <label htmlFor="ticket-title" className="form-label">Title</label>
                                        <input
                                            id="ticket-title"
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Brief summary of your issue"
                                            maxLength={200}
                                            className="form-input"
                                        />
                                    </div>

                                    <div className="form-field form-field-flex">
                                        <label htmlFor="ticket-description" className="form-label">Description</label>
                                        <textarea
                                            id="ticket-description"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Provide detailed information about your issue..."
                                            maxLength={5000}
                                            className="form-textarea form-textarea-flex"
                                        />
                                        <p className="char-counter">
                                            {description.length}/5000 characters
                                        </p>
                                    </div>

                                    {createError && (
                                        <div className="error-message">
                                            <p>{createError}</p>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleCreateTicket}
                                        disabled={isCreating || !title.trim() || !description.trim()}
                                        className="submit-button"
                                    >
                                        {isCreating ? 'Creating...' : 'Create Ticket'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentView === 'view' && currentTicket && (
                            <div className="view-ticket-container">
                                <div className="ticket-info-header">
                                    <div className="ticket-info-content">
                                        <div className="ticket-slug-wrapper">
                                            <p className="ticket-slug-text">#{currentTicket.slug}</p>
                                        </div>
                                        <span className={`status-badge status-${currentTicket.status}`}>
                                            {getStatusLabel(currentTicket.status)}
                                        </span>
                                    </div>
                                    <p className="ticket-description">{currentTicket.description}</p>
                                </div>

                                <div className="messages-list">
                                    {currentTicket.messages.map(message => (
                                        message.type === 'status_change' && message.author === 'system' ? (
                                            <div key={message.id} className="system-message-wrapper">
                                                <div className="system-message-container">
                                                    <div className="connector-line-top"></div>
                                                    <div className="system-message">
                                                        <div className="system-message-content">
                                                            <div className="status-icon-wrapper">
                                                                <svg className="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                                </svg>
                                                            </div>
                                                            <span className="system-message-text">{message.content}</span>
                                                        </div>
                                                        <div className="system-message-timestamp">
                                                            {formatDate(message.timestamp)}
                                                        </div>
                                                    </div>
                                                    <div className="connector-line-bottom"></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={message.id} className={`chat-message ${message.author}`}>
                                                <div className="message-bubble-wrapper">
                                                    <div className={`message-bubble ${message.author}`}>
                                                        <p className="message-text">{message.content}</p>
                                                    </div>
                                                    <p className={`message-meta ${message.author}`}>
                                                        <span>{getAuthorDisplayName(message.author)} · {formatDate(message.timestamp)}</span>
                                                        {message.author === 'user' && message.read_by?.includes('admin') && (
                                                            <svg className="read-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    ))}
                                    <div ref={messagesEndRef}></div>
                                </div>

                                <div className="message-input-area">
                                    {messageError && (
                                        <div className="error-message">
                                            <p>{messageError}</p>
                                        </div>
                                    )}
                                    <div className="message-input-wrapper">
                                        <input
                                            type="text"
                                            value={messageContent}
                                            onChange={(e) => setMessageContent(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && !isSendingMessage && handleSendMessage()}
                                            placeholder="Type your message..."
                                            disabled={isSendingMessage}
                                            className="message-input-field"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!messageContent.trim() || isSendingMessage}
                                            className="message-send-button"
                                        >
                                            {isSendingMessage ? (
                                                <svg className="spinner-icon" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <svg className="send-icon" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default SupportTicketWidget;
