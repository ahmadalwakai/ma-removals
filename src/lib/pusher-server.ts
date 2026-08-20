import Pusher from "pusher";

if (
  !process.env.PUSHER_APP_ID ||
  !process.env.PUSHER_KEY ||
  !process.env.PUSHER_SECRET ||
  !process.env.PUSHER_CLUSTER
) {
  console.warn("Pusher env vars not set — chat will use polling fallback");
}

export const pusherServer = process.env.PUSHER_APP_ID
  ? new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    })
  : null;

export function triggerEvent(channel: string, event: string, data: unknown) {
  if (pusherServer) {
    pusherServer.trigger(channel, event, data).catch(console.error);
  }
}
