"""Invoice PDF generation and secure invoice download routes for ARTFUL."""
from io import BytesIO
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    KeepTogether,
)

from db import db, clean
from security import get_current_customer, require_permission

router = APIRouter()
BASE_DIR = Path(__file__).resolve().parent
LOGO_PATH = BASE_DIR / "assets" / "artful_logo.png"

PLUM = colors.HexColor("#4F274F")
INK = colors.HexColor("#262226")
MUTED = colors.HexColor("#6F6870")
LINE = colors.HexColor("#E9E3E7")
SOFT = colors.HexColor("#F8F5F7")
GREEN = colors.HexColor("#276749")
AMBER = colors.HexColor("#8A5A00")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 16 * mm


def _money(value):
    try:
        return f"INR {float(value or 0):,.2f}"
    except (TypeError, ValueError):
        return "INR 0.00"


def _date(value):
    if not value:
        return "-"
    try:
        raw = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        return dt.strftime("%d %b %Y")
    except Exception:
        return str(value)[:20]


def _clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


def _company_settings(settings):
    return {
        "name": _clean_text(settings.get("store_name") or "ARTFUL"),
        "address": _clean_text(
            settings.get("office_address")
            or "168, Netaji Subhash Marg, Martand Chowk, <br/>Ram Bagh, Indore, Madhya Pradesh 452007"
        ),
        "phone": _clean_text(settings.get("contact_phone") or "+91 8871288853"),
        "email": _clean_text(settings.get("contact_email") or "support@artful.com"),
        "website": _clean_text(settings.get("website")),
        "gstin": _clean_text(settings.get("gstin") or settings.get("gst_number")),
    }


def _safe_filename(order_number):
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in str(order_number))
    return f"ARTFUL-Invoice-{safe}.pdf"


def _paragraph(text, style):
    return Paragraph(_clean_text(text).replace("&", "&amp;"), style)


