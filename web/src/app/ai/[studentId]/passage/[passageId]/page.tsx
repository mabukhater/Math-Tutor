import AIPassageBlock from "./AIPassageBlock";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string; passageId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { studentId, passageId } = await params;
  const { subject } = await searchParams;
  const course = subject === "ai8" ? "ai8" : "ai7";
  return <AIPassageBlock studentId={studentId} passageId={passageId} subject={course} />;
}
