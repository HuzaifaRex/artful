const ALLOWED_TAGS = new Set(["P", "BR", "DIV", "SPAN", "H1", "H2", "H3", "H4", "H5", "H6", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI", "BLOCKQUOTE", "A", "HR", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "IMG", "FONT"]);
const ALLOWED_ATTRS = new Set(["href", "target", "rel", "title", "style", "src", "alt", "width", "height", "size", "color"]);

export function sanitizeHtml(input = "") {
  if (typeof input !== "string" || !input) return "";
  if (typeof window === "undefined" || !window.DOMParser) return input.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "").replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
  const doc = new window.DOMParser().parseFromString(input, "text/html");
  const walk = (node) => {
    Array.from(node.children || []).forEach((child) => {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "SVG", "MATH"].includes(child.tagName)) child.remove();
        else { child.replaceWith(...Array.from(child.childNodes)); }
        return;
      }
      Array.from(child.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (!ALLOWED_ATTRS.has(name) || name.startsWith("on")) child.removeAttribute(attr.name);
        if ((name === "href" || name === "src") && /^(\s*javascript:|\s*data:text\/html)/i.test(attr.value)) child.removeAttribute(attr.name);
        if (name === "style" && /url\s*\(|expression\s*\(|javascript:/i.test(attr.value)) child.removeAttribute(attr.name);
      });
      if (child.tagName === "A") { child.setAttribute("rel", "noopener noreferrer"); if (child.getAttribute("target") === "_blank") child.setAttribute("rel", "noopener noreferrer"); }
      walk(child);
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
