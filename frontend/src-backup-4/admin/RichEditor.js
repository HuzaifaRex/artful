import React, { useEffect, useRef, useState } from "react";
import { sanitizeHtml } from "../lib/sanitizeHtml";

/* A dependency-light editor whose visible toolbar controls all perform real edits. */
export function RichEditor({ value, onChange, testid = "rich-editor" }) {
  const editorRef = useRef(null);
  const savedRange = useRef(null);
  const [color, setColor] = useState("#5C3243");
  const [size, setSize] = useState("16px");

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = sanitizeHtml(value || "");
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  const rememberRange = () => {
    const el = editorRef.current;
    const selection = window.getSelection?.();
    if (!el || !selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  };
  const restoreRange = () => {
    const selection = window.getSelection?.();
    if (selection && savedRange.current) {
      selection.removeAllRanges(); selection.addRange(savedRange.current);
    }
    editorRef.current?.focus();
  };
  const publish = () => {
    if (!editorRef.current) return;
    onChange(sanitizeHtml(editorRef.current.innerHTML));
    rememberRange();
  };
  const command = (name, valueArg = null) => {
    restoreRange();
    document.execCommand(name, false, valueArg);
    publish();
  };
  const formatBlock = (tag) => command("formatBlock", tag);
  const applyStyle = (property, value) => {
    restoreRange();
    const selection = window.getSelection?.();
    const el = editorRef.current;
    if (!selection || !selection.rangeCount || !el) return;
    let range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    if (range.collapsed) {
      const span = document.createElement("span");
      span.style[property] = value;
      span.appendChild(document.createTextNode("\u200b"));
      range.insertNode(span);
      range.setStart(span.firstChild, 1); range.collapse(true);
      selection.removeAllRanges(); selection.addRange(range);
    } else {
      const span = document.createElement("span"); span.style[property] = value;
      try { range.surroundContents(span); }
      catch { span.appendChild(range.extractContents()); range.insertNode(span); }
      range.selectNodeContents(span); selection.removeAllRanges(); selection.addRange(range);
    }
    publish();
  };
  const insertLink = () => {
    const href = window.prompt("Enter a link (https://…)");
    if (!href) return;
    const trimmed = href.trim();
    if (!/^(https?:\/\/|mailto:|\/)/i.test(trimmed) || /^javascript:/i.test(trimmed)) return;
    command("createLink", trimmed);
  };
  const pasteSafe = (event) => {
    event.preventDefault();
    const html = event.clipboardData?.getData("text/html");
    const text = event.clipboardData?.getData("text/plain") || "";
    const safe = html ? sanitizeHtml(html) : text.replace(/[&<>\"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c])).replace(/\n/g, "<br>");
    restoreRange(); document.execCommand("insertHTML", false, safe); publish();
  };
  const toolButton = (label, action, title) => <button type="button" key={label} onMouseDown={(e) => e.preventDefault()} onClick={action} title={title || label}>{label}</button>;

  return (
    <div className="artful-rich-editor border border-gray-300 rounded-lg overflow-hidden bg-white" data-testid={testid}>
      <div className="rt-toolbar" role="toolbar" aria-label="Text formatting">
        {toolButton("B", () => command("bold"), "Bold")}
        {toolButton("I", () => command("italic"), "Italic")}
        {toolButton("U", () => command("underline"), "Underline")}
        {toolButton("• List", () => command("insertUnorderedList"), "Bullet list")}
        {toolButton("1. List", () => command("insertOrderedList"), "Numbered list")}
        <select aria-label="Paragraph style" defaultValue="P" onChange={(e) => formatBlock(e.target.value)} onMouseDown={rememberRange}>
          <option value="P">Paragraph</option><option value="H2">Heading 2</option><option value="H3">Heading 3</option><option value="H4">Heading 4</option><option value="BLOCKQUOTE">Quote</option>
        </select>
        {toolButton("←", () => command("justifyLeft"), "Align left")}
        {toolButton("↔", () => command("justifyCenter"), "Align center")}
        {toolButton("→", () => command("justifyRight"), "Align right")}
        <label title="Text color" className="inline-flex items-center gap-1 text-xs">Color <input aria-label="Text color" type="color" value={color} onChange={(e) => { setColor(e.target.value); applyStyle("color", e.target.value); }} /></label>
        <select aria-label="Font size" value={size} onMouseDown={rememberRange} onChange={(e) => { setSize(e.target.value); applyStyle("fontSize", e.target.value); }}>
          <option value="12px">12 px</option><option value="14px">14 px</option><option value="16px">16 px</option><option value="18px">18 px</option><option value="24px">24 px</option><option value="32px">32 px</option>
        </select>
        {toolButton("Link", insertLink, "Insert link")}
        {toolButton("Undo", () => command("undo"), "Undo")}
        {toolButton("Redo", () => command("redo"), "Redo")}
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" className="min-h-[180px] max-w-none text-sm text-gray-800 leading-relaxed outline-none" onInput={publish} onKeyUp={rememberRange} onMouseUp={rememberRange} onBlur={publish} onPaste={pasteSafe} />
      <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-400">Formatting is saved with this content. Unsafe HTML is removed when saved and displayed.</div>
    </div>
  );
}
