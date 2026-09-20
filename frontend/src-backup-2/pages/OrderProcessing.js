import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useStore } from "../context/StoreContext";

const POLL_MS = 700;
const MAX_WAIT_MS = 45000;

function PackageAnimation() {
  return (
    <div className="relative w-64 h-48 sm:w-72 sm:h-52 mx-auto" aria-hidden="true">
      <style>{`
        @keyframes artfulBoxFloat {
          0%, 100% { transform: translateY(4px) rotate(-1deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes artfulSpark {
          0%, 100% { opacity: .25; transform: scale(.8) translateY(0); }
          50% { opacity: 1; transform: scale(1) translateY(-4px); }
        }
        @keyframes artfulTruckMove {
          0% { transform: translateX(-9px); }
          50% { transform: translateX(9px); }
          100% { transform: translateX(-9px); }
        }
        .artful-box { animation: artfulBoxFloat 2.4s ease-in-out infinite; transform-origin: center; }
        .artful-spark { animation: artfulSpark 1.8s ease-in-out infinite; transform-origin: center; }
        .artful-spark.delay-1 { animation-delay: .35s; }
        .artful-spark.delay-2 { animation-delay: .7s; }
        .artful-truck { animation: artfulTruckMove 2.2s ease-in-out infinite; }
      `}</style>

      <svg viewBox="0 0 320 220" className="w-full h-full" role="img" aria-label="Order package being prepared">
        <g className="artful-spark" opacity=".8">
          <path d="M64 49v16M56 57h16" stroke="#5C3243" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g className="artful-spark delay-1" opacity=".7">
          <path d="M246 38v12M240 44h12" stroke="#5C3243" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <g className="artful-spark delay-2" opacity=".75">
          <circle cx="270" cy="87" r="4" fill="#5C3243" />
        </g>

        <ellipse cx="160" cy="194" rx="82" ry="10" fill="#eadfe3" />

        <g className="artful-box">
          <path d="M85 101 160 67l75 34-75 35-75-35Z" fill="#f4e8e3" stroke="#5C3243" strokeWidth="2.5" />
          <path d="M85 101v57l75 36v-58l-75-35Z" fill="#ead8d0" stroke="#5C3243" strokeWidth="2.5" />
          <path d="m235 101-75 35v58l75-36v-57Z" fill="#dfc8be" stroke="#5C3243" strokeWidth="2.5" />
          <path d="M160 67v69" stroke="#5C3243" strokeWidth="2.5" />
          <path d="m160 67-22 10 75 34 22-10-75-34Z" fill="#f8f1ee" stroke="#5C3243" strokeWidth="2" />
          <rect x="148" y="106" width="24" height="15" rx="2" fill="#5C3243" opacity=".12" />
          <path d="M155 110h10M155 114h6" stroke="#5C3243" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        <g className="artful-truck">
          <path d="M204 163h50l16 13h16v15h-82v-28Z" fill="#fffaf7" stroke="#5C3243" strokeWidth="2.5" />
          <path d="M252 163h12l12 13h-24v-13Z" fill="#f2e7e2" stroke="#5C3243" strokeWidth="2.5" />
          <circle cx="222" cy="191" r="8" fill="#5C3243" />
          <circle cx="270" cy="191" r="8" fill="#5C3243" />
          <circle cx="222" cy="191" r="3" fill="#f7f2ee" />
          <circle cx="270" cy="191" r="3" fill="#f7f2ee" />
          <path d="M211 179h35" stroke="#d8c0b8" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

export default function OrderProcessing() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const { clearCart } = useStore();
  const [state, setState] = useState("checking");
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let stopped = false;
    let timer;

    const poll = async () => {
      if (stopped) return;

      try {
        const { data } = await api.get(`/orders/${encodeURIComponent(orderNumber)}`);
        const paymentStatus = String(data?.payment?.status || "").toLowerCase();
        const orderStatus = String(data?.status || "").toLowerCase();

        if (paymentStatus === "paid" || paymentStatus === "cod_confirmed" || orderStatus === "confirmed") {
          stopped = true;
          clearCart();
          navigate(`/order-success/${orderNumber}`, { replace: true });
          return;
        }

        if (paymentStatus === "failed" || orderStatus === "failed") {
          stopped = true;
          setState("failed");
          return;
        }
      } catch (error) {
        // Keep polling through transient network errors. A successful payment should never
        // cause the customer to repeat the payment just because one status request failed.
      }

      if (Date.now() - startedAt.current >= MAX_WAIT_MS) {
        stopped = true;
        setState("taking-longer");
        return;
      }

      timer = window.setTimeout(poll, POLL_MS);
    };

    poll();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [clearCart, navigate, orderNumber]);

  if (state === "failed") {
    return (
      <div className="container-artful min-h-[70vh] py-16 flex items-center justify-center">
        <div className="max-w-xl mx-auto text-center">
          <PackageAnimation />
          <h1 className="font-serif text-3xl lg:text-4xl text-plum mb-3">We couldn’t confirm your order yet.</h1>
          <p className="text-ink-secondary leading-relaxed mb-8">
            Your payment verification needs another look. Please don’t make another payment. You can check your order shortly or contact us with your order number.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate(`/account/orders`)} className="btn-primary">Check My Orders</button>
            <button onClick={() => navigate(`/shop`)} className="btn-outline">Continue Shopping</button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "taking-longer") {
    return (
      <div className="container-artful min-h-[70vh] py-16 flex items-center justify-center">
        <div className="max-w-xl mx-auto text-center">
          <PackageAnimation />
          <h1 className="font-serif text-3xl lg:text-4xl text-plum mb-3">Your order is taking a tiny extra moment ✨</h1>
          <p className="text-ink-secondary leading-relaxed mb-4">
            Payment was received and we’re still confirming the order. Please don’t pay again — your order number is <b className="text-plum">{orderNumber}</b>.
          </p>
          <p className="text-xs text-ink-muted">You can safely check your orders while we finish the behind-the-scenes magic.</p>
          <div className="mt-8">
            <button onClick={() => navigate(`/account/orders`)} className="btn-primary">Check My Orders</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-artful min-h-[70vh] py-16 flex items-center justify-center" data-testid="order-processing-page">
      <div className="max-w-2xl mx-auto text-center">
        <PackageAnimation />
        <h1 className="font-serif text-3xl lg:text-4xl text-plum mb-4">Your Order Is Being Prepared ✨</h1>
        <p className="text-ink-secondary leading-relaxed max-w-xl mx-auto">
          Payment received successfully! We’re just doing a few quick checks and getting your order ready. No need to refresh — your order is doing its little behind-the-scenes magic.
        </p>
        <p className="text-xs text-ink-muted mt-6">Order {orderNumber}</p>
      </div>
    </div>
  );
}
