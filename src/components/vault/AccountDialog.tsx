import { Cloud, LoaderCircle, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type SyncStatus, useCloud } from "@/lib/cloud";

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: "не подключено",
  syncing: "синхронизация…",
  synced: "всё синхронизировано",
  error: "ошибка синхронизации",
};

function AuthForm({ mode, onDone }: { mode: "in" | "up"; onDone: () => void }) {
  const { signIn, signUp } = useCloud();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err =
      mode === "in"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success(
      mode === "in"
        ? "С возвращением! Заметки синхронизируются."
        : "Аккаунт создан! Заметки теперь в облаке.",
    );
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 pt-1">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`email-${mode}`}>Email</Label>
        <Input
          id={`email-${mode}`}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`password-${mode}`}>Пароль</Label>
        <Input
          id={`password-${mode}`}
          type="password"
          required
          minLength={6}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          placeholder="минимум 6 символов"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="mt-1">
        {busy && <LoaderCircle className="size-4 animate-spin" />}
        {mode === "in" ? "Войти" : "Создать аккаунт"}
      </Button>
    </form>
  );
}

export function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, syncStatus, signOut } = useCloud();

  if (user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="size-5 text-primary" /> Облако подключено
            </DialogTitle>
            <DialogDescription>
              Заметки и задачи автоматически сохраняются в облако и доступны с
              любого устройства после входа.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm">
            <div className="font-medium">{user.email}</div>
            <div className="text-muted-foreground">
              Статус: {STATUS_LABEL[syncStatus]}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              toast(
                "Ты вышел из аккаунта. Заметки остались на этом устройстве.",
              );
              onOpenChange(false);
            }}
          >
            <LogOut className="size-4" /> Выйти
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="size-5 text-primary" /> Облачная синхронизация
          </DialogTitle>
          <DialogDescription>
            Войди, чтобы заметки сохранялись в облаке и синхронизировались между
            устройствами. Без входа всё работает локально в браузере.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="in">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">Вход</TabsTrigger>
            <TabsTrigger value="up">Регистрация</TabsTrigger>
          </TabsList>
          <TabsContent value="in">
            <AuthForm mode="in" onDone={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="up">
            <AuthForm mode="up" onDone={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
