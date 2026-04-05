import { useEffect, useState } from "react";
import { TabBar } from "@/components/TmsUI";
import MaintenanceBoard from "@/modules/maintenance/pages/MaintenanceBoard";
import MaintenanceHistory from "@/modules/maintenance/pages/MaintenanceHistory";

type MaintenanceTab = "board" | "history";

const STORAGE_KEY = "tms-transport-maintenance-tab";

function readStoredTab(): MaintenanceTab {
  const stored = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
  return stored === "history" ? "history" : "board";
}

function writeStoredTab(value: MaintenanceTab) {
  sessionStorage.setItem(STORAGE_KEY, value);
  localStorage.setItem(STORAGE_KEY, value);
}

export default function MaintenanceWorkspace() {
  const [tab, setTab] = useState<MaintenanceTab>(() => readStoredTab());
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
      if (detail?.forwardedFromWorkspace) return;

      if (detail?.entityType === "maintenance_request" || detail?.entityType === "maintenance") {
        setTab("board");
        setPendingFocus({ entityType: detail.entityType, entityId: detail.entityId ?? null });
      }
    };

    window.addEventListener("tms:entity-focus", handler);
    return () => window.removeEventListener("tms:entity-focus", handler);
  }, []);

  useEffect(() => {
    if (!pendingFocus || tab !== "board") return;

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
      <TabBar
        tabs={[
          { value: "board", label: "Work Queue" },
          { value: "history", label: "History" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "board" ? <MaintenanceBoard /> : <MaintenanceHistory />}
    </div>
  );
}
