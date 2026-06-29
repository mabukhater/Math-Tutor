import { notFound } from "next/navigation";
import CapstoneClient from "./CapstoneClient";

export const dynamic = "force-dynamic";

export default async function CapstonePage({
  params,
}: {
  params: Promise<{ studentId: string; level: string }>;
}) {
  const { studentId, level: levelParam } = await params;
  const levelNum = parseInt(levelParam, 10);
  if (levelNum !== 7 && levelNum !== 8) notFound();

  // Data fetching happens client-side via /api/capstone to avoid wiring
  // server-to-client async prop passing for the designer's client components.
  return <CapstoneClient studentId={studentId} levelNum={levelNum as 7 | 8} />;
}
