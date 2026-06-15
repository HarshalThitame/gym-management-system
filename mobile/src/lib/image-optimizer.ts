import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { Image, Platform } from "react-native";

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  compressFormat?: "jpeg" | "png";
}

const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.7,
  compressFormat: "jpeg",
};

export async function optimizeImage(uri: string, options?: ImageOptimizationOptions): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: opts.maxWidth ?? 1024, height: opts.maxHeight ?? 1024 } }], {
      compress: opts.quality ?? 0.7,
      format: opts.compressFormat === "png" ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch { return uri; }
}

export async function getImageSize(uri: string): Promise<{ width: number; height: number; sizeBytes: number }> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), () => resolve({ width: 0, height: 0 }));
    });
    return { width: dimensions.width, height: dimensions.height, sizeBytes: (info as any).size ?? 0 };
  } catch { return { width: 0, height: 0, sizeBytes: 0 }; }
}

export function getCacheUri(originalUri: string): string {
  const hash = Math.abs(originalUri.split("").reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)).toString(36);
  const ext = Platform.OS === "android" ? "jpg" : "jpeg";
  return `${FileSystem.cacheDirectory}img-cache-${hash}.${ext}`;
}

export function getRecommendedQuality(fileSizeBytes: number): number {
  if (fileSizeBytes > 5 * 1024 * 1024) return 0.4;
  if (fileSizeBytes > 2 * 1024 * 1024) return 0.6;
  if (fileSizeBytes > 1024 * 1024) return 0.7;
  return 0.8;
}
