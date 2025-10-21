import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';

// === Component Styles ===
const chatStyles = `
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

.icon-container {
  position: relative;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-button .icon {
  width: 1.5rem;
  height: 1.5rem;
  position: absolute;
  top: 50%;
  left: 50%;
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

.chat-container.fullscreen {
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

.chat-container.dock-bottom-right {
  bottom: 5.5rem;
  right: 1.5rem;
}

.chat-container.dock-bottom-left {
  bottom: 5.5rem;
  left: 1.5rem;
}

.chat-container.dock-top-right {
  top: 5.5rem;
  right: 1.5rem;
}

.chat-container.dock-top-left {
  top: 5.5rem;
  left: 1.5rem;
}

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

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 0.5rem 0.5rem 0 0;
  padding: 0.5rem 0.75rem;
  transition: all 0.2s;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.fullscreen-button {
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  color: inherit;
}

.fullscreen-button:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.header-title {
  font-weight: 600;
  font-size: 0.875rem;
}

.minimize-button {
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  color: inherit;
}

.minimize-button:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}

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

.message-content {
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.5;
  text-align: left;
}

.message-content h1 {
  font-size: 1.5em;
  font-weight: bold;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  line-height: 1.3;
}

.message-content h2 {
  font-size: 1.3em;
  font-weight: bold;
  margin-top: 0.5em;
  margin-bottom: 0.4em;
  line-height: 1.3;
}

.message-content h3 {
  font-size: 1.1em;
  font-weight: bold;
  margin-top: 0.4em;
  margin-bottom: 0.3em;
  line-height: 1.3;
}

.message-content p {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
  line-height: 1.5;
}

.message-content ul,
.message-content ol {
  margin-left: 1.25em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  padding-left: 0.5em;
}

.message-content li {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
  line-height: 1.4;
}

.message-content ul li {
  list-style-type: disc;
}

.message-content ol li {
  list-style-type: decimal;
}

.message-content strong {
  font-weight: 700;
}

.message-content em {
  font-style: italic;
}

.message-content .blockquote-wrapper {
  position: relative;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.message-content .message-blockquote {
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

.message-content .copy-quote-btn {
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

.message-content.dark .copy-quote-btn:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.message-content.light .copy-quote-btn:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.08);
}

.message-content .copy-quote-btn .copy-icon {
  transition: opacity 0.2s;
}

.message-content .message-link {
  text-decoration: underline;
  opacity: 0.9;
  transition: opacity 0.2s;
  font-weight: 500;
}

.message-content .message-link:hover {
  opacity: 1;
  text-decoration: underline;
}

.message-content.dark .message-inline-code {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.message-content.light .message-inline-code {
  background-color: rgba(0, 0, 0, 0.08);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.message-content .inline-code-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  position: relative;
}

.message-content .copy-inline-btn {
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

.message-content .inline-code-wrapper:hover .copy-inline-btn {
  opacity: 0.7;
}

.message-content.dark .copy-inline-btn:hover {
  opacity: 1 !important;
  background-color: rgba(255, 255, 255, 0.15);
}

.message-content.light .copy-inline-btn:hover {
  opacity: 1 !important;
  background-color: rgba(0, 0, 0, 0.1);
}

.message-content .copy-inline-btn .copy-icon {
  transition: all 0.2s;
}

.message-content .code-block-wrapper {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  border-radius: 6px;
  overflow: hidden;
}

.message-content.dark .code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4em 0.75em;
  background-color: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.message-content.light .code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4em 0.75em;
  background-color: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.message-content .code-language {
  font-size: 0.75em;
  text-transform: uppercase;
  opacity: 0.6;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.message-content .copy-code-btn {
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

.message-content.dark .copy-code-btn:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.message-content.light .copy-code-btn:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.08);
}

.message-content .copy-icon {
  width: 14px;
  height: 14px;
}

.message-content.dark .message-code-block {
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-top: none;
  padding: 0.75em;
  border-radius: 0 0 6px 6px;
  overflow-x: auto;
  margin: 0;
}

.message-content.light .message-code-block {
  background-color: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-top: none;
  padding: 0.75em;
  border-radius: 0 0 6px 6px;
  overflow-x: auto;
  margin: 0;
}

.message-content .message-code-block code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  line-height: 1.5;
}

.message-content hr {
  border: none;
  border-top: 1px solid currentColor;
  opacity: 0.3;
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

.message-content table {
  border-collapse: collapse;
  width: 100%;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  font-size: 0.95em;
}

.message-content.dark table th,
.message-content.dark table td {
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.4em 0.6em;
}

.message-content.light table th,
.message-content.light table td {
  border: 1px solid rgba(0, 0, 0, 0.2);
  padding: 0.4em 0.6em;
}

.message-content.dark table th {
  background-color: rgba(255, 255, 255, 0.05);
  font-weight: 600;
}

.message-content.light table th {
  background-color: rgba(0, 0, 0, 0.03);
  font-weight: 600;
}

.message-content > *:first-child {
  margin-top: 0;
}

.message-content > *:last-child {
  margin-bottom: 0;
}
`;

