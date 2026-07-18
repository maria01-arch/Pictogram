import ProfileView from "@/components/ProfileView";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const trimmedUsername = username.trim();
  return <ProfileView username={trimmedUsername} />;
}
