#!/usr/bin/env node
/**
 * Orchestra PROCESS-TREE SUPERVISOR — the runners' kill-group around a
 * Codex-lane engine invocation.
 *
 * Purpose: guarantee that no process tree started by a Codex-lane order
 * survives the order. It is both a library (the exec / review / crossplan
 * runners `require` it) and a standalone CLI, so the guarantee can be
 * demonstrated against a deliberate hang without any Codex in the picture.
 *
 * ------------------------------------------------------------- WHY IT EXISTS
 *
 * Field evidence, 2026-09-15, Codex 0.154.0 on Windows: the Codex command
 * runner calls `preserve_descendants()` on the non-timeout root-exit branch
 * (`windows-sandbox-rs/src/bin/command_runner/win.rs`), and its PTY job helper
 * (`utils/pty/src/win/job.rs`) strips `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`
 * from the job it builds. Together those mean: any child still running when a
 * shell command returns OUTLIVES the run. An order that launches
 * `Godot_v4.6.3-stable_win64_console.exe --headless` and returns leaves the
 * engine running forever, owned by the sandbox identity, and every
 * quiet-machine benchmark gate on the project is blocked until someone finds
 * and kills it by hand.
 *
 * This is NOT an administrator problem. The owner account can `Stop-Process`
 * the survivors — the process DACL grants Everyone terminate rights — and
 * `windows.sandbox = "elevated"` only describes admin-approved sandbox SETUP,
 * not the privileges the orphan holds. So the fix belongs where the run is
 * owned: in the runner, not in the project, and not in the order's prose.
 *
 * --------------------------------------------------------- WHAT IT GUARANTEES
 *
 * The runner — not Codex — owns a kill group for the whole invocation:
 *
 *   Windows   a Job object created by this supervisor with
 *             JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE and WITHOUT
 *             JOB_OBJECT_LIMIT_BREAKAWAY_OK / SILENT_BREAKAWAY_OK. The handle
 *             is held open by a tiny PowerShell holder process for the run's
 *             lifetime, so losing the supervisor (a kill -9, a TaskStop that
 *             does not walk the tree) closes the handle and the kernel reaps
 *             the tree for us. Nested jobs: on Windows 8+ a child MAY create
 *             its own job inside ours, but a nested job cannot escape the
 *             outer job's KILL_ON_JOB_CLOSE — only a process created with
 *             CREATE_BREAKAWAY_FROM_JOB can, and that requires
 *             JOB_OBJECT_LIMIT_BREAKAWAY_OK on the OUTER job, which this
 *             supervisor never sets. That is why Codex's own job stripping
 *             KILL_ON_JOB_CLOSE cannot defeat this one.
 *
 *   POSIX     a new process group (`detached: true` → `setsid`), signalled as
 *             a group. A descendant that calls `setsid()` itself leaves the
 *             group — the same class of hole as CREATE_BREAKAWAY_FROM_JOB —
 *             and is caught by the census reaper below instead.
 *
 * On top of the kill group, and as the documented FALLBACK for anything that
 * escaped it, every run ends with a CENSUS: the supervisor enumerates the
 * kill group (on Windows, `JobObjectBasicProcessIdList`) AND walks the
 * parent/child table down from the engine PID, merges the two, and reports
 * every process that outlived the engine with its image name and creation
 * time. With reaping on (the default) it then kills them and re-censuses, so
 * the report distinguishes "killed" from "would not die".
 *
 * The census is keyed on the run token the runner generated, and lands in the
 * runner's report header as `SURVIVORS: none` or an explicit PID list — a
 * Director sees orphans without dispatching a separate scout.
 *
 * ------------------------------------------------------------------ RECEIPT
 *
 * Every supervised run writes a receipt JSON (`--receipt <file>`), written
 * once at launch (so a supervisor that is itself killed still leaves the
 * engine PID behind for a last-ditch sweep) and rewritten at the end:
 *
 *   { schema, token, platform, mechanism, mechanismNote, killSurvivors,
 *     deadlineMs, startedAt, endedAt, elapsedMs, targetPid, exit: {code,
 *     signal}, timedOut, cancelled, parentVanished, spawnError,
 *     census: { before: [...], survivors: [...], killed: [...],
 *               stubborn: [...], source, unavailable },
 *     notes: [...] }
 *
 * A census entry is `{ pid, ppid, image, started, via }` — `via` being
 * `job` (in the kill group) or `descendant` (found by walking parentage).
 *
 * ----------------------------------------------------------------- EXIT CODES
 *
 * The supervisor is transparent about the target's fate: it exits with the
 * target's own exit code, or 128+N when a signal killed it, 124 when the
 * deadline fired (GNU `timeout`'s convention) and 127 when the target could
 * not be launched at all. `superviseSync()` maps those back onto a
 * `spawnSync`-shaped result so callers' existing exit forensics keep working
 * unchanged.
 *
 * ------------------------------------------------------------------ CLI USAGE
 *
 *   node orchestra-jobrun.js [--receipt <file>] [--deadline-ms <n>]
 *        [--grace-ms <n>] [--token <t>] [--kill-survivors|--preserve-survivors]
 *        -- <command> [args...]
 *
 * Demonstrate the guarantee against a deliberate hang:
 *
 *   node orchestra-jobrun.js --receipt r.json -- \
 *     node -e "require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1e3)'],{detached:true,stdio:'ignore'}).unref()"
 *
 * `r.json` then names the orphan, and the orphan is gone by the time the
 * command returns.
 *
 * ------------------------------------------------------------------ ESCAPE HATCH
 *
 *   ORCHESTRA_JOBRUN=off   Runners skip supervision entirely. Recorded in
 *                          their report headers as `supervision: off`, because
 *                          a guarantee that silently stopped applying is worse
 *                          than one that was never claimed.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const IS_WINDOWS = process.platform === 'win32';

const RECEIPT_SCHEMA = 'orchestra-jobrun/1';
const DEFAULT_GRACE_MS = 2000;
// GNU `timeout`'s convention for "the deadline fired", and 127 for "could not
// execute" — both chosen so a human reading a bare exit code is not misled.
const EXIT_TIMEOUT = 124;
const EXIT_SPAWN_FAILED = 127;
// How long the final census waits for the Windows holder to finish compiling
// its P/Invoke shim. Only ever paid when the engine outlived the compile,
// which is every real run and no fast stub.
const HOLDER_READY_TIMEOUT_MS = 30000;
// The parent-death poll. A TaskStop, a `kill -9` on the launcher, or a closed
// terminal all show up as "my parent is gone"; the tree dies with it.
//
// Windows polls far more slowly because its liveness test costs a process
// launch (see parentAlive): five seconds is a fine detection latency for a
// cancelled run, and 0.02% of a poll's duty cycle is nothing next to a
// two-hour cap.
const PARENT_POLL_MS = IS_WINDOWS ? 5000 : 500;

// --------------------------------------------------------------- process table
//
// One shape for both platforms: { pid, ppid, image, started, cmdline }.
// `started` is an ISO timestamp or '' — it is evidence for a human reading the
// census ("that Godot has been up since before this order"), never a key the
// reaper matches on, so a platform that cannot supply it degrades to a census
// that is merely less informative.

function isAlive(pid) {
  if (!(pid > 0)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means it exists and is not ours to signal — still alive.
    return !!(e && e.code === 'EPERM');
  }
}

// FIX (Windows CI, 2026-09-17): isAlive() above is a correct liveness test on
// POSIX and NOT one on Windows. `process.kill(pid, 0)` is an OpenProcess, and
// OpenProcess keeps succeeding for a process that has already exited while any
// handle to it remains open — so a killed parent read as alive forever, the
// parent watch never fired, and a supervisor whose launcher had been killed
// sat waiting on the engine instead of reaping it. The cancellation case in
// tests/jobrun.test.js caught it: `cancelled:false, parentVanished:false` with
// no notes at all, 15s after the launcher was SIGKILLed.
//
// `tasklist` lists only RUNNING processes, so it answers the question asked.
// It costs a process launch (~60ms), which is why PARENT_POLL_MS is slow on
// Windows. An answer we cannot get reads as "alive": killing a tree because a
// diagnostic failed would be far worse than watching one a little longer.
function parentAlive(pid) {
  if (!(pid > 0)) return false;
  if (!IS_WINDOWS) return isAlive(pid);
  const r = spawnSync('tasklist', ['/FI', 'PID eq ' + pid, '/NH', '/FO', 'CSV'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  });
  if (r.error || r.status !== 0 || typeof r.stdout !== 'string') return true;
  return new RegExp('"' + pid + '"').test(r.stdout);
}

// Linux (and any /proc-carrying kernel): read the table directly. No
// subprocess, so the census costs nothing on the platform the suites run
// fastest on.
function snapshotProc() {
  let names;
  try {
    names = fs.readdirSync('/proc');
  } catch (_) {
    return null;
  }
  const rows = [];
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue;
    let stat;
    try {
      stat = fs.readFileSync('/proc/' + name + '/stat', 'utf8');
    } catch (_) {
      continue; // it exited between the readdir and here
    }
    // Field 2 (comm) is parenthesised and may itself contain spaces and
    // parentheses, so the split point is the LAST ')' — the documented way to
    // parse /proc/<pid>/stat.
    const close = stat.lastIndexOf(')');
    const open = stat.indexOf('(');
    if (close < 0 || open < 0) continue;
    const image = stat.slice(open + 1, close);
    const rest = stat.slice(close + 2).split(' ');
    // rest[0] is field 3 (state), so field N is rest[N - 3].
    const ppid = parseInt(rest[1], 10);
    const pgid = parseInt(rest[2], 10);
    let started = '';
    try {
      // On Linux the /proc/<pid> directory's ctime IS the process start time.
      started = fs.statSync('/proc/' + name).ctime.toISOString();
    } catch (_) {
      /* an exiting process has no start time to report */
    }
    let cmdline = '';
    try {
      cmdline = fs
        .readFileSync('/proc/' + name + '/cmdline', 'utf8')
        .replace(/\0+$/, '')
        .replace(/\0/g, ' ');
    } catch (_) {
      /* kernel threads and exiting processes have none */
    }
    rows.push({ pid: parseInt(name, 10), ppid, pgid, image, started, cmdline });
  }
  return rows;
}

