import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { updateProfile, changePassword } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { toast } from "sonner";
import { User, Mail, Lock, Eye, EyeOff, Save, X } from "lucide-react";

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function ProfilePage() {
  const { user, setUser } = useAuthStore();

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState(user?.username ?? "");
  const [editEmail, setEditEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUsername.trim() || !editEmail.trim()) {
      toast.error("Username and email are required");
      return;
    }
    const changes: { username?: string; email?: string } = {};
    if (editUsername !== user.username) changes.username = editUsername;
    if (editEmail !== user.email) changes.email = editEmail;
    if (Object.keys(changes).length === 0) {
      setIsEditing(false);
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateProfile(changes);
      setUser(updated);
      toast.success("Profile updated");
      setIsEditing(false);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update profile"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setEditUsername(user.username);
    setEditEmail(user.email);
    setIsEditing(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to change password"));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-primary mb-6">Profile</h1>

      {/* Profile Info Card */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold">
            {getInitials(user.username)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">{user.username}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" />
            <span>Member since {formatDate(user.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>{user.email}</span>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary">Edit Profile</h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-accent hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Username</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={50}
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Email</label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium text-primary">{user.username}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-primary">{user.email}</span>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Form */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Must contain uppercase, lowercase, number, and special character.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
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
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {savingPassword ? "Updating..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
