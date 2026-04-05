import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const NOTIF_FILE = join("/tmp", "dash-ei-image-notifications.json");

interface ImageNotification {
  image_url: string;
  image_id: number | null;
  timestamp: number;
}

function readStore(): Record<string, ImageNotification> {
  try {
    if (existsSync(NOTIF_FILE)) {
      return JSON.parse(readFileSync(NOTIF_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function writeStore(store: Record<string, ImageNotification>) {
  writeFileSync(NOTIF_FILE, JSON.stringify(store));
}

export function addNotification(postId: number, imageUrl: string, imageId: number | null) {
  const store = readStore();
  store[String(postId)] = {
    image_url: imageUrl,
    image_id: imageId,
    timestamp: Date.now(),
  };
  writeStore(store);
}

export function consumeNotifications(): { post_id: number; image_url: string; image_id: number | null }[] {
  const store = readStore();
  const results = [];
  const now = Date.now();

  for (const [postId, data] of Object.entries(store)) {
    if (now - data.timestamp < 600000) {
      results.push({
        post_id: parseInt(postId, 10),
        image_url: data.image_url,
        image_id: data.image_id,
      });
    }
  }

  // Clear consumed + old entries
  writeStore({});

  return results;
}
