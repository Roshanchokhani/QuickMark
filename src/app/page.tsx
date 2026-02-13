import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import BookmarkDashboard from "@/components/BookmarkDashboard";
import { Bookmark } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Bookmarks</h1>
          <p className="mt-1 text-sm text-gray-500">
            Save and organize your favorite links
          </p>
        </div>
        <BookmarkDashboard
          initialBookmarks={(bookmarks as Bookmark[]) || []}
          userId={user.id}
        />
      </main>
    </div>
  );
}