// Every other POSIX. `etime` is POSIX-specified; `lstart` is not, so the start
// time is reconstructed from the elapsed time rather than parsed from a format
// that differs per platform.
function snapshotPs() {
  const r = spawnSync('ps', ['-e', '-o', 'pid=,ppid=,pgid=,etime=,comm='], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.error || r.status !== 0 || !r.stdout) return null;
  const now = Date.now();
  const rows = [];
  for (const line of r.stdout.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    rows.push({
      pid: parseInt(m[1], 10),
      ppid: parseInt(m[2], 10),
      pgid: parseInt(m[3], 10),
      image: m[5].trim(),
      started: elapsedToIso(m[4], now),
      cmdline: '',
    });
  }
  return rows.length ? rows : null;
}

// `[[dd-]hh:]mm:ss` → an ISO start time. A shape ps did not produce yields ''
// rather than a wrong timestamp.
function elapsedToIso(etime, now) {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(String(etime).trim());
  if (!m) return '';
  const secs =
    parseInt(m[1] || '0', 10) * 86400 +
    parseInt(m[2] || '0', 10) * 3600 +
    parseInt(m[3], 10) * 60 +
    parseInt(m[4], 10);
  return new Date(now - secs * 1000).toISOString();
}

// Windows has no /proc and no ps. One CIM query answers the whole table,
// including the creation time the census reports. `Get-CimInstance` is
// preferred over the removed-in-recent-Windows `wmic`.
function snapshotWindows() {
  const ps = powershellBin();
  if (!ps) return null;
  const script =
    "$ErrorActionPreference='Stop';" +
    'Get-CimInstance Win32_Process | ForEach-Object {' +
    " $t=''; if ($_.CreationDate) { $t=$_.CreationDate.ToUniversalTime().ToString('o') };" +
    " '{0}|{1}|{2}|{3}' -f $_.ProcessId,$_.ParentProcessId,$_.Name,$t }";
  const r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error || r.status !== 0 || !r.stdout) return null;
  const rows = [];
  for (const line of r.stdout.split('\n')) {
    const parts = line.trim().split('|');
    if (parts.length < 3) continue;
    const pid = parseInt(parts[0], 10);
    if (!Number.isFinite(pid)) continue;
    rows.push({
      pid,
      ppid: parseInt(parts[1], 10) || 0,
      pgid: 0, // Windows has no process groups in the POSIX sense
      image: parts[2] || '',
      started: parts[3] || '',
      cmdline: '',
    });
  }
  return rows.length ? rows : null;
}

// The last table `snapshot()` produced and where it came from. The census
// reports its own source, and recomputing a whole /proc scan just to name it
// would double the cost of every census.
let LAST_SNAPSHOT_SOURCE = '';

function snapshot() {
  if (IS_WINDOWS) {
    const rows = snapshotWindows();
    LAST_SNAPSHOT_SOURCE = rows ? 'Win32_Process' : '';
    return rows;
  }
  const proc = snapshotProc();
  if (proc) {
    LAST_SNAPSHOT_SOURCE = '/proc';
    return proc;
  }
  const ps = snapshotPs();
  LAST_SNAPSHOT_SOURCE = ps ? 'ps' : '';
  return ps;
}

let POWERSHELL_BIN = null;
function powershellBin() {
  if (POWERSHELL_BIN !== null) return POWERSHELL_BIN;
  POWERSHELL_BIN = '';
  if (!IS_WINDOWS) return POWERSHELL_BIN;
  for (const cand of [process.env.ORCHESTRA_POWERSHELL, 'powershell.exe', 'pwsh.exe']) {
    if (!cand) continue;
    const probe = spawnSync(cand, ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
    });
    if (!probe.error && probe.status === 0) {
      POWERSHELL_BIN = cand;
      break;
    }
  }
  return POWERSHELL_BIN;
}

// Every process under `rootPid` in the parent/child table. On Windows the
// parent PID field SURVIVES the parent's death, which is exactly what makes
// this usable as the orphan reaper; the creation-time guard keeps a recycled
// PID from adopting an unrelated process (a child cannot predate its parent).
function descendantsOf(table, rootPid, rootStarted) {
  if (!Array.isArray(table)) return [];
  const byParent = new Map();
  for (const row of table) {
    if (!byParent.has(row.ppid)) byParent.set(row.ppid, []);
    byParent.get(row.ppid).push(row);
  }
  // Clock tolerance: `rootStarted` is read from Date.now() at launch while a
  // child's timestamp comes from the kernel, so an immediately-spawned child
  // can legitimately read a hair earlier. Five seconds is far below any PID
  // recycling interval and far above any clock-source skew.
  const PID_REUSE_TOLERANCE_MS = 5000;
  const rootTime = rootStarted ? Date.parse(rootStarted) - PID_REUSE_TOLERANCE_MS : NaN;
  const out = [];
  const seen = new Set([rootPid]);
  const queue = [rootPid];
  while (queue.length) {
    const pid = queue.shift();
    for (const row of byParent.get(pid) || []) {
      if (seen.has(row.pid)) continue;
      // PID reuse: a "child" that started before its parent is a different
      // process wearing a recycled number.
      const childTime = row.started ? Date.parse(row.started) : NaN;
      if (Number.isFinite(rootTime) && Number.isFinite(childTime) && childTime < rootTime) continue;
      seen.add(row.pid);
      out.push(row);
      queue.push(row.pid);
    }
  }
  return out;
}

