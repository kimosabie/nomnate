"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { chatWithChef, saveChefRecipe } from "../ai-chef-actions";
import type { ChatMessage, GeneratedRecipe } from "../ai-chef-actions";

const SUGGESTIONS = [
  "Keto dinner for 4",
  "SA braai sides",
  "Vegetarian under 30min",
  "Kids will eat it",
];

type Message = ChatMessage & { recipe?: GeneratedRecipe };

export function AIChefChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  function handleSuggestion(s: string) {
    setInput(s);
  }

  function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isPending) return;
    setInput("");

    const userMsg: Message = { role: "user", content };
    const next: Message[] = [...messages, userMsg];
    setMessages(next);

    startTransition(async () => {
      const res = await chatWithChef(
        next.map((m) => ({ role: m.role, content: m.content }))
      );
      if (res.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, something went wrong: ${res.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.message, recipe: res.recipe ?? undefined },
        ]);
      }
    });
  }

  async function handleSave(recipe: GeneratedRecipe) {
    setSaving(true);
    const { id, error } = await saveChefRecipe(recipe);
    setSaving(false);
    if (id) setSavedId(id);
    else alert(error ?? "Failed to save recipe");
  }

  function handleReset() {
    setMessages([]);
    setInput("");
    setSavedId(null);
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Header */}
      <div className="max-w-3xl mx-auto w-full px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/recipes" className="text-sm text-slate hover:text-charcoal transition-colors">
            ← Recipes
          </Link>
          <h1 className="text-2xl font-display font-medium text-flame">🤖 AI Chef</h1>
        </div>
        {hasMessages && (
          <button
            onClick={handleReset}
            className="text-xs text-slate hover:text-charcoal transition-colors"
          >
            Start over
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 pb-4 space-y-4">
        {/* Greeting */}
        {!hasMessages && (
          <div className="bg-white rounded-[14px] border border-cream-border p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🤖</span>
              <div>
                <p className="text-sm font-semibold text-charcoal">Hi there!</p>
                <p className="text-sm text-slate mt-1 leading-relaxed">
                  I&apos;m NomNate&apos;s AI Chef. Tell me what you&apos;re in the mood for and I&apos;ll create a recipe
                  tailored for your family. What shall we cook tonight?
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-xs bg-flame-light text-flame font-medium px-3 py-1.5 rounded-full hover:bg-cream-dark transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <span className="text-xl shrink-0 mr-2 mt-1">🤖</span>
            )}
            <div className={`max-w-[85%] space-y-3 ${msg.role === "user" ? "" : ""}`}>
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-flame text-white rounded-tr-sm"
                    : "bg-white border border-cream-border text-charcoal rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>

              {msg.recipe && (
                <RecipeCard
                  recipe={msg.recipe}
                  savedId={savedId}
                  saving={saving}
                  onSave={handleSave}
                />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isPending && (
          <div className="flex items-start gap-2">
            <span className="text-xl">🤖</span>
            <div className="bg-white border border-cream-border px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-2 h-2 bg-slate/40 rounded-full animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-cream border-t border-cream-border">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="e.g. Something quick with chicken…"
              disabled={isPending}
              className="flex-1 px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent disabled:opacity-60"
            />
            <button
              onClick={() => handleSend()}
              disabled={isPending || !input.trim()}
              className="bg-flame hover:bg-flame-dark disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-full text-sm transition-colors shrink-0"
            >
              {isPending ? "…" : "Send"}
            </button>
          </div>
          <p className="text-xs text-slate/50 mt-1.5 text-center">
            Recipes created by Claude AI (Anthropic) · Results may vary
          </p>
        </div>
      </div>
    </div>
  );
}

function RecipeCard({
  recipe,
  savedId,
  saving,
  onSave,
}: {
  recipe: GeneratedRecipe;
  savedId: string | null;
  saving: boolean;
  onSave: (r: GeneratedRecipe) => void;
}) {
  const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);

  return (
    <div className="bg-white border border-cream-border rounded-[14px] p-5 space-y-4">
      <div>
        <h3 className="text-base font-display font-semibold text-flame">{recipe.title}</h3>
        <p className="text-xs text-slate mt-1 leading-relaxed">{recipe.description}</p>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap gap-4 text-center">
        {totalTime > 0 && (
          <div>
            <p className="text-sm font-bold text-charcoal">{totalTime} min</p>
            <p className="text-xs text-slate">total</p>
          </div>
        )}
        {recipe.servings && (
          <div>
            <p className="text-sm font-bold text-charcoal">{recipe.servings}</p>
            <p className="text-xs text-slate">servings</p>
          </div>
        )}
        {recipe.calories_per_serving && (
          <div>
            <p className="text-sm font-bold text-charcoal">{recipe.calories_per_serving}</p>
            <p className="text-xs text-slate">kcal</p>
          </div>
        )}
      </div>

      {/* Ingredients */}
      <div>
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">
          Ingredients ({recipe.ingredients.length})
        </p>
        <ul className="space-y-1">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-charcoal">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-flame shrink-0" />
              {ing.quantity != null ? `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""} ` : ""}
              {ing.name}
            </li>
          ))}
        </ul>
      </div>

      {/* Method */}
      <div>
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Method</p>
        <ol className="space-y-2">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="shrink-0 w-5 h-5 rounded-full bg-flame-light text-flame-dark text-xs font-bold flex items-center justify-center">
                {i + 1}
              </div>
              <p className="text-xs text-charcoal leading-relaxed flex-1">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {recipe.serving_suggestion && (
        <p className="text-xs text-slate italic border-t border-cream-border pt-3">
          💡 {recipe.serving_suggestion}
        </p>
      )}

      {recipe.fun_fact && (
        <p className="text-xs text-slate/70 border-t border-cream-border pt-3">
          🍽️ {recipe.fun_fact}
        </p>
      )}

      <div className="pt-2 border-t border-cream-border">
        {savedId ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-herb font-medium">✓ Added to your recipes</p>
            <Link
              href={`/recipes/${savedId}`}
              className="text-xs text-flame font-semibold hover:underline"
            >
              View recipe →
            </Link>
          </div>
        ) : (
          <button
            onClick={() => onSave(recipe)}
            disabled={saving}
            className="w-full bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
          >
            {saving ? "Saving…" : "Add to my recipes"}
          </button>
        )}
        <p className="text-xs text-slate/50 text-center mt-2">
          Created by NomNate AI Chef · Powered by Claude (Anthropic)
        </p>
      </div>
    </div>
  );
}
