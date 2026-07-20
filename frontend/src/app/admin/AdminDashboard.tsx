'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Award,
  BookOpen,
  ChevronRight,
  CircleDollarSign,
  Database,
  Gauge,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Users,
  WalletCards,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Json = Record<string, any>;
type View =
  | 'overview'
  | 'users'
  | 'transactions'
  | 'events'
  | 'policy'
  | 'admins'
  | 'audit'
  | 'system';
const nav: { id: View; label: string; icon: any; permission: string }[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Gauge,
    permission: 'ADMIN_DASHBOARD_VIEW',
  },
  {
    id: 'users',
    label: 'Users & balances',
    icon: Users,
    permission: 'ADMIN_WALLET_READ',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: WalletCards,
    permission: 'ADMIN_TRANSACTION_READ',
  },
  {
    id: 'events',
    label: 'Rewardable events',
    icon: Award,
    permission: 'ADMIN_AWARD_RULE_READ',
  },
  {
    id: 'policy',
    label: 'Token rules',
    icon: CircleDollarSign,
    permission: 'ADMIN_AWARD_RULE_READ',
  },
  {
    id: 'admins',
    label: 'Administrators',
    icon: Shield,
    permission: 'ADMIN_ACCESS_MANAGE',
  },
  {
    id: 'audit',
    label: 'Audit log',
    icon: BookOpen,
    permission: 'ADMIN_AUDIT_READ',
  },
  {
    id: 'system',
    label: 'System health',
    icon: Activity,
    permission: 'ADMIN_SYSTEM_HEALTH_READ',
  },
];

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/admin/${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const value = await response.json().catch(() => ({}));
  if (response.status === 401)
    throw Object.assign(new Error('SESSION_EXPIRED'), { status: 401 });
  if (!response.ok)
    throw new Error(
      Array.isArray(value.message)
        ? value.message.join(', ')
        : value.message || 'Request failed'
    );
  return value;
}
const short = (v: any, n = 18) =>
  v == null
    ? '—'
    : String(v).length > n
      ? `${String(v).slice(0, n)}…`
      : String(v);
const date = (v: any) => (v ? new Date(v).toLocaleString() : '—');

export default function AdminDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Json | null>(null);
  const [view, setView] = useState<View>('overview');
  const [data, setData] = useState<Json | null>(null);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Json | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const profile = me || (await api('me'));
      if (!me) setMe(profile);
      const endpoints: Record<View, string> = {
        overview: 'overview',
        users: `users?search=${encodeURIComponent(search)}`,
        transactions: `transactions?search=${encodeURIComponent(search)}`,
        events: `reward-events?search=${encodeURIComponent(search)}`,
        policy: 'token-rules',
        admins: `administrators?search=${encodeURIComponent(search)}`,
        audit: `audit?search=${encodeURIComponent(search)}`,
        system: 'system/health',
      };
      setData(await api(endpoints[view]));
    } catch (e) {
      if ((e as any).status === 401 || String(e).includes('SESSION_EXPIRED'))
        router.replace('/login');
      else toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [me, router, search, view]);
  useEffect(() => {
    load();
  }, [load]);
  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }
  const allowed = nav.filter(n => me?.permissions?.includes(n.permission));
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Database size={21} />
          </div>
          <div>
            <strong>ENERGENIUS</strong>
            <small>Award administration</small>
          </div>
        </div>
        <nav>
          {allowed.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? 'active' : ''}
                onClick={() => {
                  setView(item.id);
                  setSearch('');
                  setSelected(null);
                }}
              >
                <Icon size={18} />
                {item.label}
                <ChevronRight size={14} />
              </button>
            );
          })}
        </nav>
        <button className="logout" onClick={logout}>
          <LogOut size={17} />
          Sign out
        </button>
      </aside>
      <main className="workspace">
        <header>
          <div>
            <p className="eyebrow">OPERATIONS / {view.toUpperCase()}</p>
            <h1>{nav.find(n => n.id === view)?.label}</h1>
          </div>
          <div className="admin-id">
            <span className="status-dot" />
            <div>
              <strong>{me?.displayName || 'Administrator'}</strong>
              <small>{short(me?.nexusSubject, 28)}</small>
            </div>
          </div>
        </header>
        {['users', 'transactions', 'events', 'admins', 'audit'].includes(
          view
        ) && (
          <div className="toolbar">
            <div className="search">
              <Search size={17} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && load()}
                placeholder="Search records…"
              />
            </div>
            <button onClick={load}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        )}
        {busy ? (
          <div className="loading">
            <RefreshCw className="spin" />
            Loading operational data…
          </div>
        ) : (
          <Content
            view={view}
            data={data || {}}
            me={me || {}}
            reload={load}
            selected={selected}
            setSelected={setSelected}
          />
        )}
      </main>
    </div>
  );
}

