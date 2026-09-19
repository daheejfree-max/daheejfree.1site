import { NextResponse } from 'next/server';
import { streamText, tool, isStepCount } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const githubPat = process.env.GITHUB_PAT;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!githubPat) {
      return NextResponse.json(
        { error: 'Server misconfiguration: GITHUB_PAT is missing from environment variables.' },
        { status: 500 }
      );
    }

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Server misconfiguration: GITHUB_OWNER or GITHUB_REPO is missing from environment variables.' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({
      auth: githubPat,
    });

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });

    const result = streamText({
      model: google('gemini-1.5-pro'),
      system: `You are DaheejFree's autonomous developer agent. When the admin requests a code change or new feature:
1. ALWAYS use the \`readRepositoryFile\` tool first to inspect the target file so you do not overwrite existing Tailwind CSS or logic.
2. Generate the updated Next.js/Tailwind code internally.
3. Use the \`commitToGithub\` tool to push the exact updated code to the repository. 
4. Inform the admin that Vercel is building the new feature and it will be live in a few minutes.`,
      messages,
      stopWhen: isStepCount(10),
      tools: {
        readRepositoryFile: tool({
          description: 'Read the raw content of an existing file from the GitHub repository to inspect existing code before making changes.',
          inputSchema: z.object({
            filePath: z.string().describe('The path to the file in the repository, e.g. src/app/page.tsx'),
          }),
          execute: async ({ filePath }) => {
            try {
              const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
              });

              const data = response.data;

              if (Array.isArray(data)) {
                return {
                  success: false,
                  error: `Path '${filePath}' is a directory, not a file.`,
                };
              }

              if ('content' in data && data.content) {
                const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
                return {
                  success: true,
                  filePath,
                  content: decodedContent,
                  sha: data.sha,
                };
              }

              return {
                success: false,
                error: `Unable to read content for '${filePath}'.`,
              };
            } catch (error: any) {
              if (error?.status === 404) {
                return {
                  success: false,
                  error: `File not found at '${filePath}'. If this is a new file, you can create it using commitToGithub.`,
                  status: 404,
                };
              }
              return {
                success: false,
                error: `Failed to fetch file from repository: ${error?.message || String(error)}`,
                status: error?.status,
              };
            }
          },
        }),

        commitToGithub: tool({
          description: 'Commit a new or updated file directly to the GitHub repository on the main branch, triggering the Vercel CI/CD pipeline.',
          inputSchema: z.object({
            filePath: z.string().describe('The target file path, e.g. src/app/page.tsx'),
            fileContent: z.string().describe('The complete new raw source code/content of the file'),
            commitMessage: z.string().describe('The Git commit message describing the changes made'),
          }),
          execute: async ({ filePath, fileContent, commitMessage }) => {
            try {
              // 1. Call octokit.rest.repos.getContent to check if the file already exists and get its sha
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
                  console.warn(`[Octokit] Notice while checking existing file:`, checkErr?.message);
                }
              }

              // 2. Encode the new fileContent string into Base64
              const base64Content = Buffer.from(fileContent, 'utf-8').toString('base64');

              // 3. Call octokit.rest.repos.createOrUpdateFileContents
              const response = await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: filePath,
                message: commitMessage,
                content: base64Content,
                branch: 'main',
                ...(sha ? { sha } : {}),
              });

              // 4. Return a success payload
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

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error('[Admin Bot Route Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error in Admin Bot' },
      { status: 500 }
    );
  }
}
