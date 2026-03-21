// src/layouts/JoyNewsLayout.tsx
import AppShell from "../app/AppShell";
import NewsUnitDashboard from "@/modules/news/pages/NewsUnitDashboard";
import CreateBookingV2 from "@/modules/bookings/pages/CreateBookingV2";
import MyBookings from "@/modules/bookings/pages/MyBookings";
import ProfilePage from "@/pages/profile/ProfilePage";

const JOY_NEWS_ID   = "f34cb9c1-334a-4503-9e39-06980e6f4d74";

export default function JoyNewsLayout() {
  return (
    <AppShell
      title="Joy News"
      navItems={[
        { label: "Assignments",  element: <NewsUnitDashboard unitId={JOY_NEWS_ID} unitName="Joy News" /> },
        { label: "New Booking",  element: <CreateBookingV2 /> },
        { label: "My Bookings",  element: <MyBookings /> },
        { label: "Profile",      element: <ProfilePage /> },
      ]}
    />
  );
}