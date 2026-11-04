import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordReading } from "@/lib/services/coldrooms";

export const dynamic = "force-dynamic";

const body = z.object({ readings: z.array(z.object({ sensorId: z.string().min(1).max(80), temperatureC: z.number().min(-40).max(50), humidity: z.number().min(0).max(100).nullable().optional(), recordedAt: z.string().datetime().optional() })).max(500) });

/** Future IoT ingestion endpoint. Disabled (404) unless SENSOR_API_KEY is set. Auth: `Authorization: Bearer <key>`. */
export async function POST(req: Request) {
  const key = process.env.SENSOR_API_KEY;
  if (!key) return new Response("Sensor integration not enabled", { status: 404 });
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(auth), b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Unauthorized", { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
  let accepted = 0, unknown = 0;
  for (const r of parsed.data.readings) {
    const room = await prisma.coldRoom.findFirst({ where: { sensorId: r.sensorId } });
    if (!room) { unknown++; continue; }
    await recordReading(room.id, r.temperatureC, r.humidity ?? null, "IOT", null, r.recordedAt ? new Date(r.recordedAt) : new Date());
    accepted++;
  }
  return Response.json({ accepted, unknownSensors: unknown });
}
