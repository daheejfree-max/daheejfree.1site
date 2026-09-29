import { streamText, tool, isStepCount, convertToModelMessages, modelMessageSchema } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const config = {
  maxDuration: 60,
};

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
    console.warn('[AdminBot Edge] convertToModelMessages conversion warning:', err);
  }

  // Resilient fallback conversion if schema doesn't strictly match
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

// GET endpoint to inspect environment readiness
export async function GET() {
  const missing: string[] = [];
  if (!process.env.GITHUB_PAT) missing.push('GITHUB_PAT');
  if (!process.env.GITHUB_OWNER) missing.push('GITHUB_OWNER');
  if (!process.env.GITHUB_REPO) missing.push('GITHUB_REPO');
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GOOGLE_API_KEY) {
    missing.push('GEMINI_API_KEY');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  return Response.json({
    status: 'ok',
    model: modelName,
    githubConfigured: !missing.includes('GITHUB_PAT') && !missing.includes('GITHUB_OWNER') && !missing.includes('GITHUB_REPO'),
    missing,
  });
}

// POST endpoint for AI Chat stream
export async function POST(req: Request) {
  try {
    let messages: any[] = [];
    try {
      const body = await req.json();
      messages = Array.isArray(body?.messages) ? body.messages : [];
    } catch {
      messages = [];
    }

    if (!messages.length) {
      return Response.json({ error: 'No messages provided in request.' }, { status: 400 });
    }

    const githubPat = process.env.GITHUB_PAT;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const isGithubConfigured = Boolean(githubPat && owner && repo);

    let octokit: Octokit | null = null;
    if (isGithubConfigured && githubPat) {
      try {
        octokit = new Octokit({ auth: githubPat });
      } catch (octokitErr) {
        console.error('Failed to initialize Octokit:', octokitErr);
      }
    }

    const rawGeminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';
    const geminiKey = rawGeminiKey.trim().replace(/^["']|["']$/g, '');

    if (!geminiKey) {
      console.error('ADMIN BOT ERROR: Missing GEMINI_API_KEY.');
      return Response.json(
        { error: 'Server misconfiguration: GEMINI_API_KEY is missing from environment variables in Vercel settings.' },
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

    const systemPrompt = `You are DaheejFree's autonomous developer agent.
You assist the platform administrator with inspecting code, debugging, and executing software updates for the DaheejFree Matrimonial platform.

Current Environment Status:
- GitHub Integration: ${isGithubConfigured ? `Configured for ${owner}/${repo}` : 'Not fully configured in environment (Missing GITHUB_PAT, GITHUB_OWNER, or GITHUB_REPO).'}
- When GitHub is NOT configured:
  1. You can inspect files using \`readRepositoryFile\` (reads from local project workspace).
  2. If asked to commit or push code, explain that code is prepared, but direct commits require setting GITHUB_PAT, GITHUB_OWNER, and GITHUB_REPO in Vercel environment variables.
- When GitHub IS configured:
  1. Inspect target files before modifying them using \`readRepositoryFile\`.
  2. Write production-ready code.
  3. Use \`commitToGithub\` to commit and trigger Vercel deployment.

Key Platform Architecture & File Map:
- Didit KYC Verification:
  - API Route: src/app/api/kyc/create-session/route.ts
  - Webhook Route: src/app/api/webhooks/didit/route.ts
  - UI Component: src/components/dashboard/KYCVerification.tsx
- Razorpay / Payment Gateway:
  - API Routes: src/app/api/razorpay/create-order/route.ts, src/app/api/payment/create/route.ts
  - Hooks & Lib: src/hooks/useRazorpay.ts & src/lib/razorpay.ts
  - UI Component: src/components/pricing/PricingView.tsx & src/components/subscriptions/SubscriptionModal.tsx
- Supabase Client & DB:
  - src/lib/supabase.ts & supabase/schema.sql
- Admin Control Panel:
  - src/app/admin/page.tsx & src/components/AdminBot.tsx

Core Operational Workflow:
- Inspect relevant files using \`readRepositoryFile\` (you can inspect multiple files across frontend, backend, hooks, and configs for a thorough diagnosis).
- Use \`listDirectory\` when you need to inspect directory contents or locate specific routes and files.
- If modifying code, use \`commitToGithub\` (which updates files locally in the workspace and pushes to GitHub if credentials exist).
- Deliver a comprehensive, actionable, and clear diagnostic text response for the admin explaining what is functional, what is misconfigured or missing, and how to resolve it.
- Tone: Professional, competent, helpful, concise.`;

    // Normalize UI messages into ModelMessage[] format for streamText
    const modelMessages = await normalizeToModelMessages(messages);

    const result = streamText({
      model: google(modelName),
      system: systemPrompt,
      messages: modelMessages,
      prepareStep: ({ stepNumber }) => {
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
          execute: async ({ directoryPath }: { directoryPath: string }) => {
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
                error: `Directory '${targetDir}' not found.`,
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
          execute: async ({ filePath }: { filePath: string }) => {
            if (octokit && owner && repo) {
              try {
                const response = await octokit.rest.repos.getContent({
                  owner,
                  repo,
                  path: filePath,
                });

                const data = response.data;
                if (!Array.isArray(data) && 'content' in data && data.content) {
                  const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
                  return {
                    success: true,
                    filePath,
                    content: decodedContent,
                    sha: data.sha,
                    source: 'github',
                  };
                }
              } catch (gitErr: any) {
                console.warn(`[Octokit read failed for ${filePath}, falling back to local fs]:`, gitErr?.message);
              }
            }

            try {
              const sanitizedPath = filePath.replace(/^\/+/, '');
              const localFilePath = path.resolve(process.cwd(), sanitizedPath);

              if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
                const content = await fs.promises.readFile(localFilePath, 'utf-8');
                return {
                  success: true,
                  filePath,
                  content,
                  source: 'local-filesystem',
                };
              }
            } catch (fsErr: any) {
              console.warn(`[Local fs read error for ${filePath}]:`, fsErr?.message);
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
          execute: async ({ filePath, fileContent, commitMessage }: { filePath: string; fileContent: string; commitMessage: string }) => {
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

// Fallback Node.js Serverless Function handler for Vercel environments that invoke default export
export default async function handler(req: any, res: any) {
  // If invoked with Web Standard Request (Edge / Vercel Web handler)
  if (req instanceof Request || (req && typeof req.headers?.get === 'function')) {
    if (req.method === 'GET') return GET();
    return POST(req);
  }

  // If invoked with Node.js IncomingMessage / ServerResponse
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const webRes = await GET();
      const data = await webRes.json();
      return res.status(webRes.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error checking bot status' });
    }
  }

  if (req.method === 'POST') {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const url = `${protocol}://${host}${req.url || '/api/admin-bot'}`;

      let bodyData: any = req.body;
      if (typeof bodyData !== 'string') {
        bodyData = JSON.stringify(bodyData || {});
      }

      const webReq = new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(req.headers['authorization'] ? { authorization: req.headers['authorization'] } : {}),
        },
        body: bodyData,
      });

      const webRes = await POST(webReq);

      res.status(webRes.status);
      webRes.headers.forEach((val: string, key: string) => {
        if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-encoding') {
          res.setHeader(key, val);
        }
      });

      if (webRes.body) {
        const reader = webRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        return res.end();
      } else {
        const text = await webRes.text();
        return res.send(text);
      }
    } catch (err: any) {
      console.error('[Vercel /api/admin-bot error]:', err);
      return res.status(500).json({ error: err?.message || 'Internal server error in admin bot' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
