import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await requestPasswordReset({ email });
      setIsSuccess(true);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Request failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-lg border border-border p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <TrendingUp className="w-8 h-8 text-accent" />
          <h1 className="text-2xl font-bold text-primary">TW Stock</h1>
        </div>
        <h2 className="text-xl font-semibold text-center mb-2">Forgot Password</h2>

        {isSuccess ? (
          <div className="text-center space-y-4 mt-6">
            <p className="text-sm text-primary">
              If an account exists for that email, a reset link has been sent.
            </p>
            <p className="text-xs text-muted-foreground">
              Check server console for the token (development mode).
            </p>
            <Link to="/login" className="block text-sm text-accent font-medium hover:underline mt-4">
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Remember your password?{" "}
              <Link to="/login" className="text-accent font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
