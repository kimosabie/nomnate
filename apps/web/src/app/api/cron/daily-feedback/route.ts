import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

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

type FeedbackRow = {
  id: string;
  type: string;
  message: string;
  page_url: string | null;
  created_at: string;
  family_members: { name?: string; families?: { name?: string } } | null;
};

type TodoItem = {
  title: string;
  description: string;
  priority: string;
  category: string;
  source_feedback_ids: string[];
  feedback_summary: string;
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*, family_members(name, families(name))")
    .eq("reviewed", false)
    .order("created_at", { ascending: true });

  if (!feedback || feedback.length === 0) {
    return NextResponse.json({ message: "No new feedback" });
  }

  const rows = feedback as FeedbackRow[];

  const feedbackText = rows
    .map(
      (f, i) =>
        `#${i + 1} [${f.type.toUpperCase()}] ${f.message}
     Page: ${f.page_url ?? "unknown"}
     From: ${f.family_members?.name ?? "Unknown"}
     Family: ${f.family_members?.families?.name ?? "Unknown"}
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
    console.error("Anthropic API error:", err);
    return NextResponse.json({ error: "AI analysis failed", detail: String(err) }, { status: 500 });
  }

  const content =
    aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

  let todoItems: TodoItem[] = [];
  try {
    const cleaned = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    todoItems = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Claude response:", content);
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
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
    .in(
      "id",
      rows.map((f) => f.id)
    );

  const resend = new Resend(process.env.RESEND_API_KEY);

  const todoHtml = todoItems
    .map(
      (item) => `
    <div style="background:#FFF9F6;border:1px solid #F5D5C0;border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span>${PRIORITY_EMOJI[item.priority] ?? ""} ${CATEGORY_EMOJI[item.category] ?? ""}</span>
        <strong style="color:#1A1A1A;font-size:15px;">${item.title}</strong>
        <span style="background:#FDE8E0;color:#C0430E;border-radius:50px;padding:2px 8px;font-size:11px;font-weight:600;margin-left:auto;">
          ${item.priority.toUpperCase()}
        </span>
      </div>
      <p style="color:#444;font-size:13px;margin:0 0 8px;line-height:1.5;">${item.description}</p>
      <p style="color:#888;font-size:12px;margin:0;font-style:italic;">"${item.feedback_summary}"</p>
    </div>`
    )
    .join("");

  await resend.emails.send({
    from: "NomNate Daily Brief <onboarding@resend.dev>",
    to: process.env.ADMIN_EMAIL!,
    subject: `📋 NomNate Daily Brief — ${todoItems.length} items · ${new Date().toLocaleDateString("en-ZA")}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#E8621A;border-radius:12px;padding:20px;margin-bottom:24px;">
          <h1 style="color:white;margin:0;font-size:22px;">📋 NomNate Daily Brief</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">
            ${rows.length} feedback items → ${todoItems.length} action items · ${new Date().toLocaleDateString("en-ZA")}
          </p>
        </div>
        <p style="color:#666;font-size:14px;margin-bottom:20px;">
          Claude has reviewed your pilot feedback and generated these action items. Review and approve them below.
        </p>
        ${todoHtml}
        <div style="text-align:center;margin-top:24px;">
          <a href="https://www.nomnate.co.za/admin/feedback"
             style="background:#E8621A;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
            Review + Approve Todo Items →
          </a>
        </div>
        <p style="text-align:center;color:#aaa;font-size:12px;margin-top:24px;">
          NomNate — Family dinner, decided together
        </p>
      </div>
    `,
  });

  return NextResponse.json({
    ok: true,
    feedbackProcessed: rows.length,
    todosCreated: todoItems.length,
  });
}
