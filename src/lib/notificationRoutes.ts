// src/lib/notificationRoutes.ts

export type NotificationEntityType =
  | "booking"
  | "fuel_request"
  | "maintenance_request"
  | "incident_report"
  | "trip"
  | "news_assignment"
  | "driver_leave_request"
  | "camera_pickup"
  | "unit_pickup_schedule"
  | "user_request"
  | "password_change_request"
  | string;

export type NotificationTarget = {
  navLabel?: string;
  eventName?: string;
  eventDetail?: Record<string, unknown>;
};

const ENTITY_ROUTE_MAP: Record<string, NotificationTarget> = {
  booking: {
    navLabel: "Bookings",
    eventName: "tms:focus-booking",
  },
  fuel: {
    navLabel: "Fuel Requests",
    eventName: "tms:focus-fuel-request",
  },
  fuel_request: {
    navLabel: "Fuel Requests",
    eventName: "tms:focus-fuel-request",
  },
  maintenance: {
    navLabel: "Maintenance",
    eventName: "tms:focus-maintenance-request",
  },
  maintenance_request: {
    navLabel: "Maintenance",
    eventName: "tms:focus-maintenance-request",
  },
  incident: {
    navLabel: "Incident Report",
    eventName: "tms:focus-incident-report",
  },
  incident_report: {
    navLabel: "Incident Report",
    eventName: "tms:focus-incident-report",
  },
  trip: {
    navLabel: "Trips",
    eventName: "tms:focus-trip",
  },
  news_assignment: {
    navLabel: "Assignment",
    eventName: "tms:focus-news-assignment",
  },
  driver_leave_request: {
    navLabel: "Leave",
    eventName: "tms:focus-driver-leave-request",
  },
  camera_pickup: {
    navLabel: "Camera Pickup",
    eventName: "tms:focus-camera-pickup",
  },
  unit_pickup_schedule: {
    navLabel: "Pickup Schedule",
    eventName: "tms:focus-unit-pickup-schedule",
  },
  user_request: {
    navLabel: "User Requests",
    eventName: "tms:focus-user-request",
  },
  user: {
    navLabel: "User Requests",
    eventName: "tms:focus-user-request",
  },
  password_change_request: {
    navLabel: "User Requests",
    eventName: "tms:focus-password-change-request",
  },
};

export function resolveNotificationTarget(
  entityType?: string | null,
  entityId?: string | null
): NotificationTarget | null {
  if (!entityType) return null;

  const hit = ENTITY_ROUTE_MAP[entityType];
  if (!hit) return null;

  return {
    ...hit,
    eventDetail: entityId ? { entityId, entityType } : { entityType },
  };
}

export function navigateByNotificationEntity(
  entityType?: string | null,
  entityId?: string | null
) {
  const target = resolveNotificationTarget(entityType, entityId);
  if (!target) return;

  if (target.navLabel) {
    window.dispatchEvent(
      new CustomEvent("tms:navigate", {
        detail: { label: target.navLabel, entityType, entityId },
      })
    );
  }

  if (target.eventName) {
    window.dispatchEvent(
      new CustomEvent(target.eventName, {
        detail: target.eventDetail ?? { entityType, entityId },
      })
    );
  }

  window.dispatchEvent(
    new CustomEvent("tms:entity-focus", {
      detail: { entityType, entityId },
    })
  );
}
