// src/layouts/JoyBusinessLayout.tsx
import AppShell from "../app/AppShell";
import NewsUnitDashboard from "@/modules/news/pages/NewsUnitDashboard";
import CreateBookingV2 from "@/modules/bookings/pages/CreateBookingV2";
import MyBookings from "@/modules/bookings/pages/MyBookings";
import ProfilePage from "@/pages/profile/ProfilePage";

const JOY_BUSINESS_ID = "0dc91872-e758-4392-9ef5-34e6434188e1";

export default function JoyBusinessLayout() {
  return (
    <AppShell
      title="Joy Business"
      navItems={[
        { label: "Assignments",  element: <NewsUnitDashboard unitId={JOY_BUSINESS_ID} unitName="Joy Business" /> },
        { label: "New Booking",  element: <CreateBookingV2 /> },
        { label: "My Bookings",  element: <MyBookings /> },
        { label: "Profile",      element: <ProfilePage /> },
      ]}
    />
  );
}