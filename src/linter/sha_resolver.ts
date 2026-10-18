import { KNOWN_ACTION_SHAS } from './sha_pinning.js';
import { createOctokitClient } from '../api/github_client.js';

const resolvedShaCache = new Map<string, { sha: string; versionComment: string }>();

// Prepopulate cache with known actions
for (const [key, val] of Object.entries(KNOWN_ACTION_SHAS)) {
  resolvedShaCache.set(key, val);
}

/**
 * Resolves the immutable commit SHA for any GitHub Action reference (e.g. "actions/checkout@v4" or "pnpm/action-setup@v2").
 * Queries the GitHub REST API if online, with caching and fallback.
 */
export async function resolveActionSha(
  actionRef: string,
  token?: string
): Promise<{ sha: string; versionComment: string } | null> {
  if (resolvedShaCache.has(actionRef)) {
    return resolvedShaCache.get(actionRef)!;
  }

  const atIndex = actionRef.lastIndexOf('@');
  if (atIndex === -1) return null;

  const actionPath = actionRef.substring(0, atIndex);
  const tag = actionRef.substring(atIndex + 1);

  // If already a 40-character SHA
  if (/^[a-f0-9]{40}$/i.test(tag)) {
    return { sha: tag, versionComment: 'pinned' };
  }

  // Parse owner and repo (ignoring sub-paths like docker/setup-buildx-action)
  const parts = actionPath.split('/');
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1];

  try {
    const octokit = createOctokitClient(token);

    // Try finding ref as tag
    try {
      const refData = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `tags/${tag}`,
      });

      const object = refData.data.object;
      let targetSha = object.sha;

      // If object is an annotated tag, resolve commit object
      if (object.type === 'tag') {
        const tagObj = await octokit.rest.git.getTag({
          owner,
          repo,
          tag_sha: object.sha,
        });
        targetSha = tagObj.data.object.sha;
      }

      const result = { sha: targetSha, versionComment: tag };
      resolvedShaCache.set(actionRef, result);
      return result;
    } catch {
      // If tags/tag didn't match, try commit or branch
      const commitData = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: tag,
      });

      const result = { sha: commitData.data.sha, versionComment: tag };
      resolvedShaCache.set(actionRef, result);
      return result;
    }
  } catch {
    // API rate limit or network unreachable
    return null;
  }
}