// === Type Definitions ===
interface SupportChatProps {
    projectId: string;
    theme?: 'fleety' | 'material' | 'midnight';
    dockPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
}

interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ToolResponse {
    type: 'tool_call' | 'message';
    message: string;
    ticket_slug?: string;
}

interface ChatStreamResponse {
    choices: Array<{
        delta?: {
            content?: string;
        };
    }>;
}

// === Main Component ===
const SupportChat: React.FC<SupportChatProps> = ({
    projectId,
    theme = 'fleety',
    dockPosition = 'bottom-right'
}) => {
    // Fleety API Configuration
    const API_URL = "http://localhost:8080/v1";

    // State for anonymous session
    const [anonToken, setAnonToken] = useState('');
    const [, setTokenExpiresAt] = useState<Date | null>(null);
    const [, setSessionError] = useState('');

    // Conversation history for context
    const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [chatWidth, setChatWidth] = useState(380);
    const [chatHeight, setChatHeight] = useState(500);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const minWidth = 320;
    const maxWidth = 600;
    const minHeight = 400;
    const maxHeight = 700;

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputElementRef = useRef<HTMLInputElement>(null);

    // Configure marked options
    useEffect(() => {
        marked.setOptions({
            breaks: true,
            gfm: true,
        });
    }, []);

    // Custom renderer for better control
    const renderer = new marked.Renderer();

    // Override link rendering to add target="_blank" for external links
    renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
        const titleAttr = title ? ` title="${title}"` : '';
        const isExternal = href?.startsWith('http') || href?.startsWith('https');
        const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${href}"${titleAttr}${target} class="message-link">${text}</a>`;
    };

    // Override code rendering
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
        const language = lang || 'text';
        const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
        const escapedText = escapeHtml(text);
        return `<div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-language">${language}</span>
        <button class="copy-code-btn" data-code-id="${codeId}" onclick="window.copyCode('${codeId}')">
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
      <button class="copy-inline-btn" data-inline-id="${codeId}" onclick="window.copyInlineCode('${codeId}')" title="Copy code">
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
        <button class="copy-quote-btn" data-quote-id="${quoteId}" onclick="window.copyQuote('${quoteId}')">
          <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </blockquote>
    </div>`;
    };

    // Escape HTML to prevent XSS
    const escapeHtml = (text: string): string => {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    };

    // Parse markdown content
    const parseMarkdown = (text: string): string => {
        try {
            return marked(text, { renderer }) as string;
        } catch (error) {
            console.error('Error parsing markdown:', error);
            return escapeHtml(text);
        }
    };

    const formatMessageContent = (content: string, isUser: boolean): string => {
        if (isUser) {
            return escapeHtml(content).replace(/\n/g, '<br>');
        } else {
            return parseMarkdown(content);
        }
    };

    // Initialize an anonymous session
    const initializeSession = async () => {
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
                credentials: 'include',
                body: JSON.stringify({ project_id: projectId })
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('❌ Session initialization failed:', response.status, result);
                throw new Error(result.error || 'Failed to initialize session');
            }

            setAnonToken(result.token);
            setTokenExpiresAt(new Date(result.expires_at));
            setSessionError('');

            console.log('✅ Fleety chat session initialized');
            console.log('Token expires at:', new Date(result.expires_at));
            console.log('Project ID:', result.project_id);

            // Auto-renew token before expiration (4 minutes)
            setTimeout(() => {
                console.log('🔄 Token expiring soon, renewing...');
                initializeSession();
            }, 4 * 60 * 1000);

        } catch (err) {
            setSessionError(err instanceof Error ? err.message : 'Unknown error');
            console.error('❌ Session initialization error:', err);
        }
    };

    const toggleChat = () => {
        setIsOpen(!isOpen);
        if (!isOpen && messages.length === 0) {
            addAIMessage("👋 Welcome to Fleety support! I'm here to help you. Ask me anything!");

            if (!anonToken) {
                initializeSession();
            }
        }

        if (!isOpen) {
            setTimeout(() => {
                inputElementRef.current?.focus();
            }, 100);
        }
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const addMessage = (text: string, isUser: boolean) => {
        const message: Message = {
            id: Date.now().toString(),
            text,
            isUser,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);

        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        }, 100);
    };

    const addAIMessage = (text: string) => {
        addMessage(text, false);
    };

    // const clearConversation = () => {
    //     setMessages([]);
    //     setConversationHistory([]);
    //     console.log('🗑️ Conversation history cleared');
    // };

    const sendMessage = async () => {
        if (!currentMessage.trim()) return;

        const userMessage = currentMessage.trim();
        addMessage(userMessage, true);

        setConversationHistory(prev => [...prev, {
            role: 'user',
            content: userMessage
        }]);

        setCurrentMessage('');

        if (!anonToken) {
            console.log('⚠️ No session token, initializing...');
            await initializeSession();

            if (!anonToken) {
                addAIMessage("⚠️ Unable to connect to chat service. Please try again later.");
                return;
            }
        }

        setIsTyping(true);

        try {
            console.log('📤 Sending chat message with history...');

            const response = await fetch(`${API_URL}/chat/tools`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${anonToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: conversationHistory.concat([{ role: 'user', content: userMessage }]),
                    enable_tool_calling: true
                })
            });

            console.log('📥 Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Chat request failed:', response.status, errorData);

                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const retryMessage = retryAfter
                        ? `Please wait ${retryAfter} seconds before trying again.`
                        : 'Please wait a moment before trying again.';
                    throw new Error(`rate_limit:${errorData.message || 'You\'re sending requests too fast.'} ${retryMessage}`);
                }

                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                const toolResponse: ToolResponse = await response.json();

                if (toolResponse.type === 'tool_call') {
                    console.log('🎫 Ticket created:', toolResponse.ticket_slug);
                    addAIMessage(toolResponse.message);

                    const event = new CustomEvent('ticket-created', {
                        detail: { ticketSlug: toolResponse.ticket_slug },
                        bubbles: true,
                        composed: true
                    });
                    window.dispatchEvent(event);
                    console.log('📢 Dispatched ticket-created event:', toolResponse.ticket_slug);

                    setIsTyping(false);
                    return;
                } else if (toolResponse.type === 'message') {
                    addAIMessage(toolResponse.message);
                    setIsTyping(false);
                    return;
                }
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let aiResponse = '';
            let messageId = Date.now().toString();

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log('✅ Stream complete');
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            console.log('✅ Received [DONE] signal');
                            setIsTyping(false);
                            return;
                        }

                        try {
                            const parsed: ChatStreamResponse = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || '';

                            if (content) {
                                aiResponse += content;

                                setMessages(prev => {
                                    const existingIndex = prev.findIndex(m => m.id === messageId);
                                    if (existingIndex !== -1) {
                                        const updated = [...prev];
                                        updated[existingIndex] = {
                                            ...updated[existingIndex],
                                            text: aiResponse
                                        };
                                        return updated;
                                    } else {
                                        return [...prev, {
                                            id: messageId,
                                            text: aiResponse,
                                            isUser: false,
                                            timestamp: new Date()
                                        }];
                                    }
                                });

                                setTimeout(() => {
                                    if (chatContainerRef.current) {
                                        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                                    }
                                }, 10);
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }

            if (aiResponse) {
                setConversationHistory(prev => [...prev, {
                    role: 'assistant',
                    content: aiResponse
                }]);
                console.log('✅ Added AI response to conversation history');
            }

        } catch (err) {
            const error = err instanceof Error ? err.message : 'Failed to send message';
            console.error('❌ Chat error:', err);

            if (error.includes('rate_limit:')) {
                const message = error.replace('rate_limit:', '');
                addAIMessage(`⏰ ${message}`);
            } else if (error.includes('401') || error.includes('expired')) {
                console.log('🔄 Token expired, reinitializing session...');
                setAnonToken('');
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
            setIsTyping(false);
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    const getResizeHandles = (position: typeof dockPosition): { corner: 'nw' | 'ne' | 'sw' | 'se'; edges: ('n' | 's' | 'w' | 'e')[] } => {
        switch (position) {
            case 'bottom-right':
                return { corner: 'nw', edges: ['n', 'w'] };
            case 'bottom-left':
                return { corner: 'ne', edges: ['n', 'e'] };
            case 'top-right':
                return { corner: 'sw', edges: ['s', 'w'] };
            case 'top-left':
                return { corner: 'se', edges: ['s', 'e'] };
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

            if (direction.includes('w')) {
                newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
            } else if (direction.includes('e')) {
                newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
            }

            if (direction.includes('n')) {
                newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
            } else if (direction.includes('s')) {
                newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
            }

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
        // Handle Escape key to close chat
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        // Close chat when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (isOpen && !target.closest('.chat-container') && !target.closest('.chat-toggle-button')) {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('click', handleClickOutside);

        // Define copy functions globally
        (window as any).copyCode = (codeId: string) => {
            const codeBlock = document.getElementById(codeId);
            if (!codeBlock) return;

            const code = codeBlock.textContent || '';

            navigator.clipboard.writeText(code).then(() => {
                const button = document.querySelector(`[data-code-id="${codeId}"]`);
                if (!button) return;

                const copyText = button.querySelector('.copy-text') as HTMLElement;
                const copiedText = button.querySelector('.copied-text') as HTMLElement;

                if (copyText) copyText.style.display = 'none';
                if (copiedText) copiedText.style.display = 'inline';

                setTimeout(() => {
                    if (copyText) copyText.style.display = 'inline';
                    if (copiedText) copiedText.style.display = 'none';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code:', err);
            });
        };

        (window as any).copyQuote = (quoteId: string) => {
            const quoteBlock = document.getElementById(quoteId);
            if (!quoteBlock) return;

            const button = quoteBlock.querySelector('.copy-quote-btn');
            const clonedQuote = quoteBlock.cloneNode(true) as HTMLElement;
            const clonedButton = clonedQuote.querySelector('.copy-quote-btn');
            if (clonedButton) clonedButton.remove();

            const quoteText = clonedQuote.textContent || '';

            navigator.clipboard.writeText(quoteText.trim()).then(() => {
                if (!button) return;

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

        (window as any).copyInlineCode = (codeId: string) => {
            const codeElement = document.getElementById(codeId);
            if (!codeElement) return;

            const code = codeElement.textContent || '';

            navigator.clipboard.writeText(code).then(() => {
                const button = document.querySelector(`[data-inline-id="${codeId}"]`);
                if (!button) return;

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

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    const resizeHandles = getResizeHandles(dockPosition);

    return (
        <>
            <style>{chatStyles}</style>
            {/* Chat Window */}
            {isOpen && (
                <div
                    className={`chat-container theme-${theme} dock-${dockPosition} ${isResizing ? 'resizing' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
                    style={isFullscreen ? {} : { width: `${chatWidth}px`, height: `${chatHeight}px` }}
                    role="dialog"
                    aria-label="Support chat"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    {!isFullscreen && (
                        <>
                            {/* Corner Resize Handle */}
                            <div
                                role="button"
                                tabIndex={0}
                                onMouseDown={(e) => startResize(e, resizeHandles.corner)}
                                className={`resize-handle corner-${resizeHandles.corner}`}
                                title="Resize chat window"
                            />

                            {/* Edge Resize Handles */}
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

                    {/* Chat Header */}
                    <div className="chat-header">
                        <div className="header-left">
                            <span className="header-title">Fleety Support</span>
                        </div>
                        <div className="header-right">
                            <button onClick={toggleFullscreen} className="fullscreen-button" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                                {isFullscreen ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                )}
                            </button>
                            <button onClick={toggleChat} className="minimize-button" aria-label="Minimize chat">
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages Container */}
                    <div ref={chatContainerRef} className="messages-container">
                        {messages.map(message => (
                            <div
                                key={message.id}
                                className={`message-wrapper ${message.isUser ? 'user' : 'ai'}`}
                            >
                                <div className={`message-bubble ${message.isUser ? 'user' : 'ai'}`}>
                                    <div
                                        className={`message-content ${theme === 'material' ? 'light' : 'dark'}`}
                                        dangerouslySetInnerHTML={{ __html: formatMessageContent(message.text, message.isUser) }}
                                    />
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="message-wrapper ai">
                                <div className="typing-indicator">
                                    <div className="typing-dots">
                                        <div className="dot"></div>
                                        <div className="dot" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="dot" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="input-area">
                        <div className="input-wrapper">
                            <input
                                ref={inputElementRef}
                                value={currentMessage}
                                onChange={(e) => setCurrentMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask about Fleety..."
                                className="message-input"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!currentMessage.trim()}
                                className="send-button"
                                aria-label="Send message"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Toggle Button */}
            <div className={`chat-toggle-button theme-${theme} dock-${dockPosition}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); toggleChat(); }}
                    className="toggle-button"
                    aria-label={isOpen ? "Close support chat" : "Open support chat"}
                >
                    <div className={`icon-container ${isOpen ? 'open' : ''}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-default" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-close" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                </button>
            </div>
        </>
    );
};

export default SupportChat;
