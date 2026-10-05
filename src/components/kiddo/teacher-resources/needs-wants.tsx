import { Card } from "@/components/ui/card";
import { ResourceShell, HowToUse, AnswerKey } from "./shared";

const CARDS: Array<{ item: string; answer: string }> = [
  { item: "🍎 An apple for lunch", answer: "Need" },
  { item: "👟 Shoes for school", answer: "Need" },
  { item: "🏠 A safe place to sleep", answer: "Need" },
  { item: "💧 Clean drinking water", answer: "Need" },
  { item: "📚 A backpack for books", answer: "Need" },
  { item: "🧥 A warm jacket in winter", answer: "Need" },
  { item: "🪥 A toothbrush", answer: "Need" },
  { item: "🍞 Bread for dinner", answer: "Need" },
  { item: "💡 Lights at home", answer: "Need" },
  { item: "🩺 Medicine when sick", answer: "Need" },
  { item: "🎮 A new video game", answer: "Want" },
  { item: "🍦 Ice cream after dinner", answer: "Want" },
  { item: "🧸 A giant teddy bear", answer: "Want" },
  { item: "👟 Brand-name sneakers (you already own shoes)", answer: "Want" },
  { item: "🎬 Movie tickets this weekend", answer: "Want" },
  { item: "📱 The newest phone model", answer: "Want" },
  { item: "🍕 Pizza when there's food at home", answer: "Want" },
  { item: "🛹 A skateboard for fun", answer: "Want" },
  { item: "🎧 Wireless headphones", answer: "Want" },
  { item: "🧁 Cupcakes for a class party", answer: "Want" },
];

export function NeedsWantsDeck() {
  return (
    <ResourceShell
      title="Needs vs. Wants card deck"
      subtitle="20 printable sorting cards — the foundation of every spending decision."
    >
      <HowToUse
        steps={[
          "Print this page and cut out the 20 cards below (or display them on a projector).",
          "Draw two big circles on the board: NEEDS and WANTS.",
          "Hand each student 2–3 cards. One at a time, they place their card and explain their reasoning.",
          "Let the class debate the tricky ones — the discussion IS the lesson.",
          "Finish with the exit question: 'Name one want you bought recently. Was it worth it?'",
        ]}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-4">
        {CARDS.map((c) => (
          <Card key={c.item} className="flex min-h-24 items-center justify-center p-3 text-center">
            <p className="text-sm font-medium">{c.item}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <h2 className="font-semibold">Debate sparkers 🌶️</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>"Brand-name sneakers when you already own shoes" — is it a need if the old ones have holes?</li>
          <li>"Pizza when there's food at home" — what if cooking takes an hour and everyone's tired?</li>
          <li>"Medicine when sick" — easy. But what about vitamins you don't need?</li>
        </ul>
      </Card>
      <AnswerKey items={CARDS.map((c) => [c.item, c.answer])} />
    </ResourceShell>
  );
}
