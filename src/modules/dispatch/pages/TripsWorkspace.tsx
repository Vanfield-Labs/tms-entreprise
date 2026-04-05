import { useEffect, useState } from "react";
import { TabBar } from "@/components/TmsUI";
import DispatchBoard from "@/modules/dispatch/pages/DispatchBoard";
import CloseTrips from "@/modules/bookings/pages/CloseTrips";

type TripTab = "dispatch" | "close";

const STORAGE_KEY = "tms-transport-trips-tab";

function readStoredTab(): TripTab {
  const stored = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
  return stored === "close" ? "close" : "dispatch";
}

function writeStoredTab(value: TripTab) {
  sessionStorage.setItem(STORAGE_KEY, value);
  localStorage.setItem(STORAGE_KEY, value);
}

export default function TripsWorkspace() {
  const [tab, setTab] = useState<TripTab>(() => readStoredTab());
  const [pendingFocus, setPendingFocus] = useState<{
    entityType: string;
    entityId?: string | null;
  } | null>(null);

  useEffect(() => {
    writeStoredTab(tab);
  }, [tab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        entityType?: string;
        entityId?: string | null;
        forwardedFromWorkspace?: boolean;
      }>).detail;
      if (!detail?.entityType) return;
      if (detail.forwardedFromWorkspace) return;

      if (detail.entityType === "trip") {
        setTab("close");
        setPendingFocus({ entityType: detail.entityType, entityId: detail.entityId ?? null });
        return;
      }

      if (detail.entityType === "booking") {
        setTab("dispatch");
        setPendingFocus({ entityType: detail.entityType, entityId: detail.entityId ?? null });
      }
    };

    window.addEventListener("tms:entity-focus", handler);
    return () => window.removeEventListener("tms:entity-focus", handler);
  }, []);

  useEffect(() => {
    if (!pendingFocus) return;

    const targetTab = pendingFocus.entityType === "trip" ? "close" : "dispatch";
    if (tab !== targetTab) return;

    const timeout = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("tms:entity-focus", {
          detail: {
            entityType: pendingFocus.entityType,
            entityId: pendingFocus.entityId ?? null,
            forwardedFromWorkspace: true,
          },
        })
      );
      setPendingFocus(null);
    }, 60);

    return () => window.clearTimeout(timeout);
  }, [pendingFocus, tab]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trips</h1>
          <p className="page-sub">Dispatch approved bookings and close completed trips from one workspace</p>
        </div>
      </div>

      <TabBar
        tabs={[
          { value: "dispatch", label: "Dispatch Queue" },
          { value: "close", label: "Close Trips" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "dispatch" ? <DispatchBoard /> : <CloseTrips />}
    </div>
  );
}
