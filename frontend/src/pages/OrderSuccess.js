import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, Package, Truck } from "lucide-react";
import { api } from "../lib/api";
import { inr, formatDate } from "../lib/utils";
import { PageLoader } from "../components/Loader";
import { burstConfetti } from "../lib/confetti";

export default function OrderSuccess() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  useEffect(() => { api.get(`/orders/${orderNumber}`).then(({ data }) => setOrder(data)).catch(() => setOrder(false)); }, [orderNumber]);
  useEffect(() => { const t = setTimeout(() => burstConfetti(), 400); return () => clearTimeout(t); }, []);

  if (order === null) return <PageLoader />;

  return (
    <div className="container-artful py-16 max-w-2xl mx-auto text-center" data-testid="order-success-container">
      <CheckCircle2 size={56} className="mx-auto text-ok mb-6" strokeWidth={1.5} />
      <h1 className="font-serif text-3xl lg:text-4xl text-plum mb-3">Thank you for choosing ARTFUL.</h1>
      <p className="text-ink-secondary mb-2">Your order has been placed successfully.</p>
      <p className="text-sm text-ink-muted mb-10">Order Number: <b className="text-plum" data-testid="order-number">{orderNumber}</b></p>

      {order && order !== false && (
        <div className="bg-surface p-6 sm:p-8 text-left">
          <div className="space-y-4 mb-6">
            {order.items.map((i, idx) => (
              <div key={idx} className="flex gap-4">
                <img src={i.image} alt="" className="w-16 h-20 object-cover bg-white" />
                <div className="flex-1"><p className="font-serif text-ink">{i.name}</p><p className="text-xs text-ink-muted">Qty {i.qty}{i.gift_wrap ? " · Gift wrapped" : ""}</p></div>
                <span className="text-plum text-sm">{inr(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-line pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-ink-secondary"><span>Payment</span><span className="capitalize">{order.payment.status.replace("_", " ")}{order.payment.dev_mode ? " (Demo)" : ""}</span></div>
            <div className="flex justify-between text-plum font-medium text-lg"><span>Total Paid</span><span>{inr(order.pricing.total)}</span></div>
          </div>
          <div className="border-t border-line mt-4 pt-4 text-sm text-ink-secondary">
            <p className="font-medium text-ink mb-1">Delivery Address</p>
            <p>{order.address.name}, {order.address.line1}, {order.address.city}, {order.address.state} — {order.address.pincode}</p>
            <p className="flex items-center gap-2 mt-3 text-plum"><Truck size={15} /> Estimated delivery in 3–5 business days</p>
          </div>
        </div>
      )}

      <div className="bg-plum-light p-5 mt-6 text-sm text-plum flex items-center gap-3 justify-center">
        <Package size={18} /> Your ARTFUL account is ready. Sign in anytime with your mobile number and OTP.
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link to="/account/orders" className="btn-primary" data-testid="track-order-link">Track Your Order</Link>
        <Link to="/shop" className="btn-outline">Continue Shopping</Link>
      </div>
    </div>
  );
}