function groupMembers(table, pgid) {
  if (!Array.isArray(table) || !(pgid > 0)) return [];
  return table.filter((row) => row.pgid === pgid);
}

function censusEntry(row, via) {
  return {
    pid: row.pid,
    ppid: row.ppid,
    image: row.image || '(unknown)',
    started: row.started || '',
    via,
  };
}

function mergeCensus(lists) {
  const byPid = new Map();
  for (const list of lists) {
    for (const entry of list) {
      const prev = byPid.get(entry.pid);
      if (!prev) byPid.set(entry.pid, entry);
      else if (prev.via !== entry.via) prev.via = 'job+descendant';
    }
  }
  return Array.from(byPid.values()).sort((a, b) => a.pid - b.pid);
}

// ------------------------------------------------------- the Windows job holder
//
// A PowerShell process whose only job is to hold the Job handle open. It is
// deliberately NOT this Node process: KILL_ON_JOB_CLOSE fires when the LAST
// handle closes, so the guarantee must survive the supervisor being killed
// without a chance to clean up — which is precisely the TaskStop case.
//
// Protocol, one line each way on stdin/stdout:
//
//   → (holder emits) READY <jobname>        | FATAL <message>
//   ← ASSIGN <pid>      → ASSIGNED <pid> OK | ASSIGNED <pid> ERR <message>
//   ← CENSUS            → PROC <pid>|<image>|<startedIso> … then CENSUS-END
//   ← KILL <pid>        → KILLED <pid> OK   | KILLED <pid> ERR <message>
//   ← TERMINATE         → TERMINATED OK     | TERMINATED ERR <message>
//   ← BYE               → holder exits, closing the handle
//
// The protocol is the seam the tests drive: ORCHESTRA_JOBRUN_HOLDER lets a
// stub holder stand in for PowerShell, so the driver — the part with the
// ordering bugs — is exercised on every platform, not only on Windows.

const HOLDER_PS1 = [
  'param([string]$JobName, [int]$KillOnClose = 1)',
  '$ErrorActionPreference = "Stop"',
  '$OutputEncoding = [System.Text.Encoding]::ASCII',
  'try {',
  '  Add-Type -TypeDefinition @"',
  'using System;',
  'using System.Collections.Generic;',
  'using System.Runtime.InteropServices;',
  'public static class OrchestraJob {',
  '  [StructLayout(LayoutKind.Sequential)]',
  '  public struct IO_COUNTERS {',
  '    public UInt64 ReadOperationCount; public UInt64 WriteOperationCount;',
  '    public UInt64 OtherOperationCount; public UInt64 ReadTransferCount;',
  '    public UInt64 WriteTransferCount; public UInt64 OtherTransferCount;',
  '  }',
  '  [StructLayout(LayoutKind.Sequential)]',
  '  public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {',
  '    public Int64 PerProcessUserTimeLimit; public Int64 PerJobUserTimeLimit;',
  '    public UInt32 LimitFlags; public UIntPtr MinimumWorkingSetSize;',
  '    public UIntPtr MaximumWorkingSetSize; public UInt32 ActiveProcessLimit;',
  '    public UIntPtr Affinity; public UInt32 PriorityClass; public UInt32 SchedulingClass;',
  '  }',
  '  [StructLayout(LayoutKind.Sequential)]',
  '  public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {',
  '    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;',
  '    public IO_COUNTERS IoInfo; public UIntPtr ProcessMemoryLimit;',
  '    public UIntPtr JobMemoryLimit; public UIntPtr PeakProcessMemoryUsed;',
  '    public UIntPtr PeakJobMemoryUsed;',
  '  }',
  '  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]',
  '  static extern IntPtr CreateJobObjectW(IntPtr attrs, string name);',
  '  [DllImport("kernel32.dll", SetLastError = true)]',
  '  static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint len);',
  '  [DllImport("kernel32.dll", SetLastError = true)]',
  '  static extern bool QueryInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint len, IntPtr ret);',
  '  [DllImport("kernel32.dll", SetLastError = true)]',
  '  static extern bool AssignProcessToJobObject(IntPtr job, IntPtr proc);',
  '  [DllImport("kernel32.dll", SetLastError = true)]',
  '  static extern bool TerminateJobObject(IntPtr job, uint exitCode);',
  '  [DllImport("kernel32.dll", SetLastError = true)]',
  '  static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);',
  '  [DllImport("kernel32.dll", SetLastError = true)]',
  '  static extern bool TerminateProcess(IntPtr h, uint code);',
  '  [DllImport("kernel32.dll", SetLastError = true)]',
  '  static extern bool CloseHandle(IntPtr h);',
  '  // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE. BREAKAWAY_OK (0x0800) and',
  '  // SILENT_BREAKAWAY_OK (0x1000) are deliberately NOT set: without them a',
  '  // child cannot use CREATE_BREAKAWAY_FROM_JOB to escape, so a nested job',
  '  // that strips its own KILL_ON_JOB_CLOSE still dies with ours.',
  '  const uint KILL_ON_JOB_CLOSE = 0x2000;',
  '  const int ExtendedLimitInformation = 9;',
  '  const int BasicProcessIdList = 3;',
  '  const uint PROCESS_TERMINATE = 0x0001;',
  '  const uint PROCESS_SET_QUOTA = 0x0100;',
  '  public static IntPtr Job = IntPtr.Zero;',
  '  public static string Create(string name, bool killOnClose) {',
  '    Job = CreateJobObjectW(IntPtr.Zero, name);',
  '    if (Job == IntPtr.Zero) return "CreateJobObject failed: " + Marshal.GetLastWin32Error();',
  '    if (killOnClose) {',
  '      var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();',
  '      info.BasicLimitInformation.LimitFlags = KILL_ON_JOB_CLOSE;',
  '      int len = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));',
  '      IntPtr buf = Marshal.AllocHGlobal(len);',
  '      try {',
  '        Marshal.StructureToPtr(info, buf, false);',
  '        if (!SetInformationJobObject(Job, ExtendedLimitInformation, buf, (uint)len))',
  '          return "SetInformationJobObject failed: " + Marshal.GetLastWin32Error();',
  '      } finally { Marshal.FreeHGlobal(buf); }',
  '    }',
  '    return "";',
  '  }',
  '  public static string Assign(int pid) {',
  '    IntPtr h = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, false, (uint)pid);',
  '    if (h == IntPtr.Zero) return "OpenProcess failed: " + Marshal.GetLastWin32Error();',
  '    try {',
  '      if (!AssignProcessToJobObject(Job, h)) return "AssignProcessToJobObject failed: " + Marshal.GetLastWin32Error();',
  '    } finally { CloseHandle(h); }',
  '    return "";',
  '  }',
  '  public static List<int> Members() {',
  '    var pids = new List<int>();',
  '    int header = IntPtr.Size == 8 ? 8 : 8;',
  '    int cap = 4096;',
  '    int len = header + IntPtr.Size * cap;',
  '    IntPtr buf = Marshal.AllocHGlobal(len);',
  '    try {',
  '      for (int i = 0; i < len; i++) Marshal.WriteByte(buf, i, 0);',
  '      Marshal.WriteInt32(buf, 0, cap);',
  '      if (!QueryInformationJobObject(Job, BasicProcessIdList, buf, (uint)len, IntPtr.Zero)) return pids;',
  '      int count = Marshal.ReadInt32(buf, 4);',
  '      if (count > cap) count = cap;',
  '      for (int i = 0; i < count; i++) {',
  '        IntPtr v = Marshal.ReadIntPtr(buf, header + IntPtr.Size * i);',
  '        pids.Add((int)v.ToInt64());',
  '      }',
  '    } finally { Marshal.FreeHGlobal(buf); }',
  '    return pids;',
  '  }',
  '  public static string Kill(int pid) {',
  '    IntPtr h = OpenProcess(PROCESS_TERMINATE, false, (uint)pid);',
  '    if (h == IntPtr.Zero) return "OpenProcess failed: " + Marshal.GetLastWin32Error();',
  '    try { if (!TerminateProcess(h, 1)) return "TerminateProcess failed: " + Marshal.GetLastWin32Error(); }',
  '    finally { CloseHandle(h); }',
  '    return "";',
  '  }',
  '  public static string TerminateAll() {',
  '    if (!TerminateJobObject(Job, 1)) return "TerminateJobObject failed: " + Marshal.GetLastWin32Error();',
  '    return "";',
  '  }',
  '}',
  '"@',
  '  $err = [OrchestraJob]::Create($JobName, ($KillOnClose -ne 0))',
  '  if ($err -ne "") { Write-Output ("FATAL " + $err); exit 1 }',
  '} catch {',
  '  Write-Output ("FATAL " + $_.Exception.Message)',
  '  exit 1',
  '}',
  'Write-Output ("READY " + $JobName)',
  '$procCache = $null',
  'while ($true) {',
  '  $line = [Console]::In.ReadLine()',
  '  if ($null -eq $line) { break }',
  '  $line = $line.Trim()',
  '  if ($line -eq "BYE") { break }',
  '  elseif ($line -match "^ASSIGN (\\d+)$") {',
  '    $e = [OrchestraJob]::Assign([int]$Matches[1])',
  '    if ($e -eq "") { Write-Output ("ASSIGNED " + $Matches[1] + " OK") }',
  '    else { Write-Output ("ASSIGNED " + $Matches[1] + " ERR " + $e) }',
  '  }',
  '  elseif ($line -eq "CENSUS") {',
  '    $members = [OrchestraJob]::Members()',
  '    if ($members.Count -gt 0) {',
  '      try { $procCache = @{}; Get-CimInstance Win32_Process | ForEach-Object { $procCache[[int]$_.ProcessId] = $_ } } catch { $procCache = $null }',
  '    }',
  '    foreach ($m in $members) {',
  '      $img = "(unknown)"; $t = ""',
  '      if ($procCache -ne $null -and $procCache.ContainsKey([int]$m)) {',
  '        $p = $procCache[[int]$m]; $img = $p.Name',
  '        if ($p.CreationDate) { $t = $p.CreationDate.ToUniversalTime().ToString("o") }',
  '      }',
  '      Write-Output ("PROC " + $m + "|" + $img + "|" + $t)',
  '    }',
  '    Write-Output "CENSUS-END"',
  '  }',
  '  elseif ($line -match "^KILL (\\d+)$") {',
  '    $e = [OrchestraJob]::Kill([int]$Matches[1])',
  '    if ($e -eq "") { Write-Output ("KILLED " + $Matches[1] + " OK") }',
  '    else { Write-Output ("KILLED " + $Matches[1] + " ERR " + $e) }',
  '  }',
  '  elseif ($line -eq "TERMINATE") {',
  '    $e = [OrchestraJob]::TerminateAll()',
  '    if ($e -eq "") { Write-Output "TERMINATED OK" } else { Write-Output ("TERMINATED ERR " + $e) }',
  '  }',
  '}',
  'exit 0',
].join('\n');

