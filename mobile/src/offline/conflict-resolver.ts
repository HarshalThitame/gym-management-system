import type { ConflictRecord, ConflictStrategy } from "./types";

export class ConflictResolver {
  resolve(conflict: ConflictRecord): Record<string, unknown> {
    switch (conflict.strategy) {
      case "last_write_wins":
        return this.lastWriteWins(conflict);
      case "timestamp_merge":
        return this.timestampMerge(conflict);
      case "server_wins":
        return { ...conflict.localData, ...conflict.serverData };
      case "client_wins":
        return { ...conflict.serverData, ...conflict.localData };
      default:
        return this.lastWriteWins(conflict);
    }
  }

  private lastWriteWins(conflict: ConflictRecord): Record<string, unknown> {
    const localTime = new Date((conflict.localData._queuedAt as string) ?? 0).getTime();
    const serverTime = new Date((conflict.serverData.updated_at as string) ?? (conflict.serverData._processedAt as string) ?? 0).getTime();

    if (localTime > serverTime) {
      return { ...conflict.serverData, ...conflict.localData };
    }
    return { ...conflict.localData, ...conflict.serverData };
  }

  private timestampMerge(conflict: ConflictRecord): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...conflict.serverData };

    for (const [key, value] of Object.entries(conflict.localData)) {
      if (key.startsWith("_")) continue;
      if (merged[key] === undefined || merged[key] === null) {
        merged[key] = value;
      }
    }

    return merged;
  }

  static getStrategies(): { id: ConflictStrategy; label: string; description: string }[] {
    return [
      { id: "last_write_wins", label: "Last Write Wins", description: "The most recent change is kept" },
      { id: "timestamp_merge", label: "Merge Fields", description: "Non-conflicting fields are merged" },
      { id: "server_wins", label: "Server Wins", description: "Server data overrides local changes" },
      { id: "client_wins", label: "Client Wins", description: "Local changes override server data" },
    ];
  }
}

export const conflictResolver = new ConflictResolver();
