import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { toast } from "sonner";
import { TrendingUp, Eye, EyeOff } from "lucide-react";

const SPECIAL_PASSWORD_CHARS = '!@#$%^&*(),.?":{}|<>_-+=[]~/`\\\';';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (password.length < 8) e.password = "Password must be at least 8 characters";
    else if (!/[A-Z]/.test(password)) e.password = "Password must contain an uppercase letter";
    else if (!/[a-z]/.test(password)) e.password = "Password must contain a lowercase letter";
    else if (!/[0-9]/.test(password)) e.password = "Password must contain a digit";
    else if (![...password].some((char) => SPECIAL_PASSWORD_CHARS.includes(char)))
      e.password = "Password must contain a special character";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await resetPassword({ token: token!, new_password: password });
      toast.success("Password updated! Please sign in.");
      navigate("/login");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to reset password"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4">
        <div className="w-full max-w-md bg-card rounded-xl shadow-lg border border-border p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <TrendingUp className="w-8 h-8 text-accent" />
            <h1 className="text-2xl font-bold text-primary">TW Stock</h1>
          </div>
          <p className="text-sm text-danger mb-4">Invalid or missing reset link.</p>
          <Link to="/forgot-password" className="text-sm text-accent font-medium hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-lg border border-border p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <TrendingUp className="w-8 h-8 text-accent" />
          <h1 className="text-2xl font-bold text-primary">TW Stock</h1>
        </div>
        <h2 className="text-xl font-semibold text-center mb-6">Set New Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-danger mt-1">{errors.password}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Min 8 chars, upper, lower, digit, special char.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-danger mt-1">{errors.confirmPassword}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Updating..." : "Update password"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/login" className="text-accent font-medium hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