// The driver for that protocol. Everything it does is line-oriented and
// request/response, so a stub holder is a faithful stand-in.
class JobHolder {
  constructor(opts) {
    this.opts = opts || {};
    this.proc = null;
    this.buffer = '';
    this.lines = [];
    this.waiters = [];
    this.ready = null;
    this.failed = '';
    this.closed = false;
    this.jobName = 'OrchestraRun_' + process.pid + '_' + Date.now().toString(36);
    this.scriptFile = '';
  }

  // Spawns the holder and returns as soon as the process exists; `this.ready`
  // resolves when it answers READY (or false when it cannot). Callers must
  // await that before launching anything they intend the job to hold — see the
  // note at the launch site in supervise().
  start() {
    const custom = (process.env.ORCHESTRA_JOBRUN_HOLDER || '').trim();
    let bin;
    let args;
    if (custom) {
      // Test seam: a stub holder speaking the same protocol.
      bin = process.execPath;
      args = [custom, '--job-name', this.jobName, '--kill-on-close', this.opts.killOnClose ? '1' : '0'];
    } else {
      const ps = powershellBin();
      if (!ps) {
        this.failed = 'no PowerShell interpreter found (tried powershell.exe, pwsh.exe)';
        return false;
      }
      try {
        this.scriptFile = path.join(
          this.opts.scratchDir || os.tmpdir(),
          'orchestra-jobholder-' + process.pid + '.ps1'
        );
        fs.writeFileSync(this.scriptFile, HOLDER_PS1, 'utf8');
      } catch (e) {
        this.failed = 'could not write the job holder script: ' + ((e && e.message) || e);
        return false;
      }
      bin = ps;
      args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        this.scriptFile,
        '-JobName',
        this.jobName,
        '-KillOnClose',
        this.opts.killOnClose ? '1' : '0',
      ];
    }
    try {
      this.proc = spawn(bin, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (e) {
      this.failed = 'could not start the job holder: ' + ((e && e.message) || e);
      return false;
    }
    this.proc.on('error', (e) => {
      this.failed = this.failed || 'job holder failed: ' + ((e && e.message) || e);
      this.closed = true;
      this._drainWaiters();
    });
    this.proc.on('exit', () => {
      this.closed = true;
      this._drainWaiters();
    });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => this._onData(chunk));
    // The holder's stderr is diagnostics only; keep it out of the engine's
    // streams and surface it through the receipt instead.
    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', (chunk) => {
      this.stderr = (this.stderr || '') + chunk;
    });
    this.ready = this._expect(/^(READY|FATAL) /).then((line) => {
      if (/^FATAL /.test(line)) {
        this.failed = line.slice(6);
        return false;
      }
      return true;
    });
    return true;
  }

  _onData(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '').trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line) this.lines.push(line);
    }
    this._drainWaiters();
  }

  _drainWaiters() {
    while (this.waiters.length) {
      const waiter = this.waiters[0];
      const i = this.lines.findIndex((l) => waiter.match.test(l));
      if (i !== -1) {
        const line = this.lines.splice(i, 1)[0];
        this.waiters.shift();
        clearTimeout(waiter.timer);
        waiter.resolve(line);
        continue;
      }
      if (this.closed) {
        this.waiters.shift();
        clearTimeout(waiter.timer);
        waiter.resolve('');
        continue;
      }
      return;
    }
  }

  _expect(match, timeoutMs) {
    return new Promise((resolve) => {
      const waiter = { match, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        const i = this.waiters.indexOf(waiter);
        if (i !== -1) this.waiters.splice(i, 1);
        resolve('');
      }, timeoutMs || this.opts.timeoutMs || HOLDER_READY_TIMEOUT_MS);
      if (waiter.timer.unref) waiter.timer.unref();
      this.waiters.push(waiter);
      this._drainWaiters();
    });
  }

  _send(line) {
    if (!this.proc || this.closed || !this.proc.stdin.writable) return false;
    try {
      this.proc.stdin.write(line + '\n');
      return true;
    } catch (_) {
      return false;
    }
  }

  async assign(pid) {
    const ok = await this.ready;
    if (!ok) return this.failed || 'job holder never became ready';
    if (!this._send('ASSIGN ' + pid)) return 'job holder is gone';
    const line = await this._expect(new RegExp('^ASSIGNED ' + pid + ' '));
    if (!line) return 'job holder did not answer the assignment';
    const m = /^ASSIGNED \d+ (OK|ERR)(?: (.*))?$/.exec(line);
    return m && m[1] === 'OK' ? '' : (m && m[2]) || 'assignment refused';
  }

  async members() {
    const ok = await this.ready;
    if (!ok) return null;
    if (!this._send('CENSUS')) return null;
    const rows = [];
    for (;;) {
      const line = await this._expect(/^(PROC |CENSUS-END$)/);
      if (!line || line === 'CENSUS-END') break;
      const parts = line.slice(5).split('|');
      const pid = parseInt(parts[0], 10);
      if (!Number.isFinite(pid)) continue;
      rows.push({ pid, ppid: 0, pgid: 0, image: parts[1] || '', started: parts[2] || '', cmdline: '' });
    }
    return rows;
  }

  async kill(pid) {
    const ok = await this.ready;
    if (!ok) return this.failed || 'job holder never became ready';
    if (!this._send('KILL ' + pid)) return 'job holder is gone';
    const line = await this._expect(new RegExp('^KILLED ' + pid + ' '));
    if (!line) return 'job holder did not answer the kill';
    const m = /^KILLED \d+ (OK|ERR)(?: (.*))?$/.exec(line);
    return m && m[1] === 'OK' ? '' : (m && m[2]) || 'kill refused';
  }

  async terminate() {
    const ok = await this.ready;
    if (!ok) return this.failed || 'job holder never became ready';
    if (!this._send('TERMINATE')) return 'job holder is gone';
    const line = await this._expect(/^TERMINATED /);
    if (!line) return 'job holder did not answer the terminate';
    return /^TERMINATED OK$/.test(line) ? '' : line.replace(/^TERMINATED ERR /, '');
  }

  // Closing the holder closes the LAST handle on the job, which is what makes
  // KILL_ON_JOB_CLOSE the backstop rather than a nicety.
  close(force) {
    if (!this.proc) return;
    if (force) {
      // Never assigned anything, so the job is empty and there is nothing for
      // KILL_ON_JOB_CLOSE to reap. Killing it now is better than leaving a
      // PowerShell to finish compiling a shim nobody will use — a supervisor
      // that leaks a process of its own would be the very fault it exists to
      // close.
      try {
        this.proc.kill();
      } catch (_) {
        /* already gone */
      }
      if (this.scriptFile) {
        try {
          fs.unlinkSync(this.scriptFile);
        } catch (_) {
          /* a leaked temp script is cosmetic */
        }
      }
      return;
    }
    this._send('BYE');
    try {
      this.proc.stdin.end();
    } catch (_) {
      /* already gone */
    }
    // A holder that ignores BYE is killed outright — the handle closes either
    // way, and a leaked PowerShell would itself be an orphan.
    setTimeout(() => {
      try {
        if (!this.closed) this.proc.kill();
      } catch (_) {
        /* already gone */
      }
    }, 2000).unref();
    if (this.scriptFile) {
      setTimeout(() => {
        try {
          fs.unlinkSync(this.scriptFile);
        } catch (_) {
          /* a leaked temp script is cosmetic */
        }
      }, 2500).unref();
    }
  }
}

