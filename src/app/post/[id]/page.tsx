import SinglePostView from "../../../components/SinglePostView";

export default async function SinglePostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SinglePostView postId={id} />;
}
