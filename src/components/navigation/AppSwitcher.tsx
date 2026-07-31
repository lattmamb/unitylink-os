import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CarFront, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLastFleetRoute, getLastOSRoute } from "@/hooks/useLastVisitedRoutes";

export default function AppSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFleet = ["/fleet", "/rentals", "/booking", "/on-demand", "/charging-stations"].some((route) => location.pathname.startsWith(route));
  const lastKey = useRef<{ key: string; time: number } | null>(null);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === "o" || key === "f")) {
        event.preventDefault(); navigate(key === "f" ? getLastFleetRoute() : getLastOSRoute()); return;
      }
      if (key === "g") lastKey.current = { key, time: Date.now() };
      if ((key === "o" || key === "f") && lastKey.current && Date.now() - lastKey.current.time < 600) {
        event.preventDefault(); navigate(key === "f" ? getLastFleetRoute() : getLastOSRoute()); lastKey.current = null;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
  return <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] p-1 backdrop-blur-xl">
    <Button asChild variant="ghost" size="sm" className={`rounded-full px-3 ${!isFleet ? "bg-white/10 text-cyan-200" : "text-white/45"}`}><Link to={getLastOSRoute()}><Layers3 className="mr-1.5 h-4 w-4"/>OS</Link></Button>
    <Button asChild variant="ghost" size="sm" className={`rounded-full px-3 ${isFleet ? "bg-white/10 text-cyan-200" : "text-white/45"}`}><Link to={getLastFleetRoute()}><CarFront className="mr-1.5 h-4 w-4"/>Fleet</Link></Button>
  </div>;
}
