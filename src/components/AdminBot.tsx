'use client';

// ==============================================================================
// DAHEEJFREE AUTONOMOUS DEVELOPER AGENT CHAT INTERFACE
// Dark-mode terminal-inspired chat interface connected to /api/admin-bot
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Bot, Terminal, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminBot() {
  const [localInput, setLocalInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize useChat with /api/admin-bot endpoint and compatible AI SDK transport
  const chat = (useChat as any)({
    api: '/api/admin-bot',
    transport: new DefaultChatTransport({ api: '/api/admin-bot' }),
  });

  const {
    messages = [],
    input: sdkInput,
    handleInputChange: sdkHandleInputChange,
    handleSubmit: sdkHandleSubmit,
    sendMessage,
    status,
    error,
  } = chat;

  const isStreaming = status === 'submitted' || status === 'streaming';

  // Support controlled input across both legacy and modern AI SDK hook signatures
  const input = sdkInput !== undefined ? sdkInput : localInput;

  const handleInputChange =
    sdkHandleInputChange ||
    ((e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalInput(e.target.value);
    });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault?.();
    if (!input || !input.trim()) return;

    if (sdkHandleSubmit) {
      sdkHandleSubmit(e);
    } else if (typeof sendMessage === 'function') {
      sendMessage({ text: input });
      setLocalInput('');
    }
  };

  // Auto-scroll message container to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Extract display text from either classical message content or modern UIMessage parts
  const renderMessageContent = (msg: any) => {
    if (typeof msg.content === 'string' && msg.content) {
      return msg.content;
    }

    if (Array.isArray(msg.parts)) {
      const partsText = msg.parts
        .map((part: any) => {
          if (part.type === 'text') return part.text;
          if (part.type === 'tool-invocation') {
            const toolName = part.toolInvocation?.toolName || 'tool';
            const state = part.toolInvocation?.state || 'executed';
            return `⚙️ [Executing Tool: ${toolName} (${state})]`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      if (partsText) return partsText;
    }

    return typeof msg.text === 'string' ? msg.text : '';
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden mb-8 shadow-lg font-sans">
      {/* 1. Header */}
      <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              <span>🤖</span>
              <span>DaheejFree Autonomous Developer Agent</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active</span>
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-500">
          <Terminal className="w-3.5 h-3.5" />
          <span>Vercel &amp; GitHub Autonomous Pipeline</span>
        </div>
      </div>

      {/* 2. Message Area (scrollable, max-h-64) */}
      <div className="max-h-64 min-h-[140px] overflow-y-auto p-4 space-y-3 bg-zinc-950/60 font-mono text-xs sm:text-sm">
        {messages.length === 0 ? (
          <div className="h-full py-6 flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
            <Sparkles className="w-6 h-6 text-zinc-600 mb-1" />
            <p className="font-sans text-xs text-zinc-400 font-medium">
              Autonomous developer agent ready to inspect code and push live commits to GitHub.
            </p>
            <p className="font-mono text-[11px] text-zinc-600">
              Try: &ldquo;Fix typo in landing hero&rdquo; or &ldquo;Inspect src/app/page.tsx&rdquo;
            </p>
          </div>
        ) : (
          messages.map((msg: any, index: number) => {
            const isUser = msg.role === 'user';
            const content = renderMessageContent(msg);

            return (
              <div
                key={msg.id || index}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isUser
                      ? 'bg-blue-600/90 text-white rounded-br-none border border-blue-500/30 shadow-sm'
                      : 'bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold mb-1 opacity-70">
                    <span>{isUser ? 'Admin' : 'Autonomous Agent'}</span>
                  </div>
                  <div>{content || '...'}</div>
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 text-[11px] font-bold">
                    A
                  </div>
                )}
              </div>
            );
          })
        )}

        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-emerald-400/90 bg-emerald-950/20 border border-emerald-500/20 px-3 py-2 rounded-lg w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>Agent is reasoning and preparing GitHub tools...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/40 border border-red-500/30 px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Agent Error: {error.message || 'Failed to process prompt. Check environment variables.'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Area */}
      <form onSubmit={handleSubmit} className="p-3 bg-zinc-900/60 border-t border-zinc-800/80">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Command autonomous developer agent (e.g. Inspect or edit code)..."
            disabled={isStreaming}
            className="bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 w-full p-3 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs sm:text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
