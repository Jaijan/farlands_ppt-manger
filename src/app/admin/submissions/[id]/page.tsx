import { ReviewPage } from "@/components/review-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ReviewPage id={(await params).id} role="admin" />;
}
