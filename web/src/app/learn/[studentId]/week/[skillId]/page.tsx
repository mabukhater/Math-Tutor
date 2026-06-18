import PathBlock from "./PathBlock";

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string; skillId: string }>;
}) {
  const { studentId, skillId } = await params;
  return <PathBlock studentId={studentId} skillId={skillId} />;
}
