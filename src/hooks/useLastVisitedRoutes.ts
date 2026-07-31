import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const getLastOSRoute = () => localStorage.getItem("lastOSRoute") || "/os";
export const getLastFleetRoute = () => localStorage.getItem("lastFleetRoute") || "/fleet";

export function useLastVisitedRoutes() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    const fleetRoutes = ["/fleet", "/rentals", "/booking", "/on-demand", "/charging-stations"];
    if (fleetRoutes.some((route) => path.startsWith(route))) {
      localStorage.setItem("lastFleetRoute", path);
      return;
    }
    localStorage.setItem("lastOSRoute", path);
  }, [location]);
}
