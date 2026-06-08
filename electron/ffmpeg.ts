import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

// ---------- types ----------

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  frameRate: number;
  bitRate: number;
  audioCodec: string;
  audioSampleRate: number;
  audioChannels: number;
}

// ---------- helpers ----------

let ffmpegPath: string | undefined;

/**
 * 解析 "30000/1001" 格式的帧率字符串为数值。
 * 支持整数、小数、分数形式；解析失败时返回 0。
 */
function evalFrameRate(fpsStr: string): number {
  if (!fpsStr) return 0;
  const trimmed = fpsStr.trim();
  // 尝试直接解析为数字
  const direct = Number(trimmed);
  if (!Number.isNaN(direct)) return direct;

  // 尝试解析 "a/b" 分数格式
  const slashIndex = trimmed.indexOf('/');
  if (slashIndex !== -1) {
    const num = Number(trimmed.slice(0, slashIndex).trim());
    const den = Number(trimmed.slice(slashIndex + 1).trim());
    if (!Number.isNaN(num) && !Number.isNaN(den) && den !== 0) {
      return num / den;
    }
  }

  return 0;
}

// ---------- public API ----------

/**
 * 设置 ffmpeg 可执行文件路径。
 */
function setFfmpegPath(execPath: string): void {
  ffmpegPath = execPath;
  ffmpeg.setFfmpegPath(execPath);
}

/**
 * 检查 ffmpeg 是否可用。
 *
 * - 如果已通过 setFfmpegPath 设置了路径，则检查该文件是否可执行。
 * - 否则尝试在系统 PATH 中查找（使用 `where ffmpeg`）。
 */
function checkFfmpeg(): boolean {
  if (ffmpegPath) {
    try {
      // 检查文件是否存在且可执行
      fs.accessSync(ffmpegPath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  // 尝试在 PATH 中查找
  try {
    const { execSync } = require('child_process');
    const result = execSync('where ffmpeg', { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * 使用 ffprobe 提取视频元数据。
 */
function getMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`ffprobe failed: ${err.message}`));
        return;
      }

      const videoStream =
        metadata.streams?.find((s) => s.codec_type === 'video') ?? null;
      const audioStream =
        metadata.streams?.find((s) => s.codec_type === 'audio') ?? null;

      const duration = metadata.format?.duration ?? 0;
      const width = videoStream?.width ?? 0;
      const height = videoStream?.height ?? 0;
      const codec = videoStream?.codec_name ?? 'unknown';
      const frameRate = evalFrameRate(videoStream?.r_frame_rate ?? '0');
      // 优先使用 format.bit_rate，回退到 videoStream.bit_rate
      const bitRate = (metadata.format?.bit_rate ?? videoStream?.bit_rate ?? 0) as number;
      const audioCodec = audioStream?.codec_name ?? 'none';
      const audioSampleRate = audioStream?.sample_rate
        ? Number(audioStream.sample_rate)
        : 0;
      const audioChannels = audioStream?.channels ?? 0;

      resolve({
        duration,
        width,
        height,
        codec,
        frameRate,
        bitRate,
        audioCodec,
        audioSampleRate,
        audioChannels,
      });
    });
  });
}

/**
 * 提取视频封面缩略图。
 *
 * 输出路径: {outputDir}/thumbnails/{videoId}.jpg
 * 缩略图尺寸: 320x? (等比缩放)
 */
function generateThumbnail(
  filePath: string,
  outputDir: string,
  videoId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const thumbDir = path.join(outputDir, 'thumbnails');
    const filename = `${videoId}.jpg`;

    // 确保目录存在
    fs.mkdirSync(thumbDir, { recursive: true });

    ffmpeg(filePath)
      .screenshots({
        timestamps: ['10%'],
        filename,
        folder: thumbDir,
        size: '320x?',
      })
      .on('end', () => {
        resolve(path.join(thumbDir, filename));
      })
      .on('error', (err) => {
        reject(new Error(`generateThumbnail failed: ${err.message}`));
      });
  });
}

/**
 * 生成时间轴缩略图。
 *
 * 输出目录: {outputDir}/thumbnails/{videoId}/
 * 缩略图尺寸: 160x? (等比缩放)
 *
 * @param count  缩略图数量，默认 7
 * @returns      生成的文件路径数组（按时间戳顺序）
 * 缩略图尺寸: 320x? (等比缩放)
 */
function generateTimelineThumbnails(
  filePath: string,
  outputDir: string,
  videoId: string,
  count: number = 7,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const thumbDir = path.join(outputDir, 'thumbnails', videoId + '_frames');
    const filename = 'thumb.jpg';

    // 生成均匀分布的百分比时间戳
    const timestamps = Array.from({ length: count }, (_, i) => {
      return `${Math.round(((i + 1) / (count + 1)) * 100)}%`;
    });

    // 确保目录存在
    fs.mkdirSync(thumbDir, { recursive: true });

    ffmpeg(filePath)
      .screenshots({
        timestamps,
        filename,
        folder: thumbDir,
        size: '320x?',
      })
      .on('end', () => {
        // 读取目录中的实际文件（ffmpeg 会生成 thumb_1.jpg, thumb_2.jpg ...）
        const files = fs.readdirSync(thumbDir)
          .filter(f => /^thumb_\d+\.jpg$/.test(f))
          .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)?.[0] || '0', 10)
            const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10)
            return na - nb
          })
          .map(f => path.join(thumbDir, f))
        resolve(files)
      })
      .on('error', (err) => {
        reject(new Error(`generateTimelineThumbnails failed: ${err.message}`));
      });
  });
}

function generateProxy(
  filePath: string,
  outputDir: string,
  videoId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proxyDir = path.join(outputDir, 'proxies');
    fs.mkdirSync(proxyDir, { recursive: true });
    const outputPath = path.join(proxyDir, `${videoId}.mp4`);

    // 工具函数：用 ffprobe 获取原始分辨率以决定缩放
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        // ffprobe 失败就不做 proxy，resolve 空串
        resolve('');
        return;
      }
      const vs = metadata.streams?.find(s => s.codec_type === 'video');
      const origW = vs?.width || 1920;
      const origH = vs?.height || 1080;
      const maxDim = Math.max(origW, origH);

      // 如果原视频高度已经 ≤ 720，直接使用原文件作为代理（无需转码）
      if (maxDim <= 720) {
        resolve(filePath);
        return;
      }

      // 缩放到 720p，全关键帧（keyint=1），低码率，超快 preset
      const scale = origW >= origH ? '720:-2' : '-2:720';
      ffmpeg(filePath)
        .videoCodec('libx264')
        .outputOptions([
          '-preset', 'ultrafast',
          '-crf', '28',
          '-vf', `scale=${scale}`,
          '-g', '1',
          '-keyint_min', '1',
          '-sc_threshold', '0',
          '-movflags', '+faststart',
        ])
        .audioCodec('aac')
        .audioBitrate(64)
        .output(outputPath)
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (e) => {
          console.error(`[proxy] Failed for ${path.basename(filePath)}:`, e.message);
          resolve(''); // 失败时不阻塞流程
        })
        .run();
    });
  });
}

export {
  setFfmpegPath,
  checkFfmpeg,
  getMetadata,
  generateThumbnail,
  generateTimelineThumbnails,
  generateProxy,
  evalFrameRate,
};
export type { VideoMetadata };
