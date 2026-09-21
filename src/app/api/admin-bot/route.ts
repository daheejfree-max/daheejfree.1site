import { streamText, tool, isStepCount, convertToModelMessages, modelMessageSchema } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

// Helper to reliably normalize incoming client UIMessages into ModelMessages
async function normalizeToModelMessages(rawMessages: any[]): Promise<any[]> {
  const parseResult = z.array(modelMessageSchema).safeParse(rawMessages);
  if (parseResult.success) {
    return parseResult.data;
  }

  try {
    const converted = await convertToModelMessages(rawMessages);
    const convertedCheck = z.array(modelMessageSchema).safeParse(converted);
    if (convertedCheck.success) {
      return convertedCheck.data;
    }
  } catch (err) {
    console.warn('[AdminBot Route] convertToModelMessages conversion warning:', err);
  }

  // Resilient fallback conversion if schema doesn't strictly match or includes UI tool invocations
  const fallback: any[] = [];
  for (const m of rawMessages) {
    if (!m) continue;

    let contentText = '';
    if (typeof m.content === 'string') {
      contentText = m.content;
    } else if (Array.isArray(m.parts)) {
      contentText = m.parts
        .map((p: any) => {
          if (typeof p === 'string') return p;
          if (p?.text) return p.text;
          if (p?.type === 'text') return p.text;
          if (p?.type?.startsWith('tool-') || p?.type === 'tool-invocation') {
            const toolName = p.toolName || p.toolInvocation?.toolName || 'tool';
            const filePath = p.args?.filePath || p.input?.filePath || p.toolInvocation?.args?.filePath || '';
            const res = p.output || p.result || p.toolInvocation?.result;
            const status = res?.error ? `Error: ${res.error}` : 'Inspected successfully';
            return `[Tool: ${toolName} on "${filePath}": ${status}]`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    } else if (typeof m.text === 'string') {
      contentText = m.text;
    } else if (typeof m.message === 'string') {
      contentText = m.message;
    }

    const role = m.role === 'assistant' || m.role === 'user' ? m.role : 'user';
    fallback.push({
      role,
      content: contentText || ' ',
    });
  }

  const finalCheck = z.array(modelMessageSchema).safeParse(fallback);
  if (finalCheck.success) {
    return finalCheck.data;
  }
  return fallback;
}

// GET endpoint to allow the frontend to inspect GitHub integration readiness
export async function GET() {
  const missing: string[] = [];
  if (!process.env.GITHUB_PAT) missing.push('GITHUB_PAT');
  if (!process.env.GITHUB_OWNER) missing.push('GITHUB_OWNER');
  if (!process.env.GITHUB_REPO) missing.push('GITHUB_REPO');
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) missing.push('GEMINI_API_KEY');

  return Response.json({
    status: 'ok',
    githubConfigured: !missing.includes('GITHUB_PAT') && !missing.includes('GITHUB_OWNER') && !missing.includes('GITHUB_REPO'),
    missing,
  });
}

export async function POST(req: Request) {
  try {
    // 1. Extract messages array from request body safely
    let messages: any[] = [];
    try {
      const body = await req.json();
      messages = Array.isArray(body.messages) ? body.messages : [];
    } catch {
      messages = [];
    }

    if (!messages.length) {
      return Response.json({ error: 'No messages provided in request.' }, { status: 400 });
    }

    // 2. Check GitHub environment variables
    const githubPat = process.env.GITHUB_PAT;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const isGithubConfigured = Boolean(githubPat && owner && repo);

    if (!isGithubConfigured) {
      console.warn(
        `[Admin Bot Notice]: GitHub environment variables incomplete. Missing: ${[
          !githubPat ? 'GITHUB_PAT' : null,
          !owner ? 'GITHUB_OWNER' : null,
          !repo ? 'GITHUB_REPO' : null,
        ]
          .filter(Boolean)
          .join(', ')}. Running in advisory developer mode.`
      );
    }

    // 3. Initialize Octokit conditionally if credentials exist
    let octokit: Octokit | null = null;
    if (isGithubConfigured && githubPat) {
      try {
        octokit = new Octokit({ auth: githubPat });
      } catch (octokitErr) {
        console.error('Failed to initialize Octokit with provided GITHUB_PAT:', octokitErr);
      }
    }

    // 4. Initialize Google Generative AI
    const rawGeminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';
    const geminiKey = rawGeminiKey.trim().replace(/^["']|["']$/g, '');

    if (!geminiKey) {
      console.error('ADMIN BOT ERROR: Missing GEMINI_API_KEY.');
      return Response.json(
        { error: 'Server misconfiguration: GEMINI_API_KEY is missing from environment variables.' },
        { status: 500 }
      );
    }

    // Select high-availability, low-latency Flash model to prevent 503/429 high demand spikes
    const requestedModel = process.env.GEMINI_MODEL;
    const modelName =
      requestedModel &&
      !requestedModel.includes('3.6') &&
      !requestedModel.includes('2.0') &&
      !requestedModel.includes('1.5')
        ? requestedModel
        : 'gemini-flash-lite-latest';
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });

    // 5. System prompt informing agent of DaheejFree platform context & environment state
    const systemPrompt = `You are DaheejFree's autonomous developer agent.
You assist the platform administrator with inspecting code, debugging, and executing software updates for the DaheejFree Matrimonial platform.

Current Environment Status:
- GitHub Integration: ${isGithubConfigured ? `Configured for ${owner}/${repo}` : 'Not fully configured in environment (Missing GITHUB_PAT, GITHUB_OWNER, or GITHUB_REPO).'}
- When GitHub is NOT configured:
  1. You can inspect files using \`readRepositoryFile\` (reads from local project workspace).
  2. If asked to commit or push code, explain that code is prepared, but direct commits require setting GITHUB_PAT, GITHUB_OWNER, and GITHUB_REPO in Vercel environment variables.
- When GitHub IS configured:
  1. Inspect target files before modifying them using \`readRepositoryFile\`.
  2. Write production-ready Next.js / Tailwind code.
  3. Use \`commitToGithub\` to commit and trigger Vercel deployment.

Key Platform Architecture & File Map:
- Didit KYC Verification:
  - API Route: src/app/api/kyc/create-session/route.ts (creates session with https://verification.didit.me/v3/session/ using DIDIT_API_KEY & DIDIT_WORKFLOW_ID)
  - Webhook Route: src/app/api/webhooks/didit/route.ts
  - UI Component: src/components/dashboard/KYCVerification.tsx
  - Gate Component: src/components/kyc/HardKYCGate.tsx
- Razorpay Payment Gateway & Subscriptions:
  - API Routes: src/app/api/razorpay/create-order/route.ts, src/app/api/checkout/razorpay/route.ts
  - Webhook Route: src/app/api/webhooks/razorpay/route.ts
  - Library / SDK: src/lib/razorpay.ts
  - UI Component: src/components/subscriptions/SubscriptionModal.tsx
- Supabase Client & DB:
  - src/lib/supabase.ts & supabase/schema.sql
- Admin Control Panel:
  - src/app/admin/page.tsx & src/components/AdminBot.tsx

Core Operational Workflow:
- Inspect ONLY 1 or 2 relevant files using \`readRepositoryFile\`.
- Immediately after inspecting or if you have the needed information, deliver a comprehensive, actionable, and clear text response for the admin.
- Avoid looping tool calls. Synthesize findings and explain exactly what is functional, what is missing, and how to fix it.
- Tone: Professional, competent, helpful, concise.`;

    // 6. Normalize UI messages into ModelMessage[] format for streamText
    const modelMessages = await normalizeToModelMessages(messages);

    // 7. Invoke streamText with tools
    const result = streamText({
      model: google(modelName),
      system: systemPrompt,
      messages: modelMessages,
      prepareStep: ({ stepNumber }) => {
        // Allow up to 2 tool execution steps, then force text synthesis step
        if (stepNumber >= 2) {
          return { toolChoice: 'none' };
        }
        return {};
      },
      stopWhen: ({ steps }) => steps.length >= 3,
      maxRetries: 2,
      tools: {
        readRepositoryFile: tool({
          description:
            'Read the content of an existing file from the repository to inspect existing code before making changes.',
          inputSchema: z.object({
            filePath: z.string().describe('The path to the file in the repository, e.g. src/app/page.tsx'),
          }),
          execute: async ({ filePath }) => {
            // Intelligent alias resolver for legacy or partial paths
            const sanitize = (raw: string) => raw.replace(/^\/+/, '').trim();
            const getResolvedPath = (target: string): string => {
              const cleaned = sanitize(target);
              const direct = path.resolve(process.cwd(), cleaned);
              if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
                return cleaned;
              }
              const lower = cleaned.toLowerCase();
              if (lower.includes('kycmodal') || (lower.includes('kyc') && lower.includes('modal'))) {
                return 'src/components/dashboard/KYCVerification.tsx';
              }
              if (lower.includes('paymentmodal') || (lower.includes('payment') && lower.includes('modal'))) {
                return 'src/components/subscriptions/SubscriptionModal.tsx';
              }
              if (lower.includes('payment/create-order') || lower.includes('payment/order')) {
                return 'src/app/api/razorpay/create-order/route.ts';
              }
              if (lower.includes('payment/verify')) {
                return 'src/app/api/webhooks/razorpay/route.ts';
              }
              return cleaned;
            };

            const targetFilePath = getResolvedPath(filePath);

            // Attempt 1: Try reading via GitHub Octokit if configured
            if (octokit && owner && repo) {
              try {
                const response = await octokit.rest.repos.getContent({
                  owner,
                  repo,
                  path: targetFilePath,
                });

                const data = response.data;
                if (!Array.isArray(data) && 'content' in data && data.content) {
                  const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
                  return {
                    success: true,
                    filePath: targetFilePath,
                    content: decodedContent,
                    sha: data.sha,
                    source: 'github',
                  };
                }
              } catch (gitErr: any) {
                console.warn(`[Octokit read failed for ${targetFilePath}, falling back to local fs]:`, gitErr?.message);
              }
            }

            // Attempt 2: Fallback to reading from local filesystem
            try {
              const localFilePath = path.resolve(process.cwd(), targetFilePath);

              if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
                const content = await fs.promises.readFile(localFilePath, 'utf-8');
                return {
                  success: true,
                  filePath: targetFilePath,
                  content,
                  source: 'local-filesystem',
                };
              }
            } catch (fsErr: any) {
              console.warn(`[Local fs read error for ${targetFilePath}]:`, fsErr?.message);
            }

            return {
              success: false,
              error: `File not found at '${filePath}' neither in GitHub repository nor in local project directory.`,
            };
          },
        }),

        commitToGithub: tool({
          description:
            'Commit a new or updated file directly to the GitHub repository on the main branch, triggering the Vercel CI/CD pipeline.',
          inputSchema: z.object({
            filePath: z.string().describe('The target file path, e.g. src/app/page.tsx'),
            fileContent: z.string().describe('The complete new raw source code/content of the file'),
            commitMessage: z.string().describe('The Git commit message describing the changes made'),
          }),
          execute: async ({ filePath, fileContent, commitMessage }) => {
            if (!octokit || !owner || !repo) {
              return {
                success: false,
                error:
                  'GitHub integration is not yet configured. Please set GITHUB_PAT, GITHUB_OWNER, and GITHUB_REPO in your environment variables to enable autonomous commits.',
              };
            }

            try {
              let sha: string | undefined = undefined;
              try {
                const existingFile = await octokit.rest.repos.getContent({
                  owner,
                  repo,
                  path: filePath,
                });

                if (!Array.isArray(existingFile.data) && 'sha' in existingFile.data) {
                  sha = existingFile.data.sha;
                }
              } catch (checkErr: any) {
                if (checkErr?.status !== 404) {
                  console.warn('[Octokit] Notice checking file sha:', checkErr?.message);
                }
              }

              const base64Content = Buffer.from(fileContent, 'utf-8').toString('base64');

              const response = await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: filePath,
                message: commitMessage,
                content: base64Content,
                branch: 'main',
                ...(sha ? { sha } : {}),
              });

              return {
                success: true,
                message: 'Code committed successfully. Vercel deployment triggered.',
                filePath,
                commitSha: response.data.commit.sha,
                commitUrl: response.data.commit.html_url,
              };
            } catch (error: any) {
              return {
                success: false,
                error: `Failed to commit to GitHub: ${error?.message || String(error)}`,
                status: error?.status,
              };
            }
          },
        }),
      },
    });

    // 7. Ensure toDataStreamResponse compatibility for useChat with descriptive error reporting
    const streamResponseOptions = {
      onError: (err: any) => {
        const errorMsg = err instanceof Error ? err.message : String(err?.message || err || 'An error occurred.');
        console.error('[AdminBot AI Stream Error]:', errorMsg);
        return errorMsg;
      },
    };

    if (typeof (result as any).toUIMessageStreamResponse === 'function') {
      return (result as any).toUIMessageStreamResponse(streamResponseOptions);
    }
    if (typeof (result as any).toDataStreamResponse === 'function') {
      return (result as any).toDataStreamResponse(streamResponseOptions);
    }

    return result;
  } catch (error: any) {
    console.error('ADMIN BOT ERROR:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