// ------------------------------------------------------------------ supervise

function sleep(msec) {
  return new Promise((resolve) => setTimeout(resolve, msec));
}

function killPosixGroup(pgid, signal) {
  try {
    process.kill(-pgid, signal);
    return '';
  } catch (e) {
    if (e && e.code === 'ESRCH') return ''; // nothing left to signal is success
    return (e && e.message) || String(e);
  }
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
    return '';
  } catch (e) {
    if (e && e.code === 'ESRCH') return '';
    return (e && e.message) || String(e);
  }
}

/**
 * Run `bin args` under a kill group and reap whatever outlives it.
 *
 * @param {object} cfg
 *   bin, args, cwd, env, deadlineMs, graceMs, killSurvivors, token, receiptFile
 * @returns {Promise<object>} the receipt
 */
async function supervise(cfg) {
  const startedAt = Date.now();
  const receipt = {
    schema: RECEIPT_SCHEMA,
    token: cfg.token || '',
    platform: process.platform,
    mechanism: IS_WINDOWS ? 'windows-job-object' : 'posix-process-group',
    mechanismNote: '',
    killSurvivors: cfg.killSurvivors !== false,
    deadlineMs: cfg.deadlineMs > 0 ? cfg.deadlineMs : 0,
    graceMs: cfg.graceMs > 0 ? cfg.graceMs : DEFAULT_GRACE_MS,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: '',
    elapsedMs: 0,
    targetPid: 0,
    targetStarted: '',
    exit: { code: null, signal: null },
    timedOut: false,
    cancelled: false,
    parentVanished: false,
    abandoned: false,
    spawnError: null,
    census: { before: [], survivors: [], killed: [], stubborn: [], source: '', unavailable: '' },
    notes: [],
  };

  const writeReceipt = () => {
    if (!cfg.receiptFile) return;
    try {
      fs.writeFileSync(cfg.receiptFile, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
    } catch (_) {
      /* a receipt we cannot write degrades the report, never the kill */
    }
  };

  // --- pre-run census. Descendants of the RUNNER (this supervisor's parent)
  // before the engine launches: normally just this supervisor, and anything
  // else is debris earlier work left behind — which the Director should see
  // named rather than blamed on this run. Walking from THIS process would
  // always return nothing: it has no children yet.
  const tableBefore = snapshot();
  if (!tableBefore) {
    receipt.census.unavailable =
      'the platform process table could not be read, so survivors can be killed via the ' +
      'kill group but not listed by name';
  } else {
    receipt.census.source = LAST_SNAPSHOT_SOURCE;
    // FIX (Windows CI, 2026-09-17): this walked from the runner and excluded
    // only THIS process, so on Windows it reported the census's own
    // `powershell.exe` and its `conhost.exe` as "debris from earlier work" —
    // the snapshot tool showing up in its own snapshot. Exclude this
    // supervisor's whole subtree: at this point it has no legitimate children,
    // so everything under it belongs to the measurement, not to the machine.
    const ownSubtree = new Set([process.pid]);
    for (const r of descendantsOf(tableBefore, process.pid, '')) ownSubtree.add(r.pid);
    receipt.census.before = descendantsOf(tableBefore, process.ppid || process.pid, '')
      .filter((r) => !ownSubtree.has(r.pid))
      .map((r) => censusEntry(r, 'descendant'));
  }

  // --- the kill group.
  let holder = null;
  if (IS_WINDOWS) {
    holder = new JobHolder({
      killOnClose: receipt.killSurvivors,
      scratchDir: cfg.scratchDir,
    });
    if (!holder.start()) {
      receipt.mechanism = 'windows-job-object-unavailable';
      receipt.mechanismNote =
        'no Job object was created (' + holder.failed + '); survivors are reaped by the ' +
        'parent/child census instead, which a process that re-parents itself can evade';
      receipt.notes.push(holder.failed);
      holder = null;
    } else if (!receipt.killSurvivors) {
      receipt.mechanismNote =
        'created WITHOUT JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE because --preserve-survivors ' +
        'was given: the job is a census instrument only on this run';
    }
  }

  // FIX (Windows CI, 2026-09-18): WAIT for the job before launching anything.
  //
  // This used to start the holder and spawn the engine without waiting, so the
  // PowerShell shim could compile while the engine booted — the assignment was
  // sent whenever the holder became ready. That traded the guarantee for about
  // two seconds of startup, and the trade was bad: an engine that finished
  // before the holder did was never assigned at all (`OpenProcess failed: 87`
  // — ERROR_INVALID_PARAMETER, which is what OpenProcess returns for a pid
  // that no longer exists), so the job held nothing and the run fell back to
  // the parent/child census.
  //
  // And that fallback cannot cover this case. The walk goes DOWN from the
  // engine pid, so it needs every intermediate process to still be listed;
  // Win32_Process lists only running processes. With the real Windows shape —
  // cmd.exe (the npm `.cmd` shim) -> codex -> the orphan — both intermediates
  // are gone by census time and the chain from the root is broken, so a live
  // orphan is invisible. CI proved exactly that: `SURVIVORS: none` printed
  // while `pid 4068 survived the exec runner`.
  //
  // So the job is not an optimization to race against; it is the mechanism.
  // Two seconds of startup against a cap measured in hours is not a cost worth
  // a hole in the guarantee.
  if (holder) {
    const ready = await holder.ready;
    if (!ready) {
      receipt.mechanism = 'windows-job-object-unavailable';
      receipt.mechanismNote =
        'the Job object never became usable (' + (holder.failed || 'the holder did not answer') +
        '); survivors are reaped by the parent/child census instead, which cannot see past a ' +
        'process whose own parent has already exited';
      if (holder.failed) receipt.notes.push(holder.failed);
      holder.close(true);
      holder = null;
    }
  }

  // --- launch. stdio is inherited straight through, so the engine writes to
  // the runner's own pipes and this supervisor never buffers a report.
  let child = null;
  try {
    child = spawn(cfg.bin, cfg.args || [], {
      cwd: cfg.cwd || process.cwd(),
      env: cfg.env || process.env,
      stdio: ['inherit', 'inherit', 'inherit'],
      // POSIX: setsid, so the whole tree shares one signalable process group.
      detached: !IS_WINDOWS,
      windowsHide: true,
      windowsVerbatimArguments: !!cfg.windowsVerbatimArguments,
    });
  } catch (e) {
    receipt.spawnError = { code: (e && e.code) || '', message: (e && e.message) || String(e) };
    receipt.endedAt = new Date().toISOString();
    receipt.elapsedMs = Date.now() - startedAt;
    if (holder) holder.close(true);
    writeReceipt();
    return receipt;
  }

  receipt.targetPid = child.pid || 0;
  receipt.targetStarted = new Date().toISOString();
  writeReceipt(); // the pre-receipt: a supervisor killed from here on still
  // leaves the caller a PID to sweep.

  // The holder is already READY, so this answers in milliseconds — and it runs
  // before the engine can have spawned anything, which is the whole point:
  // everything the engine starts from here inherits job membership.
  //
  // No pid means the launch itself failed (ENOENT, EACCES): there is nothing to
  // put in the job, and asking would stall on an answer that cannot come.
  let assigned = false;
  if (holder && child.pid > 0) {
    const err = await holder.assign(child.pid);
    if (err) {
      receipt.notes.push('job assignment failed: ' + err);
      receipt.mechanismNote =
        receipt.mechanismNote ||
        'the engine was never assigned to the Job object (' + err + '); survivors are ' +
          'reaped by the parent/child census instead, which cannot see past a process ' +
          'whose own parent has already exited';
    } else {
      assigned = true;
    }
  }

  // The descendant walk needs a lower bound on the target's start time to
  // reject a RECYCLED pid (a "child" that predates its parent is a different
  // process wearing the same number). The clock at launch is that bound; the
  // tolerance inside descendantsOf absorbs the difference between this reading
  // and the kernel's own creation timestamp.

  // A termination the kill group does not honour must not become a hang. The
  // runner calls this supervisor synchronously, so a supervisor that waits
  // forever for an unkillable child wedges the whole lane — and node's own
  // backstop timer cannot rescue it, because that timer only signals a process
  // that is already ignoring signals. So every termination arms a deadline of
  // its own: past it the supervisor writes what it knows and leaves.
  const hardExitMs = Math.max(receipt.graceMs * 2, 1000) + 5000;
  let hardExitTimer = null;
  const armHardExit = () => {
    if (hardExitTimer) return;
    hardExitTimer = setTimeout(() => {
      receipt.abandoned = true;
      receipt.notes.push(
        'the kill group did not die within ' + hardExitMs + 'ms of being terminated; this ' +
          'supervisor is exiting rather than hanging the runner behind it. Processes from ' +
          'this run may still be alive — check the machine before trusting a quiet-machine ' +
          'measurement.'
      );
      receipt.endedAt = new Date().toISOString();
      receipt.elapsedMs = Date.now() - startedAt;
      if (holder) holder.close();
      writeReceipt();
      process.exit(receipt.timedOut ? EXIT_TIMEOUT : 143);
    }, hardExitMs);
  };

  const terminateGroup = async (why) => {
    receipt.notes.push('kill group terminated: ' + why);
    armHardExit();
    if (holder && assigned) {
      const err = await holder.terminate();
      if (err) receipt.notes.push('TerminateJobObject failed: ' + err);
      return;
    }
    if (!IS_WINDOWS) {
      const err = killPosixGroup(child.pid, 'SIGTERM');
      if (err) receipt.notes.push('group SIGTERM failed: ' + err);
      await sleep(receipt.graceMs);
      const err2 = killPosixGroup(child.pid, 'SIGKILL');
      if (err2) receipt.notes.push('group SIGKILL failed: ' + err2);
      return;
    }
    // Windows without a usable job: kill the target, then let the post-run
    // census sweep whatever it left.
    const err = killPid(child.pid, 'SIGKILL');
    if (err) receipt.notes.push('target terminate failed: ' + err);
  };

  const exited = new Promise((resolve) => {
    child.on('error', (e) => {
      receipt.spawnError = { code: (e && e.code) || '', message: (e && e.message) || String(e) };
      resolve({ code: null, signal: null });
    });
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });

  let deadlineTimer = null;
  if (receipt.deadlineMs > 0) {
    deadlineTimer = setTimeout(() => {
      receipt.timedOut = true;
      terminateGroup('the ' + receipt.deadlineMs + 'ms deadline fired');
    }, receipt.deadlineMs);
  }

  // A TaskStop, a killed launcher, a closed terminal: the parent goes away and
  // the tree must not outlive it. On Windows killing a parent does NOT kill
  // children, so this poll is the only thing standing between a cancelled run
  // and a permanent orphan.
  const parentPid = process.ppid;
  const parentWatch = setInterval(() => {
    if (parentPid > 1 && !parentAlive(parentPid)) {
      receipt.cancelled = true;
      receipt.parentVanished = true;
      clearInterval(parentWatch);
      terminateGroup('the parent process (' + parentPid + ') vanished — run cancelled');
    }
  }, PARENT_POLL_MS);
  if (parentWatch.unref) parentWatch.unref();

  const onSignal = (sig) => {
    receipt.cancelled = true;
    terminateGroup('this supervisor received ' + sig);
  };
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'];
  for (const sig of signals) {
    try {
      process.on(sig, () => onSignal(sig));
    } catch (_) {
      /* not every signal exists on every platform */
    }
  }

  const result = await exited;
  if (deadlineTimer) clearTimeout(deadlineTimer);
  if (hardExitTimer) clearTimeout(hardExitTimer);
  clearInterval(parentWatch);
  receipt.exit = { code: result.code, signal: result.signal || null };

  // --- the census the Director reads. Two independent sources merged: the
  // kill group itself (authoritative for anything that never escaped) and a
  // parent/child walk from the engine PID (the fallback that catches a process
  // which broke away, or which was started in the window before assignment).
  let jobEntries = [];
  if (holder && assigned) {
    const members = await holder.members();
    if (members === null) {
      receipt.notes.push('the job census could not be read');
    } else {
      jobEntries = members
        .filter((r) => r.pid !== child.pid && r.pid !== process.pid)
        .map((r) => censusEntry(r, 'job'));
    }
  }
  const tableAfter = snapshot();
  let walkEntries = [];
  if (tableAfter) {
    const beforePids = new Set(receipt.census.before.map((e) => e.pid));
    walkEntries = descendantsOf(tableAfter, child.pid, receipt.targetStarted)
      .filter((r) => r.pid !== process.pid && !beforePids.has(r.pid))
      .map((r) => censusEntry(r, 'descendant'));
    if (!IS_WINDOWS) {
      // The process group is the POSIX kill group; read it as the job list.
      walkEntries = walkEntries.concat(
        groupMembers(tableAfter, child.pid)
          .filter((r) => r.pid !== child.pid && r.pid !== process.pid)
          .map((r) => censusEntry(r, 'job'))
      );
    }
  }
  receipt.census.survivors = mergeCensus([jobEntries, walkEntries]).filter((e) => isAlive(e.pid));

  // --- reap.
  if (receipt.killSurvivors && receipt.census.survivors.length) {
    if (holder && assigned) {
      // Kill by PID first so each failure is attributable, then close the
      // handle, which is the kernel-enforced backstop for anything missed.
      for (const entry of receipt.census.survivors) {
        const err = await holder.kill(entry.pid);
        if (err) receipt.notes.push('kill ' + entry.pid + ' failed: ' + err);
        else receipt.census.killed.push(entry.pid);
      }
    } else if (!IS_WINDOWS) {
      killPosixGroup(child.pid, 'SIGTERM');
      for (const entry of receipt.census.survivors) killPid(entry.pid, 'SIGTERM');
      await sleep(receipt.graceMs);
      killPosixGroup(child.pid, 'SIGKILL');
      for (const entry of receipt.census.survivors) {
        if (isAlive(entry.pid)) killPid(entry.pid, 'SIGKILL');
      }
      receipt.census.killed = receipt.census.survivors.map((e) => e.pid);
    } else {
      for (const entry of receipt.census.survivors) {
        const err = killPid(entry.pid, 'SIGKILL');
        if (err) receipt.notes.push('kill ' + entry.pid + ' failed: ' + err);
        else receipt.census.killed.push(entry.pid);
      }
    }
    // Termination is asynchronous on both platforms; give it a moment before
    // calling anything stubborn.
    await sleep(Math.min(receipt.graceMs, 500));
    receipt.census.stubborn = receipt.census.survivors.filter((e) => isAlive(e.pid));
  } else if (!receipt.killSurvivors && receipt.census.survivors.length) {
    receipt.notes.push(
      receipt.census.survivors.length +
        ' survivor(s) were left running on purpose (--preserve-survivors)'
    );
  }

  if (holder) holder.close(!assigned);
  receipt.endedAt = new Date().toISOString();
  receipt.elapsedMs = Date.now() - startedAt;
  writeReceipt();
  return receipt;
}

// --------------------------------------------------------- the runners' entry
//
// Synchronous by design: the three runners are straight-line synchronous
// scripts built around spawnSync, and an async engine call would have rippled
// through every exit-forensics and report path in all three. Instead this
// spawns THIS FILE as a supervisor child with the runner's own stdio, so the
// engine still writes into the runner's pipes and the caller still gets a
// spawnSync-shaped result.

function superviseSync(bin, args, spawnOpts, sup) {
  const cfg = sup || {};
  const argv = [
    __filename,
    '--receipt',
    cfg.receiptFile,
    '--deadline-ms',
    String(cfg.deadlineMs > 0 ? cfg.deadlineMs : 0),
    '--grace-ms',
    String(cfg.graceMs > 0 ? cfg.graceMs : DEFAULT_GRACE_MS),
    '--token',
    String(cfg.token || ''),
    cfg.killSurvivors === false ? '--preserve-survivors' : '--kill-survivors',
  ];
  if (cfg.scratchDir) argv.push('--scratch-dir', cfg.scratchDir);
  if (spawnOpts && spawnOpts.windowsVerbatimArguments) argv.push('--windows-verbatim-arguments');
  argv.push('--', bin, ...(args || []));

  // The supervisor owns the deadline; node's own timer stays on as a backstop
  // a comfortable margin later, so a wedged supervisor still cannot hang the
  // runner forever.
  const opts = Object.assign({}, spawnOpts);
  delete opts.windowsVerbatimArguments; // it applies to the ENGINE, not to node
  if (cfg.deadlineMs > 0) opts.timeout = cfg.deadlineMs + 60000;

  const r = spawnSync(process.execPath, argv, opts);

  let receipt = null;
  try {
    receipt = JSON.parse(fs.readFileSync(cfg.receiptFile, 'utf8'));
  } catch (_) {
    receipt = null;
  }

  // The supervisor itself died (its own backstop timer, an OOM, a hostile
  // signal) before it could finish. The pre-receipt still names the engine
  // PID: sweep it here rather than leave the tree behind.
  if (!receipt || (!receipt.endedAt && receipt.targetPid)) {
    const stray = receipt && receipt.targetPid;
    if (stray) lastDitchSweep(stray);
    return Object.assign({}, r, {
      receipt,
      supervised: false,
      supervisionError:
        'the supervisor did not complete' +
        (stray ? ' — its engine PID ' + stray + ' was swept directly' : '') +
        (r.error ? ' (' + (r.error.code || r.error.message) + ')' : ''),
    });
  }

  // Map the supervisor's outcome back onto spawnSync's shape so callers' exit
  // forensics need no special case.
  const mapped = { status: r.status, signal: r.signal, error: r.error, stdout: r.stdout, stderr: r.stderr };
  if (receipt.spawnError) {
    const err = new Error(receipt.spawnError.message || 'the engine could not be launched');
    err.code = receipt.spawnError.code || 'UNKNOWN';
    mapped.error = err;
    mapped.status = null;
  } else if (receipt.timedOut) {
    const err = new Error('the supervised run exceeded its ' + receipt.deadlineMs + 'ms deadline');
    err.code = 'ETIMEDOUT';
    mapped.error = err;
    mapped.status = null;
    mapped.signal = null;
  } else {
    mapped.error = undefined;
    mapped.status = receipt.exit.code;
    mapped.signal = receipt.exit.signal;
  }
  return Object.assign(mapped, { receipt, supervised: true, supervisionError: '' });
}

// Best-effort tree kill for the one case the supervisor could not handle
// itself: it was killed before it finished.
function lastDitchSweep(pid) {
  if (!(pid > 0)) return;
  if (IS_WINDOWS) {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { windowsHide: true });
    return;
  }
  killPosixGroup(pid, 'SIGKILL');
  killPid(pid, 'SIGKILL');
}