def build_invoice_pdf(order, settings):
    """Build a clean, printable A4 invoice PDF entirely from server-side order data."""
    company = _company_settings(settings)
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title=f"Invoice {_clean_text(order.get('order_number'))}",
        author="ARTFUL",
        subject="ARTFUL Order Invoice",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="InvoiceTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=25,
        leading=28,
        textColor=PLUM,
        alignment=TA_RIGHT,
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        name="CompanyName",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=16,
        textColor=PLUM,
    ))
    styles.add(ParagraphStyle(
        name="Small",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=MUTED,
    ))
    styles.add(ParagraphStyle(
        name="Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=INK,
    ))
    styles.add(ParagraphStyle(
        name="Label",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=MUTED,
        uppercase=True,
    ))
    styles.add(ParagraphStyle(
        name="Meta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=INK,
    ))
    styles.add(ParagraphStyle(
        name="MetaRight",
        parent=styles["Meta"],
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name="TableHead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=WHITE,
    ))
    styles.add(ParagraphStyle(
        name="TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=INK,
    ))
    styles.add(ParagraphStyle(
        name="TableCellRight",
        parent=styles["TableCell"],
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name="Footer",
        parent=styles["Small"],
        alignment=TA_LEFT,
    ))

    story = []

    # Header: logo + company details on the left, invoice meta on the right.
    if LOGO_PATH.exists():
        logo = Image(str(LOGO_PATH), width=46 * mm, height=13.3 * mm, kind="proportional")
        left = [logo, Spacer(1, 2 * mm), _paragraph(company["address"], styles["Small"])]
        contact = " · ".join(filter(None, [company["phone"], company["email"], company["website"]]))
        if contact:
            left.append(_paragraph(contact, styles["Small"]))
        if company["gstin"]:
            left.append(_paragraph(f"GSTIN: {company['gstin']}", styles["Small"]))
    else:
        left = [
            _paragraph(company["name"], styles["CompanyName"]),
            Spacer(1, 2 * mm),
            _paragraph(company["address"], styles["Small"]),
        ]

    meta = [
        _paragraph("INVOICE", styles["InvoiceTitle"]),
        Spacer(1, 1.5 * mm),
        _paragraph(f"Invoice No. <b>INV-{_clean_text(order.get('order_number'))}</b>", styles["MetaRight"]),
        _paragraph(f"Invoice Date  <b>{_date(order.get('created_at'))}</b>", styles["MetaRight"]),
        _paragraph(f"Order No.  <b>{_clean_text(order.get('order_number'))}</b>", styles["MetaRight"]),
    ]

    header = Table([[left, meta]], colWidths=[108 * mm, 66 * mm], hAlign="LEFT")
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 8 * mm))

    customer = order.get("customer") or {}
    address = order.get("address") or order.get("shipping_address") or {}
    bill_lines = [
        _paragraph("BILL TO", styles["Label"]),
        Spacer(1, 1.2 * mm),
        _paragraph(customer.get("name") or address.get("name") or "Customer", styles["Body"]),
        _paragraph(customer.get("phone") or address.get("phone") or "-", styles["Small"]),
        _paragraph(customer.get("email") or "-", styles["Small"]),
    ]
    ship_address = ", ".join(filter(None, [
        address.get("name"), address.get("line1"), address.get("line2"), address.get("area"),
        address.get("city"), address.get("state"), address.get("pincode")
    ]))
    ship_lines = [
        _paragraph("SHIP TO", styles["Label"]),
        Spacer(1, 1.2 * mm),
        _paragraph(ship_address or "-", styles["Body"]),
    ]

    bill_ship = Table([[bill_lines, ship_lines]], colWidths=[87 * mm, 87 * mm], hAlign="LEFT")
    bill_ship.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
    ]))
    story.append(bill_ship)
    story.append(Spacer(1, 7 * mm))

    item_rows = [[
        _paragraph("ITEM", styles["TableHead"]),
        _paragraph("SKU", styles["TableHead"]),
        _paragraph("QTY", styles["TableHead"]),
        _paragraph("UNIT PRICE", styles["TableHead"]),
        _paragraph("AMOUNT", styles["TableHead"]),
    ]]

    for item in order.get("items") or []:
        name = _clean_text(item.get("name") or "Product")
        extras = []
        if item.get("variant_label"):
            extras.append(f"Variant: {item['variant_label']}")
        if item.get("personalization"):
            extras.append(f"Personalisation: {item['personalization']}")
        if item.get("gift_wrap"):
            extras.append("Gift wrapping included")
        description = _paragraph(
            name + (f"<br/><font color='#6F6870' size='7'>{' · '.join(extras)}</font>" if extras else ""),
            styles["TableCell"],
        )
        item_rows.append([
            description,
            _paragraph(item.get("sku") or "-", styles["TableCell"]),
            _paragraph(str(item.get("qty", 0)), styles["TableCellRight"]),
            _paragraph(_money(item.get("price")), styles["TableCellRight"]),
            _paragraph(_money(item.get("line_total", (item.get("price", 0) or 0) * (item.get("qty", 0) or 0))), styles["TableCellRight"]),
        ])

    items_table = Table(item_rows, colWidths=[74 * mm, 27 * mm, 15 * mm, 31 * mm, 31 * mm], repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PLUM),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("TOPPADDING", (0, 0), (-1, 0), 2.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2.2 * mm),
        ("TOPPADDING", (0, 1), (-1, -1), 2.8 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 2.8 * mm),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 6 * mm))

    pricing = order.get("pricing") or {}
    summary_rows = [
        [_paragraph("Subtotal", styles["Body"]), _paragraph(_money(pricing.get("subtotal")), styles["MetaRight"])],
    ]
    if float(pricing.get("discount") or 0) > 0:
        discount_label = "Discount"
        if pricing.get("coupon_code"):
            discount_label += f" ({_clean_text(pricing.get('coupon_code'))})"
        summary_rows.append([_paragraph(discount_label, styles["Body"]), _paragraph(f"- {_money(pricing.get('discount'))}", styles["MetaRight"])])
    summary_rows.append([_paragraph("Shipping", styles["Body"]), _paragraph("Free" if not pricing.get("shipping") else _money(pricing.get("shipping")), styles["MetaRight"])])
    if float(pricing.get("tax") or 0) > 0:
        summary_rows.append([_paragraph("Tax", styles["Body"]), _paragraph(_money(pricing.get("tax")), styles["MetaRight"])])
    summary_rows.append([_paragraph("TOTAL", ParagraphStyle("TotalLabel", parent=styles["Body"], fontName="Helvetica-Bold", textColor=PLUM, fontSize=10.5)),
                         _paragraph(_money(pricing.get("total")), ParagraphStyle("TotalValue", parent=styles["MetaRight"], fontName="Helvetica-Bold", fontSize=12, textColor=PLUM))])

    payment = order.get("payment") or {}
    payment_method = _clean_text(order.get("payment_method") or payment.get("method") or payment.get("provider") or "-").replace("razorpay", "Razorpay").replace("cod", "Cash on Delivery")
    payment_status = _clean_text(payment.get("status") or order.get("status") or "-").replace("_", " ").title()
    transaction_id = payment.get("payment_id") or payment.get("razorpay_payment_id") or "-"
    razor_order_id = payment.get("razorpay_order_id") or "-"

    payment_lines = [
        _paragraph("PAYMENT DETAILS", styles["Label"]),
        Spacer(1, 1.2 * mm),
        _paragraph(f"Method: <b>{payment_method}</b>", styles["Small"]),
        _paragraph(f"Status: <b>{payment_status}</b>", styles["Small"]),
        _paragraph(f"Transaction ID: {transaction_id}", styles["Small"]),
    ]
    if razor_order_id != "-":
        payment_lines.append(_paragraph(f"Razorpay Order ID: {razor_order_id}", styles["Small"]))

    payment_table = Table([[p] for p in payment_lines], colWidths=[92 * mm])
    payment_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    summary_table = Table(summary_rows, colWidths=[45 * mm, 37 * mm], hAlign="RIGHT")
    summary_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, PLUM),
        ("TOPPADDING", (0, -1), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 1 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -2), 1.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -2), 1.2 * mm),
    ]))
    totals_table = Table([[payment_table, summary_table]], colWidths=[92 * mm, 82 * mm])
    totals_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 8 * mm))

    note = "This invoice is generated electronically from your ARTFUL order record. Please retain it for your records."
    story.append(Table([[_paragraph("THANK YOU FOR SHOPPING WITH ARTFUL", ParagraphStyle("Thanks", parent=styles["Body"], fontName="Helvetica-Bold", textColor=PLUM, fontSize=9.5))]], colWidths=[174 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ])))
    story.append(Spacer(1, 2.5 * mm))
    story.append(_paragraph(note, styles["Footer"]))

    def draw_footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, 10 * mm, PAGE_W - MARGIN, 10 * mm)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(MARGIN, 6.5 * mm, f"{company['name']} · {company['email']} · {company['phone']}")
        canvas.drawRightString(PAGE_W - MARGIN, 6.5 * mm, f"Page {doc_obj.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    buffer.seek(0)
    return buffer


async def _invoice_response(order, settings):
    pdf = build_invoice_pdf(clean(dict(order)), settings)
    filename = _safe_filename(order.get("order_number"))
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/orders/{order_number}/invoice.pdf")
async def customer_invoice(order_number: str, cust: dict = Depends(get_current_customer)):
    order = await db.orders.find_one({"order_number": order_number, "customer_id": cust["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found.")
    settings = await db.settings.find_one({"id": "store"}, {"_id": 0}) or {}
    return await _invoice_response(order, settings)


@router.get("/admin/orders/{order_number}/invoice.pdf")
async def admin_invoice(order_number: str, admin: dict = Depends(require_permission("orders"))):
    order = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found.")
    settings = await db.settings.find_one({"id": "store"}, {"_id": 0}) or {}
    return await _invoice_response(order, settings)
