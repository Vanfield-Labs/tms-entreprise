import { supabase } from "@/lib/supabase";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationEntityType =
  | "booking"
  | "fuel_request"
  | "maintenance_request"
  | "incident_report"
  | "trip"
  | "news_assignment"
  | "camera_pickup"
  | "unit_pickup_schedule"
  | "user_request"
  | "password_change_request"
  | "system"
  | string;

export type CreateNotificationInput = {
  recipient_id?: string;
  user_id?: string;
  title: string;
  body: string;
  priority?: NotificationPriority;
  entity_type?: NotificationEntityType | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  is_read?: boolean;
  read_at?: string | null;
  type?: NotificationEntityType;
  link_entity?: string | null;
  link_id?: string | null;
};

function normalizeEntityType(
  value?: string | null
): NotificationEntityType {
  switch (value) {
    case "fuel":
      return "fuel_request";
    case "maintenance":
      return "maintenance_request";
    case "user":
      return "user_request";
    case "incident":
      return "incident_report";
    default:
      return value ?? "system";
  }
}

function normalizeCreateNotificationInput(input: CreateNotificationInput) {
  const recipientId = input.recipient_id ?? input.user_id;

  if (!recipientId) {
    throw new Error("recipient_id is required");
  }

  return {
    recipient_id: recipientId,
    title: input.title,
    body: input.body,
    priority: input.priority ?? "normal",
    entity_type: normalizeEntityType(
      input.entity_type ?? input.link_entity ?? input.type
    ),
    entity_id: input.entity_id ?? input.link_id ?? null,
    metadata: input.metadata ?? null,
    is_read: input.is_read ?? false,
    read_at: input.read_at ?? null,
  };
}

export async function createNotification(input: CreateNotificationInput) {
  const { error } = await supabase
    .from("notifications")
    .insert(normalizeCreateNotificationInput(input));

  if (error) {
    console.error("Failed to create notification:", error.message);
    throw error;
  }
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  if (!inputs.length) return;

  const payload = inputs.map(normalizeCreateNotificationInput);
  const { error } = await supabase.from("notifications").insert(payload);

  if (error) {
    console.error("Failed to create notifications:", error.message);
    throw error;
  }
}
