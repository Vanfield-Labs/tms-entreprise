import { supabase } from "@/lib/supabase";

export type NotificationType =
  | "booking"
  | "fuel"
  | "maintenance"
  | "user"
  | "system";

export type CreateNotificationInput = {
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  link_entity?: string | null;
  link_id?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  const payload = {
    user_id: input.user_id,
    title: input.title,
    body: input.body,
    type: input.type,
    link_entity: input.link_entity ?? null,
    link_id: input.link_id ?? null,
    read: false,
  };

  const { error } = await supabase.from("notifications").insert(payload);

  if (error) {
    console.error("Failed to create notification:", error.message);
    throw error;
  }
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  if (!inputs.length) return;

  const payload = inputs.map((input) => ({
    user_id: input.user_id,
    title: input.title,
    body: input.body,
    type: input.type,
    link_entity: input.link_entity ?? null,
    link_id: input.link_id ?? null,
    read: false,
  }));

  const { error } = await supabase.from("notifications").insert(payload);

  if (error) {
    console.error("Failed to create notifications:", error.message);
    throw error;
  }
}