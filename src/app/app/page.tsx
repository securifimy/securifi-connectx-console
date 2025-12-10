import { redirect } from "next/navigation";

export default function ConversationsRedirectPage() {
  redirect("/app/chat");
}