// ----------------------------------------------------------------- reporting

// The block the runners paste into their report headers, next to the tree
// audit. A Director must be able to answer "did this order leave anything
// running?" without dispatching a scout.
function censusBlock(receipt, opts) {
  const o = opts || {};
  const token = (receipt && receipt.token) || o.token || '';
  const provenance =
    'Census measured in-process by this runner (run token ' + token + ') around the engine\n' +
    'invocation — never from engine or session artifacts.';
  if (o.disabled) {
    return [
      'PROCESS CENSUS: not taken — supervision is OFF for this run (' + o.disabledWhy + ').',
      'Nothing the engine started was tracked, and anything it left running is still',
      'running. This is the only configuration in which a Codex-lane order can leave',
      'an orphan behind.',
    ].join('\n');
  }
  if (!receipt) {
    return [
      'PROCESS CENSUS: unavailable — the supervisor produced no receipt, so the runner',
      'cannot say what the engine left behind. Treat surviving processes as possible' ,
      'and check the machine before trusting a quiet-machine measurement.',
      provenance,
    ].join('\n');
  }
  const lines = [];
  const mech =
    receipt.mechanism === 'windows-job-object'
      ? 'Windows Job object, KILL_ON_JOB_CLOSE, no BREAKAWAY_OK'
      : receipt.mechanism === 'posix-process-group'
      ? 'POSIX process group (setsid)'
      : receipt.mechanism;
  lines.push(
    'PROCESS CENSUS: kill group = ' + mech + '; reaping = ' +
      (receipt.killSurvivors ? 'on' : 'OFF (--preserve-survivors)')
  );
  if (receipt.mechanismNote) lines.push('  note: ' + receipt.mechanismNote);
  if (receipt.census && receipt.census.unavailable) {
    lines.push('  note: ' + receipt.census.unavailable);
  }
  const before = (receipt.census && receipt.census.before) || [];
  lines.push(
    '  pre-run descendants: ' +
      (before.length
        ? before.length + ' (debris from earlier work, not attributed to this run)'
        : 'none')
  );
  for (const e of before.slice(0, 10)) lines.push('    - ' + describeProc(e));
  const survivors = (receipt.census && receipt.census.survivors) || [];
  const killed = new Set((receipt.census && receipt.census.killed) || []);
  const stubborn = new Set(((receipt.census && receipt.census.stubborn) || []).map((e) => e.pid));
  if (!survivors.length) {
    lines.push('  SURVIVORS: none — nothing the engine started outlived it.');
  } else {
    lines.push(
      '  SURVIVORS: ' + survivors.length + ' process(es) outlived the engine' +
        (receipt.killSurvivors ? ':' : ' and were LEFT RUNNING:')
    );
    for (const e of survivors.slice(0, 40)) {
      const fate = !receipt.killSurvivors
        ? 'preserved'
        : stubborn.has(e.pid)
        ? 'STILL ALIVE after the kill sweep'
        : killed.has(e.pid)
        ? 'killed'
        : 'kill not confirmed';
      lines.push('    - ' + describeProc(e) + '  [' + fate + ']');
    }
    if (survivors.length > 40) lines.push('    …and ' + (survivors.length - 40) + ' more');
    if (stubborn.size) {
      lines.push(
        '  ONE OR MORE SURVIVORS WOULD NOT DIE. The machine is not quiet: any benchmark',
        '  or timing gate taken after this run is measuring a contended machine.'
      );
    }
  }
  if (receipt.abandoned) {
    lines.push(
      '  THE KILL GROUP DID NOT DIE. The supervisor gave up waiting and returned, so this',
      '  census is incomplete: treat every process this run started as possibly alive.'
    );
  }
  for (const note of (receipt.notes || []).slice(0, 10)) lines.push('  note: ' + note);
  lines.push(provenance);
  return lines.join('\n');
}

