// In-memory store for image generation notifications
// Shared between API routes in the same server process

interface ImageNotification {
  image_url: string;
  image_id: number | null;
  timestamp: number;
}

export const pendingImages = new Map<number, ImageNotification>();
