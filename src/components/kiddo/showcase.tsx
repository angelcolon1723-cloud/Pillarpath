import { useMemo, useState } from "react";
import { Check, Heart, Images, Sparkles, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldLabel } from "@/components/ui/input";
import { useLedger } from "@/store/ledger";
import { useSocial, type ShowcasePost } from "@/store/social";
import { useTeacher, type TeacherClassroom } from "@/store/teacher";
import { SellControls } from "@/components/kiddo/creator-shop";
import { choresFor, unitsToDollars } from "@/lib/value-system";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Creator Showcase gallery                                             */
/*                                                                      */
/* Kids publish Creative Studio artwork. Nothing is visible until a      */
/* parent approves it. Display names only — no personal info. Cheers     */
/* instead of comments, so there is nothing to moderate.                */
/* ------------------------------------------------------------------ */

function PostCard({
  post,
  onCheer,
  cheered,
  showPrice,
}: {
  post: ShowcasePost;
  onCheer?: () => void;
  cheered?: boolean;
  showPrice?: boolean;
}) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="relative">
        <img
          src={post.dataUrl}
          alt={post.title}
          className="aspect-square w-full object-cover"
        />
        {post.featured ? (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
            Featured
          </span>
        ) : null}
      </div>
      <figcaption className="p-2.5">
        <p className="truncate text-sm font-semibold">{post.title}</p>
        <p className="truncate text-xs text-muted">by {post.creatorName}</p>
        <div className="mt-1.5 flex items-center justify-between">
          {onCheer ? (
            <button
              type="button"
              onClick={onCheer}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                cheered ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
              )}
              aria-label="Cheer this creation"
            >
              <Heart className={cn("size-3.5", cheered && "fill-current")} />
              <span className="tabular-nums">{post.cheers}</span>
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Heart className="size-3.5" />
              <span className="tabular-nums">{post.cheers}</span>
            </span>
          )}
          {showPrice && post.forSale ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-accent">
              <Tag className="size-3.5" />
              {post.price} Units
            </span>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}

function statusTone(status: ShowcasePost["status"]) {
  return status === "approved" ? "accent" : status === "pending" ? "warn" : "muted";
}

/* ------------------------------------------------------------------ */
/* Child view: the gallery screen                                       */
/* ------------------------------------------------------------------ */

