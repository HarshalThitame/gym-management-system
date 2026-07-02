"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Smartphone, Mail, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { verifyTwoFactorAction, sendEmailVerificationCodeAction } from "../actions/two-factor-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage, FieldError } from "@/features/auth/components/form-message";

type TwoFactorVerifyProps = {
  availableMethods: string[];
  nextPath: string;
};

export function TwoFactorVerify({ availableMethods, nextPath }: TwoFactorVerifyProps) {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<string>(availableMethods[0] ?? "totp");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [verifyState, verifyAction, verifyPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await verifyTwoFactorAction(prevState, formData);
      if (result.status === "success") {
        router.push(nextPath);
      }
      return result;
    },
    initialAuthActionState
  );

  const [emailState, emailAction] = useActionState(sendEmailVerificationCodeAction, initialAuthActionState);

  const handleEmailCode = async () => {
    const result = await emailAction(initialAuthActionState);
    if (result.status === "success") {
      setEmailSent(true);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 rounded-full bg-accent/10 w-fit">
          <Shield className="size-8 text-accent" />
        </div>
        <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
        <CardDescription>
          {isRecoveryMode
            ? "Enter one of your recovery codes to access your account"
            : "Enter the verification code from your authenticator app"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isRecoveryMode ? (
          <>
            {/* Method Selection */}
            {availableMethods.length > 1 && (
              <div className="flex gap-2 mb-4">
                {availableMethods.map((method) => (
                  <Button
                    key={method}
                    variant={selectedMethod === method ? "accent" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedMethod(method)}
                    className="flex-1"
                  >
                    {method === "totp" && <Smartphone className="size-4 mr-2" />}
                    {method === "email" && <Mail className="size-4 mr-2" />}
                    {method === "totp" ? "Authenticator" : "Email"}
                  </Button>
                ))}
              </div>
            )}

            {/* Email Code Request */}
            {selectedMethod === "email" && !emailSent && (
              <Button
                variant="secondary"
                className="w-full mb-4"
                onClick={handleEmailCode}
              >
                <Mail className="size-4 mr-2" />
                Send Code to Email
              </Button>
            )}

            {/* Verification Form */}
            <form action={verifyAction} className="space-y-4">
              <input type="hidden" name="method" value={selectedMethod} />
              <input type="hidden" name="isRecovery" value="false" />

              <div className="space-y-2">
                <Input
                  type="text"
                  name="token"
                  placeholder={selectedMethod === "email" ? "Enter 6-digit code" : "Enter 6-digit code"}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  autoFocus
                  className="text-center text-2xl tracking-widest"
                />
                <FieldError message={verifyState.fieldErrors?.token?.[0]} />
              </div>

              <Button type="submit" className="w-full" disabled={verifyPending}>
                {verifyPending ? "Verifying..." : "Verify"}
              </Button>

              <FormMessage state={verifyState} />
            </form>

            {/* Recovery Mode Toggle */}
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRecoveryMode(true)}
                className="text-muted-foreground"
              >
                <Key className="size-4 mr-2" />
                Use recovery code instead
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Recovery Code Form */}
            <form action={verifyAction} className="space-y-4">
              <input type="hidden" name="method" value="totp" />
              <input type="hidden" name="isRecovery" value="true" />

              <div className="space-y-2">
                <Input
                  type="text"
                  name="token"
                  placeholder="Enter recovery code (e.g., ABCDE-FGHIJ)"
                  required
                  autoFocus
                  className="text-center font-mono uppercase"
                />
                <FieldError message={verifyState.fieldErrors?.token?.[0]} />
              </div>

              <Button type="submit" className="w-full" disabled={verifyPending}>
                {verifyPending ? "Verifying..." : "Verify Recovery Code"}
              </Button>

              <FormMessage state={verifyState} />
            </form>

            {/* Back to Normal Mode */}
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRecoveryMode(false)}
                className="text-muted-foreground"
              >
                Back to authenticator code
              </Button>
            </div>
          </>
        )}

        {/* Help Text */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Having trouble? Contact support if you&apos;ve lost access to your authenticator device and recovery codes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
