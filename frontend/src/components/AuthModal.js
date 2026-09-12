import React, { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { api, apiError } from "../lib/api";
import { toast } from "sonner";
import { sanitizePhone } from "../lib/utils";

export default function AuthModal() {
  const { authOpen, setAuthOpen, loginSuccess } = useStore();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState(null);

  const reset = () => { setStep("phone"); setPhone(""); setCode(""); setDevOtp(null); };
  const close = () => { setAuthOpen(false); setTimeout(reset, 300); };

  const sendOtp = async (e) => {
    e?.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid mobile number");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/send", { phone });
      setStep("otp");
      if (data.dev_mode) { setDevOtp(data.dev_otp); toast.info(`Demo OTP: ${data.dev_otp}`, { duration: 8000 }); }
      else toast.success("OTP sent to your mobile");
    } catch (err) { toast.error(apiError(err)); }
    setLoading(false);
  };

  const verifyOtp = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { phone, code });
      loginSuccess(data.token, data.customer);
      toast.success(data.new_account ? "Welcome to ARTFUL! Your account is ready." : "Welcome back!");
      close();
    } catch (err) { toast.error(apiError(err)); }
    setLoading(false);
  };


  if (!authOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="auth-modal">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative bg-cream w-full max-w-md p-8 sm:p-10 animate-fadeUp">
        <button onClick={close} className="absolute top-5 right-5 text-plum" data-testid="auth-close"><X size={22} /></button>
        <div className="text-center mb-8">
          <div className="font-serif text-4xl text-plum mb-2">Artful</div>
          <p className="text-sm text-ink-secondary">Sign in with your mobile number — no password needed.</p>
        </div>

        {step === "phone" && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="label-caption block mb-2">Mobile Number</label>
              <input value={phone} onChange={(e) => setPhone(sanitizePhone(e.target.value))} inputMode="numeric" placeholder="10-digit mobile number" className="input-field" data-testid="auth-phone-input" autoFocus />
            </div>
            <button className="btn-primary w-full" disabled={loading} data-testid="auth-send-otp-btn">{loading ? "Sending…" : "Send OTP"}</button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="label-caption block mb-2">Enter OTP sent to {phone}</label>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="input-field text-center text-2xl tracking-[0.5em] font-mono" data-testid="checkout-otp-input" autoFocus />
              {devOtp && <p className="text-xs text-warn mt-2">Demo mode — OTP: <b>{devOtp}</b></p>}
            </div>
            <button className="btn-primary w-full" disabled={loading || code.length < 4} data-testid="auth-verify-otp-btn">{loading ? "Verifying…" : "Verify & Continue"}</button>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => setStep("phone")} className="text-ink-muted hover:text-plum">← Change number</button>
              <button type="button" onClick={sendOtp} className="text-plum hover:underline">Resend OTP</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
