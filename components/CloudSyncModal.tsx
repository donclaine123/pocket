import { Check, CircleAlert, Cloud, CloudOff, Lock, LogOut, Mail, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { COLORS, FONTS, STYLES } from "../constants/theme";
import { isSupabaseConfigured, supabase, getSupabaseDebugInfo } from "../database/supabase";
import { safeHaptic } from "../services/haptics";
import { syncGuestTransactionsToAccount } from "../services/storage";

type CloudSyncModalProps = {
  visible: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
  onSignOut?: () => void;
  initialMode?: "signin" | "signup" | "forgot" | "new_password" | "verify_otp";
  initialError?: string | null;
};

export function CloudSyncModal({
  visible,
  onClose,
  onSyncComplete,
  onSignOut,
  initialMode,
  initialError,
}: CloudSyncModalProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot" | "new_password" | "verify_otp">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    passwordMismatch?: boolean;
  }>({});


  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      checkCurrentUser();
      setErrorMsg(initialError ?? null);
      setSuccessMsg(null);
      setFieldErrors({});
      setPassword("");
      setConfirmPassword("");
      setOtpCode("");
      if (initialMode) {
        setAuthMode(initialMode);
      }
    }
  }, [visible, initialMode, initialError]);

  const checkCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    } catch {
      setUserEmail(null);
    }
  };

  const handleAuth = async () => {
    safeHaptic.selection();
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});

    if (!isSupabaseConfigured) {
      const dbg = getSupabaseDebugInfo();
      setErrorMsg(
        `Supabase credentials not found in environment.\n\nDiagnostics:\n• Platform: ${dbg.platform}\n• EXPO_PUBLIC_SUPABASE_URL: ${dbg.hasProcessEnvUrl ? "Found" : "Missing"}\n• EXPO_PUBLIC_SUPABASE_ANON_KEY: ${dbg.hasProcessEnvKey ? "Found" : "Missing"}\n• Active URL: ${dbg.url}\n• Key Length: ${dbg.keyLength}\n• Extra Keys: [${dbg.extraKeys.join(", ") || "none"}]`
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Reset Password Request Mode
    if (authMode === "forgot") {
      if (!email.trim()) {
        setFieldErrors({ email: "Please enter your email address." });
        safeHaptic.warning();
        return;
      } else if (!emailRegex.test(email.trim())) {
        setFieldErrors({ email: "Please enter a valid email address (e.g. name@example.com)." });
        safeHaptic.warning();
        return;
      }

      setLoading(true);
      try {
        const redirectUrl =
          Platform.OS === "web"
            ? (typeof window !== "undefined" ? window.location.origin : "http://localhost:8081")
            : "pocket://reset-password";

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl,
        });
        if (error) throw error;
        setSuccessMsg("Password reset link sent! Please check your email inbox.");
        safeHaptic.success();
      } catch (err: any) {
        setFieldErrors({ email: err.message || "Could not send reset email." });
        safeHaptic.warning();
      } finally {
        setLoading(false);
      }
      return;
    }

    // Set New Password Mode (Arrived from email link)
    if (authMode === "new_password") {
      const errors: {
        password?: string;
        confirmPassword?: string;
        passwordMismatch?: boolean;
      } = {};

      if (!password.trim()) {
        errors.password = "Please enter your new password.";
      } else if (password.length < 6) {
        errors.password = "Password must be at least 6 characters.";
      }

      if (!confirmPassword.trim()) {
        errors.confirmPassword = "Please confirm your new password.";
      } else if (password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
        errors.passwordMismatch = true;
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        safeHaptic.warning();
        return;
      }

      setLoading(true);
      try {
        let { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session && Platform.OS === "web" && typeof window !== "undefined") {
          const hash = window.location.hash || "";
          const search = window.location.search || "";
          const rawParams = hash.replace(/^#/, "") || search.replace(/^\?/, "");
          const params = new URLSearchParams(rawParams);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const code = params.get("code");

          if (accessToken && refreshToken) {
            const res = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            sessionData = res.data;
          } else if (code) {
            const res = await supabase.auth.exchangeCodeForSession(code);
            sessionData = res.data;
          }
        }

        if (!sessionData.session) {
          throw new Error("Auth session missing! Your reset link may have expired. Please request a fresh reset link.");
        }

        const { data, error } = await supabase.auth.updateUser({
          password: password.trim(),
        });
        if (error) throw error;
        setUserEmail(data.user?.email || null);
        setSuccessMsg("Password updated successfully! Realtime sync is active.");
        safeHaptic.success();
        setPassword("");
        setConfirmPassword("");
        if (Platform.OS === "web" && typeof window !== "undefined") {
          try {
            window.history.replaceState(null, "", window.location.pathname);
          } catch {}
        }
        onSyncComplete?.();
      } catch (err: any) {
        setFieldErrors({ password: err.message || "Failed to update password." });
        safeHaptic.warning();
      } finally {
        setLoading(false);
      }
      return;
    }

    // Verify OTP Code (From email confirmation)
    if (authMode === "verify_otp") {
      if (!otpCode.trim()) {
        setFieldErrors({ password: "Enter the confirmation code from your email." });
        safeHaptic.warning();
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpCode.trim(),
          type: "signup",
        });
        if (error) throw error;
        if (data.user?.id) {
          await syncGuestTransactionsToAccount(data.user.id);
        }
        setUserEmail(data.user?.email || email);
        setSuccessMsg("Account verified! Realtime sync is active.");
        safeHaptic.success();
        setOtpCode("");
        setAuthMode("signin");
        onSyncComplete?.();
      } catch (err: any) {
        setFieldErrors({ password: err.message || "Invalid or expired confirmation code." });
        safeHaptic.warning();
      } finally {
        setLoading(false);
      }
      return;
    }

    const errors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      passwordMismatch?: boolean;
    } = {};

    if (!email.trim()) {
      errors.email = "Please enter your email address.";
    } else if (!emailRegex.test(email.trim())) {
      errors.email = "Please enter a valid email address (e.g. name@example.com).";
    }

    if (!password.trim()) {
      errors.password = "Please enter your password.";
    } else if (authMode === "signup" && password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    if (authMode === "signup") {
      if (!confirmPassword.trim()) {
        errors.confirmPassword = "Please confirm your password.";
      } else if (password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
        errors.passwordMismatch = true;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      safeHaptic.warning();
      return;
    }

    setLoading(true);
    try {
      if (authMode === "signup") {
        const redirectUrl =
          Platform.OS === "web"
            ? (typeof window !== "undefined" ? window.location.origin : "http://localhost:8081")
            : "pocket://auth-callback";

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (error) throw error;
        if (data.session) {
          if (data.user?.id) {
            await syncGuestTransactionsToAccount(data.user.id);
          }
          setUserEmail(data.user?.email || email);
          setSuccessMsg("Account created! Realtime sync is active.");
          safeHaptic.success();
          onSyncComplete?.();
        } else {
          setSuccessMsg("Confirmation email sent! Tap the link in your email, or enter the confirmation code below.");
          setAuthMode("verify_otp");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        setUserEmail(data.user?.email || email);
        setSuccessMsg("Signed in! Journal synced with cloud.");
        safeHaptic.success();
        onSyncComplete?.();
      }
    } catch (err: any) {
      const msg = err.message || "Authentication error. Please try again.";
      const lower = msg.toLowerCase();

      if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
        setFieldErrors({
          email: "Invalid email or password. Please verify.",
          password: "Invalid email or password. Please verify.",
        });
      } else if (lower.includes("already registered") || lower.includes("already exists") || lower.includes("user already")) {
        setFieldErrors({
          email: "An account with this email already exists. Try signing in.",
        });
      } else if (lower.includes("password") && (lower.includes("least") || lower.includes("short") || lower.includes("character"))) {
        setFieldErrors({
          password: "Password must be at least 6 characters.",
        });
      } else if (lower.includes("valid email") || lower.includes("invalid email")) {
        setFieldErrors({
          email: "Please enter a valid email address.",
        });
      } else if (lower.includes("email not confirmed")) {
        setFieldErrors({
          email: "Email address not confirmed yet. Check your inbox.",
        });
      } else if (lower.includes("password")) {
        setFieldErrors({
          password: msg,
        });
      } else if (lower.includes("email") || lower.includes("user")) {
        setFieldErrors({
          email: msg,
        });
      } else {
        setErrorMsg(msg);
      }
      safeHaptic.warning();
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    safeHaptic.light();
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUserEmail(null);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setOtpCode("");
      setFieldErrors({});
      setErrorMsg(null);
      setAuthMode("signin");
      setSuccessMsg("Signed out. Switched to private offline journal.");
      safeHaptic.success();
      onSignOut?.();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </View>

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.titleRow}>
              <View style={[styles.statusBubble, userEmail ? styles.statusOnline : styles.statusLocal]}>
                {userEmail ? <Cloud size={16} color="#2D8A63" /> : <CloudOff size={16} color="#B35232" />}
              </View>
              <View>
                <Text style={styles.modalTitle}>Cloud Sync & Backup</Text>
                <Text style={styles.modalSubtitle}>Safe backup & multi-device sync</Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <X size={18} color={COLORS.ink} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            <View style={[styles.bannerCard, userEmail ? styles.bannerOnline : styles.bannerLocal]}>
              <Text style={styles.bannerTitle}>
                {userEmail ? "🟢 Automatic Cloud Backup Active" : "🟡 Private Offline Journal"}
              </Text>
              <Text style={styles.bannerBody}>
                {userEmail
                  ? `Signed in as ${userEmail}. Your entries are safely backed up and stay in sync across all your devices.`
                  : "Every peso and note is saved directly on this device. You can use Pocket anytime without internet—no account required."}
              </Text>
            </View>

            {/* Error or Success Notice */}
            {Boolean(errorMsg) && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}
            {Boolean(successMsg) && (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerText}>{successMsg}</Text>
              </View>
            )}

            {userEmail ? (
              /* Signed In Profile View */
              <View style={styles.profileSection}>
                <View style={styles.userCard}>
                  <Text style={styles.userCardLabel}>CONNECTED ACCOUNT</Text>
                  <Text style={styles.userCardEmail}>{userEmail}</Text>
                </View>

                <Pressable
                  onPress={handleSignOut}
                  disabled={loading}
                  style={[styles.actionButton, styles.signOutButton]}
                >
                  <LogOut size={16} color="#B35232" />
                  <Text style={styles.signOutText}>Sign Out (Switch to Offline Journal)</Text>
                </Pressable>
              </View>
            ) : (
              /* Auth Form View */
              <View style={styles.authSection}>
                {/* Switcher Tabs or Special Mode Headers */}
                {authMode === "signin" || authMode === "signup" ? (
                  <View style={styles.tabContainer}>
                    <Pressable
                      onPress={() => {
                        safeHaptic.selection();
                        setAuthMode("signin");
                        setPassword("");
                        setConfirmPassword("");
                        setOtpCode("");
                        setFieldErrors({});
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      style={[styles.tabButton, authMode === "signin" && styles.tabButtonActive]}
                    >
                      <Text style={[styles.tabText, authMode === "signin" && styles.tabTextActive]}>
                        Sign In
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        safeHaptic.selection();
                        setAuthMode("signup");
                        setPassword("");
                        setConfirmPassword("");
                        setOtpCode("");
                        setFieldErrors({});
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      style={[styles.tabButton, authMode === "signup" && styles.tabButtonActive]}
                    >
                      <Text style={[styles.tabText, authMode === "signup" && styles.tabTextActive]}>
                        Create Account
                      </Text>
                    </Pressable>
                  </View>
                ) : authMode === "verify_otp" ? (
                  <View style={styles.forgotHeaderRow}>
                    <Text style={styles.forgotTitle}>Confirm Your Email</Text>
                    <Text style={styles.forgotSubtitle}>
                      Enter the confirmation code sent to {email || "your email"}, or click the link in your email.
                    </Text>
                  </View>
                ) : authMode === "new_password" ? (
                  <View style={styles.forgotHeaderRow}>
                    <Text style={styles.forgotTitle}>Set New Password</Text>
                    <Text style={styles.forgotSubtitle}>
                      Create a new password for your Pocket account.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.forgotHeaderRow}>
                    <Text style={styles.forgotTitle}>Forgot Password?</Text>
                    <Text style={styles.forgotSubtitle}>
                      Enter your email and we'll send you a link to reset your password.
                    </Text>
                  </View>
                )}

                {/* Email Input (Hidden in new_password and verify_otp mode) */}
                {authMode !== "new_password" && authMode !== "verify_otp" && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        Boolean(fieldErrors.email) && styles.inputWrapperError,
                      ]}
                    >
                      <Mail
                        size={16}
                        color={Boolean(fieldErrors.email) ? "#E53935" : COLORS.inkSoft}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="you@example.com"
                        placeholderTextColor={COLORS.inkSoft}
                        value={email}
                        onChangeText={(val) => {
                          setEmail(val);
                          if (fieldErrors.email) {
                            setFieldErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {Boolean(fieldErrors.email) && (
                      <View style={styles.errorNoticeRow}>
                        <CircleAlert size={13} color="#E53935" strokeWidth={2.2} />
                        <Text style={styles.inputErrorText}>{fieldErrors.email}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* OTP Confirmation Code Input (Shown in verify_otp mode) */}
                {authMode === "verify_otp" && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CONFIRMATION CODE</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        Boolean(fieldErrors.password) && styles.inputWrapperError,
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            letterSpacing: 4,
                            textAlign: "center",
                            fontSize: 18,
                            fontFamily: FONTS.displayBold,
                          },
                        ]}
                        placeholder="12345678"
                        placeholderTextColor={COLORS.inkSoft}
                        value={otpCode}
                        onChangeText={(val) => {
                          setOtpCode(val.trim());
                          if (fieldErrors.password) {
                            setFieldErrors((prev) => ({ ...prev, password: undefined }));
                          }
                        }}
                        keyboardType="number-pad"
                        maxLength={10}
                      />
                    </View>
                    {Boolean(fieldErrors.password) && (
                      <View style={styles.errorNoticeRow}>
                        <CircleAlert size={13} color="#E53935" strokeWidth={2.2} />
                        <Text style={styles.inputErrorText}>{fieldErrors.password}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Password Input (Hidden in forgot password and verify_otp mode) */}
                {authMode !== "forgot" && authMode !== "verify_otp" && (
                  <View style={styles.inputGroup}>
                    <View style={styles.inputLabelRow}>
                      <Text style={styles.inputLabel}>
                        {authMode === "new_password" ? "NEW PASSWORD" : "PASSWORD"}
                      </Text>
                      {authMode === "signin" && (
                        <Pressable
                          onPress={() => {
                            safeHaptic.selection();
                            setAuthMode("forgot");
                            setErrorMsg(null);
                            setSuccessMsg(null);
                            setFieldErrors({});
                          }}
                          hitSlop={8}
                        >
                          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                        </Pressable>
                      )}
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        Boolean(fieldErrors.password || fieldErrors.passwordMismatch) &&
                          styles.inputWrapperError,
                      ]}
                    >
                      <Lock
                        size={16}
                        color={
                          Boolean(fieldErrors.password || fieldErrors.passwordMismatch)
                            ? "#E53935"
                            : COLORS.inkSoft
                        }
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="••••••••"
                        placeholderTextColor={COLORS.inkSoft}
                        value={password}
                        onChangeText={(val) => {
                          setPassword(val);
                          if (fieldErrors.password || fieldErrors.passwordMismatch) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              password: undefined,
                              passwordMismatch: false,
                              confirmPassword:
                                prev.confirmPassword === "Passwords do not match."
                                  ? undefined
                                  : prev.confirmPassword,
                            }));
                          }
                        }}
                        secureTextEntry
                      />
                    </View>
                    {Boolean(fieldErrors.password) && (
                      <View style={styles.errorNoticeRow}>
                        <CircleAlert size={13} color="#E53935" strokeWidth={2.2} />
                        <Text style={styles.inputErrorText}>{fieldErrors.password}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Confirm Password Input (Shown in signup and new_password mode) */}
                {(authMode === "signup" || authMode === "new_password") && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      {authMode === "new_password"
                        ? "CONFIRM NEW PASSWORD"
                        : "CONFIRM PASSWORD"}
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        Boolean(fieldErrors.confirmPassword || fieldErrors.passwordMismatch) &&
                          styles.inputWrapperError,
                      ]}
                    >
                      <Lock
                        size={16}
                        color={
                          Boolean(fieldErrors.confirmPassword || fieldErrors.passwordMismatch)
                            ? "#E53935"
                            : COLORS.inkSoft
                        }
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="••••••••"
                        placeholderTextColor={COLORS.inkSoft}
                        value={confirmPassword}
                        onChangeText={(val) => {
                          setConfirmPassword(val);
                          if (fieldErrors.confirmPassword || fieldErrors.passwordMismatch) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              confirmPassword: undefined,
                              passwordMismatch: false,
                            }));
                          }
                        }}
                        secureTextEntry
                      />
                    </View>
                    {Boolean(fieldErrors.confirmPassword) && (
                      <View style={styles.errorNoticeRow}>
                        <CircleAlert size={13} color="#E53935" strokeWidth={2.2} />
                        <Text style={styles.inputErrorText}>{fieldErrors.confirmPassword}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Submit Action */}
                <Pressable
                  onPress={handleAuth}
                  disabled={loading}
                  style={[styles.actionButton, styles.submitButton]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={COLORS.cream} />
                  ) : (
                    <>
                      <Check size={16} color={COLORS.cream} strokeWidth={2.5} />
                      <Text style={styles.submitButtonText}>
                        {authMode === "signup"
                          ? "Create Account & Sync"
                          : authMode === "forgot"
                          ? "Send Reset Link"
                          : authMode === "new_password"
                          ? "Save New Password & Sign In"
                          : authMode === "verify_otp"
                          ? "Confirm Code & Sign In"
                          : "Sign In & Sync"}
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Back to Sign In button if in forgot, new_password, or verify_otp mode */}
                {(authMode === "forgot" || authMode === "new_password" || authMode === "verify_otp") && (
                  <Pressable
                    onPress={() => {
                      safeHaptic.selection();
                      setAuthMode("signin");
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    style={styles.backToSignInBtn}
                    hitSlop={8}
                  >
                    <Text style={styles.backToSignInText}>← Back to Sign In</Text>
                  </Pressable>
                )}

                {/* Non-technical friendly reassurance */}
                <Text style={styles.disclaimerText}>
                  ✿ No account required: Pocket works completely offline on your device. Creating an account is only needed if you'd like to back up your journal and view it on other phones or computers.
                </Text>

                {/* Direct UI Environment Debug Card */}
                <View style={styles.debugContainer}>
                  <Text style={styles.debugTitle}>🛠 Environment Diagnostics</Text>
                  <Text style={styles.debugItem}>
                    Configured: {isSupabaseConfigured ? "✅ YES" : "❌ NO"}
                  </Text>
                  <Text style={styles.debugItem}>
                    Platform: {Platform.OS}
                  </Text>
                  <Text style={styles.debugItem}>
                    process.env.EXPO_PUBLIC_SUPABASE_URL: {Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL) ? "Found" : "Missing"}
                  </Text>
                  <Text style={styles.debugItem}>
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY: {Boolean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ? "Found" : "Missing"}
                  </Text>
                  <Text style={styles.debugItem}>
                    URL: {getSupabaseDebugInfo().url} (Key length: {getSupabaseDebugInfo().keyLength})
                  </Text>
                  <Text style={styles.debugItem}>
                    Constants Extra: [{getSupabaseDebugInfo().extraKeys.join(", ") || "none"}]
                  </Text>
                </View>

              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(42, 36, 33, 0.55)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: COLORS.paper,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    maxHeight: "88%",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 4, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.cream,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusBubble: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  statusOnline: {
    backgroundColor: "#D4F0E3",
  },
  statusLocal: {
    backgroundColor: "#FFE0D6",
  },
  modalTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: COLORS.ink,
  },
  modalSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollArea: {
    padding: 20,
  },
  bannerCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  bannerOnline: {
    backgroundColor: "#E8F7F0",
  },
  bannerLocal: {
    backgroundColor: "#FFF2EC",
  },
  bannerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.ink,
    marginBottom: 4,
  },
  bannerBody: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.inkSoft,
    lineHeight: 17,
  },
  errorBanner: {
    backgroundColor: "#FFE5E0",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E26543",
    marginBottom: 14,
  },
  errorBannerText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: "#B35232",
  },
  successBanner: {
    backgroundColor: "#E2F6EC",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#379E75",
    marginBottom: 14,
  },
  successBannerText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: "#236B4F",
  },
  profileSection: {
    gap: 14,
  },
  userCard: {
    backgroundColor: COLORS.cream,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
  userCardLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.inkSoft,
    letterSpacing: 1,
    marginBottom: 4,
  },
  userCardEmail: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    color: COLORS.ink,
  },
  authSection: {
    gap: 14,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: COLORS.ink,
  },
  tabText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  tabTextActive: {
    color: COLORS.cream,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    color: COLORS.inkSoft,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    gap: 10,
  },
  inputWrapperError: {
    borderColor: "#E53935",
    backgroundColor: "#FFF5F5",
  },
  errorNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    marginLeft: 4,
  },
  inputErrorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11.5,
    color: "#E53935",
  },
  textInput: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.ink,
    paddingVertical: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    marginTop: 6,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 2, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  submitButton: {
    backgroundColor: COLORS.ink,
  },
  submitButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.cream,
  },
  signOutButton: {
    backgroundColor: "#FFE5E0",
  },
  signOutText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: "#B35232",
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  forgotPasswordText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.peach,
    textDecorationLine: "underline",
  },
  forgotHeaderRow: {
    marginBottom: 6,
  },
  forgotTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: COLORS.ink,
  },
  forgotSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.inkSoft,
    lineHeight: 17,
    marginTop: 2,
  },
  backToSignInBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backToSignInText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.ink,
    textDecorationLine: "underline",
  },
  disclaimerText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.inkSoft,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 4,
  },
  debugContainer: {
    marginTop: 14,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  debugTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.ink,
    marginBottom: 4,
  },
  debugItem: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.inkSoft,
    lineHeight: 14,
  },
});
