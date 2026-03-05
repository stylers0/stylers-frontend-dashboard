import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SidebarTrigger } from "./ui/sidebar";

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (login(password)) {
      setPassword("");
      setAttempts(0);
    } else {
      setError("Incorrect PIN. Please try again.");
      setAttempts((prev) => prev + 1);
      setPassword("");
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Activity className="w-12 h-12 text-primary" />
            <span className="text-[32px] font-bold">Stylers</span>
          </div>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>

          <CardTitle className="text-2xl text-center">
            Access Required
          </CardTitle>
          <CardDescription className="text-center">
            Enter the Password to access the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-center text-xl tracking-widest h-12"
                // maxLength={4}
                // pattern="[0-9]*"
                // inputMode="numeric"
                autoFocus
              />
              {attempts > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Attempts: {attempts}
                </p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full h-11">
              Unlock Access
            </Button>

            {/* <div className="text-center text-sm text-muted-foreground pt-4 border-t">
              <p>Hint: The PIN is 4 digits</p>
            </div> */}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthGuard;
