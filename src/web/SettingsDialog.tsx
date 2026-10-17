import { useEffect, useState } from "react";
import type { Settings } from "../shared/model";
import { AccountSection } from "./AccountSection";
import { api } from "./api";
import { Dialog } from "./Dialog";
import { MembersSection } from "./MembersSection";
import { ReportSection } from "./ReportSection";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    api.settings().then(setSettings, console.error);
  }, []);

  return (
    <Dialog title="Ajustes" onClose={onClose} wide>
      {settings && (
        <>
          <AccountSection settings={settings} onChange={setSettings} />
          <ReportSection settings={settings} onChange={setSettings} />
          {settings.role === "admin" && <MembersSection selfId={settings.id} />}
        </>
      )}
    </Dialog>
  );
}
