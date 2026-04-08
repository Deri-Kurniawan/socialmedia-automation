// In-memory store for upload progress (use Redis in production for multi-server setups)
interface UploadProgress {
  progress: number;
  status: string;
  completed: boolean;
  error?: string;
  timestamp: number;
}

const uploadProgressStore = new Map<string, UploadProgress>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of uploadProgressStore.entries()) {
    // Remove entries older than 10 minutes or completed uploads
    if (value.completed || now - value.timestamp > 10 * 60 * 1000) {
      uploadProgressStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function setUploadProgress(uploadId: string, progress: number, status: string, error?: string) {
  uploadProgressStore.set(uploadId, {
    progress,
    status,
    completed: progress >= 100 || !!error,
    error,
    timestamp: Date.now(),
  });
}

export function getUploadProgress(uploadId: string): UploadProgress | undefined {
  return uploadProgressStore.get(uploadId);
}

export function createUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("id");

  if (!uploadId) {
    return new Response("Missing upload ID", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial progress
      const initial = uploadProgressStore.get(uploadId);
      if (initial) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initial)}\n\n`)
        );
      }

      // Set up interval to check for updates
      const interval = setInterval(() => {
        const progress = uploadProgressStore.get(uploadId);
        
        if (progress) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
          );

          // Close stream if completed or errored
          if (progress.completed || progress.error) {
            clearInterval(interval);
            controller.close();
          }
        }
      }, 500); // Update every 500ms

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
