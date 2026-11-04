import { prisma } from "@/lib/db";
import { D } from "@/lib/money";
import { BusinessError } from "@/lib/errors";

export async function recordReading(coldRoomId: string, temperatureC: number, humidity: number | null, source: "MANUAL" | "IOT", userId: string | null, recordedAt = new Date()) {
  const room = await prisma.coldRoom.findUnique({ where: { id: coldRoomId } });
  if (!room) throw new BusinessError("Cold room not found");
  if (recordedAt.getTime() > Date.now() + 5 * 60000) throw new BusinessError("Reading time cannot be in the future");
  const outOfRange = D(temperatureC).minus(D(room.targetTempC)).abs().gt(D(room.tempToleranceC));
  await prisma.$transaction(async (tx) => {
    await tx.coldRoomReading.create({ data: { coldRoomId, temperatureC: D(temperatureC).toFixed(2), humidity: humidity === null ? null : D(humidity).toFixed(2), source, outOfRange, recordedById: userId, recordedAt } });
    if (!room.lastReadingAt || recordedAt >= room.lastReadingAt) {
      await tx.coldRoom.update({ where: { id: coldRoomId }, data: { currentTempC: D(temperatureC).toFixed(2), currentHumidity: humidity === null ? room.currentHumidity : D(humidity).toFixed(2), lastReadingAt: recordedAt } });
    }
  });
  return { outOfRange };
}
