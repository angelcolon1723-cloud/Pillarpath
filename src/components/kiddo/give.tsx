import { useState } from "react";
import { Check, HeartHandshake, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldLabel, NativeSelect } from "@/components/ui/input";
import { useLedger } from "@/store/ledger";
import { useSocial, type GiftRecord } from "@/store/social";
import { formatWhen } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Give — P2P Unit gifting to parent-approved contacts                  */
/*                                                                      */
/* The 7th pillar: Learn · Earn · Save · Spend · Create · Grow · Give.   */
/* Family Units only. Every transfer is capped, logged, and visible to  */
/* the parent — who can also reverse recent gifts.                       */
/* ------------------------------------------------------------------ */

function giftTone(status: GiftRecord["status"]) {
  return status === "completed"
    ? "accent"
    : status === "pending"
      ? "warn"
      : status === "reversed"
        ? "muted"
        : "muted";
}

/* ------------------------------------------------------------------ */
/* Child view                                                           */
/* ------------------------------------------------------------------ */

export function ChildGive() {
  const balance = useLedger((s) => s.balance);
  const setScreen = useLedger((s) => s.setScreen);
  const contacts = useSocial((s) => s.contacts);
  const gifts = useSocial((s) => s.gifts);
  const giveSettings = useSocial((s) => s.giveSettings);
  const requestContact = useSocial((s) => s.requestContact);
  const sendGift = useSocial((s) => s.sendGift);

  const approved = contacts.filter((c) => c.status === "approved");
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [newName, setNewName] = useState("");

  const activeContactId = contactId || approved[0]?.id || "";

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Give</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Give Units
        </h1>
        <p className="mt-1 text-sm text-muted">
          Share Units with approved friends and family. Your parent sees every
          gift.
        </p>
      </header>

      <Card className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <HeartHandshake className="size-5" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Available to give
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums">{balance} Units</p>
        </div>
      </Card>

      {approved.length === 0 ? (
        <Card className="p-5 text-center">
          <Users className="mx-auto size-8 text-muted" />
          <p className="mt-2 text-sm text-muted">
            No approved contacts yet. Ask below and your parent will review it.
          </p>
        </Card>
      ) : (
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Send a gift</CardTitle>
          <div>
            <FieldLabel>To</FieldLabel>
            <NativeSelect
              value={activeContactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              {approved.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel>Amount (Units)</FieldLabel>
            <Input
              type="number"
              min={1}
              max={giveSettings.perTransferCap}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${giveSettings.perTransferCap}`}
            />
          </div>
          <div>
            <FieldLabel>Note (optional)</FieldLabel>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thanks for helping me!"
              maxLength={80}
            />
          </div>
          {Number(amount) > giveSettings.approvalThreshold ? (
            <p className="rounded-lg bg-warn-soft p-2 text-xs text-warn">
              Gifts over {giveSettings.approvalThreshold} Units need your parent's
              approval first.
            </p>
          ) : null}
          <Button
            className="w-full"
            onClick={() => {
              if (!activeContactId) {
                toast.error("Pick someone to give to");
                return;
              }
              const err = sendGift(activeContactId, Number(amount), note);
              if (err) {
                toast.error(err);
                return;
              }
              setAmount("");
              setNote("");
              toast.success(
                Number(amount) > giveSettings.approvalThreshold
                  ? "Sent to your parent for approval"
                  : "Gift sent",
              );
            }}
          >
            <HeartHandshake className="size-4" />
            Send gift
          </Button>
        </Card>
      )}

      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">Ask for a contact</CardTitle>
        <CardHint>Your parent approves everyone you can give Units to.</CardHint>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Friend or family name"
            maxLength={40}
          />
          <Button
            variant="secondary"
            onClick={() => {
              const err = requestContact(newName);
              if (err) toast.error(err);
              else {
                setNewName("");
                toast.success("Request sent to your parent");
              }
            }}
          >
            Ask
          </Button>
        </div>
        {contacts.filter((c) => c.status === "pending").length > 0 ? (
          <ul className="space-y-1.5">
            {contacts
              .filter((c) => c.status === "pending")
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
                >
                  <span>{c.name}</span>
                  <Badge tone="warn">waiting</Badge>
                </li>
              ))}
          </ul>
        ) : null}
      </Card>

      {gifts.length > 0 ? (
        <Card className="p-4">
          <CardTitle className="text-base">My gifts</CardTitle>
          <ul className="mt-2 divide-y divide-border">
            {gifts.slice(0, 10).map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {g.contactName} · {g.amount} Units
                  </p>
                  <p className="truncate text-xs text-muted">
                    {g.note || "No note"} · {formatWhen(g.createdAt)}
                  </p>
                </div>
                <Badge tone={giftTone(g.status)}>{g.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
        Back
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parent view: contacts, limits, approvals, activity                   */
/* ------------------------------------------------------------------ */

export function PendingGiftRows() {
  const gifts = useSocial((s) => s.gifts);
  const approveGift = useSocial((s) => s.approveGift);
  const denyGift = useSocial((s) => s.denyGift);

  const pending = gifts.filter((g) => g.status === "pending");
  if (pending.length === 0) return null;

  return (
    <>
      {pending.map((g) => (
        <div key={g.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <HeartHandshake className="size-5" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              Gift {g.amount} Units → {g.contactName}
            </div>
            <div className="truncate text-xs text-muted">
              {g.note || "No note"} · needs your approval
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="success"
              size="icon-sm"
              aria-label="Approve"
              onClick={() => {
                const err = approveGift(g.id);
                if (err) toast.error(err);
                else toast.success("Gift approved");
              }}
            >
              <Check className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Deny"
              onClick={() => {
                denyGift(g.id);
                toast.message("Gift denied");
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}

export function ParentGive() {
  const setScreen = useLedger((s) => s.setScreen);
  const contacts = useSocial((s) => s.contacts);
  const gifts = useSocial((s) => s.gifts);
  const giveSettings = useSocial((s) => s.giveSettings);
  const approveContact = useSocial((s) => s.approveContact);
  const denyContact = useSocial((s) => s.denyContact);
  const removeContact = useSocial((s) => s.removeContact);
  const setGiveSettings = useSocial((s) => s.setGiveSettings);
  const approveGift = useSocial((s) => s.approveGift);
  const denyGift = useSocial((s) => s.denyGift);
  const reverseGift = useSocial((s) => s.reverseGift);

  const [cap, setCap] = useState(String(giveSettings.perTransferCap));
  const [daily, setDaily] = useState(String(giveSettings.dailyMax));
  const [threshold, setThreshold] = useState(String(giveSettings.approvalThreshold));

  const pendingContacts = contacts.filter((c) => c.status === "pending");
  const approvedContacts = contacts.filter((c) => c.status === "approved");
  const pendingGifts = gifts.filter((g) => g.status === "pending");

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Parent</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Give & contacts
        </h1>
        <p className="mt-1 text-sm text-muted">
          Who your child can gift Units to, and the guardrails around it.
        </p>
      </header>

      {pendingContacts.length > 0 ? (
        <Card className="p-4">
          <CardTitle className="text-base">Contact requests</CardTitle>
          <div className="mt-2 divide-y divide-border">
            {pendingContacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
                  <Users className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted">
                    Requested {formatWhen(c.requestedAt)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="success"
                    size="icon-sm"
                    aria-label="Approve"
                    onClick={() => {
                      approveContact(c.id);
                      toast.success(`${c.name} approved`);
                    }}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Deny"
                    onClick={() => {
                      denyContact(c.id);
                      toast.message("Request denied");
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <CardTitle className="text-base">Approved contacts</CardTitle>
        {approvedContacts.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">
            No approved contacts yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {approvedContacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium">{c.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    removeContact(c.id);
                    toast.message("Contact removed");
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">Giving limits</CardTitle>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <FieldLabel>Per gift</FieldLabel>
            <Input type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Daily max</FieldLabel>
            <Input type="number" min={1} value={daily} onChange={(e) => setDaily(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Approve over</FieldLabel>
            <Input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted">
          Gifts above the approval threshold wait for you first. Everything is
          logged below.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setGiveSettings({
              perTransferCap: Number(cap),
              dailyMax: Number(daily),
              approvalThreshold: Number(threshold),
            });
            toast.success("Giving limits saved");
          }}
        >
          Save limits
        </Button>
      </Card>

      {pendingGifts.length > 0 ? (
        <Card className="p-4">
          <CardTitle className="text-base">Gifts waiting for approval</CardTitle>
          <div className="mt-2 divide-y divide-border">
            {pendingGifts.map((g) => (
              <div key={g.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {g.amount} Units → {g.contactName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {g.note || "No note"} · {formatWhen(g.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="success"
                    size="icon-sm"
                    aria-label="Approve"
                    onClick={() => {
                      const err = approveGift(g.id);
                      if (err) toast.error(err);
                      else toast.success("Gift approved");
                    }}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Deny"
                    onClick={() => {
                      denyGift(g.id);
                      toast.message("Gift denied");
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <CardTitle className="text-base">Gift activity</CardTitle>
        {gifts.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">No gifts yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {gifts.slice(0, 20).map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {g.amount} Units → {g.contactName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {g.note || "No note"} · {formatWhen(g.createdAt)}
                  </p>
                </div>
                <Badge tone={giftTone(g.status)}>{g.status}</Badge>
                {g.status === "completed" &&
                Date.now() - new Date(g.createdAt).getTime() < 7 * 86_400_000 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const err = reverseGift(g.id);
                      if (err) toast.error(err);
                      else toast.success("Gift reversed");
                    }}
                  >
                    Reverse
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
        Back
      </Button>
    </div>
  );
}
