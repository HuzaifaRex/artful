import React from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";

// Rich text (HTML) editor used for policy pages and site CMS content.
export function RichEditor({ value, onChange, testid = "rich-editor" }) {
  return (
    <div className="rich-editor border border-gray-300 rounded-lg overflow-hidden" data-testid={testid}>
      <CKEditor
        editor={ClassicEditor}
        data={value || ""}
        config={{
          licenseKey: "GPL",
          toolbar: ["heading", "|", "bold", "italic", "link", "bulletedList", "numberedList",
            "|", "blockQuote", "insertTable", "|", "undo", "redo"],
        }}
        onChange={(_, editor) => onChange(editor.getData())}
      />
    </div>
  );
}
