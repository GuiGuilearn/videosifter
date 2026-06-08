import fs from 'fs';
import path from 'path';
import { shell } from 'electron';
import { execSync } from 'child_process';

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm',
  '.mts', '.m2ts', '.m4v', '.3gp', '.ogv', '.ts', '.mxf'
]);

export function isVideoFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

export function scanDirectory(dirPath: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanDirectory(fullPath));
      } else if (entry.isFile() && isVideoFile(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore directories that cannot be read
  }
  return results;
}

export async function moveFileToTrash(filePath: string): Promise<boolean> {
  // 方法1: Electron shell.trashItem
  try {
    await shell.trashItem(filePath);
    return true;
  } catch (e) {
    console.error('shell.trashItem failed, trying PowerShell fallback:', e);
  }

  // 方法2: PowerShell 调用 .NET VisualBasic 送回收站（Windows 最可靠方案）
  try {
    const escaped = filePath.replace(/'/g, "''")
    const ps = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escaped}','OnlyErrorDialogs','SendToRecycleBin')`
    execSync(`powershell.exe -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { timeout: 10000 })
    return true
  } catch (e2) {
    console.error('PowerShell fallback also failed:', e2);
    return false;
  }
}

export function permanentlyDeleteFile(filePath: string): boolean {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function copyFile(source: string, destination: string): boolean {
  try {
    const destDir = path.dirname(destination);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(source, destination);
    return true;
  } catch {
    return false;
  }
}

export function moveFile(source: string, destination: string): boolean {
  try {
    const destDir = path.dirname(destination);
    fs.mkdirSync(destDir, { recursive: true });
    try {
      fs.renameSync(source, destination);
      return true;
    } catch (err) {
      // Cross-device move, fall back to copy + delete
      fs.copyFileSync(source, destination);
      fs.unlinkSync(source);
      return true;
    }
  } catch {
    return false;
  }
}

export function renameFile(oldPath: string, newPath: string): boolean {
  try {
    fs.renameSync(oldPath, newPath);
    return true;
  } catch {
    return false;
  }
}

export function openInFileExplorer(filePath: string): void {
  shell.showItemInFolder(filePath);
}

export function getFileCreationDate(filePath: string): string {
  try {
    const stat = fs.statSync(filePath);
    return stat.birthtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function getThumbnailCacheDir(appDataPath: string): string {
  const dir = path.join(appDataPath, 'thumbnails');
  return dir;
}

export function cleanThumbnailCache(appDataPath: string): void {
  const dir = path.join(appDataPath, 'thumbnails');
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'thumbnails'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'proxies'), { recursive: true });
}

export function cleanOrphanCache(appDataPath: string, validIds: string[]): void {
  const idSet = new Set(validIds)
  const baseDir = path.join(appDataPath, 'thumbnails')

  // 清理 thumbnail 图片
  const thumbDir = path.join(baseDir, 'thumbnails')
  if (fs.existsSync(thumbDir)) {
    for (const f of fs.readdirSync(thumbDir)) {
      const id = path.parse(f).name // removes .jpg
      // 如果是帧目录格式 "id_frames"
      const baseId = id.replace(/_frames$/, '')
      if (!idSet.has(baseId)) {
        const fp = path.join(thumbDir, f)
        try { fs.rmSync(fp, { recursive: true, force: true }) } catch {}
      }
    }
  }

  // 清理代理视频
  const proxyDir = path.join(baseDir, 'proxies')
  if (fs.existsSync(proxyDir)) {
    for (const f of fs.readdirSync(proxyDir)) {
      const id = path.parse(f).name // removes .mp4/.webm
      if (!idSet.has(id)) {
        const fp = path.join(proxyDir, f)
        try { fs.unlinkSync(fp) } catch {}
      }
    }
  }
}
