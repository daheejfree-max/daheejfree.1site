'use client';

// ==============================================================================
// DAHEEJFREE AUTONOMOUS DEVELOPER AGENT CHAT INTERFACE
// Dark-mode terminal-inspired chat interface connected to /api/admin-bot
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  Send,
  Bot,
  Terminal,
  Loader2,
  Sparkles,
  AlertCircle,
  X,
  CheckCircle2,
  FileCode,
  GitCommit,
  ExternalLink,
  Brain,
  FolderTree,
} from 'lucide-react';

export default function AdminBot() {
  const [localInput, setLocalInput] = useState('');
  const [envStatus, setEnvStatus] = useState<{
    githubConfigured: boolean;
    missing: string[];
  } | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Check backend integration status on mount with explicit error logging
  useEffect(() => {
    fetch('/api/admin-bot')
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error(`[AdminBot Init Error] HTTP ${res.status} ${res.statusText} from /api/admin-bot:`, text);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && typeof data.githubConfigured === 'boolean') {
          setEnvStatus({
            githubConfigured: data.githubConfigured,
            missing: data.missing || [],
          });
        }
      })
      .catch((err) => {
        console.error('[AdminBot Init Error] Network error reaching /api/admin-bot:', err);
      });
  }, []);

  // Custom fetch wrapper to log all raw HTTP errors returned by /api/admin-bot
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const res = await fetch(input, init);
      if (!res.ok) {
        try {
          const clone = res.clone();
          const errorBody = await clone.text();
          console.error(
            `[AdminBot /api/admin-bot HTTP ${res.status} Error]:`,
            res.statusText,
            errorBody || '(empty body)'
          );
        } catch (e) {
          console.error(`[AdminBot /api/admin-bot HTTP ${res.status} Error]:`, res.statusText);
        }
      }
      return res;
    } catch (networkError) {
      console.error('[AdminBot /api/admin-bot Network Request Failed]:', networkError);
      throw networkError;
    }
  };

  // Initialize useChat with /api/admin-bot endpoint and error logging
  const chat = (useChat as any)({
    api: '/api/admin-bot',
    transport: new DefaultChatTransport({
      api: '/api/admin-bot',
      fetch: customFetch,
    }),
    onError: (err: any) => {
      console.error('[AdminBot Chat onError Callback]:', err);
      if (err?.message) {
        console.error('[AdminBot Error Message]:', err.message);
      }
      if (err?.cause) {
        console.error('[AdminBot Error Cause]:', err.cause);
      }
    },
  });

  const {
    messages = [],
    input: sdkInput,
    handleInputChange: sdkHandleInputChange,
    handleSubmit: sdkHandleSubmit,
    sendMessage,
    clearError,
    status,
    error,
  } = chat;

  const isStreaming = status === 'submitted' || status === 'streaming';

  // Explicitly monitor and log reactive error changes
  useEffect(() => {
    if (error) {
      console.error('[AdminBot Active Error State]:', {
        name: error.name,
        message: error.message,
        cause: (error as any).cause,
        stack: error.stack,
        raw: error,
      });
    }
  }, [error]);

  // Monitor incoming data stream messages for streamed errors or failed tool executions
  useEffect(() => {
    messages.forEach((msg: any) => {
      if (Array.isArray(msg.parts)) {
        msg.parts.forEach((part: any) => {
          if (part.type === 'error') {
            console.error('[AdminBot DataStream Error Part]:', part.errorText || part.error || part);
          }
          if (part.type === 'tool-invocation' && part.toolInvocation?.result?.error) {
            console.error(
              `[AdminBot Tool "${part.toolInvocation.toolName}" Execution Error]:`,
              part.toolInvocation.result.error
            );
          }
        });
      }
      if (Array.isArray(msg.toolInvocations)) {
        msg.toolInvocations.forEach((ti: any) => {
          if (ti.result?.error) {
            console.error(`[AdminBot Tool "${ti.toolName}" Execution Error]:`, ti.result.error);
          }
        });
      }
    });
  }, [messages]);

  // Support controlled input across both legacy and modern AI SDK hook signatures
  const input = sdkInput !== undefined ? sdkInput : localInput;

  const handleInputChange =
    sdkHandleInputChange ||
    ((e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalInput(e.target.value);
    });

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    if (!input || !input.trim()) return;

    if (error && typeof clearError === 'function') {
      clearError();
    }

    try {
      if (sdkHandleSubmit) {
        sdkHandleSubmit(e);
      } else if (typeof sendMessage === 'function') {
        await sendMessage({ text: input });
        setLocalInput('');
      }
    } catch (submitErr) {
      console.error('[AdminBot Submit Handler Exception]:', submitErr);
    }
  };

  // Auto-scroll message container internally without scrolling the parent page/window
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Comprehensive Data Stream & UI Message part renderer
  const renderMessageContent = (msg: any) => {
    const partsElements: React.ReactNode[] = [];

    // 1. Process data stream parts array (standard in Vercel AI SDK)
    if (Array.isArray(msg.parts) && msg.parts.length > 0) {
      msg.parts.forEach((part: any, pIdx: number) => {
        const textContent = part.text || part.delta || part.content || (typeof part === 'string' ? part : '');
        if ((part.type === 'text' || typeof part === 'string') && textContent) {
          partsElements.push(
            <div key={`part-text-${pIdx}`} className="whitespace-pre-wrap leading-relaxed">
              {textContent}
            </div>
          );
        } else if (part.type === 'reasoning') {
          const reasoningText = part.reasoning || part.text || '';
          if (reasoningText) {
            partsElements.push(
              <div
                key={`part-reasoning-${pIdx}`}
                className="my-1.5 p-2.5 rounded-lg bg-purple-950/20 border border-purple-800/30 text-zinc-300 text-[11px] font-mono whitespace-pre-wrap"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-purple-400 uppercase tracking-wider font-semibold mb-1">
                  <Brain className="w-3 h-3 text-purple-400" />
                  <span>Agent Reasoning</span>
                </div>
                <div className="text-zinc-400 leading-normal">{reasoningText}</div>
              </div>
            );
          }
        } else if (
          part.type === 'tool-invocation' ||
          part.type === 'dynamic-tool' ||
          (typeof part.type === 'string' && part.type.startsWith('tool-')) ||
          Boolean(part.toolInvocation)
        ) {
          const ti = part.toolInvocation || {};
          const toolName =
            ti.toolName ||
            part.toolName ||
            (typeof part.type === 'string' && part.type.startsWith('tool-')
              ? part.type.replace(/^tool-/, '')
              : 'tool');
          const state =
            part.state === 'output-available' || part.state === 'output-error'
              ? 'result'
              : part.state === 'input-available' || part.state === 'input-start'
              ? 'call'
              : ti.state || part.state || 'call';
          const args = part.input || ti.args || part.args || {};
          const result =
            part.output !== undefined
              ? part.output
              : part.errorText
              ? { error: part.errorText }
              : ti.result !== undefined
              ? ti.result
              : part.result;

          if (toolName === 'commitToGithub') {
            partsElements.push(
              <div
                key={`part-tool-${pIdx}`}
                className="my-1.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-zinc-200">
                    <GitCommit className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-emerald-300">commitToGithub</span>
                    <span className="text-zinc-400 font-sans truncate max-w-[200px]" title={args.filePath}>
                      {args.filePath || 'file'}
                    </span>
                  </div>
                  {state === 'result' ? (
                    result?.error ? (
                      <span className="text-red-400 text-[10px] font-medium flex items-center gap-1 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/40">
                        <AlertCircle className="w-3 h-3 shrink-0" /> Commit Failed
                      </span>
                    ) : (
                      <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                        <CheckCircle2 className="w-3 h-3 shrink-0" /> Pushed to Main
                      </span>
                    )
                  ) : (
                    <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Committing...
                    </span>
                  )}
                </div>
                {args.commitMessage && (
                  <div className="mt-1.5 text-[10px] text-zinc-400 italic">
                    &ldquo;{args.commitMessage}&rdquo;
                  </div>
                )}
                {state === 'result' && result?.commitSha && (
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-400">
                    <span>SHA: {result.commitSha.slice(0, 7)}</span>
                    {result.commitUrl && (
                      <a
                        href={result.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 ml-auto"
                      >
                        View Commit <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                )}
                {state === 'result' && result?.error && (
                  <div className="mt-1.5 text-[10px] text-red-300 bg-red-950/50 p-1.5 rounded border border-red-500/20">
                    {result.error}
                  </div>
                )}
              </div>
            );
          } else if (toolName === 'readRepositoryFile') {
            partsElements.push(
              <div
                key={`part-tool-${pIdx}`}
                className="my-1.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-zinc-200">
                    <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="font-semibold text-blue-300">readRepositoryFile</span>
                    <span className="text-zinc-400 font-sans truncate max-w-[200px]" title={args.filePath}>
                      {args.filePath || 'file'}
                    </span>
                  </div>
                  {state === 'result' ? (
                    result?.error ? (
                      <span className="text-red-400 text-[10px] font-medium flex items-center gap-1 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/40">
                        <AlertCircle className="w-3 h-3 shrink-0" /> Error
                      </span>
                    ) : (
                      <span className="text-blue-400 text-[10px] font-medium flex items-center gap-1 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-800/40">
                        <CheckCircle2 className="w-3 h-3 shrink-0" /> Read {result?.content ? `(${result.content.length} chars)` : 'OK'}
                      </span>
                    )
                  ) : (
                    <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Reading file...
                    </span>
                  )}
                </div>
                {state === 'result' && result?.error && (
                  <div className="mt-1.5 text-[10px] text-red-300 bg-red-950/50 p-1.5 rounded border border-red-500/20">
                    {result.error}
                  </div>
                )}
              </div>
            );
          } else if (toolName === 'listDirectory') {
            partsElements.push(
              <div
                key={`part-tool-${pIdx}`}
                className="my-1.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-zinc-200">
                    <FolderTree className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-semibold text-amber-300">listDirectory</span>
                    <span className="text-zinc-400 font-sans truncate max-w-[200px]" title={args.directoryPath}>
                      {args.directoryPath || 'src'}
                    </span>
                  </div>
                  {state === 'result' ? (
                    result?.error ? (
                      <span className="text-red-400 text-[10px] font-medium flex items-center gap-1 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/40">
                        <AlertCircle className="w-3 h-3 shrink-0" /> Error
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                        <CheckCircle2 className="w-3 h-3 shrink-0" /> Found {result?.count ?? 0} items
                      </span>
                    )
                  ) : (
                    <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Scanning directory...
                    </span>
                  )}
                </div>
                {state === 'result' && result?.error && (
                  <div className="mt-1.5 text-[10px] text-red-300 bg-red-950/50 p-1.5 rounded border border-red-500/20">
                    {result.error}
                  </div>
                )}
                {state === 'result' && Array.isArray(result?.items) && result.items.length > 0 && (
                  <div className="mt-1.5 text-[10px] text-zinc-400 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {result.items.slice(0, 12).map((item: any, iIdx: number) => (
                      <span key={`item-${iIdx}`} className="bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-300">
                        {item.name}
                      </span>
                    ))}
                    {result.items.length > 12 && (
                      <span className="text-zinc-500 py-0.5">+{result.items.length - 12} more</span>
                    )}
                  </div>
                )}
              </div>
            );
          } else {
            partsElements.push(
              <div
                key={`part-tool-${pIdx}`}
                className="my-1.5 p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono flex items-center justify-between"
              >
                <span className="text-zinc-300">⚡ [{toolName}]</span>
                <span className="text-[10px] text-zinc-500">{state}</span>
              </div>
            );
          }
        } else if (part.type === 'error') {
          const errorMsg = part.errorText || part.error?.message || String(part.error || 'Stream error occurred');
          partsElements.push(
            <div
              key={`part-err-${pIdx}`}
              className="my-1.5 p-2.5 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-xs"
            >
              <div className="flex items-center gap-1.5 font-semibold text-red-400 mb-0.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Stream Error</span>
              </div>
              <p className="text-[11px] text-red-300/90">{errorMsg}</p>
            </div>
          );
        }
      });
    }

    // 2. Process legacy toolInvocations array if parts wasn't populated with them
    if (
      (!Array.isArray(msg.parts) || msg.parts.length === 0) &&
      Array.isArray(msg.toolInvocations) &&
      msg.toolInvocations.length > 0
    ) {
      msg.toolInvocations.forEach((ti: any, tIdx: number) => {
        partsElements.push(
          <div
            key={`ti-${tIdx}`}
            className="my-1.5 p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono flex items-center justify-between"
          >
            <span className="text-zinc-300">⚡ [{ti.toolName || 'tool'}]</span>
            <span className="text-[10px] text-zinc-500">{ti.state || 'executed'}</span>
          </div>
        );
      });
    }

    // 3. Fallback: Classical message content string or array
    if (partsElements.length === 0) {
      if (typeof msg.content === 'string' && msg.content) {
        partsElements.push(
          <div key="content-str" className="whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </div>
        );
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach((item: any, cIdx: number) => {
          if (typeof item === 'string') {
            partsElements.push(<div key={`content-arr-${cIdx}`}>{item}</div>);
          } else if (item?.text) {
            partsElements.push(<div key={`content-arr-${cIdx}`}>{item.text}</div>);
          }
        });
      } else if (typeof msg.text === 'string' && msg.text) {
        partsElements.push(
          <div key="content-text" className="whitespace-pre-wrap leading-relaxed">
            {msg.text}
          </div>
        );
      }
    }

    if (partsElements.length === 0) {
      return (
        <div className="flex items-center gap-1.5 text-zinc-400 italic text-xs py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />
          <span>Analyzing and inspecting repository...</span>
        </div>
      );
    }

    return <div className="space-y-1.5">{partsElements}</div>;
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden mb-8 shadow-lg font-sans">
      {/* 1. Header */}
      <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              <span>🤖</span>
              <span>DaheejFree Autonomous Developer Agent</span>
            </span>

            {envStatus?.githubConfigured ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>GitHub Commits Active</span>
              </span>
            ) : (
              <span
                title="Agent is active in code analysis mode. Add GITHUB_PAT, GITHUB_OWNER, and GITHUB_REPO to Vercel env for autonomous commits."
                className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full cursor-help"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Live Advisor Mode</span>
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-500">
          <Terminal className="w-3.5 h-3.5" />
          <span>Vercel &amp; Gemini Autonomous Pipeline</span>
        </div>
      </div>

      {/* 2. Message Area (scrollable, max-h-64) */}
      <div
        ref={chatContainerRef}
        className="max-h-64 min-h-[140px] overflow-y-auto p-4 space-y-3 bg-zinc-950/60 font-mono text-xs sm:text-sm"
      >
        {messages.length === 0 ? (
          <div className="h-full py-6 flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
            <Sparkles className="w-6 h-6 text-zinc-600 mb-1" />
            <p className="font-sans text-xs text-zinc-400 font-medium">
              Autonomous developer agent ready to inspect code, debug Didit KYC, and draft updates.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1 font-sans">
              <button
                type="button"
                onClick={() => {
                  if (typeof sendMessage === 'function') {
                    sendMessage({ text: 'How do I fix Didit KYC verification issues?' });
                  } else {
                    setLocalInput('How do I fix Didit KYC verification issues?');
                  }
                }}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-[11px] text-zinc-300 transition-colors"
              >
                💡 &ldquo;How do I fix Didit KYC issues?&rdquo;
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof sendMessage === 'function') {
                    sendMessage({ text: 'Inspect src/app/api/kyc/create-session/route.ts' });
                  } else {
                    setLocalInput('Inspect src/app/api/kyc/create-session/route.ts');
                  }
                }}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-[11px] text-zinc-300 transition-colors"
              >
                🔍 &ldquo;Inspect KYC create-session route&rdquo;
              </button>
            </div>
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
                  <div>
                    {content || (
                      <div className="flex items-center gap-1.5 text-emerald-400/80 text-xs py-0.5">
                        <Loader2 className="w-3 h-3 animate-spin shrink-0 text-emerald-400" />
                        <span>Inspecting codebase...</span>
                      </div>
                    )}
                  </div>
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
            <span>Agent is inspecting codebase and preparing response...</span>
          </div>
        )}

        {error && (
          <div className="flex items-start justify-between gap-2 text-xs text-red-300 bg-red-950/40 border border-red-500/30 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Chat Response Error</p>
                <p className="text-[11px] text-red-300/80">
                  {error.message?.includes('high demand')
                    ? 'Gemini API experienced a temporary demand spike. The agent has automatically switched to the high-availability Flash Lite engine. Please click the prompt button or try sending your message again.'
                    : error.message?.includes('fetch')
                    ? 'Unable to communicate with /api/admin-bot. Ensure GEMINI_API_KEY is configured in your Vercel deployment settings.'
                    : error.message === 'An error occurred.'
                    ? 'AI stream error from provider. Verify that GEMINI_API_KEY in your Vercel environment is valid and active.'
                    : error.message || 'An error occurred while generating response.'}
                </p>
              </div>
            </div>
            {typeof clearError === 'function' && (
              <button
                type="button"
                onClick={() => clearError()}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Input Area */}
      <form onSubmit={handleSubmit} className="p-3 bg-zinc-900/60 border-t border-zinc-800/80">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Command autonomous developer agent (e.g. Inspect code or fix Didit)..."
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
