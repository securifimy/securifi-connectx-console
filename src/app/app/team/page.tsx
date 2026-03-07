import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { TeamMembersContent } from "@/components/team/TeamMembersContent";

export default function TeamPage() {
  return (
    <WorkspaceShell
      activeNav="team"
      header={{
        title: "Team",
        subtitle: "Manage workspace members, access levels, and invitation flow.",
      }}
    >
      <TeamMembersContent />
    </WorkspaceShell>
  );
}
