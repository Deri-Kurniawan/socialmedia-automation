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
      let lastSentProgress: number | null = null;
      let lastSentStatus: string | null = null;
      let noDataCount = 0;
      let isClosed = false;
      
      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch (e) {
            // Controller already closed, ignore
          }
        }
      };
      
      // Send connection established message immediately
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ progress: 0, status: "Connected", completed: false, timestamp: Date.now() })}\n\n`)
        );
      } catch (e) {
        safeClose();
        return;
      }
      
      // Send initial progress or waiting message
      const initial = uploadProgressStore.get(uploadId);
      if (initial) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initial)}\n\n`)
        );
        lastSentProgress = initial.progress;
        lastSentStatus = initial.status;
      }

      // Set up interval to check for updates
      const interval = setInterval(() => {
        if (isClosed) return;
        
        try {
          const progress = uploadProgressStore.get(uploadId);
          
          if (progress) {
            noDataCount = 0;
            // Send if data changed or every 2 seconds as heartbeat
            const shouldSend = progress.progress !== lastSentProgress || 
                              progress.status !== lastSentStatus || 
                              progress.completed ||
                              Date.now() - (progress.timestamp || 0) > 2000;
            
            if (shouldSend) {
              const data = `data: ${JSON.stringify(progress)}\n\n`;
              controller.enqueue(encoder.encode(data));
              lastSentProgress = progress.progress;
              lastSentStatus = progress.status;
            }

            // Close stream if completed or errored
            if (progress.completed || progress.error) {
              clearInterval(interval);
              // Send final message before closing
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ ...progress, completed: true })}\n\n`)
              );
              setTimeout(safeClose, 100);
            }
          } else {
            // No progress data yet, send keepalive every few checks
            noDataCount++;
            if (noDataCount % 5 === 0) { // Every ~1 second
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ progress: 0, status: "Waiting to start...", completed: false, timestamp: Date.now() })}\n\n`)
              );
            }
          }
        } catch (err) {
          console.error("SSE interval error:", err);
          clearInterval(interval);
          safeClose();
        }
      }, 200); // Check every 200ms

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        safeClose();
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        safeClose();
      }, 5 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