function describeProc(e) {
  return (
    'pid ' + e.pid + '  ' + (e.image || '(unknown)') +
    (e.started ? '  started ' + e.started : '') +
    (e.via ? '  [' + e.via + ']' : '')
  );
}

// ---------------------------------------------------------------------- CLI

function parseCliArgs(argv) {
  const out = {
    receiptFile: '',
    deadlineMs: 0,
    graceMs: DEFAULT_GRACE_MS,
    token: '',
    killSurvivors: true,
    scratchDir: '',
    windowsVerbatimArguments: false,
    bin: '',
    args: [],
    help: false,
  };
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      i++;
      break;
    } else if (a === '--receipt') out.receiptFile = argv[++i];
    else if (a === '--deadline-ms') out.deadlineMs = parseInt(argv[++i], 10) || 0;
    else if (a === '--grace-ms') out.graceMs = parseInt(argv[++i], 10) || DEFAULT_GRACE_MS;
    else if (a === '--token') out.token = argv[++i] || '';
    else if (a === '--scratch-dir') out.scratchDir = argv[++i] || '';
    else if (a === '--kill-survivors') out.killSurvivors = true;
    else if (a === '--preserve-survivors') out.killSurvivors = false;
    else if (a === '--windows-verbatim-arguments') out.windowsVerbatimArguments = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  out.bin = argv[i] || '';
  out.args = argv.slice(i + 1);
  return out;
}