export function ChildGallery() {
  const childName = useLedger((s) => s.childName);
  const setScreen = useLedger((s) => s.setScreen);
  const drawings = useLedger((s) => s.drawings);
  const posts = useSocial((s) => s.posts);
  const cheeredIds = useSocial((s) => s.cheeredIds);
  const submitPost = useSocial((s) => s.submitPost);
  const cheerPost = useSocial((s) => s.cheerPost);
  const unlistFromSale = useSocial((s) => s.unlistFromSale);

  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [titles, setTitles] = useState<Record<string, string>>({});

  const visible = useMemo(
    () => posts.filter((p) => p.status === "approved"),
    [posts],
  );
  const mine = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.creatorName.trim().toLowerCase() === childName.trim().toLowerCase() &&
          p.status !== "removed",
      ),
    [posts, childName],
  );
  const publishedDrawingIds = useMemo(
    () => new Set(posts.filter((p) => p.status !== "removed").map((p) => p.drawingId)),
    [posts],
  );
  const unshared = drawings.filter((d) => !publishedDrawingIds.has(d.id));

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Creative Studio</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Showcase
        </h1>
        <p className="mt-1 text-sm text-muted">
          Share your art with family and class. A parent approves everything
          before it appears here.
        </p>
      </header>

      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-surface-2 p-1">
        {(
          [
            ["browse", "Browse"],
            ["mine", "My creations"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "min-h-11 rounded-lg text-sm font-semibold",
              tab === id ? "bg-surface text-ink shadow-[var(--shadow-border)]" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        visible.length === 0 ? (
          <Card className="p-6 text-center">
            <Images className="mx-auto size-8 text-muted" />
            <p className="mt-2 text-sm text-muted">
              Nothing in the showcase yet — be the first to share something!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visible.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                showPrice
                cheered={cheeredIds.includes(post.id)}
                onCheer={() => {
                  const err = cheerPost(post.id);
                  if (err) toast.message(err);
                }}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {unshared.length > 0 ? (
            <Card className="space-y-3 p-4">
              <CardTitle className="text-base">Share new art</CardTitle>
              <CardHint>Pick a saved drawing from the Studio to publish.</CardHint>
              <div className="grid grid-cols-3 gap-2">
                {unshared.map((d) => (
                  <div key={d.id} className="min-w-0">
                    <img
                      src={d.dataUrl}
                      alt={d.title ?? "Saved drawing"}
                      className="aspect-square w-full rounded-md object-cover outline outline-1 -outline-offset-1 outline-ink/10"
                    />
                    <Input
                      className="mt-1"
                      placeholder="Title"
                      value={titles[d.id] ?? d.title ?? ""}
                      onChange={(e) =>
                        setTitles((t) => ({ ...t, [d.id]: e.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      className="mt-1 w-full"
                      onClick={() => {
                        const err = submitPost({
                          drawingId: d.id,
                          dataUrl: d.dataUrl,
                          title: titles[d.id] ?? d.title ?? "My creation",
                          creatorName: childName,
                        });
                        if (err) toast.error(err);
                        else {
                          setTitles((t) => ({ ...t, [d.id]: "" }));
                          toast.success("Sent to your parent for approval");
                        }
                      }}
                    >
                      <Sparkles className="size-3.5" />
                      Share
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {mine.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted">
                {unshared.length === 0
                  ? "Save some art in the Studio first, then share it here."
                  : "Your shared creations will appear here."}
              </p>
            </Card>
          ) : (
            mine.map((post) => (
              <Card key={post.id} className="p-3">
                <div className="flex gap-3">
                  <img
                    src={post.dataUrl}
                    alt={post.title}
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{post.title}</p>
                      <Badge tone={statusTone(post.status)}>{post.status}</Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <Heart className="size-3" /> {post.cheers} cheers
                      {post.forSale ? ` · Listed for ${post.price} Units` : null}
                    </p>
                    {post.status === "approved" ? (
                      post.forSale ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            unlistFromSale(post.id);
                            toast.message("Removed from your shop");
                          }}
                        >
                          Stop selling
                        </Button>
                      ) : (
                        <div className="mt-2">
                          <SellControls post={post} />
                        </div>
                      )
                    ) : post.status === "pending" ? (
                      <p className="mt-1 text-xs text-muted">
                        Waiting for parent approval.
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
        Back
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parent view: approvals + managing the child's posts                 */
/* ------------------------------------------------------------------ */

export function PendingGalleryRows() {
  const posts = useSocial((s) => s.posts);
  const approvePost = useSocial((s) => s.approvePost);
  const removePost = useSocial((s) => s.removePost);

  const pending = posts.filter((p) => p.status === "pending");
  if (pending.length === 0) return null;

  return (
    <>
      {pending.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <img
            src={p.dataUrl}
            alt={p.title}
            className="size-10 shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{p.title}</div>
            <div className="text-xs text-muted">
              by {p.creatorName} · Showcase submission
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="success"
              size="icon-sm"
              aria-label="Approve"
              onClick={() => {
                approvePost(p.id);
                toast.success("Showcase piece approved");
              }}
            >
              <Check className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Remove"
              onClick={() => {
                removePost(p.id);
                toast.message("Submission removed");
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

export function ParentShowcase() {
  const childName = useLedger((s) => s.childName);
  const setScreen = useLedger((s) => s.setScreen);
  const posts = useSocial((s) => s.posts);
  const removePost = useSocial((s) => s.removePost);
  const approvePost = useSocial((s) => s.approvePost);

  const mine = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.creatorName.trim().toLowerCase() === childName.trim().toLowerCase() &&
          p.status !== "removed",
      ),
    [posts, childName],
  );
  const pending = mine.filter((p) => p.status === "pending");
  const live = mine.filter((p) => p.status === "approved");

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Parent</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Showcase & shop
        </h1>
        <p className="mt-1 text-sm text-muted">
          Approve what {childName} shares, manage their shop listings.
        </p>
      </header>

      {pending.length > 0 ? (
        <Card className="p-4">
          <CardTitle className="text-base">Waiting for your approval</CardTitle>
          <div className="mt-2 divide-y divide-border">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <img
                  src={p.dataUrl}
                  alt={p.title}
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted">by {p.creatorName}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="success"
                    size="icon-sm"
                    aria-label="Approve"
                    onClick={() => {
                      approvePost(p.id);
                      toast.success("Approved");
                    }}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Remove"
                    onClick={() => {
                      removePost(p.id);
                      toast.message("Removed");
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
        <CardTitle className="text-base">Live in the showcase</CardTitle>
        {live.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            Nothing published yet.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-border">
            {live.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <img
                  src={p.dataUrl}
                  alt={p.title}
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <Heart className="size-3" /> {p.cheers} cheers
                    {p.featured ? " · Featured by teacher" : null}
                    {p.forSale
                      ? ` · For sale: ${p.price} Units (≈$${unitsToDollars(p.price).toFixed(2)} · ≈${choresFor(p.price)} chores)`
                      : null}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    removePost(p.id);
                    toast.message("Removed from showcase");
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
        Back
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher view: feature class work (appended in the Studio section)    */
/* ------------------------------------------------------------------ */

export function TeacherShowcase({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const posts = useSocial((s) => s.posts);
  const approvePost = useSocial((s) => s.approvePost);
  const featurePost = useSocial((s) => s.featurePost);

  const classPosts = useMemo(
    () =>
      activeClassroom
        ? posts.filter(
            (p) => p.classroomId === activeClassroom.id && p.status !== "removed",
          )
        : [],
    [posts, activeClassroom],
  );
  const pending = classPosts.filter((p) => p.status === "pending");
  const approved = classPosts.filter((p) => p.status === "approved");

  if (!activeClassroom) return null;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Images className="size-5" />
        </span>
        <div>
          <CardTitle className="text-base">Class showcase</CardTitle>
          <CardHint>
            Approve class submissions and feature standout work. Only display
            names are ever shown.
          </CardHint>
        </div>
      </div>

      {pending.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Waiting for approval
          </p>
          {pending.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
              <img
                src={p.dataUrl}
                alt={p.title}
                className="size-12 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-muted">by {p.creatorName}</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  approvePost(p.id);
                  toast.success("Approved for the showcase");
                }}
              >
                Approve
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {approved.length === 0 && pending.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted">
          No class submissions yet.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {approved.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                featurePost(p.id);
                toast.message(p.featured ? "Unfeatured" : "Featured for the class");
              }}
              className={cn(
                "relative overflow-hidden rounded-lg outline outline-1 -outline-offset-1",
                p.featured ? "outline-accent ring-2 ring-accent/40" : "outline-ink/10",
              )}
              title={p.featured ? "Unfeature" : "Feature"}
            >
              <img src={p.dataUrl} alt={p.title} className="aspect-square w-full object-cover" />
              {p.featured ? (
                <span className="absolute left-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground">
                  Featured
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
