import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  listTowerChannels,
  listTowerMessages,
  openTowerDirectMessage,
  sendTowerMessage,
  type TowerChannel,
  type TowerMessage,
} from "@/lib/corporate-server";

/**
 * Tower secure messaging — the company's internal comms.
 *
 * Team channels (#general, #announcements), plus 1:1 direct messages.
 * Every read and write is gated server-side to active corporate members;
 * announcements are post-restricted to the C-suite. Nothing here is
 * visible to customers, families, or teachers.
 */
export function TowerMessages() {
  const [channels, setChannels] = useState<TowerChannel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TowerMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [dmEmail, setDmEmail] = useState("");
  const [showDm, setShowDm] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChannels = useCallback(async () => {
    try {
      const r = await listTowerChannels();
      setChannels(r.channels);
      setActiveId((prev) => {
        if (prev && r.channels.some((c) => c.id === prev)) return prev;
        return r.channels.find((c) => !c.isDm)?.id ?? r.channels[0]?.id ?? null;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load channels.");
    }
  }, []);

  const loadMessages = useCallback(async (channelId: string) => {
    try {
      const r = await listTowerMessages({ data: { channelId } });
      setMessages(r.messages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load messages.");
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    const t = setInterval(() => void loadMessages(activeId), 15000);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const active = channels.find((c) => c.id === activeId) ?? null;

  async function send() {
    const text = draft.trim();
    if (!text || !activeId || !active?.canPost) return;
    setBusy(true);
    try {
      await sendTowerMessage({ data: { channelId: activeId, body: text } });
      setDraft("");
      await loadMessages(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  async function startDm() {
    if (!dmEmail.trim()) return;
    setBusy(true);
    try {
      const r = await openTowerDirectMessage({ data: { email: dmEmail.trim() } });
      setDmEmail("");
      setShowDm(false);
      await loadChannels();
      setActiveId(r.channelId);
      toast.success("Direct message opened.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the conversation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* channel list */}
      <Card className="p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <h3 className="font-display text-sm font-semibold">Channels</h3>
          <Button size="sm" variant="ghost" onClick={() => setShowDm((v) => !v)} title="New direct message">
            ＋ DM
          </Button>
        </div>
        {showDm && (
          <div className="mb-2 flex gap-1.5 px-1">
            <Input
              placeholder="teammate@pillarpath.com"
              value={dmEmail}
              onChange={(e) => setDmEmail(e.target.value)}
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void startDm();
              }}
            />
            <Button size="sm" disabled={busy || !dmEmail.trim()} onClick={startDm}>
              Go
            </Button>
          </div>
        )}
        <div className="space-y-1">
          {channels.filter((c) => !c.isDm).map((c) => (
            <ChannelRow key={c.id} channel={c} active={c.id === activeId} onSelect={setActiveId} />
          ))}
          {channels.some((c) => c.isDm) && (
            <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
              Direct messages
            </p>
          )}
          {channels.filter((c) => c.isDm).map((c) => (
            <ChannelRow key={c.id} channel={c} active={c.id === activeId} onSelect={setActiveId} />
          ))}
          {channels.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted">No channels yet.</p>
          )}
        </div>
        <p className="mt-3 px-2 text-[10px] leading-relaxed text-muted">
          🔒 Internal only — visible solely to corporate team members. Never visible to customers.
        </p>
      </Card>

      {/* thread */}
      <Card className="flex min-h-[420px] flex-col p-4">
        {!active ? (
          <p className="m-auto text-sm text-muted">Select a channel to start messaging.</p>
        ) : (
          <>
            <div className="border-b border-white/10 pb-2">
              <h3 className="font-display text-base font-semibold">
                {active.isAnnouncement && "📢 "}
                {active.name}
              </h3>
              {active.description && (
                <p className="text-xs text-muted">{active.description}</p>
              )}
              {active.isAnnouncement && !active.canPost && (
                <p className="mt-1 text-[11px] text-muted">
                  Announcements are posted by the C-suite only.
                </p>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto py-3" style={{ maxHeight: 380 }}>
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.isMe ? "justify-end" : "justify-start")}>
                  <div className="max-w-[85%]">
                    {!m.isMe && (
                      <p className="mb-0.5 text-[11px] text-muted">
                        {m.senderName}
                        {m.senderTitle && <span className="opacity-70"> · {m.senderTitle}</span>}
                      </p>
                    )}
                    <div
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm",
                        m.isMe ? "bg-accent text-accent-foreground" : "bg-white/10",
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="py-8 text-center text-xs text-muted">
                  No messages yet — start the conversation.
                </p>
              )}
              <div ref={bottomRef} />
            </div>
            {active.canPost ? (
              <div className="flex gap-2 border-t border-white/10 pt-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={active.isAnnouncement ? "Post an announcement…" : "Message the team…"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) void send();
                  }}
                />
                <Button disabled={busy || !draft.trim()} onClick={send}>
                  Send
                </Button>
              </div>
            ) : (
              <p className="border-t border-white/10 pt-3 text-center text-xs text-muted">
                Read-only for you.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function ChannelRow({
  channel,
  active,
  onSelect,
}: {
  channel: TowerChannel;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(channel.id)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm",
        active ? "bg-accent/20 text-accent" : "hover:bg-white/5",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden>{channel.isDm ? "👤" : channel.isAnnouncement ? "📢" : "#"}</span>
        <span className="truncate font-medium">{channel.name}</span>
      </span>
      {channel.isAnnouncement && (
        <Badge tone="muted" className="shrink-0 text-[9px]">exec only</Badge>
      )}
    </button>
  );
}
