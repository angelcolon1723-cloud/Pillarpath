import { Card } from "@/components/ui/card";
import { ResourceShell, HowToUse } from "./shared";

const PROMPTS: Array<{ q: string; follow: string }> = [
  {
    q: "You find 20 Units on the playground. No one saw you drop it. What do you do?",
    follow: "What changes if it's 200 Units? What does honesty 'cost' you here?",
  },
  {
    q: "Your friend buys the sneakers you wanted. Now you want them more. Why?",
    follow: "Is that feeling about the shoes — or about your friend?",
  },
  {
    q: "You saved 100 Units for a game, but your sister needs 100 for school supplies. Choose.",
    follow: "Is there a third option? (Hint: there usually is.)",
  },
  {
    q: "A store has 'BUY ONE GET ONE FREE!' on candy you don't need. Deal or trap?",
    follow: "Who does the 'deal' really help — you or the store?",
  },
  {
    q: "You can have 50 Units today or 80 Units next month. Which do you pick?",
    follow: "What would make you switch your answer?",
  },
  {
    q: "Everyone in class is buying the same trendy toy. You don't love it. Do you buy it?",
    follow: "What's the difference between fitting in and spending well?",
  },
  {
    q: "Your grandma gives you 100 Units 'for something special.' What's special?",
    follow: "Does 'special' mean expensive? What made your answer special?",
  },
  {
    q: "You break a neighbor's window playing ball. Repairs cost 60 of your 80 Units. Pay up?",
    follow: "What does responsibility cost — and what does avoiding it cost?",
  },
  {
    q: "Two jobs: wash cars for 30 Units guaranteed, or sell lemonade that might earn 60. Pick.",
    follow: "Are you a play-it-safe person or a risk-taker? Is one better?",
  },
  {
    q: "In ten years, what do you want money to DO for you?",
    follow: "Work backwards: what's one money habit that gets you there?",
  },
];

export function DiscussionPrompts() {
  return (
    <ResourceShell
      title="Discussion prompts: spending choices"
      subtitle="Ten circle-time conversations about tradeoffs — the thinking behind the spending."
      resourceId="res-6"
    >
      <HowToUse
        steps={[
          "Pick one prompt per session — ten is a term's worth of circle time.",
          "Read the big question. Give 30 seconds of silent thinking first.",
          "Go around the circle: everyone answers, no interrupting, no 'wrong' answers.",
          "Then open it up — and drop the follow-up question when the energy dips.",
          "Close with: 'What's one thing you'll think about differently this week?'",
        ]}
      />
      <div className="space-y-2">
        {PROMPTS.map((p, i) => (
          <Card key={i} className="p-4">
            <p className="font-semibold">
              <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                {i + 1}
              </span>
              {p.q}
            </p>
            <p className="mt-2 pl-8 text-sm text-muted">💬 Follow-up: {p.follow}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <h2 className="font-semibold">Ground rules for great discussions</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Every answer is welcome. We question ideas, not people.</li>
          <li>"I disagree because…" beats "that's dumb" every time.</li>
          <li>It's okay to change your mind mid-discussion — that's called learning.</li>
          <li>The teacher's job: ask, don't answer. Let them think.</li>
        </ul>
      </Card>
    </ResourceShell>
  );
}
