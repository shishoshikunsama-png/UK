import { getUncachableGitHubClient } from './github';
import fs from 'fs';

async function pushToRepo() {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    const repo = 'T2';
    console.log(`Creating repo ${owner}/${repo} and pushing all files...`);
    
    try {
      await octokit.repos.createForAuthenticatedUser({ name: repo, private: false, auto_init: false });
      console.log('Repo created.');
    } catch (e: any) {
      if (e.status === 422) console.log('Repo already exists.');
      else throw e;
    }

    let baseTreeSha: string | undefined;
    try { const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' }); baseTreeSha = ref.object.sha; } catch (e) {}
    
    const allFiles: string[] = [];
    const walk = (dir: string) => {
      fs.readdirSync(dir).forEach(file => {
        const filePath = `${dir}/${file}`;
        if (fs.statSync(filePath).isDirectory()) {
          if (!['node_modules', '.git', 'dist', '.replit', '.cache', '.upm'].includes(file)) walk(filePath);
        } else allFiles.push(filePath);
      });
    };
    walk('.');
    
    const treeEntries: any[] = [];
    for (const filePath of allFiles) {
      const isBinary = !filePath.match(/\.(ts|tsx|js|jsx|json|html|css|md|txt|toml|yaml|yml)$/i);
      const content = isBinary ? fs.readFileSync(filePath).toString('base64') : fs.readFileSync(filePath, 'utf-8');
      const { data: blob } = await octokit.git.createBlob({ owner, repo, content, encoding: isBinary ? "base64" : "utf-8" });
      treeEntries.push({ path: filePath.replace(/^\.\//, ''), mode: '100644', type: 'blob', sha: blob.sha });
    }
    
    const { data: tree } = await octokit.git.createTree({ owner, repo, tree: treeEntries });
    const { data: commit } = await octokit.git.createCommit({
      owner, repo,
      message: 'Initial commit: Eden Bets landing page with new Telegram link',
      tree: tree.sha,
      parents: baseTreeSha ? [baseTreeSha] : []
    });
    
    if (baseTreeSha) {
      await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.sha, force: true });
    } else {
      await octokit.git.createRef({ owner, repo, ref: 'refs/heads/main', sha: commit.sha });
    }
    console.log('Successfully pushed to T2.');
  } catch (error: any) { console.error('Failed:', error.message); }
}
pushToRepo();
