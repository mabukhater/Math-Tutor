import ReadingBlock from "./ReadingBlock";

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string; passageId: string }>;
}) {
  const { studentId, passageId } = await params;
  return <ReadingBlock studentId={studentId} passageId={passageId} />;
}
