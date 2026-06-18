import TopicPractice from "./TopicPractice";

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string; topicCode: string }>;
}) {
  const { studentId, topicCode } = await params;
  return <TopicPractice studentId={studentId} topicCode={topicCode} />;
}
