import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDirtyGuard } from "@/ui/hooks/use-dirty-guard";
import { countLabel, TableSkeleton } from "@/ui/components/table-skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Copy,
  Download,
  Ellipsis,
  Eye,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import {
  useChallans,
  type Challan,
  type ChallanItem,
  type ChallanInput,
  type ChallanType,
} from "@/store/challans";
import { ChallanDocument } from "@/ui/components/challan-document";
import { RecipeLinkButton } from "@/ui/components/recipe-detail";
import { printPage } from "@/lib/platform";
import { useMasters } from "@/store/masters";
import { friendlyError } from "@/ui/lib/errors";
import { api, ApiError } from "@/lib/api";
import { toastError, toastSuccess } from "@/store/toast";
import { AppShell } from "@/ui/components/app-shell";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/components/ui/card";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { DatePicker } from "@/ui/components/ui/date-picker";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/ui/components/ui/input-group";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/ui/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Textarea } from "@/ui/components/ui/textarea";
import { Badge } from "@/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Skeleton } from "@/ui/components/motion";
import { useConfirm } from "@/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/components/ui/dialog";
import { EASE } from "@/ui/lib/motion";
import { fmtBoxes, fmtWt, todayLocal } from "@/ui/lib/format";
import { type ChallanKind } from "./challans-shared";

export function ChallanPrintRoute({ kind }: { kind: ChallanKind }) {
  const { id } = useParams();
  const { detail, load, clearDetail } = useChallans();
  const company = useAuth((s) => s.company);
  const printed = useRef(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadError(false);
    void load(id).catch(() => setLoadError(true));
  }, [id, load]);

  useEffect(() => clearDetail, [clearDetail]);

  useEffect(() => {
    if (detail && !printed.current) {
      printed.current = true;
      const t = setTimeout(() => void printPage(kind.singular), 350);
      return () => clearTimeout(t);
    }
  }, [detail, kind.singular]);

  if (loadError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        Couldn't load the challan. Check your connection.
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const { challan } = detail;

  return (
    <div className="min-h-dvh bg-muted p-4 print:bg-white print:p-0">
      <style>{`@page { size: 210mm 148mm; margin: 0; }
.challan-sheet { page-break-after: always; }
.challan-sheet:last-child { page-break-after: auto; }`}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to={`${kind.listPath}/${challan.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        <Button onClick={() => void printPage(kind.singular)}>
          <Printer className="size-4" aria-hidden />
          Print / Save as PDF
        </Button>
      </div>

      <div className="flex flex-col items-center gap-6 print:gap-0">
        <ChallanDocument detail={detail} company={company} type={kind.type} />
      </div>
    </div>
  );
}

// ── Sales exports (M6, unchanged API) ────────────────────────────────────────