const USAGE =
  'usage: node orchestra-jobrun.js [--receipt <file>] [--deadline-ms <n>] [--grace-ms <n>]\n' +
  '                               [--token <t>] [--kill-survivors|--preserve-survivors]\n' +
  '                               -- <command> [args...]\n' +
  '\n' +
  'Runs <command> inside a kill group owned by this process (a Windows Job object\n' +
  'with KILL_ON_JOB_CLOSE, or a POSIX process group), then censuses and reaps every\n' +
  'process that outlived it. Exits with the command\'s own status, 124 on deadline,\n' +
  '127 if it could not be launched.\n';

if (require.main === module) {
  const cli = parseCliArgs(process.argv.slice(2));
  if (cli.help || !cli.bin) {
    process.stderr.write(USAGE);
    process.exit(cli.help ? 0 : 2);
  }
  supervise({
    bin: cli.bin,
    args: cli.args,
    cwd: process.cwd(),
    env: process.env,
    deadlineMs: cli.deadlineMs,
    graceMs: cli.graceMs,
    killSurvivors: cli.killSurvivors,
    token: cli.token,
    receiptFile: cli.receiptFile,
    scratchDir: cli.scratchDir,
    windowsVerbatimArguments: cli.windowsVerbatimArguments,
  })
    .then((receipt) => {
      if (receipt.spawnError) process.exit(EXIT_SPAWN_FAILED);
      if (receipt.timedOut) process.exit(EXIT_TIMEOUT);
      if (receipt.exit.signal) {
        const num = Object.keys(os.constants.signals).indexOf(receipt.exit.signal);
        process.exit(128 + (os.constants.signals[receipt.exit.signal] || num + 1 || 15));
      }
      process.exit(typeof receipt.exit.code === 'number' ? receipt.exit.code : 1);
    })
    .catch((e) => {
      process.stderr.write('orchestra-jobrun: ' + ((e && e.stack) || e) + '\n');
      process.exit(EXIT_SPAWN_FAILED);
    });
}

module.exports = {
  supervise,
  superviseSync,
  censusBlock,
  lastDitchSweep,
  RECEIPT_SCHEMA,
  DEFAULT_GRACE_MS,
  EXIT_TIMEOUT,
  EXIT_SPAWN_FAILED,
  HOLDER_PS1,
  // Exercised directly by tests/jobrun.test.js: these are the parts with the
  // ordering and parsing bugs, and they are platform-shaped, so they are
  // tested against fixtures rather than only through a live run.
  _internals: {
    JobHolder,
    parseCliArgs,
    descendantsOf,
    groupMembers,
    mergeCensus,
    elapsedToIso,
    snapshot,
    snapshotProc,
    snapshotPs,
    snapshotWindows,
    isAlive,
    describeProc,
  },
};