function Content({
  view,
  data,
  me,
  reload,
  selected,
  setSelected,
}: {
  view: View;
  data: Json;
  me: Json;
  reload: () => void;
  selected: Json | null;
  setSelected: (v: Json | null) => void;
}) {
  if (view === 'overview')
    return (
      <>
        <div className="cards">
          <Metric
            label="Confirmed awards"
            value={`${data.confirmedAwardAmount || 0} ENC`}
            note={`${data.confirmedAwardCount || 0} transactions`}
          />
          <Metric
            label="Confirmed spends"
            value={`${data.confirmedSpendAmount || 0} ENC`}
            note={`${data.confirmedSpendCount || 0} transactions`}
          />
          <Metric
            label="Pending chain work"
            value={
              (data.operations?.RESERVED || 0) +
              (data.operations?.SUBMITTED || 0)
            }
            note={`${data.operations?.RECONCILIATION_REQUIRED || 0} need reconciliation`}
          />
          <Metric
            label="Rejected requests"
            value={data.rejected?.length || 0}
            note="Most recent sample"
          />
        </div>
        <Panel title="Operational attention">
          <Table
            rows={data.rejected || []}
            columns={[
              ['createdAt', 'Time', date],
              ['eventId', 'Event'],
              ['targetUserId', 'User'],
              ['reasonCategory', 'Reason'],
            ]}
          />
        </Panel>
        <Panel title="Recent administrator activity">
          <Table
            rows={data.recentAudit || []}
            columns={[
              ['createdAt', 'Time', date],
              ['actorNexusSubject', 'Administrator', short],
              ['action', 'Action'],
              ['resourceType', 'Resource'],
            ]}
          />
        </Panel>
      </>
    );
  if (view === 'users')
    return (
      <>
        <Panel
          title="Wallet registry"
          action="Select a user to inspect on-chain balance and history"
        >
          <Table
            rows={data.items || []}
            onRow={async r => {
              try {
                setSelected(
                  await api(
                    `users/${encodeURIComponent(r.uidNew || r.uid || r.address)}`
                  )
                );
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            columns={[
              ['uidNew', 'Nexus user ID', short],
              ['uid', 'Legacy UID', short],
              ['address', 'Wallet address', short],
              ['updatedAt', 'Updated', date],
            ]}
          />
        </Panel>
        {selected && (
          <UserDrawer
            value={selected}
            me={me}
            close={() => setSelected(null)}
            reload={reload}
          />
        )}
      </>
    );
  if (view === 'transactions')
    return (
      <Panel title="Durable chain operations">
        <Table
          rows={data.items || []}
          columns={[
            ['createdAt', 'Created', date],
            ['type', 'Type'],
            ['uid', 'User', short],
            ['amount', 'ENC'],
            ['status', 'Status'],
            ['txHash', 'Transaction', short],
            ['componentIdentity', 'Component', short],
          ]}
        />
      </Panel>
    );
  if (view === 'events')
    return (
      <>
        <Panel
          title="Configured rewardable events"
          action={
            me.permissions?.includes('ADMIN_AWARD_RULE_CREATE') ? (
              <button onClick={() => setSelected({ new: true })}>
                + New event
              </button>
            ) : undefined
          }
        >
          <Table
            rows={data.items || []}
            onRow={r => setSelected(r)}
            columns={[
              ['eventId', 'Event ID'],
              ['displayName', 'Display name'],
              ['source', 'Source'],
              ['rewardAmount', 'ENC'],
              ['maxPerUser', 'Per user'],
              ['maxPerDay', 'Per day'],
              ['enabled', 'State', v => (v ? 'Enabled' : 'Disabled')],
            ]}
          />
        </Panel>
        {selected && (
          <EventDrawer
            value={selected}
            close={() => setSelected(null)}
            reload={reload}
          />
        )}
      </>
    );
  if (view === 'policy')
    return (
      <PolicyPanel
        data={data}
        reload={reload}
        editable={me.permissions?.includes('ADMIN_TOKEN_RULE_MANAGE')}
      />
    );
  if (view === 'admins') return <AdminsPanel data={data} reload={reload} />;
  if (view === 'audit')
    return (
      <Panel title="Append-only administrator audit">
        <Table
          rows={data.items || []}
          columns={[
            ['createdAt', 'Time', date],
            ['actorNexusSubject', 'Administrator', short],
            ['action', 'Action'],
            ['resourceType', 'Resource'],
            ['reason', 'Reason', short],
          ]}
        />
      </Panel>
    );
  return <SystemPanel data={data} reload={reload} me={me} />;
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: any;
  note: string;
}) {
  return (
    <article className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: any;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {typeof action === 'string' && <p>{action}</p>}
        </div>
        {typeof action !== 'string' && action}
      </div>
      {children}
    </section>
  );
}
function Table({
  rows,
  columns,
  onRow,
}: {
  rows: any[];
  columns: [string, string, ((v: any) => any)?][];
  onRow?: (r: any) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c[0]}>{c[1]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRow?.(row)}
                className={onRow ? 'clickable' : ''}
              >
                {columns.map(c => (
                  <td key={c[0]}>
                    {c[2] ? c[2](row[c[0]]) : (row[c[0]] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="empty">
                No records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Drawer({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="scrim" onMouseDown={close}>
      <aside className="drawer" onMouseDown={e => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{title}</h2>
          <button onClick={close}>Close</button>
        </div>
        {children}
      </aside>
    </div>
  );
}
function UserDrawer({
  value,
  me,
  close,
  reload,
}: {
  value: Json;
  me: Json;
  close: () => void;
  reload: () => void;
}) {
  const wallet = value.wallet || {};
  const [show, setShow] = useState(false);
  return (
    <Drawer title="User wallet" close={close}>
      <dl className="details">
        <dt>Nexus user ID</dt>
        <dd>{value.nexusUserId}</dd>
        <dt>Wallet</dt>
        <dd>{wallet.address}</dd>
        <dt>On-chain balance</dt>
        <dd>{value.balanceWei} wei</dd>
        <dt>Email</dt>
        <dd>Unavailable from current Nexus integration</dd>
      </dl>
      {me.permissions?.includes('ADMIN_BALANCE_ADJUST') && (
        <button className="primary" onClick={() => setShow(!show)}>
          Manual adjustment
        </button>
      )}
      {show && (
        <Adjustment
          uid={value.nexusUserId}
          done={() => {
            setShow(false);
            reload();
          }}
        />
      )}
      <h3>Recent history</h3>
      <Table
        rows={value.history || []}
        columns={[
          ['createdAt', 'Time', date],
          ['type', 'Type'],
          ['amount', 'ENC'],
          ['status', 'Status'],
          ['txHash', 'Transaction', short],
        ]}
      />
    </Drawer>
  );
}
function Adjustment({ uid, done }: { uid: string; done: () => void }) {
  const [type, setType] = useState('CREDIT');
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  const confirmation = `CONFIRM ${type} ${amount} ENC`;
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api('adjustments', {
        method: 'POST',
        body: JSON.stringify({
          uid,
          type,
          amount: Number(amount),
          reason,
          idempotencyKey: crypto.randomUUID(),
          confirmation,
        }),
      });
      toast.success('Adjustment confirmed on chain');
      done();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack inset">
      <label>
        Type
        <select value={type} onChange={e => setType(e.target.value)}>
          <option>CREDIT</option>
          <option>DEBIT</option>
          <option>CORRECTION_CREDIT</option>
          <option>CORRECTION_DEBIT</option>
          <option>REFUND</option>
        </select>
      </label>
      <label>
        Amount (whole ENC)
        <input
          type="number"
          min="1"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </label>
      <label>
        Reason
        <textarea
          required
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </label>
      <label>
        Type to confirm
        <input
          required
          pattern={confirmation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}
          placeholder={confirmation}
        />
      </label>
      <button className="danger">Submit irreversible on-chain operation</button>
    </form>
  );
}

function EventDrawer({
  value,
  close,
  reload,
}: {
  value: Json;
  close: () => void;
  reload: () => void;
}) {
  const [form, setForm] = useState<Json>(
    value.new
      ? {
          eventId: '',
          displayName: '',
          source: '',
          relativeValue: 1,
          rewardAmount: 1,
          maxPerUser: 0,
          maxPerDay: 0,
          notes: '',
          comments: '',
          globalCapExempt: false,
        }
      : value
  );
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const body: Json = {
        ...form,
        relativeValue: Number(form.relativeValue),
        rewardAmount: Number(form.rewardAmount),
        maxPerUser: Number(form.maxPerUser),
        maxPerDay: Number(form.maxPerDay),
        ...(value.new
          ? {}
          : { reason: form.reason || 'Administrative configuration update' }),
      };
      delete body.id;
      delete body.createdAt;
      delete body.updatedAt;
      delete body.createdBy;
      delete body.updatedBy;
      delete body.retiredAt;
      await api(value.new ? 'reward-events' : `reward-events/${value.id}`, {
        method: value.new ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success('Reward event saved');
      close();
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <Drawer
      title={value.new ? 'Create rewardable event' : 'Edit rewardable event'}
      close={close}
    >
      <form onSubmit={submit} className="form-grid">
        {[
          ['eventId', 'Event ID'],
          ['displayName', 'Display name'],
          ['source', 'Source'],
          ['rewardAmount', 'Reward (ENC)'],
          ['maxPerUser', 'Max per user'],
          ['maxPerDay', 'Max per day'],
          ['relativeValue', 'Relative value'],
        ].map(([k, l]) => (
          <label key={k}>
            {l}
            <input
              required
              value={form[k] ?? ''}
              type={
                [
                  'rewardAmount',
                  'maxPerUser',
                  'maxPerDay',
                  'relativeValue',
                ].includes(k)
                  ? 'number'
                  : 'text'
              }
              onChange={e => set(k, e.target.value)}
            />
          </label>
        ))}
        <label className="wide">
          Notes
          <textarea
            value={form.notes || ''}
            onChange={e => set('notes', e.target.value)}
          />
        </label>
        {!value.new && (
          <label className="wide">
            Reason
            <textarea
              required
              value={form.reason || ''}
              onChange={e => set('reason', e.target.value)}
            />
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={!!form.globalCapExempt}
            onChange={e => set('globalCapExempt', e.target.checked)}
          />{' '}
          Exempt from global cap
        </label>
        <button className="primary wide">Save event</button>
      </form>
    </Drawer>
  );
}

function PolicyPanel({
  data,
  reload,
  editable,
}: {
  data: Json;
  reload: () => void;
  editable: boolean;
}) {
  const [cap, setCap] = useState(!!data.capEnabled);
  const [daily, setDaily] = useState(data.dailyCap || 5);
  const [ex, setEx] = useState(
    (data.exemptions || []).map((x: any) => x.eventId).join(', ')
  );
  const [reason, setReason] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api('token-rules', {
        method: 'PATCH',
        body: JSON.stringify({
          capEnabled: cap,
          dailyCap: Number(daily),
          exemptions: ex
            .split(',')
            .map((x: string) => x.trim())
            .filter(Boolean),
          reason,
        }),
      });
      toast.success('Token policy updated');
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <>
      <Panel title="Global token policy">
        <form onSubmit={save} className="form-grid">
          <label className="check">
            <input
              type="checkbox"
              checked={cap}
              disabled={!editable}
              onChange={e => setCap(e.target.checked)}
            />{' '}
            Enable global daily award cap
          </label>
          <label>
            Daily cap (whole ENC)
            <input
              type="number"
              min="0"
              disabled={!editable}
              value={daily}
              onChange={e => setDaily(Number(e.target.value))}
            />
          </label>
          <label className="wide">
            Exempt event IDs (comma separated)
            <input
              disabled={!editable}
              value={ex}
              onChange={e => setEx(e.target.value)}
            />
          </label>
          {editable && (
            <>
              <label className="wide">
                Reason
                <textarea
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </label>
              <button className="primary wide">Save token policy</button>
            </>
          )}
        </form>
      </Panel>
      <ComponentSources />
    </>
  );
}
function ComponentSources() {
  const [value, setValue] = useState<Json | null>(null);
  useEffect(() => {
    api('component-sources')
      .then(setValue)
      .catch(() => {});
  }, []);
  return (
    <Panel
      title="Component source observations"
      action="Observation only — enforcement remains disabled"
    >
      <Table
        rows={value?.observations || []}
        columns={[
          ['createdAt', 'Time', date],
          ['componentIdentity', 'Component', short],
          ['configuredSource', 'Reported source'],
          ['eventId', 'Event'],
          ['matched', 'Mapped', v => (v ? 'Yes' : 'No')],
        ]}
      />
    </Panel>
  );
}

const permissions = [
  'ADMIN_DASHBOARD_VIEW',
  'ADMIN_WALLET_READ',
  'ADMIN_TRANSACTION_READ',
  'ADMIN_TRANSACTION_RECONCILE',
  'ADMIN_AWARD_RULE_READ',
  'ADMIN_AWARD_RULE_CREATE',
  'ADMIN_AWARD_RULE_UPDATE',
  'ADMIN_AWARD_RULE_DISABLE',
  'ADMIN_TOKEN_RULE_MANAGE',
  'ADMIN_BALANCE_ADJUST',
  'ADMIN_TREASURY_READ',
  'ADMIN_CONTRACT_PAUSE',
  'ADMIN_CONTRACT_UNPAUSE',
  'ADMIN_SYSTEM_HEALTH_READ',
  'ADMIN_AUDIT_READ',
  'ADMIN_ACCESS_MANAGE',
];
function AdminsPanel({ data, reload }: { data: Json; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<string[]>(['ADMIN_DASHBOARD_VIEW']);
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api('administrators', {
        method: 'POST',
        body: JSON.stringify({
          nexusSubject: subject,
          displayName: name,
          permissions: perms,
        }),
      });
      toast.success('Administrator added');
      setOpen(false);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <>
      <Panel
        title="Nexus administrator register"
        action={
          <button onClick={() => setOpen(true)}>+ Add administrator</button>
        }
      >
        <Table
          rows={data.items || []}
          columns={[
            ['displayName', 'Name'],
            ['nexusSubject', 'Nexus subject', short],
            ['enabled', 'State', v => (v ? 'Enabled' : 'Disabled')],
            ['permissions', 'Permissions', v => `${v?.length || 0} granted`],
          ]}
        />
      </Panel>
      {open && (
        <Drawer title="Add administrator" close={() => setOpen(false)}>
          <form onSubmit={create} className="form-stack">
            <label>
              Nexus subject (`sub`)
              <input
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </label>
            <label>
              Display name
              <input value={name} onChange={e => setName(e.target.value)} />
            </label>
            <fieldset>
              <legend>Permissions</legend>
              <div className="permission-grid">
                {permissions.map(p => (
                  <label className="check" key={p}>
                    <input
                      type="checkbox"
                      checked={perms.includes(p)}
                      onChange={e =>
                        setPerms(
                          e.target.checked
                            ? [...perms, p]
                            : perms.filter(x => x !== p)
                        )
                      }
                    />
                    {p.replace('ADMIN_', '').replaceAll('_', ' ')}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="primary">Create administrator</button>
          </form>
        </Drawer>
      )}
    </>
  );
}
function SystemPanel({
  data,
  reload,
  me,
}: {
  data: Json;
  reload: () => void;
  me: Json;
}) {
  async function action(path: string, confirmation?: string) {
    if (
      confirmation &&
      !confirm(
        `This changes the deployed contract. Continue with ${confirmation}?`
      )
    )
      return;
    try {
      await api(path, {
        method: 'POST',
        headers: confirmation ? { 'x-admin-confirmation': confirmation } : {},
      });
      toast.success('Operation completed');
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <>
      <div className="cards">
        <Metric
          label="Contract"
          value={data.contract_deployed ? 'Deployed' : 'Missing'}
          note={short(data.contract_address, 24)}
        />
        <Metric
          label="Signer ownership"
          value={data.signer_is_owner ? 'Valid' : 'Mismatch'}
          note={short(data.signer_address, 24)}
        />
        <Metric
          label="Contract state"
          value={data.paused ? 'Paused' : 'Active'}
          note={`Chain ${data.chain_id}`}
        />
        <Metric
          label="Reconciliation cursor"
          value={data.last_reconciled_block || 'Not started'}
          note={`Head ${data.latest_block || '—'}`}
        />
      </div>
      <Panel title="Chain controls">
        <div className="button-row">
          {me.permissions?.includes('ADMIN_TRANSACTION_RECONCILE') && (
            <button onClick={() => action('reconciliation/run')}>
              Run reconciliation
            </button>
          )}
          {me.permissions?.includes('ADMIN_CONTRACT_PAUSE') && !data.paused && (
            <button
              className="danger"
              onClick={() => action('contract/pause', 'PAUSE ENCOIN')}
            >
              Pause contract
            </button>
          )}
          {me.permissions?.includes('ADMIN_CONTRACT_UNPAUSE') &&
            data.paused && (
              <button
                className="danger"
                onClick={() => action('contract/unpause', 'UNPAUSE ENCOIN')}
              >
                Unpause contract
              </button>
            )}
        </div>
        <dl className="details">
          <dt>Owner</dt>
          <dd>{data.owner_address}</dd>
          <dt>Treasury</dt>
          <dd>{data.treasury_address}</dd>
          <dt>Treasury balance</dt>
          <dd>{data.treasury_balance_wei} wei</dd>
          <dt>Token</dt>
          <dd>
            {data.token?.name} ({data.token?.symbol})
          </dd>
        </dl>
      </Panel>
    </>
  );
}
