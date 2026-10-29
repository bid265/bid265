import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import DashboardLayoutFrame from "@/components/dashboard/DashboardLayoutFrame";

export default async function AddListingPage({ searchParams }) {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = {
    id: Number(session.user.id) || 0,
    name: session.user.name || "N/A",
    email: session.user.email || "",
    role: session.user.role || "BIDDER",
  };

  if (session.user.mustChangePassword || (user.role !== "AUCTIONEER" && user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const initialMode = ["daily-sale", "auction"].includes(params?.mode) ? params.mode : "property";

  return (
    <DashboardLayoutFrame
      user={user}
      serializedAuctionItems={[]}
      isAuctioneer={true}
      forceTab="add-listing"
      addListingInitialMode={initialMode}
    />
  );
}
