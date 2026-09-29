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
- Razorpay Payment Gateway & Subscriptions:
  - Exact Order API Route: src/app/api/razorpay/create-order/route.ts
  - Order API Aliases: src/app/api/payment/create/route.ts, src/app/api/payment/create-order/route.ts, src/app/api/payment/route.ts, src/app/api/create-order/route.ts
  - Alternative Checkout API: src/app/api/checkout/razorpay/route.ts
  - Subscription API: src/app/api/razorpay/subscription/route.ts
  - Webhook Route: src/app/api/webhooks/razorpay/route.ts
  - Razorpay Client Hook & Functions: src/hooks/useRazorpay.ts & src/lib/razorpay.ts
  - UI Components: src/components/pricing/PricingView.tsx & src/components/subscriptions/SubscriptionModal.tsx
- Didit KYC Verification:
  - API Route: src/app/api/kyc/create-session/route.ts (creates session with https://verification.didit.me/v3/session/ using DIDIT_API_KEY & DIDIT_WORKFLOW_ID)
  - Webhook Route: src/app/api/webhooks/didit/route.ts
  - UI Component: src/components/dashboard/KYCVerification.tsx
  - Gate Component: src/components/kyc/HardKYCGate.tsx
- Supabase Client & DB:
  - src/lib/supabase.ts & supabase/schema.sql
- Server & Routes:
  - server.ts & src/app/page.tsx
- Admin Control Panel:
  - src/app/admin/page.tsx & src/components/AdminBot.tsx

Core Operational Workflow:
- Inspect relevant files using \`readRepositoryFile\` (you can inspect multiple files across frontend, backend, hooks, and configs for a thorough diagnosis).
- Use \`listDirectory\` when you need to inspect directory contents or locate specific routes and files.
- If modifying code, use \`commitToGithub\` (which updates files locally in the workspace and pushes to GitHub if credentials exist).
- Deliver a comprehensive, actionable, and clear diagnostic text response for the admin explaining what is functional, what is misconfigured or missing, and how to resolve it.
- Tone: Professional, competent, helpful, concise.`;

    // 6. Normalize UI messages into ModelMessage[] format for streamText
    const modelMessages = await normalizeToModelMessages(messages);

    // 7. Invoke streamText with tools
    const result = streamText({
      model: google(modelName),
      system: systemPrompt,
      messages: modelMessages,
      prepareStep: ({ stepNumber }) => {
        // Allow up to 5 tool execution steps for thorough multi-file inspection, then force text synthesis step
        if (stepNumber >= 5) {
          return { toolChoice: 'none' };
        }
        return {};
      },
      stopWhen: ({ steps }) => steps.length >= 6,
      maxRetries: 2,
      tools: {
        listDirectory: tool({
          description:
            'List files and directories in a given repository folder (e.g. "src/app/api", "src/components", "src/hooks").',
          inputSchema: z.object({
            directoryPath: z.string().describe('The relative directory path to list, e.g. "src/app/api" or "src"'),
          }),
          execute: async ({ directoryPath }) => {
            const sanitize = (raw: string) => raw.replace(/^\/+/, '').trim();
            const targetDir = sanitize(directoryPath || 'src');
            const localDirPath = path.resolve(process.cwd(), targetDir);

            try {
              if (fs.existsSync(localDirPath) && fs.statSync(localDirPath).isDirectory()) {
                const entries = fs.readdirSync(localDirPath, { withFileTypes: true });
                const items = entries
                  .filter((e) => e.name !== 'node_modules' && e.name !== '.git' && e.name !== '.next' && e.name !== 'dist')
                  .map((e) => ({
                    name: e.name,
                    type: e.isDirectory() ? 'directory' : 'file',
                    path: path.join(targetDir, e.name).replace(/\\/g, '/'),
                  }));
                return {
                  success: true,
                  directory: targetDir,
                  items,
                  count: items.length,
                };
              }
              return {
                success: false,
                error: `Directory '${targetDir}' not found in local workspace.`,
              };
            } catch (err: any) {
              return {
                success: false,
                error: `Error listing directory '${targetDir}': ${err?.message || String(err)}`,
              };
            }
          },
        }),

        readRepositoryFile: tool({
          description:
            'Read the content of an existing file from the repository to inspect existing code before making changes.',
          inputSchema: z.object({
            filePath: z.string().describe('The path to the file in the repository, e.g. src/app/page.tsx'),
          }),
          execute: async ({ filePath }) => {
            // Intelligent alias resolver for legacy, partial, or shortened paths
            const sanitize = (raw: string) => raw.replace(/^\/+/, '').trim();
            const getResolvedPath = (target: string): string => {
              const cleaned = sanitize(target);
              const direct = path.resolve(process.cwd(), cleaned);
              if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
                return cleaned;
              }

              // Check common extensions if missing
              const extensions = ['.ts', '.tsx', '.js', '.jsx', '/route.ts', '/page.tsx', '/index.ts', '/index.tsx'];
              for (const ext of extensions) {
                const candidate = path.resolve(process.cwd(), cleaned + ext);
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                  return cleaned + ext;
                }
              }

              const lower = cleaned.toLowerCase();
              if (lower.includes('kycmodal') || (lower.includes('kyc') && lower.includes('modal'))) {
                return 'src/components/dashboard/KYCVerification.tsx';
              }
              if (lower.includes('paymentmodal') || (lower.includes('payment') && lower.includes('modal'))) {
                return 'src/components/subscriptions/SubscriptionModal.tsx';
              }
              if (
                lower.includes('create-order') ||
                lower.includes('create_order') ||
                lower.includes('createorder') ||
                lower.includes('payment/create') ||
                lower.includes('payment/create-order') ||
                (lower.includes('payment') && (lower.includes('api') || lower.includes('order') || lower.includes('create') || lower.includes('route')))
              ) {
                return 'src/app/api/razorpay/create-order/route.ts';
              }
              if (lower.includes('checkout') && lower.includes('razorpay')) {
                return 'src/app/api/checkout/razorpay/route.ts';
              }
              if (lower.includes('subscription') && lower.includes('razorpay')) {
                return 'src/app/api/razorpay/subscription/route.ts';
              }
              if (lower.includes('payment/verify') || (lower.includes('webhook') && lower.includes('razorpay')) || lower.includes('webhook')) {
                return 'src/app/api/webhooks/razorpay/route.ts';
              }
              if (lower.includes('pricing') || lower.includes('pricingview')) {
                return 'src/components/pricing/PricingView.tsx';
              }
              if (lower.includes('lib/razorpay') || lower === 'razorpay.ts') {
                return 'src/lib/razorpay.ts';
              }
              if (lower.includes('userazorpay') || lower === 'userazorpay.ts') {
                return 'src/hooks/useRazorpay.ts';
              }
              if (lower.includes('server') || lower === 'server.ts') {
                return 'server.ts';
              }
              if (lower.includes('adminbot') || lower.includes('admin-bot')) {
                return lower.includes('route') ? 'src/app/api/admin-bot/route.ts' : 'src/components/AdminBot.tsx';
              }

              // Recursive filesystem search for matching base name in src/
              try {
                const baseName = path.basename(cleaned);
                if (baseName) {
                  const findMatch = (dir: string): string | null => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                      const full = path.join(dir, entry.name);
                      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                        const sub = findMatch(full);
                        if (sub) return sub;
                      } else if (entry.isFile()) {
                        if (entry.name.toLowerCase() === baseName.toLowerCase() || entry.name.toLowerCase().startsWith(baseName.toLowerCase())) {
                          return path.relative(process.cwd(), full);
                        }
                      }
                    }
                    return null;
                  };
                  const matched = findMatch(path.resolve(process.cwd(), 'src'));
                  if (matched) return matched;
                }
              } catch (searchErr) {
                // ignore
              }

              return cleaned;
            };

            const targetFilePath = getResolvedPath(filePath);

            // Attempt 1: Prioritize reading directly from local filesystem (guaranteed in runtime environment)
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

            // Attempt 2: Fallback to reading via GitHub Octokit if credentials exist
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
                console.warn(`[Octokit read failed for ${targetFilePath}]:`, gitErr?.message);
              }
            }

            return {
              success: false,
              error: `File not found at '${filePath}'. Key files available: src/app/api/razorpay/create-order/route.ts, src/hooks/useRazorpay.ts, src/lib/razorpay.ts, src/components/pricing/PricingView.tsx, server.ts`,
            };
          },
        }),

        commitToGithub: tool({
          description:
            'Commit a new or updated file directly to the project repository and workspace, updating code immediately.',
          inputSchema: z.object({
            filePath: z.string().describe('The target file path, e.g. src/app/page.tsx'),
            fileContent: z.string().describe('The complete new raw source code/content of the file'),
            commitMessage: z.string().describe('The Git commit message describing the changes made'),
          }),
          execute: async ({ filePath, fileContent, commitMessage }) => {
            const sanitize = (raw: string) => raw.replace(/^\/+/, '').trim();
            const cleanPath = sanitize(filePath);
            const localPath = path.resolve(process.cwd(), cleanPath);

            // Always write changes to the local filesystem so they are immediately active in the dev server
            let localWritten = false;
            try {
              await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
              await fs.promises.writeFile(localPath, fileContent, 'utf-8');
              localWritten = true;
            } catch (fsErr: any) {
              console.error('[commitToGithub local write error]:', fsErr);
            }

            if (!octokit || !owner || !repo) {
              return {
                success: true,
                message: localWritten
                  ? `File ${cleanPath} updated successfully in local workspace! (GitHub remote commit skipped: GITHUB_PAT not configured).`
                  : `File update processed for ${cleanPath}.`,
                filePath: cleanPath,
                localSaved: localWritten,
              };
            }

            try {
              let sha: string | undefined = undefined;
              try {
                const existingFile = await octokit.rest.repos.getContent({
                  owner,
                  repo,
                  path: cleanPath,
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
                path: cleanPath,
                message: commitMessage,
                content: base64Content,
                branch: 'main',
                ...(sha ? { sha } : {}),
              });

              return {
                success: true,
                message: 'Code committed successfully to GitHub and applied locally.',
                filePath: cleanPath,
                commitSha: response.data.commit.sha,
                commitUrl: response.data.commit.html_url,
                localSaved: localWritten,
              };
            } catch (error: any) {
              return {
                success: localWritten,
                error: `Local changes saved, but GitHub push failed: ${error?.message || String(error)}`,
                filePath: cleanPath,
                localSaved: localWritten,
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
