import type { Settings } from "../shared/model";
import { AccountSection } from "./AccountSection";
import { Dialog } from "./Dialog";
import { MembersSection } from "./MembersSection";
import { ReportSection } from "./ReportSection";
import { TokensSection } from "./TokensSection";

export function SettingsDialog(props: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}) {
  const { settings, onChange } = props;
  return (
    <Dialog title="Ajustes" onClose={props.onClose} wide>
      <AccountSection settings={settings} onChange={onChange} />
      <ReportSection settings={settings} onChange={onChange} />
      <TokensSection />
      {settings.role === "admin" && <MembersSection selfId={settings.id} />}
    </Dialog>
  );
}
