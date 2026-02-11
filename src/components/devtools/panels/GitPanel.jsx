import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "devcentric.repoPath";

function mapStatus(file) {
  const status = file.working_dir || file.index || "";
  if (status === "?" || status === "U") return "untracked";
  if (status === "A") return "added";
  if (status === "D") return "deleted";
  if (status === "R") return "renamed";
  return "modified";
}

function formatFile(file) {
  return {
    name: file.path,
    status: mapStatus(file),
  };
}

export default function GitPanel() {
  const [repoPath, setRepoPath] = useState("");
  const [branch, setBranch] = useState("");
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [files, setFiles] = useState([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState({ authenticated: false, user: null });
  const [deviceFlow, setDeviceFlow] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState("");
  const [repos, setRepos] = useState([]);
  const [repoQuery, setRepoQuery] = useState("");
  const [cloneDir, setCloneDir] = useState("");
  const [cloneBusy, setCloneBusy] = useState(false);

  const changedCount = files.length;

  const statusBadge = useMemo(() => {
    if (!repoPath) return "No repo";
    if (ahead || behind) return `Ahead ${ahead} / Behind ${behind}`;
    return "Up to date";
  }, [repoPath, ahead, behind]);

  const filteredRepos = useMemo(() => {
    if (!repoQuery) return repos;
    const q = repoQuery.toLowerCase();
    return repos.filter((r) => r.full_name.toLowerCase().includes(q));
  }, [repoQuery, repos]);

  const loadRepoData = async (path) => {
    if (!path) return;
    setLoading(true);
    setError("");

    try {
      const statusRes = await window.electronAPI?.gitStatus?.(path);
      if (!statusRes?.ok) {
        throw new Error(
          statusRes?.error || "Unable to read repository status.",
        );
      }
      const status = statusRes.status;
      setFiles((status.files || []).map(formatFile));
      setAhead(status.ahead || 0);
      setBehind(status.behind || 0);

      const branchRes = await window.electronAPI?.gitBranches?.(path);
      if (!branchRes?.ok) {
        throw new Error(branchRes?.error || "Unable to read branches.");
      }
      setBranch(branchRes.branches.current || "");
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = async () => {
    const result = await window.electronAPI?.selectRepo?.();
    if (!result || result.canceled) return;
    if (!result.ok) {
      setError(result.error || "Unable to select repository.");
      return;
    }
    setRepoPath(result.repoPath);
    localStorage.setItem(STORAGE_KEY, result.repoPath);
    loadRepoData(result.repoPath);
  };

  const handleCommit = async () => {
    if (!repoPath) return;
    setLoading(true);
    setError("");
    try {
      const res = await window.electronAPI?.gitCommit?.(repoPath, commitMsg);
      if (!res?.ok) throw new Error(res?.error || "Commit failed.");
      setCommitMsg("");
      await loadRepoData(repoPath);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || "";
    if (saved) {
      setRepoPath(saved);
      loadRepoData(saved);
    }
  }, []);

  useEffect(() => {
    const loadAuth = async () => {
      const res = await window.electronAPI?.githubStatus?.();
      if (res?.ok && res.authenticated) {
        setAuth({ authenticated: true, user: res.user });
      }
    };
    loadAuth();
  }, []);

  useEffect(() => {
    if (!deviceFlow) return undefined;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      const res = await window.electronAPI?.githubPoll?.(
        deviceFlow.device_code,
      );
      if (!res) return;
      if (res.ok && res.access_token) {
        setDeviceStatus("Authenticated");
        const status = await window.electronAPI?.githubStatus?.();
        if (status?.ok && status.authenticated) {
          setAuth({ authenticated: true, user: status.user });
        }
        setDeviceFlow(null);
        return;
      }
      if (res.error === "authorization_pending") {
        setDeviceStatus("Waiting for approval...");
      } else if (res.error === "slow_down") {
        setDeviceStatus("Slow down requested by GitHub...");
      } else if (res.error) {
        setDeviceStatus(res.error_description || res.error);
      }
      setTimeout(poll, (deviceFlow.interval || 5) * 1000);
    };

    poll();
    return () => {
      stopped = true;
    };
  }, [deviceFlow]);

  const startDeviceFlow = async () => {
    setError("");
    setDeviceStatus("");
    const res = await window.electronAPI?.githubDeviceCode?.();
    if (!res?.ok) {
      setError(res?.error || "Unable to start GitHub login.");
      return;
    }
    setDeviceFlow(res);
    setDeviceStatus("Follow the steps to authorize this app.");
  };

  const openVerification = async () => {
    if (!deviceFlow?.verification_uri) return;
    await window.electronAPI?.openExternal?.(deviceFlow.verification_uri);
  };

  const handleLogout = async () => {
    await window.electronAPI?.githubLogout?.();
    setAuth({ authenticated: false, user: null });
    setRepos([]);
  };

  const loadRepos = async (page = 1) => {
    setError("");
    const res = await window.electronAPI?.githubListRepos?.(page);
    if (!res?.ok) {
      setError(res?.error || "Unable to load repositories.");
      return;
    }
    setRepos((prev) => (page === 1 ? res.repos : [...prev, ...res.repos]));
  };

  const chooseCloneDir = async () => {
    const res = await window.electronAPI?.githubChooseCloneDir?.();
    if (res?.ok) setCloneDir(res.path);
  };

  const pathSep = () =>
    window.navigator.platform.toLowerCase().includes("win") ? "\\" : "/";

  const handleClone = async (repo) => {
    if (!cloneDir) {
      setError("Choose a storage folder before cloning.");
      return;
    }
    setCloneBusy(true);
    setError("");
    try {
      const target = `${cloneDir}${cloneDir.endsWith("/") || cloneDir.endsWith("\\") ? "" : pathSep()}${repo.name}`;
      const res = await window.electronAPI?.githubClone?.(
        repo.clone_url,
        target,
      );
      if (!res?.ok) throw new Error(res?.error || "Clone failed.");
      setRepoPath(target);
      localStorage.setItem(STORAGE_KEY, target);
      await loadRepoData(target);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setCloneBusy(false);
    }
  };

  return (
    <div className="tool-panel">
      <div className="git-panel__status">
        <div className="git-panel__repo">
          <span className="git-panel__repo-label">GitHub Account</span>
          <span className="git-panel__repo-path">
            {auth.authenticated
              ? `Signed in as ${auth.user?.login}`
              : "Not signed in"}
          </span>
          <div className="git-panel__repo-actions">
            {!auth.authenticated ? (
              <button className="git-panel__repo-btn" onClick={startDeviceFlow}>
                Sign in with GitHub
              </button>
            ) : (
              <button className="git-panel__repo-btn" onClick={handleLogout}>
                Sign out
              </button>
            )}
            {auth.authenticated && (
              <button
                className="git-panel__repo-btn"
                onClick={() => loadRepos(1)}
              >
                Load Repos
              </button>
            )}
          </div>
        </div>
        {deviceFlow && (
          <div className="git-panel__device">
            <div className="git-panel__device-row">
              1) Open: {deviceFlow.verification_uri}
            </div>
            <div className="git-panel__device-row">
              2) Enter code: <strong>{deviceFlow.user_code}</strong>
            </div>
            <div className="git-panel__device-actions">
              <button
                className="git-panel__repo-btn"
                onClick={openVerification}
              >
                Open Login
              </button>
            </div>
            <div className="git-panel__device-status">{deviceStatus}</div>
          </div>
        )}
      </div>
      {auth.authenticated && repos.length > 0 && (
        <div className="git-panel__repos">
          <div className="git-panel__repos-header">
            <input
              className="git-panel__repo-search"
              type="text"
              placeholder="Filter repositories..."
              value={repoQuery}
              onChange={(e) => setRepoQuery(e.target.value)}
            />
            <button className="git-panel__repo-btn" onClick={chooseCloneDir}>
              Choose Storage
            </button>
          </div>
          {cloneDir && (
            <div className="git-panel__repo-path">Storage: {cloneDir}</div>
          )}
          <div className="git-panel__repos-list">
            {filteredRepos.map((repo) => (
              <div key={repo.id} className="git-panel__repo-card">
                <div>
                  <div className="git-panel__repo-name">{repo.full_name}</div>
                  <div className="git-panel__repo-meta">
                    {repo.private ? "Private" : "Public"} •{" "}
                    {repo.default_branch}
                  </div>
                </div>
                <button
                  className="git-panel__repo-btn"
                  onClick={() => handleClone(repo)}
                  disabled={cloneBusy}
                >
                  Clone
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="git-panel__status">
        <div className="git-panel__repo">
          <span className="git-panel__repo-label">Repository</span>
          <span className="git-panel__repo-path">
            {repoPath || "Not selected"}
          </span>
          <div className="git-panel__repo-actions">
            <button className="git-panel__repo-btn" onClick={handleSelectRepo}>
              Select
            </button>
            <button
              className="git-panel__repo-btn"
              onClick={() => loadRepoData(repoPath)}
              disabled={!repoPath || loading}
            >
              Refresh
            </button>
          </div>
        </div>
        {error && <div className="git-panel__error">{error}</div>}
        <div className="git-panel__branch">
          <span className="git-panel__branch-icon">⎇</span>
          {branch || "No branch"}
          <span className="tool-panel__badge tool-panel__badge--info">
            {statusBadge}
          </span>
        </div>
      </div>
      <div className="tool-panel__header">
        <span className="tool-panel__title">Changed Files</span>
        <span className="tool-panel__badge tool-panel__badge--warn">
          {changedCount}
        </span>
      </div>
      <ul className="git-panel__file-list">
        {files.map((file, i) => (
          <li key={`${file.name}-${i}`} className="git-panel__file">
            <span
              className={`git-panel__file-status git-panel__file-status--${file.status}`}
            >
              {file.status === "modified"
                ? "M"
                : file.status === "added"
                  ? "A"
                  : file.status === "deleted"
                    ? "D"
                    : file.status === "renamed"
                      ? "R"
                      : "U"}
            </span>
            <span>{file.name}</span>
          </li>
        ))}
        {files.length === 0 && (
          <li className="git-panel__file git-panel__file--empty">
            No changes detected.
          </li>
        )}
      </ul>
      <div className="git-panel__commit-area">
        <textarea
          className="git-panel__commit-input"
          placeholder="Commit message (commits all changes)..."
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
        />
        <button
          className="git-panel__commit-btn"
          onClick={handleCommit}
          disabled={!repoPath || !commitMsg.trim() || loading}
        >
          Commit Changes
        </button>
      </div>
    </div>
  );
}
