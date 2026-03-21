// src/layouts/AdomTvLayout.tsx
import AppShell from "../app/AppShell";
import NewsUnitDashboard from "@/modules/news/pages/NewsUnitDashboard";
import CreateBookingV2 from "@/modules/bookings/pages/CreateBookingV2";
import MyBookings from "@/modules/bookings/pages/MyBookings";
import ProfilePage from "@/pages/profile/ProfilePage";

const ADOM_TV_ID = "61ef9897-c284-43fe-a60d-7a22fa4e1a11";

export default function AdomTvLayout() {
  return (
    <AppShell
      title="Adom TV"
      navItems={[
        { label: "Assignments",  element: <NewsUnitDashboard unitId={ADOM_TV_ID} unitName="Adom TV" /> },
        { label: "New Booking",  element: <CreateBookingV2 /> },
        { label: "My Bookings",  element: <MyBookings /> },
        { label: "Profile",      element: <ProfilePage /> },
      ]}
    />
  );
}