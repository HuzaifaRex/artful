import React, { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { api, apiError } from "../lib/api";

const QUICK_QUESTIONS = [
  "What products do you have?",
  "What is your return policy?",
  "Do you offer bulk orders?",
  "How long does delivery take?",
];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "model",
      content:
        "Hi! I’m ARTFUL’s little shopping assistant ✨ Ask me about products, prices, bulk orders, delivery, returns, refunds, cancellation or our FAQs.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const sendMessage = async (value) => {
    const text = (value ?? draft).trim();
    if (!text || sending) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setSending(true);

    try {
      const history = next
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));
      const { data } = await api.post("/chatbot", { message: text, history });
      setMessages((prev) => [
        ...prev,
        { role: "model", content: data.answer || "I’m not sure about that yet." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: apiError(
            err,
            "I’m having a tiny moment. Please try again, or contact ARTFUL support."
          ),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-plum text-cream shadow-lg transition-transform hover:-translate-y-0.5"
          aria-label="Open ARTFUL assistant"
          title="Ask ARTFUL"
          data-testid="chatbot-open"
        >
          <MessageCircle size={22} />
        </button>
      )}

      {open && (
        <section
          className="fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-2xl"
          aria-label="ARTFUL customer assistant"
          data-testid="chatbot-panel"
        >
          <div className="flex items-center justify-between bg-plum px-4 py-3 text-cream">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-cream/10">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide">Ask ARTFUL</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft">
                  Product & Store Assistant
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-cream/80 hover:bg-cream/10 hover:text-cream"
              aria-label="Close assistant"
              data-testid="chatbot-close"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[52vh] min-h-[280px] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-plum text-cream"
                      : "rounded-bl-md border border-line bg-white text-ink"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {messages.length === 1 && !sending && (
              <div className="pt-2">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-secondary">
                  <Sparkles size={13} /> Quick questions
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => sendMessage(question)}
                      className="rounded-full border border-line bg-white px-3 py-2 text-xs text-ink hover:border-plum hover:text-plum"
                      data-testid={`chatbot-quick-${question.slice(0, 8)}`}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-line bg-cream px-3 py-3">
            <div className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 focus-within:border-plum">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 1200))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
                rows={1}
                placeholder="Ask about products, prices, policies..."
                className="min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-secondary"
                aria-label="Ask ARTFUL a question"
                data-testid="chatbot-input"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-plum text-cream disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
                data-testid="chatbot-send"
              >
                <Send size={17} />
              </button>
            </div>
            <div className="mt-2 px-1">
              <span className="text-[10px] text-ink-secondary">
                Answers are based on ARTFUL’s current store information.
              </span>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
