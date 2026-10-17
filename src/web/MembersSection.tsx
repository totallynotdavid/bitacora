import { useEffect, useState } from "react";
import { ROLE_TITLES, ROLES, type IssuedLink, type Member, type Role } from "../shared/model";
import { api } from "./api";
import { CopyLink } from "./CopyLink";
import form from "./form.module.css";
import styles from "./SettingsDialog.module.css";

const expiry = (link: IssuedLink) =>
  `Vence el ${new Date(link.expiresAt * 1000).toLocaleDateString("es", { day: "numeric", month: "long" })}. Sirve una sola vez.`;

function RoleSelect(props: {
  id: string;
  label: string;
  value: Role;
  disabled?: boolean;
  onChange: (role: Role) => void;
}) {
  return (
    <select
      id={props.id}
      className={form.input + " " + styles.role}
      aria-label={props.label}
      value={props.value}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.target.value as Role)}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_TITLES[role]}
        </option>
      ))}
    </select>
  );
}

function Invite() {
  const [role, setRole] = useState<Role>("member");
  const [link, setLink] = useState<IssuedLink | null>(null);
  const [failed, setFailed] = useState(false);

  async function invite() {
    setFailed(false);
    try {
      setLink(await api.invite(role));
    } catch (error) {
      console.error(error);
      setFailed(true);
    }
  }

  return (
    <div>
      <div className={styles.inviteRow}>
        <RoleSelect id="invite-role" label="Rol de la invitación" value={role} onChange={setRole} />
        <button type="button" className={form.primary} onClick={invite}>
          Invitar
        </button>
      </div>
      {failed && <p role="alert">No se pudo crear la invitación.</p>}
      {link && (
        <>
          <CopyLink id="invite-link" label="Enlace de invitación" value={`${location.origin}${link.path}`} />
          <p className={styles.hint}>{expiry(link)}</p>
        </>
      )}
    </div>
  );
}

function Row(props: { member: Member; self: boolean; onChange: (member: Member) => void }) {
  const { member } = props;
  const [reset, setReset] = useState<IssuedLink | null>(null);
  const [failed, setFailed] = useState(false);

  async function run(action: () => Promise<void>) {
    setFailed(false);
    try {
      await action();
    } catch (error) {
      console.error(error);
      setFailed(true);
    }
  }

  const update = (patch: { role?: Role; disabled?: boolean }) =>
    run(async () => props.onChange(await api.updateMember(member.id, patch)));

  return (
    <li className={styles.member} data-disabled={member.disabled}>
      <div className={styles.memberHead}>
        <div className={styles.who}>
          <strong>{member.name}</strong>
          <span className={styles.hint}>
            {member.email ?? "Sin correo"}
            {props.self && " · Tú"}
            {member.disabled && " · Desactivado"}
          </span>
        </div>
        <RoleSelect
          id={`role-${member.id}`}
          label={`Rol de ${member.name}`}
          value={member.role}
          disabled={props.self}
          onChange={(role) => update({ role })}
        />
      </div>
      <div className={styles.memberActions}>
        <button
          type="button"
          className={form.secondary}
          onClick={() => run(async () => setReset(await api.resetLink(member.id)))}
        >
          Enlace para restablecer contraseña
        </button>
        {!props.self && (
          <button
            type="button"
            className={member.disabled ? form.secondary : form.danger}
            onClick={() => update({ disabled: !member.disabled })}
          >
            {member.disabled ? "Activar" : "Desactivar"}
          </button>
        )}
      </div>
      {failed && <p role="alert">No se pudo completar la acción.</p>}
      {reset && (
        <>
          <CopyLink
            id={`reset-${member.id}`}
            label="Enlace para restablecer"
            value={`${location.origin}${reset.path}`}
          />
          <p className={styles.hint}>{expiry(reset)}</p>
        </>
      )}
    </li>
  );
}

export function MembersSection(props: { selfId: string }) {
  const [members, setMembers] = useState<Member[] | null>(null);

  useEffect(() => {
    api.members().then(setMembers, console.error);
  }, []);

  const replace = (next: Member) =>
    setMembers((all) => all?.map((member) => (member.id === next.id ? next : member)) ?? null);

  return (
    <section className={styles.section} aria-labelledby="members-heading">
      <h3 id="members-heading" className={styles.heading}>
        Miembros
      </h3>
      <Invite />
      <ul className={styles.members} aria-label="Miembros">
        {members?.map((member) => (
          <Row key={member.id} member={member} self={member.id === props.selfId} onChange={replace} />
        ))}
      </ul>
    </section>
  );
}
