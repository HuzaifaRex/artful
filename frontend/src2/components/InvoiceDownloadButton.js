import React, { useState } from "react";
import { Download } from "lucide-react";
import { adminApi, api, apiError } from "../lib/api";
import { toast } from "sonner";

export default function InvoiceDownloadButton({ orderNumber, admin = false, className = "" }) {
  const [disabled, setDisabled] = useState(false);

  const download = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!orderNumber || disabled) return;

    setDisabled(true);
    try {
      const client = admin ? adminApi : api;
      const { data } = await client.get(
        admin ? `/orders/${orderNumber}/invoice.pdf` : `/orders/${orderNumber}/invoice.pdf`,
        { responseType: "blob" }
      );

      const blob = new Blob([data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ARTFUL-Invoice-${orderNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(apiError(error, "Could not download the invoice. Please try again."));
    } finally {
      setDisabled(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={disabled}
      className={className || "btn-outline inline-flex items-center gap-2"}
      data-testid={`download-invoice-${orderNumber}`}
      aria-label={`Download invoice for ${orderNumber}`}
    >
      <Download size={15} />
      Download Invoice
    </button>
  );
}
