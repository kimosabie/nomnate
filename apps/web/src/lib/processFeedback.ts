import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

type FeedbackRow = {
  id: string;
  type: string;
  message: string;
  page_url: string | null;
  user_id: string | null;
  created_at: string;
};

type TodoItem = {
  title: string;
  description: string;
  priority: string;
  category: string;
  source_feedback_ids: string[];
  feedback_summary: string;
};

// Obvious test/throwaway submissions (e.g. "test", "test2", "tes3", "testing email",
// "this is a test msg") shouldn't be triaged into todos or sit in the review queue.
// Conservative on purpose — short messages only — so real feedback is never dropped.
function isTestFeedback(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (m.length === 0) return true;
  if (/^tes(t(ing)?)?[\s\d]*$/.test(m)) return true; // test, tes3, test2, testing
  if (/^test(ing)?\b/.test(m) && m.length <= 25) return true; // "testing email", "test msg"
  if (/^(this is a test|test message|test feedback|ignore this)\b/.test(m)) return true;
  return false;
}

const PRIORITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};
const CATEGORY_EMOJI: Record<string, string> = {
  bug: "🐛",
  feature: "✨",
  improvement: "⚡",
  content: "📝",
};

export type DailyBriefResult =
  | { ok: true; feedbackProcessed: number; todosCreated: number }
  | { message: string }
  | { error: string; detail?: string };

export async function processFeedback(): Promise<DailyBriefResult> {
  const supabase = createAdminClient();

  const { data: feedback, error: feedbackError } = await supabase
    .from("feedback")
    .select("id, type, message, page_url, user_id, created_at")
    .eq("reviewed", false)
    .order("created_at", { ascending: true })
    .limit(50);

  if (feedbackError) return { error: feedbackError.message };
  if (!feedback || feedback.length === 0) return { message: "No new feedback" };

  const allRows = feedback as FeedbackRow[];

  // Quarantine obvious test submissions: mark them reviewed so they neither reach
  // the AI triage nor linger in the admin review queue (not deleted — recoverable).
  const testRows = allRows.filter((r) => isTestFeedback(r.message));
  const rows = allRows.filter((r) => !isTestFeedback(r.message));

  if (testRows.length > 0) {
    await supabase
      .from("feedback")
      .update({ reviewed: true })
      .in("id", testRows.map((f) => f.id));
  }

  if (rows.length === 0) {
    return { ok: true, feedbackProcessed: testRows.length, todosCreated: 0 };
  }

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from("family_members")
      .select("user_id, name")
      .in("user_id", userIds);
    for (const m of members ?? []) nameMap[m.user_id] = m.name;
  }

  const feedbackText = rows
    .map(
      (f, i) =>
        `#${i + 1} [${f.type.toUpperCase()}] ${f.message}
     Page: ${f.page_url ?? "unknown"}
     From: ${f.user_id ? (nameMap[f.user_id] ?? "Unknown") : "Unknown"}
     Date: ${new Date(f.created_at).toLocaleDateString("en-ZA")}`
    )
    .join("\n\n");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let aiResponse;
  try {
    aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are reviewing user feedback for NomNate, a family meal planning and voting app for South African families.

Analyse this feedback and return ONLY a JSON array of todo items.
Group similar feedback together into single todo items.
Be specific and actionable.

Return this exact JSON structure, no other text:
[
  {
    "title": "Short actionable title",
    "description": "What needs to be done and why",
    "priority": "critical|high|medium|low",
    "category": "bug|feature|improvement|content",
    "source_feedback_ids": ["id1", "id2"],
    "feedback_summary": "Brief summary of the feedback that led to this"
  }
]

Priority guide:
- critical: app is broken, users cannot complete core flows
- high: significant pain point affecting multiple users
- medium: improvement that would meaningfully help users
- low: nice to have, minor polish

Here is the feedback to analyse:

${feedbackText}

Feedback IDs for reference:
${rows.map((f, i) => `#${i + 1}: ${f.id}`).join("\n")}`,
        },
      ],
    });
  } catch (err) {
    return { error: "AI analysis failed", detail: String(err) };
  }

  const content =
    aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

  let todoItems: TodoItem[] = [];
  try {
    const cleaned = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    todoItems = JSON.parse(cleaned);
  } catch {
    return { error: "Failed to parse Claude response", detail: content.slice(0, 500) };
  }

  await supabase.from("todo_items").insert(
    todoItems.map((item) => ({
      title: item.title,
      description: item.description,
      priority: item.priority,
      category: item.category,
      source_feedback_ids: item.source_feedback_ids,
    }))
  );

  await supabase
    .from("feedback")
    .update({ reviewed: true })
    .in("id", rows.map((f) => f.id));

  // Send email summary (non-fatal — don't fail if Resend key missing)
  if (process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const todoHtml = todoItems
        .map(
          (item) => `
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span>${PRIORITY_EMOJI[item.priority] ?? ""} ${CATEGORY_EMOJI[item.category] ?? ""}</span>
            <strong style="color:#fff;font-size:15px;">${item.title}</strong>
            <span style="background:#E8621A;color:#fff;border-radius:50px;padding:2px 8px;font-size:11px;font-weight:600;margin-left:auto;">
              ${item.priority.toUpperCase()}
            </span>
          </div>
          <p style="color:#aaa;font-size:13px;margin:0 0 8px;line-height:1.5;">${item.description}</p>
          <p style="color:#666;font-size:12px;margin:0;font-style:italic;">"${item.feedback_summary}"</p>
        </div>`
        )
        .join("");

      await resend.emails.send({
        from: "NomNate Daily Brief <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL,
        subject: `📋 NomNate Daily Brief — ${todoItems.length} items · ${new Date().toLocaleDateString("en-ZA")}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0f0f0f;">
            <div style="background:#E8621A;border-radius:12px;padding:20px;margin-bottom:24px;">
              <h1 style="color:white;margin:0;font-size:22px;">📋 NomNate Daily Brief</h1>
              <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">
                ${rows.length} feedback → ${todoItems.length} action items · ${new Date().toLocaleDateString("en-ZA")}
              </p>
            </div>
            ${todoHtml}
            <div style="text-align:center;margin-top:24px;">
              <a href="https://www.nomnate.co.za/admin/feedback?tab=todos"
                 style="background:#E8621A;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
                Review + Approve →
              </a>
            </div>
          </div>
        `,
      });
    } catch {
      // Email failure is non-fatal
    }
  }

  return { ok: true, feedbackProcessed: rows.length, todosCreated: todoItems.length };
}
